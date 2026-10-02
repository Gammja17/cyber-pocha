import { BarScene } from './scene.js';
import { AudioManager } from './audio.js';
import { Voice } from './voice.js';
import { Net } from './net.js';

const $ = (s) => document.querySelector(s);
const won = (n) => n.toLocaleString('ko-KR') + '원';
const VENUE_DESC = {
  pocha: '주황 천막, 백열전구, 옆 테이블 웃음소리',
  pub: '생맥주, 치킨, 시끄러운 호프집',
  store: '파라솔 아래, 귀뚜라미 소리, 조용한 밤',
};

const menu = await (await fetch('menu.json')).json();
const params = new URLSearchParams(location.search);
$('#roomInput').value = params.get('room') || '';
$('#nameInput').value = localStorage.getItem('pocha-name') || '';

let socket, scene, audio, voice;
let myId = null;
let state = null;
let cart = {};
let micOn = false;

// ===================== 입장 =====================
$('#joinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#joinBtn').disabled = true;
  const name = $('#nameInput').value.trim();
  try { localStorage.setItem('pocha-name', name); } catch {}

  audio = new AudioManager(); // 사용자 클릭 안에서 만들어야 소리가 남
  socket = new Net(menu);
  myId = socket.id;
  voice = new Voice(socket, audio.ctx, onLevel);
  micOn = await voice.initMic();
  updateMicBtn();

  $('#lobby').hidden = true;
  $('#app').hidden = false;
  scene = new BarScene($('#view'), menu, {
    onItem: (id) => socket.emit('take', id),
    onGlass: () => socket.emit('sip'),
    onCat: () => socket.emit('pet'),
  });

  // 방 코드: 비워두면 새 방 (내가 바로 방장)
  const typed = $('#roomInput').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const code = typed || makeCode();
  $('#roomCode').textContent = code;
  history.replaceState(null, '', `?room=${code}`);
  if (typed) banner('친구들 찾는 중… 🔎', 6000);

  bindSocket();
  socket.connect(code, !typed);
  socket.emit('join', { name });
});

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function bindSocket() {
  socket.on('joined', () => $('#banner').classList.remove('show'));
  socket.on('state', onState);
  socket.on('fx', onFx);
  socket.on('chat', ({ id, name, text }) => {
    addChat(name, text);
    scene.showBubble(id, text);
  });
  socket.on('look', ({ id, yaw, pitch }) => scene.remoteLook(id, yaw, pitch));
  socket.on('notice', (msg) => banner(msg));
  socket.on('receipt', showReceipt);

  // 내 시선 방향 공유 (마주보기)
  let last = '';
  setInterval(() => {
    const cur = `${scene.yaw.toFixed(2)},${scene.pitch.toFixed(2)}`;
    if (cur !== last) { last = cur; socket.emit('look', { yaw: scene.yaw, pitch: scene.pitch }); }
  }, 120);
}

// ===================== 상태 =====================
function onState(s) {
  const prevVenue = state?.venue;
  state = s;
  const me = s.members.find((m) => m.id === myId);
  if (s.venue !== prevVenue) {
    audio.setVenue(s.venue);
    $('#venueName').textContent = menu[s.venue].name;
    $('#orderBtn span').textContent = menu[s.venue].orderVerb;
    $('#orderBtn i').textContent = s.venue === 'store' ? '🏪' : '🍽️';
  }
  $('#roundTag').textContent = `${s.round}차`;
  scene.setState(s, myId);

  // 멤버 목록
  $('#memberList').innerHTML = s.members.map((m) => `
    <li data-id="${m.id}"><span class="dot" style="background:${m.color}"></span>${esc(m.name)}${m.id === myId ? ' (나)' : ''}
    ${m.away === 'store' ? '<span class="st">🏪</span>' : ''}${m.smoking ? '<span class="st">🚬</span>' : ''}</li>`).join('');

  // 버튼 상태
  const away = !!me?.away;
  $('#orderBtn').disabled = away;
  $('#smokeBtn').disabled = away || me?.smoking;
  $('#toastBtn').disabled = away;
  $('#moveBtn').disabled = !!s.vote;
  $('#endBtn').disabled = !!s.vote;
  $('#toastBtn').classList.toggle('pulse', !!s.toast && !s.toast.joined.includes(myId));

  $('#awayNote').textContent = me?.away === 'store' ? '🏪 편의점 들어가는 중… 띵동~' : me?.away === 'smoke' ? '🚬 밖에서 한대 피는 중… (실내 금연)' : '';
  $('#awayNote').classList.toggle('on', away);

  renderVote();
}

