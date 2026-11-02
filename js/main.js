/* =========================================================================
 *  main.js — A "placa-mãe": liga tela, BASIC, SID, memória, teclado,
 *  disquete virtual, comandos especiais (HELP / HARDWARE / HISTORIA)
 *  e a interface da página.
 * ========================================================================= */
'use strict';

const COLOR_TAGS = { blk: 0, wht: 1, red: 2, cyn: 3, pur: 4, grn: 5, blu: 6, yel: 7, org: 8, brn: 9,
  lrd: 10, gr1: 11, gr2: 12, lgn: 13, lbl: 14, gr3: 15 };

class C64Machine {
  constructor(canvas) {
    this.screen = new C64Screen(canvas);
    this.screen.glyphs = buildCharset();
    this.sid = new MiniSID();
    this.ram = new Uint8Array(65536);
    this.keyBuf = [];
    this.pager = null;
    this.busy = null;
    this.typeQueue = [];
    this.typeClock = 0;
    this.powered = false;
    this.booting = false;
    this.bootTime = performance.now();
    this.jiffyOffset = 0;
    this.listeners = {};
    this.basic = new BasicInterpreter(this.makeHost());
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach((fn) => fn(...a)); }

  makeHost() {
    const m = this;
    return {
      screen: m.screen,
      peek: (a) => m.peek(a),
      poke: (a, v) => m.poke(a, v),
      getKey: () => (m.keyBuf.length ? String.fromCharCode(m.keyBuf.shift()) : ''),
      sys: (a) => m.sys(a),
      jiffies: () => m.jiffies(),
      setJiffies: (n) => { m.jiffyOffset = n - m.rawJiffies(); },
      fileOp: (k, n, d, sa, cb) => m.fileOp(k, n, d, sa, cb),
      onReady: () => m.ready(),
      onInput: () => {}
    };
  }

  rawJiffies() { return (performance.now() - this.bootTime) * 60 / 1000; }
  jiffies() { return (this.rawJiffies() + this.jiffyOffset) % 5184000; }

  /* -------------------- memória -------------------- */
  peek(a) {
    const s = this.screen;
    if (a >= 1024 && a < 2024) return s.chars[a - 1024];
    if (a >= 55296 && a < 56296) return s.colors[a - 55296] | 0xF0;
    switch (a) {
      case 1: return 0x37;
      case 160: return (this.jiffies() >> 16) & 255;
      case 161: return (this.jiffies() >> 8) & 255;
      case 162: return Math.floor(this.jiffies()) & 255;
      case 197: return this.keyBuf.length ? 0 : 64;
      case 198: return this.keyBuf.length;
      case 211: return s.cx;
      case 214: return Math.min(s.cy, 24);
      case 646: return s.color;
      case 53265: return (s.blanked ? 0x0B : 0x1B) | ((this.raster() > 255) ? 128 : 0);
      case 53266: return this.raster() & 255;
      case 53280: return s.border | 0xF0;
      case 53281: return s.bg | 0xF0;
      case 56320: case 56321: return 0xFF;
    }
    if (a >= 54272 && a <= 54300) return this.sid.read(a - 54272);
    return this.ram[a];
  }

  raster() { return Math.floor(performance.now() * 15.625) % 312; }

  poke(a, v) {
    const s = this.screen;
    this.ram[a] = v;
    if (a >= 1024 && a < 2024) { s.chars[a - 1024] = v; s.dirty = true; return; }
    if (a >= 55296 && a < 56296) { s.colors[a - 55296] = v & 15; s.dirty = true; return; }
    if (a >= 54272 && a <= 54296) { this.sid.write(a - 54272, v); return; }
    switch (a) {
      case 198: this.keyBuf.length = Math.min(v, this.keyBuf.length); break;
      case 211: s.cx = Math.min(v, 39); break;
      case 214: s.cy = Math.min(v, 24); break;
      case 646: s.color = v & 15; break;
      case 53265: s.blanked = !(v & 16); s.dirty = true; break;
      case 53280: s.setBorder(v); break;
      case 53281: s.setBg(v); break;
    }
  }

