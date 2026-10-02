// public/sounds/ 폴더의 mp3를 불러와 재생. 파일이 없으면 조용히 건너뜀 (sounds/README.md 참고)
const SOUNDS = [
  'ambient_pocha', 'ambient_pub', 'ambient_store',
  'chair_scrape', 'clink', 'pour', 'can_open', 'sip', 'bite', 'serve', 'call_bell',
  'lighter', 'door_chime', 'plastic_bag', 'crowd_cheer', 'laugh', 'car_pass', 'footsteps', 'meow',
];

// 장소별 분위기: 배경 루프 볼륨 + 가끔 나는 소리 [이름, 최소초, 최대초, 볼륨]
const VENUE_SOUND = {
  pocha: { loop: 'ambient_pocha', vol: 0.45, random: [['laugh', 15, 40, 0.25], ['clink', 8, 25, 0.12], ['chair_scrape', 25, 60, 0.15]] },
  pub: { loop: 'ambient_pub', vol: 0.7, random: [['crowd_cheer', 20, 50, 0.35], ['clink', 5, 15, 0.2], ['laugh', 8, 20, 0.3], ['call_bell', 20, 45, 0.2]] },
  store: { loop: 'ambient_store', vol: 0.3, random: [['chair_scrape', 18, 45, 0.35], ['car_pass', 25, 70, 0.3], ['door_chime', 30, 80, 0.15]] },
};

export class AudioManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.buffers = {};
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.connect(this.master);
    this.ambientLevel = 1;
    this.current = null;
    this.timers = [];
    this.missing = [];
    this.ready = Promise.all(SOUNDS.map((n) => this.load(n))).then(() => {
      if (this.missing.length) console.info('[sound] 아직 없는 파일:', this.missing.join(', '));
    });
  }

  async load(name) {
    try {
      const res = await fetch(`sounds/${name}.mp3`);
      if (!res.ok) throw 0;
      this.buffers[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      this.missing.push(name);
    }
  }

  play(name, { volume = 1, rate = 1, delay = 0, out } = {}) {
    const buf = this.buffers[name];
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(out || this.master);
    src.start(this.ctx.currentTime + delay);
    return src;
  }

  async setVenue(key) {
    await this.ready;
    const cfg = VENUE_SOUND[key];
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const now = this.ctx.currentTime;
    if (this.current) {
      const old = this.current;
      old.gain.gain.setTargetAtTime(0, now, 0.6);
      setTimeout(() => old.src.stop(), 3000);
      this.current = null;
    }
    if (this.buffers[cfg.loop]) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[cfg.loop];
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(cfg.vol, now, 0.8);
      src.connect(gain).connect(this.ambientGain);
      src.start();
      this.current = { src, gain };
    }
    for (const [name, min, max, vol] of cfg.random) {
      const loop = () => {
        this.timers.push(setTimeout(() => {
          this.play(name, { volume: vol * this.ambientLevel, rate: 0.9 + Math.random() * 0.2, out: this.ambientGain });
          loop();
        }, (min + Math.random() * (max - min)) * 1000));
      };
      loop();
    }
  }

  // 배경 소음 볼륨 (0~1)
  setAmbient(v) {
    this.ambientLevel = v;
    this.ambientGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  stopAll() {
    this.timers.forEach(clearTimeout);
    if (this.current) this.current.src.stop();
    this.current = null;
  }
}
