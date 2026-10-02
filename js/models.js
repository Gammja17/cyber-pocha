import * as THREE from 'three';

export const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...opts });

export function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

export const box = (w, h, d, color, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat(color), x, y, z);
export const cyl = (rt, rb, h, color, x, y, z, seg = 10) =>
  mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color), x, y, z);

// ---------- 사람 ----------
const SKIN = ['#f1c9a5', '#e0b08a', '#c98f68', '#f5d6bb'];
const HAIR = ['#1c1410', '#3a2414', '#2b2b2b', '#5a3a1a'];

export function makeAvatar(color, seed = Math.random()) {
  const g = new THREE.Group();
  const skin = SKIN[Math.floor(seed * 97) % SKIN.length];
  const hair = HAIR[Math.floor(seed * 53) % HAIR.length];

  const torso = cyl(0.15, 0.2, 0.52, color, 0, 0.72, 0, 8);
  g.add(torso);
  // 팔 (테이블 쪽으로 걸친 느낌)
  for (const side of [-1, 1]) {
    const arm = cyl(0.045, 0.045, 0.42, color, side * 0.2, 0.78, -0.12, 6);
    arm.rotation.x = 1.0;
    g.add(arm);
    g.add(mesh(new THREE.SphereGeometry(0.045, 6, 5), mat(skin), side * 0.2, 0.66, -0.3));
  }
  const head = new THREE.Group();
  head.position.set(0, 1.12, 0);
  head.add(mesh(new THREE.IcosahedronGeometry(0.14, 1), mat(skin)));
  const hairCap = mesh(new THREE.SphereGeometry(0.148, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(hair), 0, 0.01, 0.01);
  hairCap.rotation.x = 0.25;
  head.add(hairCap);
  for (const side of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.018, 6, 4), mat('#111'), side * 0.05, 0.02, -0.125));
  const mouth = box(0.06, 0.012, 0.01, '#5a1a1a', 0, -0.06, -0.13);
  head.add(mouth);
  // 볼터치 (취기)
  const blush = [];
  for (const side of [-1, 1]) {
    const b = mesh(new THREE.CircleGeometry(0.025, 8), new THREE.MeshBasicMaterial({ color: '#ff5a5a', transparent: true, opacity: 0 }), side * 0.08, -0.03, -0.128);
    b.rotation.y = Math.PI + side * 0.5;
    head.add(b);
    blush.push(b);
  }
  // 담배 (입 오른쪽)
  const cig = new THREE.Group();
  cig.add(cyl(0.006, 0.006, 0.08, '#f4f1ea', 0, 0, 0, 6));
  const tip = mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.01, 6), new THREE.MeshBasicMaterial({ color: '#ff5a1a' }), 0, 0.044, 0);
  cig.add(tip);
  cig.rotation.x = -1.35;
  cig.position.set(0.035, -0.065, -0.17);
  cig.visible = false;
  head.add(cig);
  g.add(head);

  return { group: g, head, torso, mouth, cig, tip, blush };
}

// ---------- 길고양이 ----------
const COATS = [
  { base: '#e8a04a', patch: ['#c97a2a', '#c97a2a'], name: '치즈' },
  { base: '#8d8d8d', patch: ['#4a4a4a', '#4a4a4a'], name: '고등어' },
  { base: '#f4efe6', patch: ['#e08a3a', '#2a2420'], name: '삼색' },
];