  sys(a) {
    if (a === 64738 || a === 65126) setTimeout(() => this.reset(), 0);
  }

  /* -------------------- ciclo de vida -------------------- */
  powerOn() {
    if (this.powered) return;
    this.powered = true;
    this.booting = true;
    this.screen.powered = true;
    this.screen.reset();
    this.screen.chars.fill(32);
    this.screen.dirty = true;
    this.emit('power', true);
    setTimeout(() => { this.booting = false; this.reset(); }, 450);
  }

  powerOff() {
    if (!this.powered) return;
    this.powered = false;
    this.basic.cold();
    this.pager = null; this.busy = null; this.typeQueue = [];
    this.sid.reset();
    this.screen.powered = false;
    this.screen.showCursor(false);
    this.screen.dirty = true;
    this.emit('power', false);
  }

  reset() {
    this.sid.reset();
    this.ram.fill(0);
    this.keyBuf = [];
    this.pager = null; this.busy = null; this.typeQueue = [];
    this.basic.cold();
    this.bootTime = performance.now(); this.jiffyOffset = 0;
    const s = this.screen;
    s.reset();
    s.newline();
    s.print('    **** COMMODORE 64 BASIC V2 ****');
    s.newline(); s.newline();
    s.print(' 64K RAM SYSTEM  38911 BASIC BYTES FREE');
    s.newline(); s.newline();
    this.ready();
  }

  /** RUN/STOP + RESTORE: para tudo e restaura as cores */
  restore() {
    if (!this.powered || this.booting) return;
    this.pager = null; this.busy = null; this.typeQueue = [];
    if (this.basic.state !== 'direct') { this.basic.state = 'direct'; }
    this.sid.reset();
    const s = this.screen;
    s.reset();
    this.ready();
  }

  ready() {
    const s = this.screen;
    if (s.cx !== 0) s.newline();
    s.print('READY.');
    s.newline();
    this.emit('ready');
  }

  /* -------------------- laço principal (60 Hz) -------------------- */
  frame(t) {
    const dt = Math.min(t - this.last, 100);
    this.last = t;
    const s = this.screen;
    s.tick(dt);
    if (this.powered && !this.booting) {
      if (this.busy && t >= this.busy.at) { const fn = this.busy.fn; this.busy = null; fn(); }
      if (this.typeQueue.length && !this.pager && !this.busy && this.basic.state === 'direct') {
        this.typeClock += dt;
        while (this.typeClock >= 38 && this.typeQueue.length) { this.typeClock -= 38; this.press(this.typeQueue.shift(), true); if (this.basic.state !== 'direct') break; }
      }
      if (this.pager) this.pagerStep();
      this.basic.step(dt);
      const st = this.basic.state;
      s.showCursor(!this.pager && !this.busy && (st === 'direct' || st === 'input'));
    }
    s.render();
    requestAnimationFrame((tt) => this.frame(tt));
  }

  /* -------------------- teclado -------------------- */
  /** Entrada única de teclas (PETSCII) vinda do teclado físico ou virtual */
  press(code, auto = false) {
    if (!this.powered || this.booting) return;
    if (code === 'restore') { this.restore(); return; }
    if (!auto && this.typeQueue.length) this.typeQueue = [];
    if (this.pager) { this.pagerKey(code); return; }
    if (this.busy) { if (code === 3) { const cb = this.busy.cancel; this.busy = null; if (cb) cb(); } return; }
    const st = this.basic.state;
    if (st === 'run' || st === 'wait' || st === 'io' || st === 'halt') {
      if (code === 3) this.basic.breakProgram();
      else if (this.keyBuf.length < 10) this.keyBuf.push(code);
      return;
    }
    this.edit(code);
  }

