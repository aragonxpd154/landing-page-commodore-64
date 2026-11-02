/* =========================================================================
 *  screen.js — Tela do VIC-II simulada (40x25 caracteres, 320x200 pixels)
 *  ---------------------------------------------------------------------
 *  - Memória de tela (screen codes) e Color RAM, exatamente como no C64
 *  - Conjunto de caracteres maiúsculo/gráfico (PETSCII) desenhado pixel
 *    a pixel: letras e números vêm da fonte Press Start 2P (8x8) e os
 *    gráficos PETSCII (linhas, blocos, naipes...) são gerados em código
 *  - Editor de tela "full screen" com linhas lógicas de até 80 colunas,
 *    modo aspas (quote mode), INST/DEL e cursor piscando
 * ========================================================================= */
'use strict';

/* Paleta "Pepto" (PAL) — as 16 cores do VIC-II */
const C64_PALETTE = [
  '#000000', '#FFFFFF', '#68372B', '#70A4B2', '#6F3D86', '#588D43', '#352879', '#B8C76F',
  '#6F4F25', '#433900', '#9A6759', '#444444', '#6C6C6C', '#9AD284', '#6C5EB5', '#959595'
];
const C64_COLOR_NAMES = ['PRETO', 'BRANCO', 'VERMELHO', 'CIANO', 'ROXO', 'VERDE', 'AZUL', 'AMARELO',
  'LARANJA', 'MARROM', 'VERM. CLARO', 'CINZA 1', 'CINZA 2', 'VERDE CLARO', 'AZUL CLARO', 'CINZA 3'];

/* Códigos PETSCII de cor (CTRL+1..8 e C=+1..8) */
const PETSCII_COLORS = [144, 5, 28, 159, 156, 30, 31, 158, 129, 149, 150, 151, 152, 153, 154, 155];

/* ------------------------------------------------------------------ */
/*  Conversões PETSCII <-> screen code <-> Unicode                      */
/* ------------------------------------------------------------------ */

/** PETSCII imprimível -> screen code (sem bit de reverso). -1 = controle */
function petsciiToScreen(c) {
  if (c >= 32 && c <= 63) return c;
  if (c >= 64 && c <= 95) return c - 64;
  if (c >= 96 && c <= 127) return c - 32;
  if (c >= 160 && c <= 191) return c - 64;
  if (c >= 192 && c <= 254) return c - 128;
  if (c === 255) return 94;
  return -1;
}

/** screen code (0-127) -> PETSCII (para ler a linha digitada) */
function screenToPetscii(s) {
  if (s < 32) return s + 64;
  if (s < 64) return s;
  if (s < 96) return s + 128;
  return s + 64;
}

/* Unicode -> PETSCII para textos escritos no código-fonte */
const UNI_TO_PETSCII = {
  '─': 192, '│': 221, '┌': 176, '┐': 174, '└': 173, '┘': 189, '├': 171, '┤': 179,
  '┬': 178, '┴': 177, '┼': 219, '╲': 205, '╱': 206, '●': 209, '○': 215, '♥': 211,
  '♠': 193, '♣': 216, '♦': 218, '╳': 214, 'π': 222, '▒': 166, '▌': 161, '▄': 162,
  '▔': 163, '▁': 164, '▏': 165, '▕': 167, '◤': 169, '◥': 223, '▗': 172, '▖': 187,
  '▝': 188, '▘': 190, '▚': 191, '╭': 213, '╮': 201, '╰': 202, '╯': 203,
  '£': 92, '↑': 94, '^': 94, '←': 95, '\\': 205, '|': 221, '_': 164, '{': 91, '}': 93,
  '~': 45, '`': 39, '·': 46, '•': 209, '—': 45, '–': 45, '“': 34, '”': 34, '’': 39, '‘': 39,
  'ª': 65, 'º': 79, '°': 79
};

/** Converte texto Unicode em uma string PETSCII (um char = um código) */
function toPetscii(str) {
  let out = '';
  const norm = String(str).normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const ch of norm) {
    if (ch === '\n') { out += '\r'; continue; }
    if (ch === '\r' || ch.charCodeAt(0) < 32) { out += ch; continue; }
    if (UNI_TO_PETSCII[ch] !== undefined) { out += String.fromCharCode(UNI_TO_PETSCII[ch]); continue; }
    const up = ch.toUpperCase();
    const c = up.charCodeAt(0);
    if (c >= 32 && c <= 93) { out += up; continue; }
    if (ch === '█') { out += '\x12 \x92'; continue; }
    out += ' ';
  }
  return out;
}

