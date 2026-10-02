import * as THREE from 'three';
import { buildVenue, TABLE_H } from './venues.js';
import { makeAvatar, makeGlass, makeItem, makeTextSprite, makeCat, cyl, mesh } from './models.js';

const SEAT_R = 1.1;
const GLASS_R = 0.52;
const EYE_Y = 1.13;
const BASE_PITCH = -0.22;
const SLOTS = [
  ...Array.from({ length: 8 }, (_, i) => [0.31, (i / 8) * Math.PI * 2 + Math.PI / 8]),
  ...Array.from({ length: 4 }, (_, i) => [0.11, (i / 4) * Math.PI * 2]),
];

const seatAngle = (seat) => (seat / 6) * Math.PI * 2;
const STATUS = { store: '🏪 편의점 가는 중…', smoke: '🚬 밖에서 한대 중…' };

export class BarScene {
  constructor(container, menu, { onItem, onGlass, onCat }) {
    this.menu = menu;
    this.onItem = onItem;
    this.onGlass = onGlass;
    this.onCat = onCat;
    this.cat = null;
    this.hearts = [];
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.03, 120);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.yaw = 0;
    this.pitch = 0;
    this.myId = null;
    this.mySeat = 0;
    this.venueKey = null;
    this.avatars = new Map();
    this.items = new Map();
    this.glasses = new Map();
    this.seats = [];
    this.anims = [];
    this.talk = new Map();
    this.smokers = [];
    this.particles = [];
    this.raycaster = new THREE.Raycaster();