  edit(code) {
    const s = this.screen;
    const literal = s.quote || s.insertCount > 0;
    if (code === 13) { this.handleReturn(); return; }
    if (code === 141) { const { end } = s.logicalBounds(s.cy); s.cy = end; s.newline(); return; }
    if (code === 3) return;
    if (code === 20) { s.del(); return; }
    const isControl = (code < 32) || (code >= 128 && code < 160);
    if (isControl && literal && code !== 20) { s.typeCode(code); return; }
    switch (code) {
      case 148: s.inst(); return;
      case 19: s.home(); return;
      case 147: s.clear(); return;
      case 17: s.cursorDown(); return;
      case 145: s.cursorUp(); return;
      case 29: s.cursorRight(); return;
      case 157: s.cursorLeft(); return;
      case 18: s.rvs = true; return;
      case 146: s.rvs = false; return;
    }
    const ci = PETSCII_COLORS.indexOf(code);
    if (ci >= 0) { s.color = ci; s.dirty = true; return; }
    if (code >= 133 && code <= 140) return;   // F1-F8 não fazem nada no BASIC
    s.typeCode(code);
  }

  handleReturn() {
    const s = this.screen;
    if (this.basic.state === 'input') {
      const mark = s.inputMark;
      const from = mark && mark.row >= 0 ? mark.row * 40 + mark.col : -1;
      const { text, end } = s.readLogicalLine(s.cy, from);
      s.cy = end; s.newline();
      s.inputMark = null;
      this.basic.inputLine(text);
      return;
    }
    const { text, end } = s.readLogicalLine(s.cy);
    s.cy = end;
    s.newline();
    this.command(text);
  }

  /** Digita um comando automaticamente (botões da página) */
  typeCommand(cmd) {
    if (!this.powered) { this.powerOn(); setTimeout(() => this.typeCommand(cmd), 900); return; }
    if (this.booting) { setTimeout(() => this.typeCommand(cmd), 300); return; }
    if (this.pager) this.endPager();
    if (this.busy) { this.busy = null; this.basic.state = 'direct'; this.ready(); }
    if (this.basic.state !== 'direct') this.basic.breakProgram();
    const s = this.screen;
    const { text } = s.readLogicalLine(s.cy);
    const q = [];
    if (text.trim() !== '') q.push(141);
    for (const part of String(cmd).split('|')) {           // "LOAD"MAZE",8|RUN"
      for (const ch of toPetscii(part)) q.push(ch.charCodeAt(0));
      q.push(13);
    }
    this.typeQueue = q;
    this.typeClock = 0;
  }

  /* -------------------- comandos especiais -------------------- */
  command(raw) {
    const plain = petsciiToText(raw).replace(/\s+/g, ' ').trim();
    const s = this.screen;
    let m;
    if (plain === '') return;
    if (/^(HELP|SOBRE|AJUDA|ABOUT)$/.test(plain)) return this.startPager(pageSobre());
    if (/^(COMANDOS|COMMANDS)$/.test(plain)) return this.startPager(pageComandos());
    if (/^(HISTORIA|HISTORY)$/.test(plain)) return this.startPager(pageHistoria());
    if ((m = plain.match(/^HARDWARE(?: (.+))?$/))) {
      const sec = m[1] ? m[1].replace(/ /g, '') : '';
      const page = pageHardware(sec);
      if (page) return this.startPager(page);
      return this.startPager(['{lrd}?SEÇÃO NÃO ENCONTRADA', '', '{lbl}USE: HARDWARE <SEÇÃO>', '{gr3}' + HW_ORDER.slice(0, 6).join(' '), '{gr3}' + HW_ORDER.slice(6).join(' ')]);
    }
    if (/^GITHUB$/.test(plain) || /^LINKEDIN$/.test(plain)) {
      const url = plain === 'GITHUB' ? PERFIL.github : PERFIL.linkedin;
      s.print('ABRINDO ' + shortUrl(url) + '...');
      s.newline();
      try { window.open(url, '_blank', 'noopener'); } catch (e) { /* bloqueado */ }
      this.ready();
      return;
    }
    if (/^TURBO$/.test(plain)) {
      this.basic.turbo = !this.basic.turbo;
      s.print(this.basic.turbo ? 'TURBO LIGADO (25X)' : 'TURBO DESLIGADO (1 MHZ)');
      s.newline(); this.ready(); this.emit('turbo', this.basic.turbo);
      return;
    }
    if (/^(CLS|CLEAR)$/.test(plain)) { s.clear(); this.ready(); return; }
    if (/^(DIR|@\$)$/.test(plain)) {
      this.diskDirectory().forEach((l) => { s.printPetscii(l); s.newline(); });
      this.ready();
      return;
    }
    /* BASIC */
    try {
      if (/^\s*\d/.test(raw)) { this.basic.enterLine(raw); return; }
      this.basic.execDirect(raw);
    } catch (e) {
      this.basic.lineIdx = -1;
      this.basic.handleError(e);
    }
  }

