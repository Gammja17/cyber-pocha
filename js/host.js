// 방장 브라우저에서 돌아가는 "서버". 방장이 나가면 다른 사람이 스냅샷으로 이어받음.
const MAX_MEMBERS = 6;
const TABLE_SLOTS = 12;
const VOTE_MS = 20000;
const TOAST_MS = 3500;
const SMOKE_MS = 20000;
const STORE_TRIP_MS = 7000;
const CAT_EVERY_MS = new URLSearchParams(location.search).has('catfast') ? [4000, 6000] : [60000, 150000]; // ?catfast 붙이면 테스트용
const CAT_STAY_MS = 15000;
const CAT_MAX_MS = 40000;
const CAT_OUT_MS = 4600; // 클라 퇴장 애니메이션 길이 (scene.js와 맞춤)
const SEAT_ORDER = [0, 3, 1, 4, 2, 5]; // 2명이면 마주보게, 그다음부터 사이사이
const SIP_DRUNK = 0.06;
const SHOT_DRUNK = 0.15; // 짠 원샷 (잔 가득 기준)
const FAST_DRINKS = 3; // 1분에 이보다 많이 마시면 1.5배
const SOBER_STEP = 0.01; // 10초마다 깨는 양
const BLACKOUT_MS = 3000;
const COLORS = ['#e4572e', '#4c9be8', '#f3c13a', '#5fbf6a', '#b06ad9', '#ef7fb0'];

export class PochaHost {
  // out: { toAll(ev, data), toPeer(id, ev, data) }
  constructor(menu, code, out, snap = null) {
    this.MENU = menu;
    this.out = out;
    this.alive = true;
    this.room = snap ? restore(snap) : {
      code, venue: 'pocha', round: 1, members: {}, items: [], glasses: {}, ledger: [],
      vote: null, toast: null, cat: null, history: [{ round: 1, venue: 'pocha' }], startedAt: Date.now(), nextItemId: 1, drinks: {},
    };
    if (snap) {
      // 이어받을 때: 진행 중이던 타이머는 사라졌으니 정리
      if (this.room.vote) this.room.vote.timer = setTimeout(() => this.resolveVote(), Math.max(0, this.room.vote.endsAt - Date.now()) + 50);
      this.scheduleCat();
    }
    // 시간 지나면 술이 깸
    this.soberTimer = setInterval(() => {
      let changed = false;
      for (const m of Object.values(this.room.members)) {
        if (m.drunk > 0 && !m.blackout) { m.drunk = Math.max(0, +(m.drunk - SOBER_STEP).toFixed(3)); changed = true; }
      }
      if (changed) this.broadcast();
    }, 10000);
  }

  stop() {
    this.alive = false;
    clearInterval(this.soberTimer);
    clearTimeout(this.room.catTimer);
    if (this.room.vote) clearTimeout(this.room.vote.timer);
  }

  snapshot() {
    const r = this.room;
    return {
      code: r.code, venue: r.venue, round: r.round, members: r.members, items: r.items, glasses: r.glasses,
      ledger: r.ledger, history: r.history, startedAt: r.startedAt, nextItemId: r.nextItemId, drinks: r.drinks,
      vote: r.vote && { ...r.vote, timer: undefined },
    };
  }

  publicState() {
    const room = this.room, now = Date.now();
    return {
      code: room.code,
      venue: room.venue,
      round: room.round,
      members: Object.values(room.members),
      items: room.items,
      glasses: room.glasses,
      vote: room.vote && {
        type: room.vote.type, target: room.vote.target, by: room.vote.by,
        byName: room.vote.byName, answers: room.vote.answers, left: room.vote.endsAt - now,
      },
      toast: room.toast && { by: room.toast.by, joined: room.toast.joined },
      cat: room.cat && {
        id: room.cat.id, angle: room.cat.angle, itemId: room.cat.itemId,
        age: now - room.cat.startedAt, left: room.cat.until - now,
      },
    };
  }