/** PETSCII -> texto legível (para leitores de tela e cópia) */
function petsciiToText(str) {
  let out = '';
  for (const ch of str) {
    const c = ch.charCodeAt(0);
    if (c === 13) out += '\n';
    else if (c >= 32 && c <= 90) out += ch;
    else if (c === 92) out += '£';
    else if (c === 94) out += '↑';
    else if (c === 95) out += '←';
    else if (c >= 91 && c <= 93) out += ch;
    else if (c >= 160) out += ' ';
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Gráficos PETSCII desenhados à mão (8x8)                             */
/* ------------------------------------------------------------------ */
function bmp(rows) {
  const b = new Uint8Array(64);
  rows.forEach((r, y) => { for (let x = 0; x < 8; x++) b[y * 8 + x] = r[x] === '#' ? 1 : 0; });
  return b;
}
function bmpFn(fn) {
  const b = new Uint8Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) b[y * 8 + x] = fn(x, y) ? 1 : 0;
  return b;
}
const H = (r) => bmpFn((x, y) => y === r || y === r + 1);         // linha horizontal 2px
const V = (c) => bmpFn((x, y) => x === c || x === c + 1);         // linha vertical 2px
const MID = (v) => v === 3 || v === 4;
const box = (up, down, left, right) => bmpFn((x, y) =>
  (MID(x) && ((up && y <= 4) || (down && y >= 3))) ||
  (MID(y) && ((left && x <= 4) || (right && x >= 3))));

const GFX = {
  64: H(3),
  65: bmp(['...##...', '..####..', '.######.', '########', '########', '...##...', '..####..', '........']), // ♠
  66: V(3),
  67: H(3),
  68: H(1),
  69: H(0),
  70: H(5),
  71: V(1),
  72: V(5),
  73: bmp(['........', '........', '........', '#####...', '######..', '....##..', '...###..', '...##...']), // ╮
  74: bmp(['...##...', '...###..', '....####', '.....###', '........', '........', '........', '........']), // ╰
  75: bmp(['...##...', '..###...', '####....', '###.....', '........', '........', '........', '........']), // ╯
  76: bmpFn((x, y) => x <= 1 || y >= 6),                                // └ grosso na borda
  77: bmpFn((x, y) => x === y || x === y + 1),                           // ╲
  78: bmpFn((x, y) => x === 7 - y || x === 6 - y),                       // ╱
  79: bmpFn((x, y) => x <= 1 || y <= 1),                                 // ┌ na borda
  80: bmpFn((x, y) => x >= 6 || y <= 1),                                 // ┐ na borda
  81: bmp(['........', '..####..', '.######.', '.######.', '.######.', '.######.', '..####..', '........']), // ●
  82: H(5),
  83: bmp(['.##..##.', '########', '########', '########', '.######.', '..####..', '...##...', '........']), // ♥
  84: V(1),
  85: bmp(['........', '........', '........', '...#####', '..######', '..##....', '..###...', '...##...']), // ╭
  86: bmpFn((x, y) => x === y || x === 7 - y || x === y + 1 || x === 6 - y), // ╳
  87: bmp(['........', '..####..', '.##..##.', '.#....#.', '.#....#.', '.##..##.', '..####..', '........']), // ○
  88: bmp(['...##...', '..####..', '..####..', '##.##.##', '########', '##.##.##', '...##...', '..####..']), // ♣
  89: V(5),
  90: bmp(['...##...', '..####..', '.######.', '########', '.######.', '..####..', '...##...', '........']), // ♦
  91: box(1, 1, 1, 1),                                                   // ┼
  92: bmpFn((x, y) => x < 4 && (x + y) % 2 === 0),                       // xadrez esq.
  93: V(3),                                                              // │
  94: bmp(['........', '........', '#######.', '.##.##..', '.##.##..', '.##.##..', '.##..##.', '........']), // π
  95: bmpFn((x, y) => x >= y),                                           // ◥
  96: bmpFn(() => false),
  97: bmpFn((x) => x < 4),                                               // ▌
  98: bmpFn((x, y) => y >= 4),                                           // ▄
  99: bmpFn((x, y) => y === 0),                                          // ▔
  100: bmpFn((x, y) => y === 7),                                         // ▁
  101: bmpFn((x) => x === 0),                                            // ▏
  102: bmpFn((x, y) => (x + y) % 2 === 0),                               // ▒
  103: bmpFn((x) => x === 7),                                            // ▕
  104: bmpFn((x, y) => y >= 4 && (x + y) % 2 === 0),
  105: bmpFn((x, y) => x <= 7 - y),                                      // ◤
  106: bmpFn((x) => x >= 6),
  107: box(1, 1, 0, 1),                                                  // ├
  108: bmpFn((x, y) => x >= 4 && y >= 4),                                // ▗
  109: box(1, 0, 0, 1),                                                  // └
  110: box(0, 1, 1, 0),                                                  // ┐
  111: bmpFn((x, y) => y >= 6),
  112: box(0, 1, 0, 1),                                                  // ┌
  113: box(1, 0, 1, 1),                                                  // ┴
  114: box(0, 1, 1, 1),                                                  // ┬
  115: box(1, 1, 1, 0),                                                  // ┤
  116: bmpFn((x) => x <= 1),
  117: bmpFn((x) => x <= 2),
  118: bmpFn((x) => x >= 5),
  119: bmpFn((x, y) => y <= 1),
  120: bmpFn((x, y) => y <= 2),
  121: bmpFn((x, y) => y >= 5),
  122: bmpFn((x, y) => (x >= 6 && y >= 0) || y >= 6),                    // ┘ na borda
  123: bmpFn((x, y) => x < 4 && y >= 4),                                 // ▖
  124: bmpFn((x, y) => x >= 4 && y < 4),                                 // ▝
  125: box(1, 0, 1, 0),                                                  // ┘
  126: bmpFn((x, y) => x < 4 && y < 4),                                  // ▘
  127: bmpFn((x, y) => (x < 4) === (y < 4))                              // ▚
};
/* setas ↑ e ← (screen codes 30 e 31) */
GFX[30] = bmp(['...##...', '..####..', '.######.', '...##...', '...##...', '...##...', '...##...', '...##...']);
GFX[31] = bmp(['........', '..##....', '.##.....', '########', '########', '.##.....', '..##....', '........']);

/** Monta os 128 glifos (screen codes 0-127): letras/números da ROM
 *  CHARGEN (chargen.js) e gráficos PETSCII definidos acima. */
function buildCharset() {
  const glyphs = new Array(128);
  for (let s = 0; s < 128; s++) {
    if (GFX[s]) { glyphs[s] = GFX[s]; continue; }
    const g = new Uint8Array(64);
    if (s < 64) {
      for (let y = 0; y < 8; y++) {
        const row = CHARGEN[s * 8 + y];
        for (let x = 0; x < 8; x++) g[y * 8 + x] = (row >> (7 - x)) & 1;
      }
    }
    glyphs[s] = g;
  }
  return glyphs;
}

/* ------------------------------------------------------------------ */
/*  A tela                                                              */
/* ------------------------------------------------------------------ */
class C64Screen {
  constructor(canvas) {
    this.canvas = canvas;
    this.W = 384; this.H = 272;           // 320x200 + borda
    this.BX = 32; this.BY = 36;
    canvas.width = this.W; canvas.height = this.H;
    this.ctx = canvas.getContext('2d');
    this.img = this.ctx.createImageData(this.W, this.H);
    this.u32 = new Uint32Array(this.img.data.buffer);
    this.pal32 = C64_PALETTE.map((hex) => {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      return (255 << 24 | b << 16 | g << 8 | r) >>> 0;   // little-endian ABGR
    });
    this.chars = new Uint8Array(1000);
    this.colors = new Uint8Array(1000);
    this.links = new Uint8Array(25);      // 1 = esta linha continua a anterior
    this.glyphs = null;
    this.powered = false;
    this.blanked = false;                 // POKE 53265,11 apaga a tela
    this.cursorOn = false;
    this.blinkOn = true;
    this.blinkClock = 0;
    this.dirty = true;
    this.onBorderChange = null;
    this.reset();
  }

  reset() {
    this.border = 14; this.bg = 6; this.color = 14;
    this.rvs = false; this.quote = false; this.insertCount = 0;
    this.blanked = false;
    this.clear();
    if (this.onBorderChange) this.onBorderChange(this.border);
  }

  setBorder(c) { this.border = c & 15; this.dirty = true; if (this.onBorderChange) this.onBorderChange(this.border); }
  setBg(c) { this.bg = c & 15; this.dirty = true; }

  clear() {
    this.chars.fill(32);
    this.colors.fill(this.color);
    this.links.fill(0);
    this.cx = 0; this.cy = 0;
    this.dirty = true;
  }

  /* ---------- rolagem e linhas ---------- */
  scroll() {
    this.chars.copyWithin(0, 40);
    this.colors.copyWithin(0, 40);
    this.chars.fill(32, 960);
    this.colors.fill(this.color, 960);
    this.links.copyWithin(0, 1);
    this.links[24] = 0; this.links[0] = 0;
    this.cy--;
    if (this.inputMark) this.inputMark.row--;
    this.dirty = true;
  }

  insertRow(r) {                         // abre uma linha vazia em r
    for (let row = 24; row > r; row--) {
      this.chars.copyWithin(row * 40, (row - 1) * 40, row * 40);
      this.colors.copyWithin(row * 40, (row - 1) * 40, row * 40);
      this.links[row] = this.links[row - 1];
    }
    this.chars.fill(32, r * 40, r * 40 + 40);
    this.colors.fill(this.color, r * 40, r * 40 + 40);
    this.links[r] = 0;
    this.dirty = true;
  }

  newline() {
    this.cx = 0;
    this.cy++;
    while (this.cy < 25 && this.links[this.cy]) this.cy++;
    if (this.cy >= 25) { this.cy = 25; this.scroll(); }
    this.links[this.cy] = 0;
    this.rvs = false; this.quote = false; this.insertCount = 0;
    this.dirty = true;
  }

  /** limites da linha lógica que contém a linha `row` */
  logicalBounds(row) {
    let start = row;
    while (start > 0 && this.links[start]) start--;
    let end = start;
    while (end < 24 && this.links[end + 1]) end++;
    return { start, end };
  }

  /* ---------- escrita ---------- */
  putCode(code) {                        // screen code na posição do cursor
    const i = this.cy * 40 + this.cx;
    this.chars[i] = code;
    this.colors[i] = this.color;
    this.dirty = true;
  }

  advanceOutput() {
    this.cx++;
    if (this.cx >= 40) {
      this.cx = 0; this.cy++;
      if (this.cy >= 25) { this.cy = 25; this.scroll(); }
      this.links[this.cy] = this.links[this.cy - 1] ? 0 : 1;
    }
  }

  advanceTyping() {
    this.cx++;
    if (this.cx < 40) return;
    this.cx = 0;
    if (this.links[this.cy]) {                        // já é a 2ª linha (80 col.)
      this.cy++;
      if (this.cy >= 25) { this.cy = 25; this.scroll(); }
    } else if (this.cy < 24 && this.links[this.cy + 1]) {
      this.cy++;
    } else {
      if (this.cy >= 24) { this.scroll(); }
      this.insertRow(this.cy + 1);
      this.links[this.cy + 1] = 1;
      this.cy++;
    }
  }

  /** Executa / imprime um código PETSCII (saída de PRINT) */
  putPetscii(c, literal = false) {
    if (literal || this.quote || this.insertCount > 0) {
      const lit = this.literalCode(c);
      if (lit >= 0) { this.putCode(lit); this.advanceOutput(); if (this.insertCount > 0) this.insertCount--; return; }
    }
    switch (c) {
      case 13: case 141: this.newline(); return;
      case 147: this.clear(); return;
      case 19: this.cx = 0; this.cy = 0; return;
      case 17: this.cursorDown(); return;
      case 145: if (this.cy > 0) this.cy--; return;
      case 29: this.advanceOutput(); return;
      case 157: this.cursorLeft(); return;
      case 18: this.rvs = true; return;
      case 146: this.rvs = false; return;
      case 20: this.del(); return;
      case 148: this.inst(); return;
      case 14: case 142: case 8: case 9: return;
    }
    const ci = PETSCII_COLORS.indexOf(c);
    if (ci >= 0) { this.color = ci; return; }
    const s = petsciiToScreen(c);
    if (s < 0) return;
    this.putCode(this.rvs ? s | 128 : s);
    this.advanceOutput();
  }

  /** Códigos de controle exibidos em modo aspas viram caracteres reversos */
  literalCode(c) {
    if (c < 32) return c === 13 ? -1 : (c | 128);
    if (c >= 128 && c < 160) return c === 141 ? -1 : ((c - 64) | 128);
    return -1;
  }

  /** Imprime uma string PETSCII */
  printPetscii(str, literal = false) {
    for (let i = 0; i < str.length; i++) this.putPetscii(str.charCodeAt(i), literal);
  }

  /** Imprime texto Unicode (converte para PETSCII) */
  print(str) { this.printPetscii(toPetscii(str)); }

  /* ---------- editor ---------- */
  typeCode(c) {                          // tecla imprimível digitada
    let s = petsciiToScreen(c);
    if (s < 0) { s = this.literalCode(c); if (s < 0) return; }
    else if (this.rvs) s |= 128;
    if (c === 34) this.quote = !this.quote;
    if (this.insertCount > 0) this.insertCount--;
    this.putCode(s);
    this.advanceTyping();
  }

  cursorRight() { this.cx++; if (this.cx >= 40) { this.cx = 0; this.cursorDown(); } }
  cursorLeft() { if (this.cx > 0) this.cx--; else if (this.cy > 0) { this.cy--; this.cx = 39; } }
  cursorDown() { this.cy++; if (this.cy >= 25) { this.cy = 25; this.scroll(); this.links[24] = 0; } }
  cursorUp() { if (this.cy > 0) this.cy--; }
  home() { this.cx = 0; this.cy = 0; }

  del() {
    const { start, end } = this.logicalBounds(this.cy);
    const first = start * 40, last = end * 40 + 39;
    const idx = this.cy * 40 + this.cx;
    if (idx <= first) return;
    this.chars.copyWithin(idx - 1, idx, last + 1);
    this.colors.copyWithin(idx - 1, idx, last + 1);
    this.chars[last] = 32;
    this.cursorLeft();
    if (this.insertCount > 0) this.insertCount--;
    this.dirty = true;
  }

  inst() {
    let { start, end } = this.logicalBounds(this.cy);
    let last = end * 40 + 39;
    if (this.chars[last] !== 32) {
      if (end === start && end < 24) { this.insertRow(end + 1); this.links[end + 1] = 1; end++; last = end * 40 + 39; }
      else return;
    }
    const idx = this.cy * 40 + this.cx;
    this.chars.copyWithin(idx + 1, idx, last);
    this.colors.copyWithin(idx + 1, idx, last);
    this.chars[idx] = 32;
    this.colors[idx] = this.color;
    this.insertCount++;
    this.dirty = true;
  }

  /** Lê a linha lógica sob o cursor como PETSCII. fromIndex = início opcional */
  readLogicalLine(row, fromIndex = -1) {
    const { start, end } = this.logicalBounds(row);
    let a = start * 40;
    const b = end * 40 + 40;
    if (fromIndex >= a && fromIndex < b) a = fromIndex;
    let out = '';
    for (let i = a; i < b; i++) {
      const sc = this.chars[i];
      const base = sc & 127;
      if (sc & 128) {                       // reverso: códigos de controle
        if (base < 32) { out += String.fromCharCode(base); continue; }
        if (base >= 64 && base < 96) { out += String.fromCharCode(base + 64); continue; }
      }
      out += String.fromCharCode(screenToPetscii(base));
    }
    return { text: out.replace(/ +$/, ''), start, end };
  }

  /** Texto da tela inteira (acessibilidade) */
  dumpText() {
    let out = '';
    for (let r = 0; r < 25; r++) {
      let line = '';
      for (let c = 0; c < 40; c++) line += petsciiToText(String.fromCharCode(screenToPetscii(this.chars[r * 40 + c] & 127)));
      out += line.replace(/ +$/, '') + '\n';
    }
    return out.replace(/\n+$/, '');
  }

  /* ---------- renderização ---------- */
  tick(dtMs) {
    this.blinkClock += dtMs;
    if (this.blinkClock >= 333) {          // 20 jiffies, como o KERNAL
      this.blinkClock = 0;
      this.blinkOn = !this.blinkOn;
      if (this.cursorOn) this.dirty = true;
    }
  }

  showCursor(on) {
    if (this.cursorOn !== on) { this.cursorOn = on; this.blinkOn = true; this.blinkClock = 0; this.dirty = true; }
  }

  render() {
    if (!this.dirty) return;
    this.dirty = false;
    const buf = this.u32, W = this.W;
    if (!this.powered || !this.glyphs) { buf.fill(this.pal32[0]); this.ctx.putImageData(this.img, 0, 0); return; }
    buf.fill(this.pal32[this.border]);
    const bg = this.pal32[this.bg];
    if (this.blanked) {
      this.ctx.putImageData(this.img, 0, 0);
      return;
    }
    const curIdx = (this.cursorOn && this.blinkOn && this.cy < 25) ? this.cy * 40 + this.cx : -1;
    for (let r = 0; r < 25; r++) {
      for (let c = 0; c < 40; c++) {
        const i = r * 40 + c;
        let code = this.chars[i];
        let fg = this.pal32[this.colors[i] & 15];
        if (i === curIdx) { code ^= 128; fg = this.pal32[this.color]; }
        const g = this.glyphs[code & 127];
        const inv = code & 128 ? 1 : 0;
        let p = (this.BY + r * 8) * W + this.BX + c * 8;
        for (let y = 0; y < 8; y++, p += W) {
          const gy = y * 8;
          for (let x = 0; x < 8; x++) buf[p + x] = (g[gy + x] ^ inv) ? fg : bg;
        }
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}