  /* -------------------- paginador -------------------- */
  startPager(lines) {
    this.pager = { lines, i: 0, rows: 0, waiting: false, base: this.screen.color };
    this.screen.showCursor(false);
  }

  pagerStep() {
    const p = this.pager;
    if (p.waiting) return;
    for (let n = 0; n < 2; n++) {
      if (p.i >= p.lines.length) { this.endPager(); return; }
      const line = p.lines[p.i++];
      this.printRich(line, p.base);
      p.rows += Math.max(1, Math.ceil(visLen(line) / 40));
      if (p.rows >= 22 && p.i < p.lines.length) {
        const s = this.screen;
        s.rvs = true; s.color = 1;
        s.print(' ESPAÇO = MAIS     Q / ESC = SAIR ');
        s.rvs = false; s.color = p.base;
        p.waiting = true;
        return;
      }
    }
  }

  pagerKey(code) {
    const p = this.pager;
    if (!p.waiting) { if (code === 3 || code === 81) this.endPager(); return; }
    const s = this.screen;
    s.chars.fill(32, s.cy * 40, s.cy * 40 + 40);
    s.cx = 0; s.dirty = true;
    p.waiting = false; p.rows = 0;
    if (code === 3 || code === 81) this.endPager();
    else if (code === 13) p.rows = 21;              // RETURN avança uma linha
  }

  endPager() {
    const p = this.pager;
    this.pager = null;
    this.screen.color = p ? p.base : 14;
    this.screen.rvs = false;
    this.ready();
  }

  printRich(line, base) {
    const s = this.screen;
    s.color = base; s.rvs = false;
    const parts = line.split(/(\{[a-z0-9]+\})/);
    for (const part of parts) {
      const m = part.match(/^\{([a-z0-9]+)\}$/);
      if (m) {
        if (m[1] === 'rvs') s.rvs = true;
        else if (m[1] === 'off') s.rvs = false;
        else if (COLOR_TAGS[m[1]] !== undefined) s.color = COLOR_TAGS[m[1]];
        continue;
      }
      s.print(part);
    }
    s.rvs = false;
    s.newline();
  }

  /* -------------------- disquete virtual -------------------- */
  userFiles() {
    try { return JSON.parse(localStorage.getItem('c64.disk') || '{}'); } catch (e) { return {}; }
  }

  saveUserFile(name, lines) {
    try {
      const d = this.userFiles();
      d[name] = lines;
      localStorage.setItem('c64.disk', JSON.stringify(d));
      return true;
    } catch (e) { return false; }
  }

  diskFiles() {
    const files = [];
    const user = this.userFiles();
    Object.keys(DEMOS).forEach((n) => { if (!user[n]) files.push({ name: n, lines: DEMOS[n] }); });
    Object.keys(user).forEach((n) => files.push({ name: n, lines: user[n] }));
    return files;
  }