  broadcast() { if (this.alive) this.out.toAll('state', this.publicState()); }
  fx(data) { if (this.alive) this.out.toAll('fx', data); }
  defOf(item) { return this.MENU[this.room.venue].items.find((d) => d.key === item.key); }
  freeSlots() {
    const used = new Set(this.room.items.map((i) => i.slot));
    return [...Array(TABLE_SLOTS).keys()].filter((s) => !used.has(s));
  }
  later(ms, fn) { return setTimeout(() => this.alive && fn(), ms); }

  // ---------- 편의점 길고양이 ----------
  scheduleCat() {
    const room = this.room;
    clearTimeout(room.catTimer);
    room.cat = null;
    if (room.venue !== 'store') return;
    const [min, max] = CAT_EVERY_MS;
    room.catTimer = this.later(min + Math.random() * (max - min), () => this.spawnCat());
  }

  spawnCat() {
    const room = this.room;
    if (room.venue !== 'store') return;
    const now = Date.now();
    const snack = room.items.find((i) => this.defOf(i).kind === 'food');
    // 의자 사이 틈으로 들어옴 (k=0 쪽은 파라솔 기둥이라 제외)
    const cat = {
      id: now, angle: (1 + Math.floor(Math.random() * 5) + 0.5) * (Math.PI / 3),
      itemId: snack ? snack.id : null, startedAt: now, until: now + CAT_STAY_MS,
    };
    room.cat = cat;
    this.fx({ type: 'cat_come' });
    this.broadcast();

    const leaveCheck = () => {
      if (room.cat !== cat) return;
      const wait = cat.until - Date.now();
      if (wait > 0) { room.catTimer = this.later(wait, leaveCheck); return; }
      this.fx({ type: 'cat_leave' });
      room.catTimer = this.later(CAT_OUT_MS, () => {
        if (room.cat !== cat) return;
        this.scheduleCat();
        this.broadcast();
      });
    };
    // 테이블에 올라가서 잠시 뒤 안주 한입 슬쩍 (장부엔 안 들어감)
    room.catTimer = this.later(6000, () => {
      if (room.cat !== cat) return;
      const item = room.items.find((i) => i.id === cat.itemId);
      if (item) {
        item.left -= 1;
        if (item.left <= 0) room.items = room.items.filter((i) => i !== item);
        this.fx({ type: 'cat_steal', item: this.defOf(item).name, itemId: item.id });
        this.broadcast();
      }
      leaveCheck();
    });
  }

  // 메뉴를 테이블에 올리고 장부에 기록 (실제로 받은 시점에 계산)
  serve(defs, member) {
    const room = this.room;
    const slots = this.freeSlots();
    const served = [];
    for (const def of defs) {
      const slot = slots.shift();
      if (slot === undefined) break;
      room.items.push({ id: room.nextItemId++, key: def.key, slot, left: def.servings });
      room.ledger.push({ round: room.round, venue: room.venue, name: def.name, price: def.price, by: member.name });
      served.push(def.name);
    }
    return served;
  }

  resolveVote() {
    const room = this.room;
    const v = room.vote;
    if (!v) return;
    const ids = Object.keys(room.members);
    const rejected = ids.some((id) => v.answers[id] === false);
    const allYes = ids.every((id) => v.answers[id] === true);
    if (!rejected && !allYes && Date.now() < v.endsAt) return;

    clearTimeout(v.timer);
    room.vote = null;
    const passed = allYes && !rejected;
    this.fx({ type: 'vote_result', passed, vote: v.type, target: v.target });

    if (passed && v.type === 'move') {
      room.venue = v.target;
      room.round += 1;
      room.items = [];
      room.glasses = {};
      room.toast = null;
      room.history.push({ round: room.round, venue: room.venue });
      for (const m of Object.values(room.members)) { m.away = null; m.smoking = false; }
      this.scheduleCat();
      this.fx({ type: 'moved', venue: room.venue, round: room.round });
    }
    if (passed && v.type === 'end') {
      this.out.toAll('receipt', {
        ledger: room.ledger,
        history: room.history,
        members: Object.values(room.members).map((m) => m.name),
        drinks: room.drinks,
        startedAt: room.startedAt,
        endedAt: Date.now(),
      });
      this.stop();
      return;
    }
    this.broadcast();
  }