export function makeCat(seed) {
  const coat = COATS[seed % COATS.length];
  const g = new THREE.Group();
  const body = new THREE.Group(); // 몸 기준점: 뒷다리 쪽
  g.add(body);
  const torso = mesh(new THREE.CapsuleGeometry(0.065, 0.16, 3, 8), mat(coat.base), 0, 0.13, -0.07);
  torso.rotation.x = Math.PI / 2;
  body.add(torso);
  // 무늬
  coat.patch.forEach((c, i) => {
    const p = mesh(new THREE.SphereGeometry(0.045, 6, 5), mat(c), (i ? -1 : 1) * 0.035, 0.17, -0.04 - i * 0.07);
    p.scale.set(1, 0.5, 1.3);
    body.add(p);
  });
  // 다리
  const legs = [];
  for (const [x, z] of [[-0.04, -0.15], [0.04, -0.15], [-0.04, 0.0], [0.04, 0.0]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.1, z);
    leg.add(mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.1, 5), mat(coat.base), 0, -0.05, 0));
    body.add(leg);
    legs.push(leg);
  }
  // 머리
  const head = new THREE.Group();
  head.position.set(0, 0.2, -0.2);
  head.add(mesh(new THREE.IcosahedronGeometry(0.06, 1), mat(coat.base)));
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.022, 0.045, 4), mat(coat.patch[s > 0 ? 0 : 1]), s * 0.033, 0.055, 0.005);
    ear.rotation.z = -s * 0.25;
    head.add(ear);
  }
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: '#c8e85a' }), s * 0.024, 0.012, -0.052);
    eye.add(mesh(new THREE.SphereGeometry(0.006, 4, 3), new THREE.MeshBasicMaterial({ color: '#111' }), 0, 0, -0.008));
    head.add(eye);
    eyes.push(eye);
  }
  head.add(mesh(new THREE.SphereGeometry(0.007, 4, 3), new THREE.MeshBasicMaterial({ color: '#f29aa6' }), 0, -0.008, -0.06));
  body.add(head);
  // 꼬리 (마디 3개)
  const tail = new THREE.Group();
  tail.position.set(0, 0.15, 0.04);
  let parent = tail;
  const tailSegs = [];
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    seg.position.y = i ? 0.06 : 0;
    seg.add(mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.065, 5), mat(i === 2 ? coat.patch[0] : coat.base), 0, 0.03, 0));
    seg.rotation.x = 0.45;
    parent.add(seg);
    tailSegs.push(seg);
    parent = seg;
  }
  body.add(tail);
  // 클릭 판정용
  const hit = mesh(new THREE.SphereGeometry(0.2, 6, 5), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.15, -0.08);
  g.add(hit);

  return { group: g, body, head, legs, eyes, tailSegs, hit, coat: coat.name };
}

// ---------- 텍스트 스프라이트 ----------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function makeTextSprite({ bg = 'rgba(0,0,0,0.55)', fg = '#fff', font = 34, maxWidth = 520, tail = false } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.renderOrder = 10;

  sprite.setText = (text) => {
    ctx.font = `bold ${font}px "Pretendard", "Malgun Gothic", sans-serif`;
    // 줄바꿈
    const lines = [];
    let line = '';
    for (const ch of String(text)) {
      if (ctx.measureText(line + ch).width > maxWidth) { lines.push(line); line = ''; }
      line += ch;
    }
    lines.push(line);
    const lineH = font * 1.3;
    const w = Math.min(maxWidth, Math.max(...lines.map((l) => ctx.measureText(l).width))) + 36;
    const h = lines.length * lineH + 22 + (tail ? 18 : 0);
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(h);
    ctx.font = `bold ${font}px "Pretendard", "Malgun Gothic", sans-serif`;
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h - (tail ? 18 : 0), 18);
    ctx.fill();
    if (tail) {
      ctx.beginPath();
      ctx.moveTo(w / 2 - 14, h - 18);
      ctx.lineTo(w / 2, h);
      ctx.lineTo(w / 2 + 14, h - 18);
      ctx.fill();
    }
    ctx.fillStyle = fg;
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, 18, 11 + i * lineH));
    tex.needsUpdate = true;
    const scale = 0.0016;
    sprite.scale.set(w * scale, h * scale, 1);
    sprite.center.set(0.5, 0);
  };
  return sprite;
}

// ---------- 잔 ----------
export function makeGlass() {
  const g = new THREE.Group();
  const glass = mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.07, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, roughness: 0.1, side: THREE.DoubleSide }), 0, 0.035, 0);
  g.add(glass);
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 10), mat('#cfe3ea', { transparent: true, opacity: 0.6 }), 0, 0.003, 0));
  const liqGeo = new THREE.CylinderGeometry(0.027, 0.023, 0.06, 10);
  liqGeo.translate(0, 0.03, 0);
  const liquid = mesh(liqGeo, new THREE.MeshStandardMaterial({ color: '#dcefff', transparent: true, opacity: 0.8, roughness: 0.2 }), 0, 0.006, 0);
  g.add(liquid);
  // 클릭 판정용 투명 박스
  const hit = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 6), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.05, 0);
  g.add(hit);
  g.setFill = (fill, color) => {
    liquid.visible = fill > 0.01;
    liquid.scale.y = Math.max(0.01, fill);
    if (color) liquid.material.color.set(color);
  };
  g.setFill(0);
  g.hit = hit;
  return g;
}

// ---------- 음식 / 술 ----------
function lumps(group, count, color, radius, y, size = 0.022) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const a = i * 2.4;
    const r = radius * Math.sqrt((i + 0.5) / count);
    const m = mesh(new THREE.DodecahedronGeometry(size, 0), mat(color), Math.cos(a) * r, y + (i % 3) * 0.006, Math.sin(a) * r);
    m.rotation.set(i, i * 2, 0);
    group.add(m);
    list.push(m);
  }
  return (left) => list.forEach((m, i) => (m.visible = i < left));
}