  findFile(name) {
    const files = this.diskFiles();
    if (name === '*') return files[0];
    if (name.endsWith('*')) return files.find((f) => f.name.startsWith(name.slice(0, -1)));
    return files.find((f) => f.name === name);
  }

  diskDirectory() {
    const RVS = '\x12', OFF = '\x92';
    const out = ['0 ' + RVS + '"' + DISK_NAME.padEnd(16) + '" ' + DISK_ID + ' 2A' + OFF];
    let used = 0;
    for (const f of this.diskFiles()) {
      const bytes = f.lines.reduce((a, l) => a + l.length + 5, 2);
      const blocks = Math.max(1, Math.ceil(bytes / 254));
      used += blocks;
      out.push(String(blocks).padEnd(5) + '"' + f.name + '"' + ' '.repeat(16 - f.name.length) + ' PRG');
    }
    out.push((664 - used) + ' BLOCKS FREE.');
    return out.map((l) => toPetscii(l).replace(/\x12/g, RVS));
  }

  fileOp(kind, rawName, dev, sa, cb) {
    const s = this.screen;
    const name = petsciiToText(rawName).trim().replace(/^@?\d?:/, '').slice(0, 16);
    const later = (ms, fn) => { this.busy = { at: performance.now() + ms, fn, cancel: () => cb('BREAK') }; };
    if (dev === 1) {
      s.print(kind === 'SAVE' ? 'PRESS RECORD & PLAY ON TAPE' : 'PRESS PLAY ON TAPE');
      s.newline();
      later(1600, () => cb('DEVICE'));
      return;
    }
    if (dev !== 8) { cb('DEVICE'); return; }
    if (!name) { cb('MISSING'); return; }

    if (kind === 'SAVE') {
      s.print('SAVING ' + name); s.newline();
      const lines = this.basic.programLines();
      later(700, () => cb(this.saveUserFile(name, lines) ? null : 'DEVICE'));
      return;
    }
    s.print('SEARCHING FOR ' + name); s.newline();
    later(500, () => {
      if (name === '$') {
        s.print('LOADING'); s.newline();
        later(500, () => {
          this.basic.cold();
          this.basic.dirListing = this.diskDirectory();
          cb(null);
        });
        return;
      }
      const f = this.findFile(name);
      if (!f) { cb('NOTFOUND'); return; }
      if (kind === 'VERIFY') {
        s.print('VERIFYING'); s.newline();
        const same = JSON.stringify(f.lines.map((l) => toPetscii(l))) === JSON.stringify(this.basic.programLines());
        later(500, () => { if (same) { s.print('OK'); s.newline(); cb(null); } else cb('VERIFY'); });
        return;
      }
      s.print('LOADING'); s.newline();
      later(700, () => { this.basic.loadProgram(f.lines.map((l) => toPetscii(l))); cb(null); });
    });
  }
}

/* =========================================================================
 *  Teclado virtual (layout do C64) e mapeamento do teclado físico
 * ========================================================================= */