  // ---------- 취기 ----------
  drink(id, amount, glasses) {
    const room = this.room;
    const m = room.members[id];
    if (!m || amount <= 0) return;
    const now = Date.now();
    m.recent = (m.recent || []).filter((t) => now - t < 60000);
    m.recent.push(now);
    const fast = m.recent.length > FAST_DRINKS ? 1.5 : 1; // 빨리 마시면 더 취함
    m.drunk = Math.min(1, (m.drunk || 0) + amount * fast);
    room.drinks[m.name] = +((room.drinks[m.name] || 0) + glasses).toFixed(2);
    if (m.drunk >= 1 && !m.blackout) this.blackout(m);
  }

  blackout(m) {
    m.blackout = true;
    this.fx({ type: 'blackout', id: m.id, name: m.name });
    this.later(BLACKOUT_MS, () => {
      if (!this.room.members[m.id]) return;
      m.blackout = false;
      m.drunk = 0.7; // 정신 차림 (아직 취함)
      this.fx({ type: 'wake', id: m.id, name: m.name });
      this.broadcast();
    });
  }

  // ---------- 손님 요청 처리 ----------
  handle(id, ev, data) {
    if (!this.alive) return;
    const room = this.room;
    if (ev === 'join') return this.join(id, data);
    const me = room.members[id];
    if (!me) return;

    switch (ev) {
      case 'chat': {
        const text = String(data || '').trim().slice(0, 200);
        if (text) this.out.toAll('chat', { id, name: me.name, text });
        break;
      }
      case 'order': {
        const keys = data;
        if (!Array.isArray(keys) || !keys.length || keys.length > 10 || me.away) return;
        const menu = this.MENU[room.venue].items;
        const defs = keys.map((k) => menu.find((i) => i.key === k)).filter(Boolean);
        if (!defs.length) return;
        if (this.freeSlots().length < defs.length) return this.out.toPeer(id, 'notice', '테이블이 꽉 찼어요! 좀 먹고 시키자');
        const round = room.round;
        const names = defs.map((d) => d.name);
        if (room.venue === 'store') {
          me.away = 'store';
          this.fx({ type: 'store_go', id, name: me.name, names });
          this.broadcast();
          this.later(STORE_TRIP_MS, () => {
            if (!room.members[id] || room.round !== round) return;
            me.away = null;
            const served = this.serve(defs, me);
            this.fx({ type: 'store_back', id, name: me.name, names: served });
            this.broadcast();
          });
        } else {
          this.fx({ type: 'ordered', id, name: me.name, names });
          this.later(3000 + Math.random() * 3000, () => {
            if (!room.members[id] || room.round !== round) return;
            const served = this.serve(defs, me);
            if (!served.length) return;
            this.fx({ type: 'served', names: served });
            this.broadcast();
          });
        }
        break;
      }
      case 'take': { // 음식 한입 / 술 따르기
        if (me.away) return;
        const item = room.items.find((i) => i.id === data);
        if (!item) return;
        const def = this.defOf(item);
        item.left -= 1;
        if (item.left <= 0) room.items = room.items.filter((i) => i !== item);
        if (def.kind === 'drink') {
          room.glasses[id] = { fill: 1, color: def.liquid };
          this.fx({ type: 'pour', id, name: me.name, item: def.name, model: def.model });
        } else {
          this.fx({ type: 'bite', id, name: me.name, item: def.name, itemId: data, empty: item.left <= 0 });
        }
        this.broadcast();
        break;
      }
      case 'sip': {
        const g = room.glasses[id];
        if (!g || g.fill <= 0 || me.away) return;
        const sipped = Math.min(g.fill, 0.34);
        g.fill = Math.max(0, +(g.fill - 0.34).toFixed(2));
        this.drink(id, SIP_DRUNK * (sipped / 0.34), sipped);
        this.fx({ type: 'sip', id });
        this.broadcast();
        break;
      }
      case 'toast': {
        if (me.away) return;
        if (room.toast) {
          if (!room.toast.joined.includes(id)) room.toast.joined.push(id);
          return this.broadcast();
        }
        const toast = { by: me.name, joined: [id] };
        room.toast = toast;
        this.fx({ type: 'toast_start', name: me.name });
        this.broadcast();
        this.later(TOAST_MS, () => {
          if (room.toast !== toast) return;
          room.toast = null;
          const joined = toast.joined.filter((pid) => room.members[pid]);
          for (const pid of joined) {
            const g = room.glasses[pid];
            if (!g) continue;
            this.drink(pid, SHOT_DRUNK * g.fill, g.fill); // 원샷
            g.fill = 0;
          }
          this.fx({ type: 'cheers', ids: joined });
          this.broadcast();
        });
        break;
      }
      case 'smoke': {
        if (me.smoking || me.away) return;
        me.smoking = true;
        if (room.venue === 'pub') me.away = 'smoke'; // 실내 금연 - 밖에 나가서
        this.fx({ type: 'smoke', id, name: me.name, outside: room.venue === 'pub' });
        this.broadcast();
        const round = room.round;
        this.later(SMOKE_MS, () => {
          if (!room.members[id] || room.round !== round) return;
          me.smoking = false;
          if (me.away === 'smoke') me.away = null;
          this.fx({ type: 'smoke_end', id, name: me.name });
          this.broadcast();
        });
        break;
      }
      case 'pet': {
        const cat = room.cat;
        if (!cat || Date.now() >= cat.until) return;
        cat.until = Math.min(cat.startedAt + CAT_MAX_MS, cat.until + 3000); // 쓰다듬으면 더 머묾
        this.fx({ type: 'pet', name: me.name });
        this.broadcast();
        break;
      }
      case 'propose': {
        const { type, target } = data || {};
        if (room.vote) return;
        if (type === 'move' && (!this.MENU[target] || target === room.venue)) return;
        if (type !== 'move' && type !== 'end') return;
        room.vote = {
          type, target: type === 'move' ? target : null, by: id, byName: me.name,
          answers: { [id]: true }, endsAt: Date.now() + VOTE_MS,
        };
        room.vote.timer = this.later(VOTE_MS + 50, () => this.resolveVote());
        this.broadcast();
        this.resolveVote();
        break;
      }
      case 'vote': {
        if (!room.vote) return;
        room.vote.answers[id] = !!data;
        this.broadcast();
        this.resolveVote();
        break;
      }
    }
  }