// ===================== 이벤트 연출 =====================
function onFx(f) {
  const P = audio.play.bind(audio);
  switch (f.type) {
    case 'join':
      P('chair_scrape', { volume: 0.7 });
      sys(`${f.name} 님이 앉았어요`);
      break;
    case 'leave':
      voice.remove(f.id);
      P('chair_scrape', { volume: 0.6, rate: 1.1 });
      sys(`${f.name} 님이 먼저 갔어요`);
      break;
    case 'ordered': {
      const call = state.venue === 'pub' ? '사장님~ 여기' : '이모~ 여기';
      P('call_bell', { volume: 0.6 });
      sys(`${f.name}: ${call} ${f.names.join(', ')} 주세요!`);
      break;
    }
    case 'served':
      P('serve', { volume: 0.8 });
      banner(`${f.names.join(', ')} 나왔습니다~`);
      break;
    case 'store_go':
      P('chair_scrape', { volume: 0.7 });
      P('footsteps', { volume: 0.5, delay: 0.6 });
      P('door_chime', { volume: 0.5, delay: 2.2 });
      sys(`${f.name} 님이 편의점 갔어요 (${f.names.join(', ')})`);
      break;
    case 'store_back':
      P('door_chime', { volume: 0.6 });
      P('plastic_bag', { volume: 0.8, delay: 0.8 });
      P('chair_scrape', { volume: 0.6, delay: 1.5 });
      banner(`${f.name}: 사왔다~ ${f.names.join(', ')}`);
      break;
    case 'bite':
      scene.bounceItem(f.itemId);
      P('bite', { volume: 0.7, rate: 0.9 + Math.random() * 0.25 });
      feed(`${f.name} · ${f.item} 한입 냠${f.empty ? ' (다 먹음!)' : ''}`);
      break;
    case 'pour':
      P(f.model === 'cans' ? 'can_open' : 'pour', { volume: 0.7 });
      feed(`${f.name} · ${f.item} 한잔 따름`);
      break;
    case 'sip':
      P('sip', { volume: 0.5 });
      break;
    case 'toast_start':
      banner(`${f.name}: 짠 하자!! 🍻 (3초 안에 짠 누르기)`, 3500);
      break;
    case 'cheers':
      scene.playCheers(f.ids);
      for (let i = 0; i < Math.max(1, f.ids.length - 1); i++) P('clink', { volume: 0.8, delay: 0.45 + i * 0.04, rate: 0.95 + Math.random() * 0.1 });
      banner(f.ids.length > 1 ? `짠!!! 🍻 (${f.ids.length}명)` : '혼자 짠… 🥲');
      break;
    case 'smoke':
      P('lighter', { volume: 0.8, delay: f.outside ? 1.5 : 0 });
      if (f.outside) P('chair_scrape', { volume: 0.6 });
      sys(f.outside ? `${f.name} 님 밖에 담배 피러 나감` : `${f.name} 님 한대 태우는 중`);
      break;
    case 'smoke_end':
      sys(`${f.name} 님 담배 끝`);
      break;
    case 'vote_result':
      if (!f.passed) banner(f.vote === 'move' ? '2차 무산… 다음에 가자' : '아직 더 마신다!');
      break;
    case 'moved':
      moveTransition(f);
      break;
    case 'blackout':
      feed(`${f.name} 님 필름 끊김 💫`);
      if (f.id === myId) {
        $('#blackout').textContent = '';
        $('#blackout').classList.add('on');
      }
      break;
    case 'wake':
      if (f.id === myId) {
        $('#blackout').textContent = '…어? 여기 어디';
        setTimeout(() => $('#blackout').classList.remove('on'), 1200);
      }
      break;
    case 'cat_come':
      P('meow', { volume: 0.6 });
      banner('🐈 길고양이가 왔다! (클릭해서 쓰다듬기)', 3500);
      break;
    case 'cat_steal':
      scene.bounceItem(f.itemId);
      P('meow', { volume: 0.5, rate: 1.2 });
      feed(`🐈 고양이가 ${f.item} 한입 슬쩍함 (계산 안 됨)`);
      break;
    case 'pet':
      scene.petCat();
      P('meow', { volume: 0.4, rate: 1.05 + Math.random() * 0.2 });
      feed(`${f.name} 님이 고양이 쓰다듬음 💗`);
      break;
    case 'cat_leave':
      feed('🐈 고양이가 총총 떠났다…');
      break;
  }
}

function moveTransition(f) {
  $('#fade').classList.add('on');
  audio.play('chair_scrape', { volume: 0.8 });
  audio.play('chair_scrape', { volume: 0.6, delay: 0.3, rate: 1.1 });
  audio.play('footsteps', { volume: 0.6, delay: 0.6 });
  setTimeout(() => {
    $('#fade').classList.remove('on');
    banner(`${f.round}차 · ${menu[f.venue].name} 도착!`, 3000);
    audio.play('chair_scrape', { volume: 0.5, delay: 0.2 });
  }, 1400);
}