const KEY_ROWS = [
  [
    { k: '←', c: 95 }, { k: '1', s: '!', f: 'BLK', f2: 'ORG' }, { k: '2', s: '"', f: 'WHT', f2: 'BRN' },
    { k: '3', s: '#', f: 'RED', f2: 'L.RD' }, { k: '4', s: '$', f: 'CYN', f2: 'GR1' }, { k: '5', s: '%', f: 'PUR', f2: 'GR2' },
    { k: '6', s: '&', f: 'GRN', f2: 'L.GN' }, { k: '7', s: "'", f: 'BLU', f2: 'L.BL' }, { k: '8', s: '(', f: 'YEL', f2: 'GR3' },
    { k: '9', s: ')', f: 'RVS', f2: 'ON' }, { k: '0', f: 'RVS', f2: 'OFF' }, { k: '+' }, { k: '-' }, { k: '£', c: 92 },
    { k: 'HOME', s: 'CLR', t: 'home', id: 'HOME' }, { k: 'DEL', s: 'INST', t: 'del', id: 'DEL' }
  ],
  [
    { k: 'CTRL', t: 'ctrl', w: 1.5, id: 'CTRL' }, ...'QWERTYUIOP'.split('').map((k) => ({ k })), { k: '@' }, { k: '*' },
    { k: '↑', s: 'π', c: 94, id: 'UPARROW' }, { k: 'RESTORE', t: 'restore', w: 1.5, id: 'RESTORE' }
  ],
  [
    { k: 'STOP', s: 'RUN', t: 'stop', id: 'STOP' }, { k: 'LOCK', s: 'SHIFT', t: 'lock', id: 'LOCK' },
    ...'ASDFGHJKL'.split('').map((k) => ({ k })), { k: ':', s: '[' }, { k: ';', s: ']' }, { k: '=' },
    { k: 'RETURN', t: 'ret', w: 2, id: 'RETURN' }
  ],
  [
    { k: 'C=', t: 'cbm', id: 'CBM' }, { k: 'SHIFT', t: 'shift', w: 1.5, id: 'LSHIFT' },
    ...'ZXCVBNM'.split('').map((k) => ({ k })), { k: ',', s: '<' }, { k: '.', s: '>' }, { k: '/', s: '?' },
    { k: 'SHIFT', t: 'shift', w: 1.5, id: 'RSHIFT' }, { k: '↑↓', s: 'CRSR', t: 'ud', id: 'CRSRUD' }, { k: '←→', s: 'CRSR', t: 'lr', id: 'CRSRLR' }
  ],
  [
    { gap: 3 }, { k: '', t: 'space', w: 9, id: 'SPACE' }, { gap: 4 }
  ]
];
const FKEYS = [['F1', 'F2', 133, 137], ['F3', 'F4', 134, 138], ['F5', 'F6', 135, 139], ['F7', 'F8', 136, 140]];