    // 1인칭 담배 (화면 오른쪽 아래)
    this.myCig = new THREE.Group();
    this.myCig.add(cyl(0.006, 0.006, 0.09, '#f4f1ea', 0, 0, 0, 6));
    this.myCigTip = mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.01, 6), new THREE.MeshBasicMaterial({ color: '#ff5a1a' }), 0, 0.05, 0);
    this.myCig.add(this.myCigTip);
    this.myCig.position.set(0.1, -0.13, -0.42);
    this.myCig.rotation.set(-1.3, 0, -0.9);
    this.myCig.scale.setScalar(0.7);
    this.myCig.visible = false;
    this.camera.add(this.myCig);

    this.smokeTex = makeSmokeTexture();
    this.heartTex = makeEmojiTexture('💗');
    this.setupInput();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.renderer.domElement.parentElement;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------- 입력 ----------------
  setupInput() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, moved: false };
      try { el.setPointerCapture(e.pointerId); } catch {}
    });
    el.addEventListener('pointermove', (e) => {
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) < 6) return;
        down.moved = true;
        this.yaw = THREE.MathUtils.clamp(this.yaw - dx * 0.005, -1.9, 1.9);
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.005, -0.9, 0.7);
        down.x = e.clientX;
        down.y = e.clientY;
      } else {
        el.style.cursor = this.pick(e) ? 'pointer' : 'grab';
      }
    });
    el.addEventListener('pointerup', (e) => {
      if (down && !down.moved) {
        const hit = this.pick(e);
        if (hit?.itemId) this.onItem(hit.itemId);
        if (hit?.glass) this.onGlass();
        if (hit?.cat) this.onCat();
      }
      down = null;
    });
  }

  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets = [...this.items.values()].map((i) => i.hit);
    const myGlass = this.glasses.get(this.myId);
    if (myGlass) targets.push(myGlass.hit);
    if (this.cat) targets.push(this.cat.hit);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    if (myGlass && hit.object === myGlass.hit) return { glass: true };
    if (this.cat && hit.object === this.cat.hit) return { cat: true };
    for (const [id, item] of this.items) if (item.hit === hit.object) return { itemId: id };
    return null;
  }

  // ---------------- 장소 ----------------
  setVenue(key) {
    if (this.venue) this.scene.remove(this.venue.group);
    this.venueKey = key;
    this.venue = buildVenue(key);
    this.scene.add(this.venue.group);
    this.scene.background = new THREE.Color(this.venue.background);
    this.scene.fog = new THREE.Fog(...this.venue.fog);
    this.seats.forEach((s) => this.scene.remove(s));
    this.seats = Array.from({ length: 6 }, (_, i) => {
      const s = this.venue.seat();
      const a = seatAngle(i);
      s.position.set(Math.sin(a) * SEAT_R, 0, Math.cos(a) * SEAT_R);
      s.rotation.y = a;
      this.scene.add(s);
      return s;
    });
    for (const item of this.items.values()) this.scene.remove(item);
    this.items.clear();
    this.occ = null;
    this.yaw = 0;
    this.pitch = 0;
  }

  // ---------------- 상태 동기화 ----------------
  setState(state, myId) {
    this.myId = myId;
    if (state.venue !== this.venueKey) this.setVenue(state.venue);
    const defs = this.menu[state.venue].items;
    const me = state.members.find((m) => m.id === myId);
    if (me) this.mySeat = me.seat;

    // 사람
    const present = new Set();
    for (const m of state.members) {
      present.add(m.id);
      if (m.id === myId) continue;
      let av = this.avatars.get(m.id);
      if (!av) {
        av = makeAvatar(m.color, m.seat / 6 + 0.13);
        av.label = makeTextSprite({ font: 30 });
        av.label.position.y = 1.36;
        av.group.add(av.label);
        av.bubble = makeTextSprite({ bg: 'rgba(255,255,255,0.95)', fg: '#111', font: 30, maxWidth: 420, tail: true });
        av.bubble.position.y = 1.5;
        av.bubble.visible = false;
        av.group.add(av.bubble);
        av.lastLabel = '';
        this.scene.add(av.group);
        this.avatars.set(m.id, av);
      }
      const a = seatAngle(m.seat);
      av.group.position.set(Math.sin(a) * (SEAT_R + 0.03), 0, Math.cos(a) * (SEAT_R + 0.03));
      av.group.rotation.y = a;
      const away = !!m.away;
      av.group.children.forEach((c) => { if (c !== av.label && c !== av.bubble) c.visible = !away; });
      const labelText = away ? `${m.name} ${STATUS[m.away]}` : m.name;
      if (labelText !== av.lastLabel) { av.label.setText(labelText); av.lastLabel = labelText; }
      av.cig.visible = m.smoking && !away;
      av.smoking = av.cig.visible;
    }
    for (const [id, av] of this.avatars) {
      if (!present.has(id)) { this.scene.remove(av.group); this.avatars.delete(id); }
    }
    this.myCig.visible = !!(me && me.smoking && !me.away);
    this.updateCamera();

    // 앉거나 일어나면 의자가 뒤로 쓱 밀림 (크르륵)
    const occ = Array(6).fill('');
    for (const m of state.members) occ[m.seat] = m.id + (m.away ? '-away' : '');
    if (this.occ) occ.forEach((o, i) => o !== this.occ[i] && this.slideChair(i));
    this.occ = occ;

    this.setCat(state.cat);

    // 잔
    for (const m of state.members) {
      let g = this.glasses.get(m.id);
      if (!g) { g = makeGlass(); this.scene.add(g); this.glasses.set(m.id, g); }
      if (!g.animating) g.position.copy(this.glassHome(m.seat));
      g.seat = m.seat;
      const st = state.glasses[m.id];
      g.setFill(st ? st.fill : 0, st && st.color);
    }
    for (const [id, g] of this.glasses) if (!present.has(id)) { this.scene.remove(g); this.glasses.delete(id); }

    // 테이블 위 음식
    const ids = new Set(state.items.map((i) => i.id));
    for (const it of state.items) {
      let obj = this.items.get(it.id);
      if (!obj) {
        const def = defs.find((d) => d.key === it.key);
        obj = makeItem(def);
        const [r, a] = SLOTS[it.slot];
        obj.position.set(Math.sin(a) * r, TABLE_H + 0.018, Math.cos(a) * r);
        obj.rotation.y = Math.random() * Math.PI;
        obj.scale.setScalar(0.01);
        this.tween(0.35, (t) => obj.scale.setScalar(Math.max(0.01, easeOutBack(t))));
        this.scene.add(obj);
        this.items.set(it.id, obj);
      }
      obj.setLeft(it.left);
    }
    for (const [id, obj] of this.items) if (!ids.has(id)) { this.scene.remove(obj); this.items.delete(id); }
  }

  glassHome(seat) {
    const a = seatAngle(seat) + 0.25;
    return new THREE.Vector3(Math.sin(a) * GLASS_R, TABLE_H + 0.018, Math.cos(a) * GLASS_R);
  }

  updateCamera() {
    const a = seatAngle(this.mySeat);
    this.camera.position.set(Math.sin(a) * (SEAT_R + 0.05), EYE_Y, Math.cos(a) * (SEAT_R + 0.05));
    this.camera.rotation.y = a + this.yaw;
    this.camera.rotation.x = BASE_PITCH + this.pitch;
  }

  // ---------------- 이펙트 ----------------
  remoteLook(id, yaw, pitch) {
    const av = this.avatars.get(id);
    if (av) av.look = { yaw: THREE.MathUtils.clamp(yaw, -1.3, 1.3), pitch: THREE.MathUtils.clamp(BASE_PITCH + pitch, -0.6, 0.5) };
  }

  showBubble(id, text) {
    const av = this.avatars.get(id);
    if (!av) return;
    av.bubble.setText(text);
    av.bubble.visible = true;
    clearTimeout(av.bubbleTimer);
    av.bubbleTimer = setTimeout(() => (av.bubble.visible = false), 4000 + text.length * 80);
  }

  setTalk(id, level) {
    this.talk.set(id, level);
  }

  bounceItem(itemId) {
    const obj = this.items.get(itemId);
    if (!obj) return;
    this.tween(0.25, (t) => obj.scale.setScalar(1 - Math.sin(t * Math.PI) * 0.15));
  }

  playCheers(ids) {
    const n = ids.length;
    ids.forEach((id, i) => {
      const g = this.glasses.get(id);
      if (!g) return;
      const home = this.glassHome(g.seat);
      const a = (i / Math.max(n, 1)) * Math.PI * 2;
      const meet = new THREE.Vector3(Math.sin(a) * 0.045, TABLE_H + 0.32, Math.cos(a) * 0.045);
      g.animating = true;
      this.tween(1.6, (t) => {
        const k = t < 0.3 ? easeInOut(t / 0.3) : t < 0.55 ? 1 : 1 - easeInOut((t - 0.55) / 0.45);
        g.position.lerpVectors(home, meet, k);
        g.rotation.z = t > 0.55 && t < 0.85 ? Math.sin(((t - 0.55) / 0.3) * Math.PI) * 0.9 : 0; // 원샷
        if (t >= 1) { g.animating = false; g.rotation.z = 0; }
      });
    });
  }

  slideChair(i) {
    const s = this.seats[i];
    if (!s) return;
    const a = seatAngle(i);
    const twist = (Math.random() - 0.5) * 0.4;
    this.tween(0.8, (t) => {
      const k = Math.sin(t * Math.PI);
      s.position.set(Math.sin(a) * (SEAT_R + k * 0.18), 0, Math.cos(a) * (SEAT_R + k * 0.18));
      s.rotation.y = a + k * twist;
    });
  }

  // ---------------- 길고양이 ----------------
  setCat(c) {
    if (!c) {
      if (this.cat) { this.scene.remove(this.cat.group); this.cat = null; }
      return;
    }
    if (!this.cat || this.cat.id !== c.id) {
      if (this.cat) this.scene.remove(this.cat.group);
      this.cat = makeCat(c.id);
      this.cat.id = c.id;
      this.cat.angle = c.angle;
      this.scene.add(this.cat.group);
    }
    const now = performance.now() / 1000;
    this.cat.start = now - c.age / 1000;
    this.cat.leaveAt = now + c.left / 1000;
    this.cat.itemId = c.itemId;
  }

  petCat() {
    if (!this.cat) return;
    this.cat.purrUntil = performance.now() / 1000 + 1.6;
    const p = new THREE.Vector3();
    this.cat.head.getWorldPosition(p);
    for (let i = 0; i < 3; i++) {
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.heartTex, transparent: true, depthWrite: false }));
      h.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.05 + i * 0.03, (Math.random() - 0.5) * 0.12));
      h.scale.setScalar(0.07);
      h.life = -i * 0.15;
      this.scene.add(h);
      this.hearts.push(h);
    }
  }

  updateCat(t) {
    const cat = this.cat;
    if (!cat) return;
    const now = performance.now() / 1000;
    const e = now - cat.start; // 등장 후 경과
    const L = cat.leaveAt - cat.start; // 떠나기 시작하는 시점
    const a = cat.angle;
    const FAR = 4.5, EDGE = 1.0, ON = 0.45;
    const place = (r, y) => cat.group.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    let walking = false;
    cat.body.rotation.x = 0;
    cat.body.position.y = 0;
    cat.head.rotation.set(0, 0, 0);

    if (e < 3) { // 걸어 들어옴
      place(THREE.MathUtils.lerp(FAR, EDGE, e / 3), 0);
      cat.group.rotation.y = a;
      walking = true;
    } else if (e < 3.6) { // 테이블로 점프
      const k = (e - 3) / 0.6;
      place(THREE.MathUtils.lerp(EDGE, ON, k), THREE.MathUtils.lerp(0, TABLE_H, k) + Math.sin(k * Math.PI) * 0.35);
      cat.group.rotation.y = a;
      cat.body.rotation.x = Math.sin(k * Math.PI) * 0.5;
    } else if (now < cat.leaveAt) { // 테이블 위에서 식빵/앉기
      place(ON, TABLE_H + 0.018);
      const item = this.items.get(cat.itemId);
      let yaw = a;
      if (item && e < 9) { // 안주 쳐다보기
        yaw = Math.atan2(cat.group.position.x - item.position.x, cat.group.position.z - item.position.z);
      }
      const diff = THREE.MathUtils.euclideanModulo(yaw - cat.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      cat.group.rotation.y += diff * 0.05;
      cat.body.rotation.x = 0.35; // 앞발 세우고 앉은 자세
      cat.body.position.y = -0.03;
      cat.head.rotation.y = Math.sin(t * 0.7) * 0.5;
      cat.head.rotation.x = -0.35;
    } else if (now < cat.leaveAt + 0.6) { // 뛰어내림
      const k = (now - cat.leaveAt) / 0.6;
      place(THREE.MathUtils.lerp(ON, EDGE, k), THREE.MathUtils.lerp(TABLE_H, 0, k) + Math.sin(k * Math.PI) * 0.25);
      cat.group.rotation.y = a + Math.PI;
      cat.body.position.y = 0;
    } else { // 총총 떠남
      const k = Math.min(1, (now - cat.leaveAt - 0.6) / 4);
      place(THREE.MathUtils.lerp(EDGE, FAR + 2, k), 0);
      cat.group.rotation.y = a + Math.PI;
      walking = true;
    }

    cat.legs.forEach((leg, i) => (leg.rotation.x = walking ? Math.sin(t * 12 + (i % 2 ? 0 : Math.PI) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 : 0));
    cat.tailSegs.forEach((s, i) => (s.rotation.z = Math.sin(t * 2.5 - i * 0.8) * 0.35));
    const purring = cat.purrUntil > now;
    cat.eyes.forEach((eye) => (eye.scale.y = purring ? 0.15 : 1));
    if (purring) cat.head.rotation.z = Math.sin(t * 6) * 0.15;
  }

  tween(duration, fn) {
    this.anims.push({ t: 0, duration, fn });
  }

  emitSmoke(pos) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, depthWrite: false, opacity: 0.5, color: '#cfcfd4' }));
    s.position.copy(pos);
    s.scale.setScalar(0.04);
    s.life = 0;
    s.vel = new THREE.Vector3((Math.random() - 0.5) * 0.04, 0.12 + Math.random() * 0.06, (Math.random() - 0.5) * 0.04);
    this.scene.add(s);
    this.particles.push(s);
  }

  // ---------------- 루프 ----------------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;
    this.updateCamera();
    this.venue?.update(t, dt);

    for (const [id, av] of this.avatars) {
      const look = av.look || { yaw: 0, pitch: BASE_PITCH };
      av.head.rotation.y += (look.yaw - av.head.rotation.y) * 0.15;
      av.head.rotation.x += (look.pitch - av.head.rotation.x) * 0.15;
      av.torso.rotation.y = av.head.rotation.y * 0.3;
      av.torso.scale.y = 1 + Math.sin(t * 2 + av.group.position.x) * 0.012;
      const lvl = this.talk.get(id) || 0;
      av.mouth.scale.y += (1 + lvl * 6 - av.mouth.scale.y) * 0.4;
      av.tip.material.color.setHSL(0.04, 1, 0.45 + Math.sin(t * 5) * 0.1);
    }

    // 담배 연기
    this.smokeAcc = (this.smokeAcc || 0) + dt;
    if (this.smokeAcc > 0.12) {
      this.smokeAcc = 0;
      const p = new THREE.Vector3();
      for (const av of this.avatars.values()) if (av.smoking) { av.tip.getWorldPosition(p); this.emitSmoke(p); }
      if (this.myCig.visible) { this.myCigTip.getWorldPosition(p); this.emitSmoke(p); }
    }
    this.particles = this.particles.filter((s) => {
      s.life += dt;
      s.position.addScaledVector(s.vel, dt);
      s.vel.x += Math.sin(t * 2 + s.id) * 0.002;
      s.scale.setScalar(0.04 + s.life * 0.12);
      s.material.opacity = Math.max(0, 0.45 * (1 - s.life / 2.6));
      if (s.life > 2.6) { this.scene.remove(s); s.material.dispose(); return false; }
      return true;
    });

    this.updateCat(t);
    this.hearts = this.hearts.filter((h) => {
      h.life += dt;
      if (h.life < 0) { h.visible = false; return true; }
      h.visible = true;
      h.position.y += dt * 0.15;
      h.material.opacity = Math.max(0, 1 - h.life / 1.4);
      if (h.life > 1.4) { this.scene.remove(h); h.material.dispose(); return false; }
      return true;
    });

    this.anims = this.anims.filter((a) => {
      a.t += dt;
      const k = Math.min(1, a.t / a.duration);
      a.fn(k);
      return k < 1;
    });

    this.renderer.render(this.scene, this.camera);
  }
}

function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeEmojiTexture(emoji) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 32, 36);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const easeInOut =(t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOutBack = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