function onLevel(id, level) {
  if (id === 'me') id = myId;
  else scene?.setTalk(id, level);
  document.querySelector(`#memberList li[data-id="${id}"]`)?.classList.toggle('talking', level > 0.08);
}

// ===================== 채팅 =====================
function addChat(name, text) {
  const d = document.createElement('div');
  d.innerHTML = `<b>${esc(name)}</b>${esc(text)}`;
  $('#chatLog').append(d);
  $('#chatLog').scrollTop = 1e9;
}
function sys(text) {
  const d = document.createElement('div');
  d.className = 'sys';
  d.textContent = text;
  $('#chatLog').append(d);
  $('#chatLog').scrollTop = 1e9;
}
$('#chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#chatInput').value.trim();
  if (v) socket.emit('chat', v);
  $('#chatInput').value = '';
});
addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement !== $('#chatInput') && !$('#app').hidden && !document.querySelector('.modal:not([hidden]) input')) {
    $('#chatInput').focus();
  }
  if (e.key === 'Escape') $('#chatInput').blur();
});

let bannerTimer;
function banner(text, ms = 2500) {
  $('#banner').textContent = text;
  $('#banner').classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => $('#banner').classList.remove('show'), ms);
}
function feed(text) {
  const d = document.createElement('div');
  d.textContent = text;
  $('#feed').append(d);
  setTimeout(() => d.remove(), 5000);
}

// ===================== 버튼 =====================
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => (b.closest('.modal').hidden = true)));

$('#orderBtn').addEventListener('click', () => {
  if (!state) return banner('아직 친구들 찾는 중… 잠깐만!'); // 방장 연결 전
  cart = {};
  $('#menuTitle').textContent = state.venue === 'store' ? '🏪 뭐 사올까?' : '🍽️ 메뉴판';
  $('#orderSubmit').textContent = state.venue === 'store' ? '사러 가기' : '주문하기';
  renderMenu();
  $('#menuModal').hidden = false;
});

function renderMenu() {
  const items = menu[state.venue].items;
  $('#menuList').innerHTML = items.map((it) => `
    <li><span class="nm">${it.name}</span><span class="pr">${won(it.price)}</span>
    <span class="qty"><button data-k="${it.key}" data-d="-1">−</button><b>${cart[it.key] || 0}</b><button data-k="${it.key}" data-d="1">+</button></span></li>`).join('');
  const keys = Object.entries(cart).filter(([, n]) => n > 0);
  const total = keys.reduce((s, [k, n]) => s + items.find((i) => i.key === k).price * n, 0);
  $('#cartText').textContent = keys.length ? keys.map(([k, n]) => `${items.find((i) => i.key === k).name}×${n}`).join(', ') : '담은 거 없음';
  $('#cartTotal').textContent = won(total);
  $('#orderSubmit').disabled = !keys.length;
}
$('#menuList').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const n = Math.max(0, Math.min(5, (cart[b.dataset.k] || 0) + +b.dataset.d));
  cart[b.dataset.k] = n;
  renderMenu();
});
$('#orderSubmit').addEventListener('click', () => {
  const keys = Object.entries(cart).flatMap(([k, n]) => Array(n).fill(k));
  if (keys.length) socket.emit('order', keys);
  $('#menuModal').hidden = true;
});

$('#toastBtn').addEventListener('click', () => socket.emit('toast'));
$('#smokeBtn').addEventListener('click', () => socket.emit('smoke'));

$('#moveBtn').addEventListener('click', () => {
  if (!state) return banner('아직 친구들 찾는 중… 잠깐만!');
  $('#venueChoices').innerHTML = Object.keys(menu).filter((k) => k !== state.venue)
    .map((k) => `<button data-v="${k}"><b>${menu[k].name}</b><span>${VENUE_DESC[k]}</span></button>`).join('');
  $('#moveModal').hidden = false;
});
$('#venueChoices').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  socket.emit('propose', { type: 'move', target: b.dataset.v });
  $('#moveModal').hidden = true;
});
$('#endBtn').addEventListener('click', () => socket.emit('propose', { type: 'end' }));

$('#micBtn').addEventListener('click', async () => {
  if (!voice.stream) {
    banner('마이크 권한이 없어요. 주소창 옆 🔒에서 허용 후 새로고침!', 4000);
    return;
  }
  micOn = !micOn;
  voice.setMuted(!micOn);
  updateMicBtn();
});
function updateMicBtn() {
  $('#micBtn').classList.toggle('off', !micOn);
  $('#micBtn span').textContent = micOn ? '마이크 ON' : '마이크 OFF';
}
$('#ambientVol').addEventListener('input', (e) => audio.setAmbient(+e.target.value));