function buildKeyboard(root, machine) {
  const mods = { shift: false, ctrl: false, cbm: false, lock: false };
  const modEls = { shift: [], ctrl: [], cbm: [], lock: [] };
  const refresh = () => Object.keys(modEls).forEach((m) => modEls[m].forEach((el) => el.classList.toggle('latched', mods[m])));

  const main = document.createElement('div');
  main.className = 'kb-main';
  KEY_ROWS.forEach((row) => {
    const r = document.createElement('div');
    r.className = 'kb-row';
    row.forEach((key) => {
      if (key.gap) { const g = document.createElement('span'); g.className = 'kb-gap'; g.style.flexGrow = key.gap; r.appendChild(g); return; }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'key' + (key.t ? ' key-' + key.t : '') + (key.k.length > 2 ? ' key-word' : '');
      b.style.flexGrow = key.w || 1;
      b.dataset.id = key.id || key.k;
      b.setAttribute('aria-label', (key.s ? key.s + ' ' : '') + (key.k || 'ESPAÇO'));
      b.innerHTML = (key.s ? `<span class="k-sh">${key.s}</span>` : '') +
        `<span class="k-main">${key.k}</span>` +
        (key.f ? `<span class="k-front"><i>${key.f}</i><i>${key.f2}</i></span>` : '');
      if (key.t && modEls[key.t]) modEls[key.t].push(b);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); machine.sid.unlock(); b.classList.add('down'); });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
      b.addEventListener('click', (e) => { e.preventDefault(); activate(key); });
      r.appendChild(b);
    });
    main.appendChild(r);
  });

  const fk = document.createElement('div');
  fk.className = 'kb-fkeys';
  FKEYS.forEach(([a, b2, c1, c2]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'key key-fn'; b.dataset.id = a;
    b.innerHTML = `<span class="k-main">${a}</span><span class="k-sh">${b2}</span>`;
    b.setAttribute('aria-label', a);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); });
    const up = () => b.classList.remove('down');
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
    b.addEventListener('click', () => { machine.press(mods.shift || mods.lock ? c2 : c1); release(); });
    fk.appendChild(b);
  });

  root.appendChild(main);
  root.appendChild(fk);

  function release() { mods.shift = false; mods.ctrl = false; mods.cbm = false; refresh(); }

  function activate(key) {
    const shifted = mods.shift || mods.lock;
    switch (key.t) {
      case 'shift': mods.shift = !mods.shift; refresh(); return;
      case 'ctrl': mods.ctrl = !mods.ctrl; refresh(); return;
      case 'cbm': mods.cbm = !mods.cbm; refresh(); return;
      case 'lock': mods.lock = !mods.lock; refresh(); return;
      case 'ret': machine.press(shifted ? 141 : 13); break;
      case 'del': machine.press(shifted ? 148 : 20); break;
      case 'home': machine.press(shifted ? 147 : 19); break;
      case 'ud': machine.press(shifted ? 145 : 17); break;
      case 'lr': machine.press(shifted ? 157 : 29); break;
      case 'stop': machine.press(3); break;
      case 'restore': machine.press('restore'); break;
      case 'space': machine.press(32); break;
      default: {
        const d = '1234567890'.indexOf(key.k);
        if (mods.ctrl && d >= 0 && d <= 7) machine.press(PETSCII_COLORS[d]);
        else if (mods.ctrl && key.k === '9') machine.press(18);
        else if (mods.ctrl && key.k === '0') machine.press(146);
        else if (mods.cbm && d >= 0 && d <= 7) machine.press(PETSCII_COLORS[8 + d]);
        else if (shifted && key.s) machine.press(toPetscii(key.s).charCodeAt(0));
        else if (shifted && /^[A-Z]$/.test(key.k)) machine.press(key.k.charCodeAt(0) + 128);
        else if (shifted && key.k === '↑') machine.press(255);
        else machine.press(key.c || key.k.charCodeAt(0));
      }
    }
    release();
  }

  /* destaque das teclas quando o teclado físico é usado */
  return function flash(id) {
    const el = root.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.classList.add('down');
    setTimeout(() => el.classList.remove('down'), 110);
  };
}

/** Teclado físico -> código PETSCII (ou null para deixar o navegador agir) */
function mapPhysicalKey(e) {
  const k = e.key;
  if (e.metaKey || e.isComposing) return null;
  if (e.altKey && /^Digit[1-8]$/.test(e.code)) return PETSCII_COLORS[7 + +e.code.slice(5)];
  if (e.ctrlKey) {
    const d = /^Digit(\d)$/.test(e.code) ? +e.code.slice(5) : -1;
    if (d >= 1 && d <= 8) return PETSCII_COLORS[d - 1];
    if (d === 9) return 18;
    if (d === 0) return 146;
    return null;
  }
  if (e.altKey) return null;
  switch (k) {
    case 'Enter': return e.shiftKey ? 141 : 13;
    case 'Backspace': return e.shiftKey ? 148 : 20;
    case 'Delete': return 20;
    case 'Insert': return 148;
    case 'Home': return e.shiftKey ? 147 : 19;
    case 'End': return 147;
    case 'ArrowUp': return 145;
    case 'ArrowDown': return 17;
    case 'ArrowLeft': return 157;
    case 'ArrowRight': return 29;
    case 'Escape': return 3;
    case 'PageUp': return 'restore';
  }
  if (k.length === 1) {
    const p = toPetscii(k);
    if (p.length === 1) return p.charCodeAt(0);
  }
  return null;
}

function physicalKeyId(e) {
  const map = { Enter: 'RETURN', Backspace: 'DEL', Delete: 'DEL', Insert: 'DEL', Escape: 'STOP', Home: 'HOME', End: 'HOME',
    ArrowUp: 'CRSRUD', ArrowDown: 'CRSRUD', ArrowLeft: 'CRSRLR', ArrowRight: 'CRSRLR', ' ': 'SPACE', Shift: 'LSHIFT',
    Control: 'CTRL', Alt: 'CBM', PageUp: 'RESTORE', '^': 'UPARROW' };
  if (map[e.key]) return map[e.key];
  if (e.key.length === 1) return e.key.toUpperCase();
  return null;
}