function bottle(color, label) {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.85, roughness: 0.2, flatShading: true });
  g.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.15, 10), glassMat, 0, 0.075, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.013, 0.03, 0.04, 10), glassMat, 0, 0.17, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.04, 10), glassMat, 0, 0.21, 0));
  g.add(cyl(0.015, 0.015, 0.015, label === '#ffffff' ? '#2a8a4a' : '#d4b43a', 0, 0.235, 0));
  g.add(cyl(0.0335, 0.0335, 0.05, label, 0, 0.07, 0));
  return g;
}

export function makeItem(def) {
  const g = new THREE.Group();
  let update = () => {};
  const max = def.servings;

  switch (def.model) {
    case 'plate': {
      g.add(cyl(0.11, 0.09, 0.015, '#f5f5f0', 0, 0.008, 0, 16));
      update = lumps(g, max, def.color, 0.07, 0.03);
      break;
    }
    case 'bowl': {
      g.add(cyl(0.1, 0.06, 0.07, '#e9e4da', 0, 0.035, 0, 14));
      g.add(cyl(0.09, 0.09, 0.005, '#c88a4a', 0, 0.066, 0, 14));
      update = lumps(g, max, def.color, 0.06, 0.075, 0.018);
      break;
    }
    case 'soju': {
      g.add(bottle('#2f8f4e', '#ffffff'));
      break;
    }
    case 'beer': {
      g.add(bottle('#6b3a12', '#d9b44a'));
      break;
    }
    case 'pitcher': {
      g.add(mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.24, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: '#fff', transparent: true, opacity: 0.25, side: THREE.DoubleSide }), 0, 0.12, 0));
      const geo = new THREE.CylinderGeometry(0.07, 0.065, 0.22, 12);
      geo.translate(0, 0.11, 0);
      const beer = mesh(geo, mat('#f2b233', { transparent: true, opacity: 0.85 }), 0, 0.005, 0);
      const foam = cyl(0.071, 0.071, 0.02, '#fff8e8', 0, 0.2, 0, 12);
      g.add(beer, foam);
      const handle = mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 10, Math.PI), mat('#ddd', { transparent: true, opacity: 0.4 }), 0.075, 0.12, 0);
      handle.rotation.z = -Math.PI / 2;
      g.add(handle);
      update = (left) => {
        const f = left / max;
        beer.scale.y = Math.max(0.02, f);
        foam.position.y = 0.005 + 0.22 * f + 0.01;
      };
      break;
    }
    case 'cans': {
      const cans = [];
      for (let i = 0; i < max; i++) {
        const c = cyl(0.033, 0.033, 0.12, i % 2 ? '#d9d9d9' : '#e8c24a', (i % 2 - 0.5) * 0.075, 0.06, (Math.floor(i / 2) - 0.5) * 0.075, 12);
        g.add(c);
        cans.push(c);
      }
      update = (left) => cans.forEach((c, i) => (c.visible = i < left));
      break;
    }
    case 'bag': {
      const bag = box(0.16, 0.025, 0.21, def.color, 0, 0.013, 0.02);
      bag.rotation.y = 0.4;
      g.add(bag);
      g.add(box(0.09, 0.027, 0.06, '#ffe36b', 0, 0.015, 0.02));
      update = lumps(g, max, def.key === 'jerky' ? '#7a3a1a' : '#f0c38a', 0.06, 0.035, 0.016);
      g.children.slice(2).forEach((m) => (m.position.x += 0.11));
      break;
    }
    case 'cupramen': {
      g.add(cyl(0.06, 0.045, 0.1, '#f2f2f2', 0, 0.05, 0, 14));
      g.add(cyl(0.0605, 0.055, 0.035, def.color, 0, 0.075, 0, 14));
      const noodle = cyl(0.056, 0.056, 0.01, '#e8c26b', 0, 0.095, 0, 14);
      g.add(noodle);
      update = (left) => {
        noodle.position.y = 0.02 + 0.075 * (left / max);
      };
      break;
    }
    case 'triangle': {
      const pieces = [];
      for (let i = 0; i < max; i++) {
        const t = new THREE.Group();
        const rice = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.035, 3), mat('#f5f2ea'), 0, 0.0175, 0);
        t.add(rice);
        t.add(box(0.05, 0.036, 0.06, def.color, 0, 0.018, 0.03));
        t.position.set((i - 1) * 0.06, 0, i % 2 ? 0.03 : -0.02);
        t.rotation.y = i * 0.7;
        t.scale.setScalar(0.7);
        g.add(t);
        pieces.push(t);
      }
      update = (left) => pieces.forEach((p, i) => (p.visible = i < left));
      break;
    }
  }

  // 클릭 판정용
  const hit = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.1, 0);
  g.add(hit);
  g.hit = hit;
  g.setLeft = update;
  return g;
}