$('#inviteBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); banner('초대 링크 복사 완료! 단톡방에 뿌려~'); } catch { banner(location.href, 5000); }
});

// ===================== 투표 =====================
let voteTick;
function renderVote() {
  const v = state.vote;
  clearInterval(voteTick);
  if (!v) { $('#voteModal').hidden = true; return; }
  $('#voteModal').hidden = false;
  $('#voteTitle').textContent = v.type === 'move'
    ? `${v.byName}: ${state.round + 1}차 ${menu[v.target].name} 가자!`
    : `${v.byName}: 오늘은 여기까지? 계산하자 🧾`;
  const yes = state.members.filter((m) => v.answers[m.id] === true).map((m) => m.name);
  const waiting = state.members.filter((m) => v.answers[m.id] === undefined).map((m) => m.name);
  $('#voteStatus').textContent = `콜: ${yes.join(', ') || '-'}${waiting.length ? ` · 대기: ${waiting.join(', ')}` : ''} (전원 찬성해야 함)`;
  $('#voteButtons').hidden = v.answers[myId] !== undefined;
  const total = 20000;
  const endsAt = Date.now() + v.left; // 방장 시계랑 어긋나지 않게 남은 시간으로 받음
  const tick = () => ($('#voteTimer').style.width = `${Math.max(0, (endsAt - Date.now()) / total) * 100}%`);
  tick();
  voteTick = setInterval(tick, 200);
}
$('#voteYes').addEventListener('click', () => socket.emit('vote', true));
$('#voteNo').addEventListener('click', () => socket.emit('vote', false));

// ===================== 영수증 =====================
function showReceipt(r) {
  audio.stopAll();
  $('#voteModal').hidden = true;
  const fmt = (t) => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const total = r.ledger.reduce((s, l) => s + l.price, 0);
  const perPerson = {};
  for (const l of r.ledger) perPerson[l.by] = (perPerson[l.by] || 0) + l.price;
  const n = Math.max(1, r.members.length);

  let html = `<h3>🏮 사이버 포차 영수증</h3><div class="c">${fmt(r.startedAt)} ~ ${fmt(r.endedAt)}</div><hr>`;
  for (const h of r.history) {
    const lines = r.ledger.filter((l) => l.round === h.round);
    html += `<div class="rd">[${h.round}차] ${menu[h.venue].name}</div>`;
    if (!lines.length) html += `<div class="ln"><span class="n">(아무것도 안 먹음)</span></div>`;
    // 같은 메뉴 묶기
    const grouped = {};
    for (const l of lines) {
      const k = l.name + '|' + l.by;
      grouped[k] = grouped[k] || { ...l, qty: 0, sum: 0 };
      grouped[k].qty++;
      grouped[k].sum += l.price;
    }
    for (const g of Object.values(grouped)) {
      html += `<div class="ln"><span class="n">${esc(g.name)} ×${g.qty} <span class="who">(${esc(g.by)})</span></span><span>${g.sum.toLocaleString()}</span></div>`;
    }
    const sub = lines.reduce((s, l) => s + l.price, 0);
    html += `<div class="ln"><span class="n">소계</span><span>${sub.toLocaleString()}</span></div>`;
  }
  html += `<hr><div class="ln tot"><span class="n">합계</span><span>${won(total)}</span></div><hr>`;
  html += `<div class="rd">누가 시켰나</div>`;
  for (const [who, sum] of Object.entries(perPerson).sort((a, b) => b[1] - a[1])) {
    html += `<div class="ln"><span class="n">${esc(who)}</span><span>${sum.toLocaleString()}</span></div>`;
  }
  html += `<hr><div class="ln tot"><span class="n">1/N (${n}명)</span><span>${won(Math.ceil(total / n / 100) * 100)}</span></div>`;
  const king = Object.entries(r.drinks || {}).sort((a, b) => b[1] - a[1])[0];
  if (king && king[1] > 0) html += `<hr><div class="c">🏆 오늘의 주량왕: <b>${esc(king[0])}</b> (${king[1].toFixed(1)}잔)</div>`;
  html += `<hr><div class="c">함께한 사람: ${r.members.map(esc).join(', ')}</div>`;
  html += `<div class="barcode"></div><div class="c">감사합니다 또 오세요~ 🍶</div>`;
  $('#receipt').innerHTML = html;
  $('#receiptModal').hidden = false;
  $('#app').hidden = true;
}
$('#receiptClose').addEventListener('click', () => (location.href = location.pathname));

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