/* =========================================================================
 *  Inicialização da página
 * ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#screen');
  const crt = $('#crt');
  const proxy = $('#kbd-proxy');
  const machine = new C64Machine(canvas);
  window.c64 = machine;                        // útil para depurar no console

  /* brilho do monitor acompanha a cor da borda */
  machine.screen.onBorderChange = (c) => document.documentElement.style.setProperty('--glow', C64_PALETTE[c]);
  machine.screen.onBorderChange(machine.screen.border);

  /* teclado virtual */
  const flash = buildKeyboard($('#keyboard'), machine);

  /* teclado físico */
  const typingTarget = (el) => el && el !== proxy && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  window.addEventListener('keydown', (e) => {
    if (typingTarget(e.target)) return;
    machine.sid.unlock();
    const id = physicalKeyId(e);
    if (id) flash(id);
    if (e.key === 'Unidentified' || e.keyCode === 229) return;  // teclados móveis: tratado no beforeinput
    const code = mapPhysicalKey(e);
    if (code === null) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
    machine.press(code);
  });

  /* teclado nativo do celular (textarea invisível sobre a tela) */
  proxy.addEventListener('beforeinput', (e) => {
    e.preventDefault();
    if (e.inputType === 'insertText' || e.inputType === 'insertCompositionText') {
      for (const ch of toPetscii(e.data || '')) machine.press(ch.charCodeAt(0));
    } else if (e.inputType === 'deleteContentBackward') machine.press(20);
    else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') machine.press(13);
  });
  proxy.addEventListener('input', () => { proxy.value = ''; });
  crt.addEventListener('click', () => {
    machine.sid.unlock();
    if (machine.pager && machine.pager.waiting) { machine.press(32); return; }   // toque = "mais"
    proxy.focus({ preventScroll: true });
  });

  /* botões de comando rápido */
  document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => {
    machine.sid.unlock();
    machine.typeCommand(b.dataset.cmd);
    b.blur();
  }));

  /* liga/desliga */
  const powerBtns = document.querySelectorAll('[data-power]');
  const setPowerUI = (on) => {
    document.body.classList.toggle('is-off', !on);
    powerBtns.forEach((b) => b.setAttribute('aria-pressed', String(on)));
  };
  machine.on('power', setPowerUI);
  powerBtns.forEach((b) => b.addEventListener('click', () => {
    machine.sid.unlock();
    if (machine.powered) machine.powerOff(); else machine.powerOn();
    b.blur();
  }));

  /* som */
  const soundBtn = $('#btn-sound');
  soundBtn.addEventListener('click', () => {
    machine.sid.unlock();
    machine.sid.muted = !machine.sid.muted;
    soundBtn.setAttribute('aria-pressed', String(!machine.sid.muted));
    soundBtn.classList.toggle('off', machine.sid.muted);
    soundBtn.blur();
  });

  /* tela cheia */
  $('#btn-full').addEventListener('click', (e) => {
    const el = $('#bezel');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    e.currentTarget.blur();
  });

  /* turbo */
  const turboBtn = $('#btn-turbo');
  turboBtn.addEventListener('click', () => { machine.typeCommand('TURBO'); turboBtn.blur(); });
  machine.on('turbo', (on) => turboBtn.classList.toggle('on', on));

  /* leitor de tela: espelha o texto da tela quando o BASIC fica pronto */
  const sr = $('#sr-screen');
  let srTimer = null;
  machine.on('ready', () => {
    clearTimeout(srTimer);
    srTimer = setTimeout(() => { sr.textContent = machine.screen.dumpText(); }, 400);
  });

  /* liga o computador */
  setTimeout(() => machine.powerOn(), 350);
});