  join(id, data) {
    const room = this.room;
    if (room.members[id]) { // 방장 교대 후 다시 인사한 경우
      this.out.toPeer(id, 'joined', { id, code: room.code });
      return this.broadcast();
    }
    const name = String(data?.name || '').trim().slice(0, 12) || '익명';
    const taken = new Set(Object.values(room.members).map((m) => m.seat));
    const seat = SEAT_ORDER.find((s) => !taken.has(s));
    if (seat === undefined || Object.keys(room.members).length >= MAX_MEMBERS) return this.out.toPeer(id, 'notice', '자리가 꽉 찼어요 (최대 6명)');
    room.members[id] = { id, name, seat, color: COLORS[seat], away: null, smoking: false, drunk: 0, blackout: false };
    this.out.toPeer(id, 'joined', { id, code: room.code });
    this.fx({ type: 'join', id, name });
    this.broadcast();
  }

  leave(id) {
    const room = this.room;
    const me = room.members[id];
    if (!me) return;
    delete room.members[id];
    delete room.glasses[id];
    this.fx({ type: 'leave', id, name: me.name });
    if (room.vote) { delete room.vote.answers[id]; this.resolveVote(); }
    this.broadcast();
  }
}

function restore(snap) {
  const room = structuredClone(snap);
  room.toast = null;
  room.cat = null;
  for (const m of Object.values(room.members)) { m.away = null; m.smoking = false; m.blackout = false; }
  room.drinks ||= {};
  return room;
}
