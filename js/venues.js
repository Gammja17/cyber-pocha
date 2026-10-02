import * as THREE from 'three';
import { mat, mesh, box, cyl, makeAvatar } from './models.js';

export const TABLE_H = 0.72;
export const TABLE_R = 0.7;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const CROWD = ['#3d5a80', '#ee6c4d', '#98c1d9', '#6d597a', '#e5989b', '#588157', '#bc6c25', '#7f5539', '#adb5bd'];

function textTexture(lines, { w = 512, h = 256, bg = '#111', fg = '#fff', font = 64, glow } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${font}px "Malgun Gothic", sans-serif`;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 24; }
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * font * 1.25));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 주변 손님들 (시끌벅적 연출)
function crowdTable(group, x, z, { tableColor, seatColor, n = 4, tableFn, seatFn }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(tableFn ? tableFn(tableColor) : roundTable(tableColor, 0.55));
  const people = [];
  const offset = Math.random() * Math.PI;
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
    const seat = seatFn(seatColor);
    seat.position.set(Math.sin(a) * 0.85, 0, Math.cos(a) * 0.85);
    seat.rotation.y = a;
    g.add(seat);
    if (Math.random() < 0.85) {
      const p = makeAvatar(pick(CROWD));
      p.group.position.copy(seat.position);
      p.group.rotation.y = a;
      p.phase = Math.random() * 10;
      p.speed = rand(1.5, 4);
      g.add(p.group);
      people.push(p);
    }
  }
  // 테이블 위 병들
  for (let i = 0; i < 3; i++) {
    const b = cyl(0.03, 0.03, 0.2, pick(['#2f8f4e', '#6b3a12', '#2f8f4e']), rand(-0.2, 0.2), TABLE_H + 0.1, rand(-0.2, 0.2), 6);
    g.add(b);
  }
  group.add(g);
  return people;
}

function animateCrowd(people, t) {
  for (const p of people) {
    const s = Math.sin(t * p.speed + p.phase);
    p.head.rotation.y = Math.sin(t * 0.4 + p.phase) * 0.6;
    p.head.rotation.x = Math.max(0, s) * 0.15 - 0.05; // 웃는 듯 끄덕
    p.torso.rotation.z = Math.sin(t * 0.7 + p.phase) * 0.05;
    p.mouth.scale.y = 1 + Math.max(0, Math.sin(t * 9 + p.phase)) * 3 * (s > 0.3 ? 1 : 0);
  }
}

function roundTable(color, r = TABLE_R, metal = false) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r, 0.035, 24), mat(color, metal ? { metalness: 0.7, roughness: 0.35 } : {}), 0, TABLE_H, 0));
  g.add(cyl(0.04, 0.04, TABLE_H, '#555', 0, TABLE_H / 2, 0, 8));
  g.add(cyl(0.3, 0.3, 0.03, '#444', 0, 0.015, 0, 12));
  return g;
}

function plasticStool(color) {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.19, 0.04, color, 0, 0.44, 0, 12));
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.42, 4, 1, true), mat(color, { side: THREE.DoubleSide }), 0, 0.21, 0));
  return g;
}

function woodStool(color) {
  const g = new THREE.Group();
  g.add(cyl(0.17, 0.17, 0.05, color, 0, 0.45, 0, 10));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = cyl(0.018, 0.022, 0.44, '#3b2414', Math.sin(a) * 0.11, 0.22, Math.cos(a) * 0.11, 5);
    g.add(leg);
  }
  return g;
}

// 편의점 앞 그 하얀 플라스틱 팔걸이 의자 (모노블럭)
function monoblocChair(color = '#f4f4ee') {
  const g = new THREE.Group();
  const m = mat(color, { roughness: 0.45, emissive: color, emissiveIntensity: 0.06 });
  const part = (w, h, d, x, y, z, parent = g) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  };
  part(0.46, 0.035, 0.44, 0, 0.44, 0); // 좌판
  part(0.46, 0.06, 0.03, 0, 0.415, -0.22); // 좌판 앞 말림
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = part(0.05, 0.46, 0.05, sx * 0.2, 0.22, sz * 0.19);
    leg.rotation.z = sx * 0.12; // 아래로 벌어진 다리
    leg.rotation.x = -sz * 0.1;
  }
  const back = new THREE.Group();
  back.position.set(0, 0.45, 0.21);
  back.rotation.x = 0.18;
  g.add(back);
  for (const sx of [-1, 1]) part(0.045, 0.46, 0.04, sx * 0.21, 0.23, 0, back);
  for (let i = 0; i < 4; i++) part(0.42, 0.045, 0.025, 0, 0.09 + i * 0.085, 0, back); // 가로 슬랫
  part(0.48, 0.06, 0.045, 0, 0.47, 0, back); // 등받이 윗단
  for (const sx of [-1, 1]) {
    part(0.055, 0.03, 0.44, sx * 0.245, 0.65, 0.01); // 팔걸이
    part(0.04, 0.2, 0.04, sx * 0.245, 0.54, -0.18); // 팔걸이 앞 기둥
  }
  return g;
}

function stringLights(group, from, to, sag, count, color = '#ffcf7a') {
  const bulbs = [];
  const geo = new THREE.SphereGeometry(0.045, 8, 6);
  const m = new THREE.MeshBasicMaterial({ color });
  const points = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const p = new THREE.Vector3().lerpVectors(from, to, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    points.push(p);
    if (i > 0 && i < count) {
      const b = mesh(geo, m.clone(), p.x, p.y - 0.06, p.z);
      group.add(b);
      bulbs.push(b);
    }
  }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#222' })));
  return bulbs;
}

function buildingRow(group, z, count, seedColor) {
  for (let i = 0; i < count; i++) {
    const w = rand(3, 6), h = rand(4, 12);
    const x = -count * 2.5 + i * 5 + rand(-0.5, 0.5);
    const b = box(w, h, 3, seedColor, x, h / 2, z);
    group.add(b);
    // 불 켜진 창문
    for (let k = 0; k < 8; k++) {
      if (Math.random() < 0.4) continue;
      const win = mesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshBasicMaterial({ color: pick(['#ffd28a', '#9fd3ff', '#ffe9b0']) }),
        x + rand(-w / 2 + 0.4, w / 2 - 0.4), rand(1.5, h - 0.5), z + (z < 0 ? 1.51 : -1.51));
      if (z > 0) win.rotation.y = Math.PI;
      group.add(win);
    }
  }
}

// ====================== 야장 ======================
function buildPocha() {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight('#3a4a7a', '#1a1410', 0.55));
  const floor = mesh(new THREE.PlaneGeometry(60, 60), mat('#2b2a2e'));
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  // 보도블럭 라인
  for (let i = -10; i <= 10; i++) group.add(box(0.03, 0.005, 30, '#3a383c', i * 1.2, 0.003, 0));

  // 우리 테이블 위 백열등
  const bulb = mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe0a0' }), 0, 2.3, 0);
  group.add(bulb);
  group.add(box(0.01, 1.2, 0.01, '#111', 0, 2.95, 0));
  const lamp = new THREE.PointLight('#ffb35c', 6, 8, 1.6);
  lamp.position.set(0, 2.2, 0);
  group.add(lamp);

  group.add(roundTable('#c8ccd2', TABLE_R, true));

  // 주황 비닐 천막 (포장마차)
  const tarp = mat('#ff7a1a', { transparent: true, opacity: 0.75, side: THREE.DoubleSide, emissive: '#ff5a00', emissiveIntensity: 0.18 });
  const back = mesh(new THREE.PlaneGeometry(9, 2.6), tarp, 0, 1.3, -4.5);
  group.add(back);
  const roof = mesh(new THREE.PlaneGeometry(9, 3.2), tarp, 0, 2.9, -3);
  roof.rotation.x = Math.PI / 2 - 0.35;
  group.add(roof);
  const side = mesh(new THREE.PlaneGeometry(3, 2.6), tarp, -4.5, 1.3, -3);
  side.rotation.y = Math.PI / 2;
  group.add(side);
  const tarpLight = new THREE.PointLight('#ff8a2a', 4, 10, 1.4);
  tarpLight.position.set(0, 2, -3.6);
  group.add(tarpLight);
  // 포차 간판
  const sign = mesh(new THREE.PlaneGeometry(3, 0.6), new THREE.MeshBasicMaterial({ map: textTexture(['실내포차 · 야장'], { w: 768, h: 160, bg: '#c81e1e', font: 90, glow: '#ffdd88' }) }), 0, 2.45, -4.45);
  group.add(sign);
  // 조리대
  group.add(box(3, 0.9, 0.7, '#9aa0a6', 1.5, 0.45, -4));
  group.add(cyl(0.25, 0.25, 0.3, '#555', 1.0, 1.05, -4, 10));

  // 전구줄
  const bulbs = [];
  const poles = [[-4, 3.5], [4, 3.5], [4, -3.5], [-4, -3.5]];
  for (const [x, z] of poles) group.add(cyl(0.04, 0.04, 3, '#333', x, 1.5, z, 6));
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = poles[i], [x2, z2] = poles[(i + 1) % 4];
    bulbs.push(...stringLights(group, new THREE.Vector3(x1, 3, z1), new THREE.Vector3(x2, 3, z2), 0.5, 10));
  }
  bulbs.push(...stringLights(group, new THREE.Vector3(-4, 3, 3.5), new THREE.Vector3(4, 3, -3.5), 0.7, 14));
  for (const [x, z] of [[-2.5, 2.5], [2.5, 2.5], [2.5, -2]]) {
    const l = new THREE.PointLight('#ffc070', 2.5, 7, 1.5);
    l.position.set(x, 2.6, z);
    group.add(l);
  }

  // 옆 테이블 손님들
  const crowd = [];
  for (const [x, z] of [[3.2, 1.2], [-3.2, 1.5], [3.0, -2.2], [-2.8, -2.4], [0.5, 4.2], [-5.5, 4.5], [5.8, 4]]) {
    crowd.push(...crowdTable(group, x, z, { tableColor: '#c8ccd2', seatColor: pick(['#d32f2f', '#1e63c9']), n: Math.floor(rand(3, 5)), seatFn: plasticStool }));
  }
  // 맥주 상자
  for (let i = 0; i < 4; i++) group.add(box(0.5, 0.3, 0.35, i % 2 ? '#2b7a3a' : '#1e4fa0', -4 + (i % 2) * 0.52, 0.15 + Math.floor(i / 2) * 0.3, -4));

  buildingRow(group, -12, 7, '#1c1d26');
  buildingRow(group, 14, 7, '#1a1b22');

  return {
    group, background: '#0b1022', fog: ['#0b1022', 8, 26],
    seat: () => plasticStool('#d32f2f'),
    update(t) {
      animateCrowd(crowd, t);
      bulbs.forEach((b, i) => b.material.color.setHSL(0.11, 1, 0.68 + Math.sin(t * 2 + i * 1.7) * 0.05));
    },
  };
}

// ====================== 호프 ======================
function buildPub() {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight('#ffd9a8', '#3a2414', 0.6));
  const W = 14, H = 3.2;
  const room = mesh(new THREE.BoxGeometry(W, H, W), mat('#6b4426', { side: THREE.BackSide }), 0, H / 2, 0);
  group.add(room);
  const floor = mesh(new THREE.PlaneGeometry(W, W), mat('#3b2a1e'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  group.add(floor);
  // 벽 나무판
  for (let i = 0; i < 14; i++) group.add(box(0.05, H, 0.04, '#4a2d18', -W / 2 + i, H / 2, -W / 2 + 0.03));
  // 메뉴판
  const menuTex = textTexture(['후라이드치킨  21,000', '생맥주 3000cc  18,000', '노가리  8,000', '감자튀김  9,000'], { w: 1024, h: 512, bg: '#1b2a1b', fg: '#f5f0dc', font: 70 });
  group.add(mesh(new THREE.PlaneGeometry(3.4, 1.7), new THREE.MeshBasicMaterial({ map: menuTex }), 0, 2.1, -W / 2 + 0.06));
  // 네온 사인
  const neon = mesh(new THREE.PlaneGeometry(2, 0.8), new THREE.MeshBasicMaterial({ map: textTexture(['오늘도 달린다'], { w: 768, h: 256, bg: '#1a0a12', fg: '#ff7ad9', font: 96, glow: '#ff2fb0' }) }), -W / 2 + 0.06, 2.2, 0);
  neon.rotation.y = Math.PI / 2;
  group.add(neon);
  const neon2 = mesh(new THREE.PlaneGeometry(2, 0.8), new THREE.MeshBasicMaterial({ map: textTexture(['HOF  生맥주'], { w: 768, h: 256, bg: '#0a1218', fg: '#7af0ff', font: 100, glow: '#2fd0ff' }) }), W / 2 - 0.06, 2.2, 1);
  neon2.rotation.y = -Math.PI / 2;
  group.add(neon2);
  const pinkLight = new THREE.PointLight('#ff4fc0', 2, 5, 1.5);
  pinkLight.position.set(-W / 2 + 0.6, 2.2, 0);
  group.add(pinkLight);
  // TV (야구 중계 느낌)
  const tv = box(1.6, 0.9, 0.08, '#111', W / 2 - 0.1, 2.3, -3);
  tv.rotation.y = -Math.PI / 2;
  group.add(tv);
  const screen = mesh(new THREE.PlaneGeometry(1.45, 0.8), new THREE.MeshBasicMaterial({ color: '#3a8a4a' }), W / 2 - 0.16, 2.3, -3);
  screen.rotation.y = -Math.PI / 2;
  group.add(screen);

  // 펜던트 조명
  const pendant = (x, z, intensity = 4) => {
    group.add(box(0.01, 0.9, 0.01, '#111', x, H - 0.45, z));
    const shade = mesh(new THREE.ConeGeometry(0.22, 0.2, 10, 1, true), mat('#2a1a10', { side: THREE.DoubleSide }), x, H - 0.95, z);
    group.add(shade);
    group.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe0a0' }), x, H - 1.02, z));
    const l = new THREE.PointLight('#ffb866', intensity, 6, 1.6);
    l.position.set(x, H - 1.1, z);
    group.add(l);
  };
  pendant(0, 0, 6);

  group.add(roundTable('#8b5a2b'));

  const crowd = [];
  const spots = [[3.2, 0.5], [-3.2, 0.2], [3.4, -3.4], [-3.4, -3.3], [0, -4.4], [3.4, 3.6], [-3.4, 3.6], [0, 4.3]];
  for (const [x, z] of spots) {
    pendant(x, z, 3);
    crowd.push(...crowdTable(group, x, z, { tableColor: '#8b5a2b', seatColor: '#5a3a1e', n: Math.floor(rand(3, 6)), seatFn: woodStool }));
  }

  return {
    group, background: '#1a0f08', fog: ['#1a0f08', 10, 20],
    seat: () => woodStool('#6b4426'),
    update(t) {
      animateCrowd(crowd, t);
      screen.material.color.setHSL(0.33 + Math.sin(t * 0.7) * 0.03, 0.5, 0.35 + Math.sin(t * 3.1) * 0.05);
      pinkLight.intensity = 2 + Math.sin(t * 13) * Math.sin(t * 3) * 0.3;
    },
  };
}

// ====================== 편의점 앞 ======================
const PRODUCT_COLORS = ['#e8463a', '#f2c94c', '#3a7be8', '#5fbf6a', '#ff8a3d', '#ffffff', '#b06ad9', '#e85a8a', '#2a2a2a', '#7ac7ff'];

// 상품 여러 개를 InstancedMesh 하나로 (메쉬 수 절약)
function productRow(list, x0, x1, y, z, depthDir) {
  for (let x = x0; x < x1 - 0.1;) {
    const w = rand(0.09, 0.18), h = rand(0.14, 0.26);
    list.push({ x: x + w / 2, y: y + h / 2, z: z + depthDir * 0.1, w, h, d: 0.16, color: pick(PRODUCT_COLORS) });
    x += w + 0.015;
  }
}

function buildStoreInterior(group, Z, D, W) {
  const inner = new THREE.Group();
  group.add(inner);
  // 방 (BackSide라서 바깥에서 보면 앞면은 안 보임)
  inner.add(mesh(new THREE.BoxGeometry(W - 0.1, 2.75, D), mat('#eef0f2', { side: THREE.BackSide }), 0, 1.375, Z - D / 2));
  const innerFloor = mesh(new THREE.PlaneGeometry(W - 0.1, D), mat('#d9dcdf'), 0, 0.01, Z - D / 2);
  innerFloor.rotation.x = -Math.PI / 2;
  inner.add(innerFloor);
  // 천장 형광등
  for (const z of [-0.8, -2.2, -3.6]) inner.add(mesh(new THREE.BoxGeometry(W - 1.5, 0.04, 0.25), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 0, 2.72, Z + z));
  for (const x of [-2.5, 2.5]) {
    const l = new THREE.PointLight('#f2f7ff', 7, 7, 1.4);
    l.position.set(x, 2.4, Z - 2);
    inner.add(l);
  }

  const products = [];
  // 진열대 (매대) — 정면에서 상품이 보이게 가로로 배치
  for (const [x0, x1, z] of [[-4.2, -1.0, -1.3], [-4.2, -1.0, -2.6], [2.9, 4.3, -1.6], [2.9, 4.3, -2.9]]) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    inner.add(box(w, 0.12, 0.6, '#c9ced6', cx, 0.06, Z + z));
    inner.add(box(w, 1.5, 0.06, '#d7dbe1', cx, 0.75, Z + z));
    for (let t = 0; t < 4; t++) {
      const y = 0.12 + t * 0.36;
      inner.add(box(w, 0.025, 0.55, '#bfc4cc', cx, y, Z + z));
      productRow(products, x0, x1, y + 0.013, Z + z, 1);
    }
  }
  // 뒷벽 음료 냉장고 (불 들어온 유리문)
  inner.add(box(W - 1, 2.0, 0.5, '#2a2d33', 0, 1.0, Z - D + 0.3));
  inner.add(mesh(new THREE.PlaneGeometry(W - 1.2, 1.8), new THREE.MeshBasicMaterial({ color: '#e8f6ff' }), 0, 1.0, Z - D + 0.56));
  for (let t = 0; t < 5; t++) {
    for (let x = -3.9; x < 3.9; x += 0.09) {
      products.push({ x, y: 0.25 + t * 0.36, z: Z - D + 0.6, w: 0.06, h: 0.22, d: 0.06, color: pick(['#2f8f4e', '#6b3a12', '#e8463a', '#3a7be8', '#f2c94c', '#ffffff']) });
    }
  }
  for (let i = 1; i < 8; i++) inner.add(box(0.03, 1.8, 0.03, '#2a2d33', -4 + i, 1.0, Z - D + 0.6));

  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#ffffff', { roughness: 0.6 }), products.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  products.forEach((p, i) => {
    inst.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(p.w, p.h, p.d)));
    inst.setColorAt(i, c.set(p.color));
  });
  inner.add(inst);

  // 카운터 + 계산대 + 알바생 + 담배 진열장
  inner.add(box(1.6, 1.0, 0.6, '#e2e4e8', 1.5, 0.5, Z - 0.9));
  inner.add(box(0.35, 0.25, 0.3, '#222', 1.2, 1.12, Z - 0.9));
  inner.add(box(0.3, 0.2, 0.02, '#5fd3ff', 1.2, 1.3, Z - 0.75));
  const staff = makeAvatar('#2e9a4a', 0.7);
  staff.group.position.set(1.6, 0.25, Z - 1.6);
  staff.group.rotation.y = Math.PI;
  inner.add(staff.group);
  inner.add(box(1.8, 1.0, 0.25, '#30343a', 1.6, 1.9, Z - 2.2));
  const cig = [];
  for (let r = 0; r < 4; r++) for (let x = 0.8; x < 2.4; x += 0.07) cig.push({ x, y: 1.5 + r * 0.24, z: Z - 2.05, w: 0.05, h: 0.09, d: 0.03, color: pick(['#ffffff', '#c81e1e', '#1e4fa0', '#e8c24a', '#111']) });
  const cigInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#fff'), cig.length);
  cig.forEach((p, i) => {
    cigInst.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(p.w, p.h, p.d)));
    cigInst.setColorAt(i, c.set(p.color));
  });
  inner.add(cigInst);
  return staff;
}

// "Nice to CU" 간판
function cuSignTexture() {
  const w = 2048, h = 170;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const LIME = '#a8cf3a', PURPLE = '#6a2c91';
  const pill = (x, y, pw, ph) => {
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, ph / 2);
    ctx.fill();
  };
  ctx.fillStyle = PURPLE;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'middle';
  // "Nice to" 라임 알약
  ctx.fillStyle = LIME;
  pill(110, 50, 230, 72);
  ctx.fillStyle = '#3d1659';
  ctx.font = 'bold 50px "Arial Rounded MT Bold", Arial, sans-serif';
  ctx.fillText('Nice to', 135, 88);
  // CU
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 118px "Arial Black", Arial, sans-serif';
  ctx.fillText('CU', 365, 92);
  // 긴 라임 바 (마디)
  ctx.fillStyle = LIME;
  pill(600, 55, 1330, 62);
  ctx.fillStyle = '#8fb52c';
  for (let x = 760; x < 1880; x += 225) ctx.fillRect(x, 55, 6, 62);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildStore() {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight('#22304a', '#0a0a10', 0.4));
  const floor = mesh(new THREE.PlaneGeometry(60, 60), mat('#24252a'));
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  for (let i = -6; i <= 6; i++) {
    group.add(box(0.02, 0.004, 12, '#333339', i * 0.6, 0.003, -1));
    group.add(box(8, 0.004, 0.02, '#333339', 0, 0.003, -1 + i * 0.6));
  }
  // 차도 경계석
  group.add(box(40, 0.12, 0.3, '#5a5a60', 0, 0.06, 3.5));
  group.add(box(40, 0.01, 12, '#18181c', 0, 0.001, 9.6));

  // 편의점 건물 — 통유리 너머로 실제 매장 내부가 보이게
  const Z = -5.2, D = 4.5, W = 9;
  const staff = buildStoreInterior(group, Z, D, W);
  // CU 스타일 외관: 회색 콘크리트 패널 벽 + 보라 간판 + 흰 프레임 통유리
  const WALL = '#8f949a', GLASS_TOP = 2.6, HALF = W / 2;
  group.add(box(16, 2.2, 0.3, WALL, 0, GLASS_TOP + 1.1, Z)); // 유리 위
  group.add(box(16 / 2 - HALF, GLASS_TOP, 0.3, WALL, -(HALF + (8 - HALF) / 2), GLASS_TOP / 2, Z)); // 왼쪽
  group.add(box(16 / 2 - HALF, GLASS_TOP, 0.3, WALL, HALF + (8 - HALF) / 2, GLASS_TOP / 2, Z)); // 오른쪽
  for (let x = -8; x <= 8; x += 1.2) group.add(box(0.015, 4.8, 0.01, '#6f7379', x, 2.4, Z + 0.155)); // 패널 줄눈
  for (let y = 1.2; y < 4.8; y += 1.15) group.add(box(16, 0.015, 0.01, '#6f7379', 0, y, Z + 0.155));
  // 통유리 + 흰 멀리언
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false });
  group.add(mesh(new THREE.PlaneGeometry(W, GLASS_TOP), glass, 0, GLASS_TOP / 2, Z + 0.02));
  const mullion = '#eceef1';
  group.add(box(W, 0.07, 0.08, mullion, 0, GLASS_TOP - 0.035, Z + 0.05));
  group.add(box(W, 0.05, 0.08, mullion, 0, 0.025, Z + 0.05));
  group.add(box(W, 0.04, 0.06, mullion, 0, 2.1, Z + 0.05)); // 문 위 가로대
  for (let i = 0; i <= 7; i++) group.add(box(0.05, GLASS_TOP, 0.08, mullion, -HALF + i * (W / 7), GLASS_TOP / 2, Z + 0.05));
  group.add(box(0.03, 0.6, 0.03, '#b8bcc4', -HALF + W / 7 - 0.15, 1.1, Z + 0.1)); // 문 손잡이 (맨 왼쪽 칸)
  // 유리 스티커
  const poster = (lines, bg, fg, w, h, x, y) => {
    group.add(mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTexture(lines, { w: 256, h: Math.round(256 * h / w), bg, fg, font: 72 }) }), x, y, Z + 0.05));
  };
  poster(['당기세요'], '#ffffff', '#333', 0.3, 0.12, -HALF + W / 7 - 0.15, 1.35);
  poster(['1+1'], '#ff3b30', '#fff', 0.45, 0.45, 2.3, 1.55);
  poster(['2+1'], '#ffcc00', '#c81e1e', 0.45, 0.45, 2.85, 1.55);
  // 보라 간판 (※ 실제 브랜드 로고 — 공개 배포할 땐 cuSignTexture를 일반 간판으로 교체)
  group.add(box(W + 0.6, 0.8, 0.3, '#5b2483', 0, GLASS_TOP + 0.55, Z + 0.15));
  group.add(mesh(new THREE.PlaneGeometry(W + 0.6, 0.8), new THREE.MeshBasicMaterial({ map: cuSignTexture() }), 0, GLASS_TOP + 0.55, Z + 0.31));
  const storeLight = new THREE.SpotLight('#e6f2ff', 10, 14, 0.9, 0.6, 1.5);
  storeLight.position.set(0, 2.2, Z + 0.4);
  storeLight.target.position.set(0, 0, 1.5);
  group.add(storeLight, storeLight.target);
  const fill = new THREE.PointLight('#cfe6ff', 1.5, 6, 1.5);
  fill.position.set(0, 1.5, Z + 0.6);
  group.add(fill);

  // 파라솔 테이블 (기둥이 얼굴을 가리지 않게 옆에 세운 행잉 파라솔)
  group.add(roundTable('#2e8b3a'));
  const pa = Math.PI / 6, pr = 1.75;
  group.add(cyl(0.03, 0.03, 2.6, '#cfcfcf', Math.sin(pa) * pr, 1.3, Math.cos(pa) * pr, 6));
  group.add(cyl(0.18, 0.18, 0.08, '#555', Math.sin(pa) * pr, 0.04, Math.cos(pa) * pr, 10));
  const arm = cyl(0.02, 0.02, pr, '#cfcfcf', Math.sin(pa) * pr / 2, 2.62, Math.cos(pa) * pr / 2, 6);
  arm.rotation.set(Math.PI / 2, 0, 0);
  arm.rotation.order = 'YXZ';
  arm.rotation.y = pa;
  group.add(arm);
  const umbrella = mesh(new THREE.ConeGeometry(1.6, 0.5, 8, 1, true), mat('#d83a2e', { side: THREE.DoubleSide }), 0, 2.45, 0);
  group.add(umbrella);
  const umbrella2 = mesh(new THREE.ConeGeometry(1.605, 0.5, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#f5f5f5', flatShading: true, side: THREE.DoubleSide, wireframe: true }), 0, 2.45, 0);
  group.add(umbrella2);

  // 가로등
  group.add(cyl(0.06, 0.08, 4.5, '#3a3a40', 4.5, 2.25, 3.2, 6));
  group.add(box(0.8, 0.08, 0.2, '#3a3a40', 4.15, 4.5, 3.2));
  group.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb35c' }), 3.8, 4.4, 3.2));
  const street = new THREE.PointLight('#ff9a3a', 5, 12, 1.4);
  street.position.set(3.8, 4.2, 3.2);
  group.add(street);

  // 소품: 분리수거함, 아이스크림 냉동고, 맥주 박스, 전봇대
  ['#2d6fd0', '#2e9a4a', '#8a8f98'].forEach((c, i) => {
    group.add(box(0.4, 0.75, 0.4, c, -4.1 + i * 0.45, 0.375, Z + 0.55));
    group.add(box(0.2, 0.02, 0.1, '#111', -4.1 + i * 0.45, 0.76, Z + 0.55));
  });
  group.add(box(1.3, 0.8, 0.65, '#f4f6f8', 3.4, 0.4, Z + 0.7));
  const freezerLid = mesh(new THREE.PlaneGeometry(1.2, 0.55), new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.7 }), 3.4, 0.81, Z + 0.7);
  freezerLid.rotation.x = -Math.PI / 2;
  group.add(freezerLid);
  group.add(mesh(new THREE.PlaneGeometry(1.1, 0.25), new THREE.MeshBasicMaterial({ map: textTexture(['아이스크림'], { w: 512, h: 112, bg: '#e8304a', font: 70 }) }), 3.4, 0.55, Z + 1.03));
  for (let i = 0; i < 3; i++) group.add(box(0.5, 0.3, 0.35, '#2b7a3a', 2.2, 0.15 + i * 0.3, Z + 0.5));
  group.add(cyl(0.1, 0.12, 7, '#4a4a4a', -5, 3.5, 3.4, 6));
  // 비어있는 옆 테이블 + 쌓아둔 의자
  const spare = roundTable('#2e8b3a', 0.6);
  spare.position.set(-3.3, 0, -2.6);
  group.add(spare);
  for (let i = 0; i < 4; i++) {
    const c = monoblocChair();
    c.position.set(-4.6, i * 0.07, -1.8);
    c.rotation.y = 0.4;
    group.add(c);
  }
  for (const a of [0.8, 2.6]) {
    const c = monoblocChair();
    c.position.set(-3.3 + Math.sin(a) * 0.95, 0, -2.6 + Math.cos(a) * 0.95);
    c.rotation.y = a + rand(-0.4, 0.4);
    group.add(c);
  }

  // 별
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2, e = rand(0.15, 1.2), r = 40;
    pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#cfd8ff', size: 0.15, fog: false }));
  group.add(stars);

  buildingRow(group, -14, 6, '#15161c');
  buildingRow(group, 16, 6, '#121318');

  // 가끔 지나가는 차 불빛
  const car = new THREE.Group();
  for (const s of [-0.5, 0.5]) car.add(mesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff4d0' }), 0, 0.5, s));
  const carLight = new THREE.PointLight('#fff1c8', 4, 6, 1.5);
  carLight.position.y = 0.6;
  car.add(carLight);
  car.position.set(-40, 0, 6);
  group.add(car);
  let carT = 5;

  return {
    group, background: '#05070d', fog: ['#05070d', 7, 30],
    seat: () => monoblocChair(),
    update(t, dt) {
      carT -= dt;
      if (carT < 0) { car.position.x += dt * 14; if (car.position.x > 40) { car.position.x = -40; carT = rand(10, 25); } }
      fill.intensity = 1.5 + (Math.random() < 0.01 ? -1 : 0); // 형광등 깜빡
      staff.head.rotation.x = -0.45 + Math.sin(t * 0.3) * 0.05; // 폰 보는 알바생
      staff.head.rotation.y = Math.sin(t * 0.13) > 0.95 ? 0.6 : 0;
    },
  };
}

export function buildVenue(key) {
  return { pocha: buildPocha, pub: buildPub, store: buildStore }[key]();
}
