/* =========================================================================
 *  basic.js — Interpretador Commodore BASIC V2 (subconjunto amplo)
 *  ---------------------------------------------------------------------
 *  Comportamentos fiéis ao C64:
 *   - palavras-chave reconhecidas mesmo sem espaços (FORI=1TO10)
 *   - variáveis com 2 caracteres significativos (+ sufixo $ ou %)
 *   - verdadeiro = -1, falso = 0; AND/OR/NOT bit a bit em 16 bits
 *   - números impressos com espaço à esquerda e cursor à direita
 *   - mensagens de erro originais ("?SYNTAX  ERROR IN 10")
 *   - velocidade aproximada de um 6510 a ~1 MHz
 * ========================================================================= */
'use strict';

const BASIC_KEYWORDS = [
  'END', 'FOR', 'NEXT', 'DATA', 'INPUT#', 'INPUT', 'DIM', 'READ', 'LET', 'GOTO', 'RUN', 'IF',
  'RESTORE', 'GOSUB', 'RETURN', 'REM', 'STOP', 'ON', 'WAIT', 'LOAD', 'SAVE', 'VERIFY', 'DEF',
  'POKE', 'PRINT#', 'PRINT', 'CONT', 'LIST', 'CLR', 'CMD', 'SYS', 'OPEN', 'CLOSE', 'GET', 'NEW',
  'TAB(', 'TO', 'FN', 'SPC(', 'THEN', 'NOT', 'STEP', 'AND', 'OR', 'SGN', 'INT', 'ABS', 'USR',
  'FRE', 'POS', 'SQR', 'RND', 'LOG', 'EXP', 'COS', 'SIN', 'TAN', 'ATN', 'PEEK', 'LEN', 'STR$',
  'VAL', 'ASC', 'CHR$', 'LEFT$', 'RIGHT$', 'MID$', 'GO'
];

const BASIC_ERRORS = {
  SYNTAX: 'SYNTAX', TYPE: 'TYPE MISMATCH', UNDEF: "UNDEF'D STATEMENT", NEXT: 'NEXT WITHOUT FOR',
  RETURN: 'RETURN WITHOUT GOSUB', DATA: 'OUT OF DATA', QTY: 'ILLEGAL QUANTITY', DIV0: 'DIVISION BY ZERO',
  OVERFLOW: 'OVERFLOW', SUBSCRIPT: 'BAD SUBSCRIPT', REDIM: "REDIM'D ARRAY", DIRECT: 'ILLEGAL DIRECT',
  CONT: "CAN'T CONTINUE", LONG: 'STRING TOO LONG', UNDEFFN: "UNDEF'D FUNCTION", FILE: 'FILE NOT OPEN',
  NOTFOUND: 'FILE NOT FOUND', DEVICE: 'DEVICE NOT PRESENT', MEMORY: 'OUT OF MEMORY', FORMULA: 'FORMULA TOO COMPLEX',
  BREAK: 'BREAK', MISSING: 'MISSING FILE NAME', VERIFY: 'VERIFY'
};

class BasicError extends Error {
  constructor(code) { super(BASIC_ERRORS[code] || code); this.code = code; }
}

/* ---------- formatação numérica do C64 ---------- */
function c64NumStr(n) {
  if (!isFinite(n)) throw new BasicError('OVERFLOW');
  if (n === 0) return '0';
  const a = Math.abs(n);
  let s;
  if (a >= 1e9 || a < 0.01) {
    let [m, e] = a.toExponential(8).split('e');
    m = m.replace(/\.?0+$/, '');
    const ei = parseInt(e, 10);
    s = m + 'E' + (ei < 0 ? '-' : '+') + String(Math.abs(ei)).padStart(2, '0');
  } else {
    s = String(parseFloat(a.toPrecision(9)));
    if (s.startsWith('0.')) s = s.slice(1);
  }
  return (n < 0 ? '-' : '') + s;
}
function c64Str(n) { return (n < 0 ? '' : ' ') + c64NumStr(n); }
function c64Val(s) {
  const t = String(s).replace(/ /g, '');
  const m = t.match(/^[+-]?(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}
function int16(v) {
  if (typeof v !== 'number') throw new BasicError('TYPE');
  const i = Math.floor(v);
  if (i < -32768 || i > 32767) throw new BasicError('QTY');
  return i;
}

/* ---------- tokenizador ---------- */
function matchKeyword(s, i) {
  for (const kw of BASIC_KEYWORDS) if (s.startsWith(kw, i)) return kw;
  return null;
}
const isDigit = (c) => c >= '0' && c <= '9';
const isLetter = (c) => c >= 'A' && c <= 'Z';

function tokenize(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    if (ch === ' ') { i++; continue; }
    if (ch === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j++;
      toks.push({ t: 'str', v: s.slice(i + 1, j) });
      i = j + 1; continue;
    }
    if (ch === '?') { toks.push({ t: 'kw', v: 'PRINT' }); i++; continue; }
    if (code === 255 || code === 222) { toks.push({ t: 'num', v: Math.PI }); i++; continue; }
    const kw = matchKeyword(s, i);
    if (kw) {
      toks.push({ t: 'kw', v: kw });
      i += kw.length;
      if (kw === 'REM') { toks.push({ t: 'raw', v: s.slice(i) }); i = s.length; }
      else if (kw === 'DATA') {
        let j = i, q = false;
        while (j < s.length && (q || s[j] !== ':')) { if (s[j] === '"') q = !q; j++; }
        toks.push({ t: 'raw', v: s.slice(i, j) });
        i = j;
      }
      continue;
    }
    if (isDigit(ch) || (ch === '.' && isDigit(s[i + 1] || ''))) {
      let j = i;
      while (j < s.length && (isDigit(s[j]) || s[j] === ' ')) j++;
      if (s[j] === '.') { j++; while (j < s.length && isDigit(s[j])) j++; }
      if (s[j] === 'E' && (isDigit(s[j + 1] || '') || ((s[j + 1] === '+' || s[j + 1] === '-') && isDigit(s[j + 2] || '')))) {
        j += 2; while (j < s.length && isDigit(s[j])) j++;
      }
      toks.push({ t: 'num', v: parseFloat(s.slice(i, j).replace(/ /g, '')) });
      i = j; continue;
    }
    if (isLetter(ch)) {
      let j = i, name = '';
      while (j < s.length && (isLetter(s[j]) || isDigit(s[j]))) {
        if (j > i && matchKeyword(s, j)) break;
        name += s[j]; j++;
      }
      if (s[j] === '$' || s[j] === '%') { name += s[j]; j++; }
      toks.push({ t: 'id', v: name });
      i = j; continue;
    }
    toks.push({ t: 'op', v: ch === String.fromCharCode(94) ? '^' : ch });
    i++;
  }
  toks.push({ t: 'eol' });
  return toks;
}

/** Normaliza nome de variável: 2 caracteres significativos + tipo */
function varKey(name) {
  const suf = /[$%]$/.test(name) ? name.slice(-1) : '';
  const base = suf ? name.slice(0, -1) : name;
  return base.slice(0, 2) + suf;
}

/* ========================================================================= */
class BasicInterpreter {
  /**
   * host: { screen, peek(a), poke(a,v), getKey(), sys(a), jiffies(),
   *         setJiffies(n), fileOp(kind,name,dev,cb), onReady() }
   */
  constructor(host) {
    this.host = host;
    this.speed = 1100;          // "unidades" por segundo (~ 1 MHz)
    this.turbo = false;
    this.cold();
  }

  cold() {
    this.prog = new Map();
    this.order = [];
    this.dirListing = null;
    this.clearVars();
    this.state = 'direct';
    this.contState = null;
    this.credit = 0;
  }

  clearVars() {
    this.vars = new Map();
    this.arrays = new Map();
    this.fns = new Map();
    this.forStack = [];
    this.gosubStack = [];
    this.buildData();
  }

  get screen() { return this.host.screen; }

  /* -------------------- edição de programa -------------------- */
  enterLine(text) {
    const m = text.match(/^\s*(\d[\d ]*)(.*)$/);
    if (!m) return false;
    const num = parseInt(m[1].replace(/ /g, ''), 10);
    if (num > 63999) throw new BasicError('SYNTAX');
    const body = m[2].replace(/^ +/, '');
    this.dirListing = null;
    if (body === '') this.prog.delete(num);
    else this.prog.set(num, { num, text: body, toks: tokenize(body) });
    this.order = [...this.prog.keys()].sort((a, b) => a - b);
    this.clearVars();
    this.contState = null;
    return true;
  }

  programBytes() {
    let n = 2;
    for (const L of this.prog.values()) n += L.text.length + 5;
    return n;
  }

  loadProgram(lines) {
    this.cold();
    for (const line of lines) {
      const m = line.match(/^(\d+) ?(.*)$/);
      if (m) this.prog.set(+m[1], { num: +m[1], text: m[2], toks: tokenize(m[2]) });
    }
    this.order = [...this.prog.keys()].sort((a, b) => a - b);
  }

  programLines() { return this.order.map((n) => n + ' ' + this.prog.get(n).text); }

  /* -------------------- execução -------------------- */
  execDirect(text) {
    this.toks = tokenize(text);
    this.p = 0;
    this.lineIdx = -1;
    this.curLine = -1;
    this.state = 'run';
    this.jumped = false;
  }

  isRunning() { return this.state !== 'direct'; }

  /** chamado a cada quadro (60 Hz) */
  step(dtMs) {
    if (this.state === 'wait') {
      const w = this.waitCond;
      if (((this.host.peek(w.addr) ^ w.xor) & w.mask) !== 0) this.state = 'run';
      else return;
    }
    if (this.state !== 'run') return;
    const rate = this.turbo ? this.speed * 25 : this.speed;
    this.credit = Math.min(this.credit + rate * dtMs / 1000, rate / 10);
    while (this.credit > 0 && this.state === 'run') {
      const p0 = this.p, toks0 = this.toks;
      const t0 = toks0[p0];
      if (t0.t === 'op' && t0.v === ':') { this.p++; this.credit -= 0.2; continue; }
      try { this.execOne(); } catch (e) { this.handleError(e); break; }
      const used = toks0 === this.toks ? Math.abs(this.p - p0) : 3;
      this.credit -= 1 + Math.min(used, 40) * 0.1;      // custo aproximado por comando
    }
  }

  execOne() {
    const t = this.toks[this.p];
    if (t.t === 'op' && t.v === ':') { this.p++; return; }
    if (t.t === 'eol') { this.nextLine(); return; }
    this.jumped = false;
    this.execStatement();
    if (this.state !== 'run' && this.state !== 'wait') return;
    if (!this.jumped) {
      const t2 = this.toks[this.p];
      if (!(t2.t === 'eol' || (t2.t === 'op' && t2.v === ':'))) throw new BasicError('SYNTAX');
    }
  }

  nextLine() {
    if (this.lineIdx < 0) { this.finish(false); return; }
    this.lineIdx++;
    if (this.lineIdx >= this.order.length) { this.finish(false); return; }
    this.loadLine(this.lineIdx);
  }

  loadLine(idx) {
    const L = this.prog.get(this.order[idx]);
    this.lineIdx = idx;
    this.toks = L.toks;
    this.p = 0;
    this.curLine = L.num;
  }

  gotoLine(num) {
    const idx = this.order.indexOf(num);
    if (idx < 0) throw new BasicError('UNDEF');
    this.loadLine(idx);
    this.jumped = true;
  }

  finish(fromStop) {
    if (this.lineIdx >= 0 && fromStop) this.saveCont();
    this.state = 'direct';
    this.host.onReady();
  }

  saveCont() { this.contState = { lineIdx: this.lineIdx, toks: this.toks, p: this.p, curLine: this.curLine }; }

  breakProgram() {
    if (this.state === 'direct') return;
    const inProg = this.lineIdx >= 0;
    if (inProg) this.saveCont();
    this.state = 'direct';
    const s = this.screen;
    if (s.cx !== 0) s.newline();
    s.print(inProg ? 'BREAK IN ' + this.curLine : 'BREAK');
    s.newline();
    this.host.onReady();
  }

  handleError(e) {
    if (!(e instanceof BasicError)) { console.error(e); e = new BasicError('SYNTAX'); }
    const s = this.screen;
    if (s.cx !== 0) s.newline();
    s.print('?' + e.message + '  ERROR' + (this.lineIdx >= 0 && this.curLine >= 0 ? ' IN ' + this.curLine : ''));
    s.newline();
    this.state = 'direct';
    this.contState = null;
    this.host.onReady();
  }

  /* -------------------- helpers de token -------------------- */
  peek() { return this.toks[this.p]; }
  next() { return this.toks[this.p++]; }
  isOp(v) { const t = this.toks[this.p]; return t.t === 'op' && t.v === v; }
  isKw(v) { const t = this.toks[this.p]; return t.t === 'kw' && t.v === v; }
  atEnd() { const t = this.toks[this.p]; return t.t === 'eol' || (t.t === 'op' && t.v === ':'); }
  expectOp(v) { if (!this.isOp(v)) throw new BasicError('SYNTAX'); this.p++; }
  expectKw(v) { if (!this.isKw(v)) throw new BasicError('SYNTAX'); this.p++; }
  skipStatement() { while (!this.atEnd()) this.p++; }
  skipLine() { while (this.toks[this.p].t !== 'eol') this.p++; }
  numExpr() { const v = this.expr(); if (typeof v !== 'number') throw new BasicError('TYPE'); return v; }
  strExpr() { const v = this.expr(); if (typeof v !== 'string') throw new BasicError('TYPE'); return v; }
  byteExpr() { const v = Math.floor(this.numExpr()); if (v < 0 || v > 255) throw new BasicError('QTY'); return v; }
  wordExpr() { const v = Math.floor(this.numExpr()); if (v < 0 || v > 65535) throw new BasicError('QTY'); return v; }
  lineNumber() { const t = this.next(); if (t.t !== 'num') throw new BasicError('SYNTAX'); return Math.floor(t.v); }
  requireProgram() { if (this.lineIdx < 0) throw new BasicError('DIRECT'); }

  /* -------------------- comandos -------------------- */
  execStatement() {
    const t = this.next();
    if (t.t === 'id') { this.p--; this.doLet(); return; }
    if (t.t !== 'kw') throw new BasicError('SYNTAX');
    switch (t.v) {
      case 'LET': this.doLet(); return;
      case 'PRINT': this.doPrint(); return;
      case 'REM': this.skipLine(); return;
      case 'DATA': this.p++; return;
      case 'GOTO': this.gotoLine(this.lineNumber()); return;
      case 'GO': this.expectKw('TO'); this.gotoLine(this.lineNumber()); return;
      case 'GOSUB': {
        const n = this.lineNumber();
        this.gosubStack.push({ lineIdx: this.lineIdx, toks: this.toks, p: this.p, curLine: this.curLine });
        if (this.gosubStack.length > 24) throw new BasicError('MEMORY');
        this.gotoLine(n); return;
      }
      case 'RETURN': {
        const r = this.gosubStack.pop();
        if (!r) throw new BasicError('RETURN');
        this.lineIdx = r.lineIdx; this.toks = r.toks; this.p = r.p; this.curLine = r.curLine;
        this.skipStatement();
        return;
      }
      case 'IF': return this.doIf();
      case 'FOR': return this.doFor();
      case 'NEXT': return this.doNext();
      case 'END': this.finish(true); return;
      case 'STOP': this.breakProgram(); return;
      case 'ON': return this.doOn();
      case 'DIM': return this.doDim();
      case 'READ': return this.doRead();
      case 'RESTORE': this.dataPtr = 0; return;
      case 'INPUT': return this.doInput();
      case 'GET': return this.doGet();
      case 'POKE': { const a = this.wordExpr(); this.expectOp(','); const v = this.byteExpr(); this.host.poke(a, v); return; }
      case 'SYS': {
        const a = this.wordExpr();
        if (a === 64738 || a === 65126) this.state = 'halt';
        this.host.sys(a);
        return;
      }
      case 'WAIT': {
        const addr = this.wordExpr(); this.expectOp(',');
        const mask = this.byteExpr(); let xor = 0;
        if (this.isOp(',')) { this.p++; xor = this.byteExpr(); }
        this.waitCond = { addr, mask, xor };
        if (((this.host.peek(addr) ^ xor) & mask) === 0) this.state = 'wait';
        return;
      }
      case 'DEF': return this.doDef();
      case 'CLR': this.clearVars(); return;
      case 'NEW': this.cold(); this.state = 'direct'; this.host.onReady(true); return;
      case 'RUN': return this.doRun();
      case 'CONT': {
        if (!this.contState || this.lineIdx >= 0) throw new BasicError('CONT');
        const c = this.contState;
        this.lineIdx = c.lineIdx; this.toks = c.toks; this.p = c.p; this.curLine = c.curLine;
        this.jumped = true; return;
      }
      case 'LIST': return this.doList();
      case 'LOAD': case 'SAVE': case 'VERIFY': return this.doFile(t.v);
      case 'OPEN': case 'CLOSE': case 'CMD': this.skipStatement(); return;
      case 'PRINT#': case 'INPUT#': throw new BasicError('FILE');
      default: throw new BasicError('SYNTAX');
    }
  }

  /* LET */
  doLet() {
    const ref = this.varRef();
    this.expectOp('=');
    const v = this.expr();
    this.assign(ref, v);
  }

  varRef() {
    const t = this.next();
    if (t.t !== 'id') throw new BasicError('SYNTAX');
    const key = varKey(t.v);
    if (this.isOp('(')) {
      this.p++;
      const idx = [];
      do { idx.push(Math.floor(this.numExpr())); } while (this.isOp(',') && ++this.p);
      this.expectOp(')');
      return { key, idx };
    }
    return { key, idx: null };
  }

  assign(ref, v) {
    const isStr = ref.key.endsWith('$'), isInt = ref.key.endsWith('%');
    if (isStr !== (typeof v === 'string')) throw new BasicError('TYPE');
    if (isStr && v.length > 255) throw new BasicError('LONG');
    if (isInt) { v = Math.floor(v); if (v < -32768 || v > 32767) throw new BasicError('QTY'); }
    if (typeof v === 'number' && !isFinite(v)) throw new BasicError('OVERFLOW');
    if (ref.idx) {
      const arr = this.getArray(ref.key, ref.idx.length);
      arr.data[this.arrayOffset(arr, ref.idx)] = v;
      return;
    }
    if (ref.key === 'TI$') { this.host.setJiffies(this.parseTime(v)); return; }
    if (ref.key === 'TI' || ref.key === 'ST') throw new BasicError('SYNTAX');
    this.vars.set(ref.key, v);
  }

  parseTime(s) {
    if (!/^\d{6}$/.test(s)) throw new BasicError('QTY');
    return ((+s.slice(0, 2) * 60 + +s.slice(2, 4)) * 60 + +s.slice(4, 6)) * 60;
  }

  getVar(key) {
    if (key === 'TI') return Math.floor(this.host.jiffies());
    if (key === 'TI$') {
      const j = Math.floor(this.host.jiffies() / 60) % 86400;
      const p2 = (n) => String(n).padStart(2, '0');
      return p2(Math.floor(j / 3600)) + p2(Math.floor(j / 60) % 60) + p2(j % 60);
    }
    if (key === 'ST') return 0;
    if (this.vars.has(key)) return this.vars.get(key);
    return key.endsWith('$') ? '' : 0;
  }

  getArray(key, ndims) {
    let arr = this.arrays.get(key);
    if (!arr) arr = this.makeArray(key, new Array(ndims).fill(10));
    if (arr.dims.length !== ndims) throw new BasicError('SUBSCRIPT');
    return arr;
  }

  makeArray(key, dims) {
    const size = dims.reduce((a, d) => a * (d + 1), 1);
    if (size > 20000) throw new BasicError('MEMORY');
    const arr = { dims, data: new Array(size).fill(key.endsWith('$') ? '' : 0) };
    this.arrays.set(key, arr);
    return arr;
  }

  arrayOffset(arr, idx) {
    let off = 0;
    for (let i = 0; i < idx.length; i++) {
      if (idx[i] < 0 || idx[i] > arr.dims[i]) throw new BasicError('SUBSCRIPT');
      off = off * (arr.dims[i] + 1) + idx[i];
    }
    return off;
  }

  doDim() {
    do {
      const t = this.next();
      if (t.t !== 'id') throw new BasicError('SYNTAX');
      const key = varKey(t.v);
      this.expectOp('(');
      const dims = [];
      do { const d = Math.floor(this.numExpr()); if (d < 0) throw new BasicError('QTY'); dims.push(d); } while (this.isOp(',') && ++this.p);
      this.expectOp(')');
      if (this.arrays.has(key)) throw new BasicError('REDIM');
      this.makeArray(key, dims);
    } while (this.isOp(',') && ++this.p);
  }

  /* PRINT */
  doPrint() {
    const s = this.screen;
    let sep = false;
    while (!this.atEnd()) {
      if (this.isOp(';')) { this.p++; sep = true; continue; }
      if (this.isOp(',')) {
        this.p++; sep = true;
        const n = 10 - (s.cx % 10);
        for (let i = 0; i < n; i++) s.putPetscii(29);
        continue;
      }
      if (this.isKw('TAB(') || this.isKw('SPC(')) {
        const kw = this.next().v;
        const n = this.byteExpr(); this.expectOp(')');
        const pos = s.cx + (s.links[s.cy] ? 40 : 0);
        const count = kw === 'TAB(' ? Math.max(0, n - pos) : n;
        for (let i = 0; i < count; i++) s.putPetscii(29);
        sep = true; continue;
      }
      const v = this.expr();
      if (typeof v === 'number') s.printPetscii(c64Str(v) + '\x1d');
      else s.printPetscii(v);
      sep = false;
    }
    if (!sep) s.putPetscii(13);
  }

  /* IF */
  doIf() {
    const c = this.expr();
    const truth = typeof c === 'string' ? c.length > 0 : c !== 0;
    if (this.isKw('GOTO')) {
      this.p++;
      if (truth) this.gotoLine(this.lineNumber()); else this.skipLine();
      return;
    }
    this.expectKw('THEN');
    if (!truth) { this.skipLine(); return; }
    if (this.peek().t === 'num') this.gotoLine(this.lineNumber());
    else this.jumped = true;               // continua na mesma linha
  }

  /* FOR / NEXT */
  doFor() {
    const t = this.next();
    if (t.t !== 'id' || /[$%]$/.test(t.v)) throw new BasicError('SYNTAX');
    const key = varKey(t.v);
    this.expectOp('=');
    const start = this.numExpr();
    this.expectKw('TO');
    const limit = this.numExpr();
    let step = 1;
    if (this.isKw('STEP')) { this.p++; step = this.numExpr(); }
    this.vars.set(key, start);
    const i = this.forStack.findIndex((f) => f.key === key);
    if (i >= 0) this.forStack.length = i;
    this.forStack.push({ key, limit, step, lineIdx: this.lineIdx, toks: this.toks, p: this.p, curLine: this.curLine });
    if (this.forStack.length > 10) throw new BasicError('MEMORY');
  }

  doNext() {
    do {
      let idx = this.forStack.length - 1;
      if (this.peek().t === 'id') {
        const key = varKey(this.next().v);
        while (idx >= 0 && this.forStack[idx].key !== key) idx--;
      }
      if (idx < 0) throw new BasicError('NEXT');
      this.forStack.length = idx + 1;
      const f = this.forStack[idx];
      const v = this.vars.get(f.key) + f.step;
      this.vars.set(f.key, v);
      const done = f.step >= 0 ? v > f.limit : v < f.limit;
      if (!done) {
        this.lineIdx = f.lineIdx; this.toks = f.toks; this.p = f.p; this.curLine = f.curLine;
        this.jumped = true;
        return;
      }
      this.forStack.pop();
    } while (this.isOp(',') && ++this.p);
  }

  /* ON x GOTO/GOSUB */
  doOn() {
    const n = Math.floor(this.numExpr());
    if (n < 0 || n > 255) throw new BasicError('QTY');
    const kw = this.next();
    if (kw.t !== 'kw' || (kw.v !== 'GOTO' && kw.v !== 'GOSUB')) throw new BasicError('SYNTAX');
    const targets = [];
    do { targets.push(this.lineNumber()); } while (this.isOp(',') && ++this.p);
    if (n < 1 || n > targets.length) return;
    if (kw.v === 'GOSUB') this.gosubStack.push({ lineIdx: this.lineIdx, toks: this.toks, p: this.p, curLine: this.curLine });
    this.gotoLine(targets[n - 1]);
  }

  /* DATA / READ */
  buildData() {
    this.data = [];
    this.dataPtr = 0;
    if (!this.order) return;
    for (const n of this.order) {
      const toks = this.prog.get(n).toks;
      for (let i = 0; i < toks.length; i++) {
        if (toks[i].t === 'kw' && toks[i].v === 'DATA' && toks[i + 1] && toks[i + 1].t === 'raw') {
          const raw = toks[i + 1].v;
          let cur = '', q = false;
          for (const ch of raw + ',') {
            if (ch === '"') { q = !q; cur += ch; continue; }
            if (ch === ',' && !q) { this.data.push({ v: cur.trim(), line: n }); cur = ''; continue; }
            cur += ch;
          }
        }
      }
    }
  }

  doRead() {
    do {
      const ref = this.varRef();
      if (this.dataPtr >= this.data.length) throw new BasicError('DATA');
      const d = this.data[this.dataPtr++];
      let raw = d.v;
      if (raw.startsWith('"')) raw = raw.slice(1).replace(/"$/, '');
      if (ref.key.endsWith('$')) this.assign(ref, raw);
      else {
        if (raw !== '' && !/^[+-]?(\d+\.?\d*|\.\d+)(E[+-]?\d+)?$/.test(raw.replace(/ /g, ''))) {
          this.curLine = d.line; throw new BasicError('SYNTAX');
        }
        this.assign(ref, c64Val(raw));
      }
    } while (this.isOp(',') && ++this.p);
  }

  /* INPUT */
  doInput() {
    this.requireProgram();
    let prompt = '';
    if (this.peek().t === 'str') { prompt = this.next().v; this.expectOp(';'); }
    const refs = [];
    do { refs.push(this.varRef()); } while (this.isOp(',') && ++this.p);
    this.inputRefs = refs;
    this.inputPrompt = prompt;
    this.beginInput(prompt + '? ');
  }

  beginInput(promptText) {
    const s = this.screen;
    s.printPetscii(promptText);
    s.inputMark = { row: s.cy, col: s.cx };
    this.state = 'input';
    this.host.onInput();
  }

  /** chamado pelo host quando RETURN é pressionado durante INPUT */
  inputLine(text) {
    const values = [];
    let cur = '', q = false;
    for (const ch of text) {
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { values.push(cur); cur = ''; continue; }
      cur += ch;
    }
    values.push(cur);
    if (text.trim() === '') { this.inputRefs = []; this.state = 'run'; return; }
    try {
      while (this.inputRefs.length && values.length) {
        const ref = this.inputRefs[0];
        const raw = values.shift().replace(/^ +/, '');
        if (ref.key.endsWith('$')) this.assign(ref, raw);
        else {
          if (!/^[+-]?(\d+\.?\d*|\.\d+)(E[+-]?\d+)?$/.test(raw.replace(/ /g, '') || '0')) {
            this.screen.print('?REDO FROM START'); this.screen.newline();
            this.beginInput(this.inputPrompt + '? ');
            return;
          }
          this.assign(ref, c64Val(raw));
        }
        this.inputRefs.shift();
      }
    } catch (e) { this.handleError(e); return; }
    if (this.inputRefs.length) { this.beginInput('?? '); return; }
    if (values.length) { this.screen.print('?EXTRA IGNORED'); this.screen.newline(); }
    this.state = 'run';
  }

  /* GET */
  doGet() {
    this.requireProgram();
    do {
      const ref = this.varRef();
      const k = this.host.getKey();
      if (ref.key.endsWith('$')) this.assign(ref, k);
      else if (k === '' || isDigit(k)) this.assign(ref, k === '' ? 0 : +k);
      else throw new BasicError('SYNTAX');
    } while (this.isOp(',') && ++this.p);
  }

  /* DEF FN */
  doDef() {
    this.requireProgram();
    this.expectKw('FN');
    const name = this.next();
    if (name.t !== 'id') throw new BasicError('SYNTAX');
    this.expectOp('(');
    const param = this.next();
    if (param.t !== 'id') throw new BasicError('SYNTAX');
    this.expectOp(')');
    this.expectOp('=');
    this.fns.set(varKey(name.v), { param: varKey(param.v), toks: this.toks, p: this.p });
    this.skipStatement();
  }

  /* RUN */
  doRun() {
    let target = null;
    if (this.peek().t === 'num') target = this.lineNumber();
    this.clearVars();
    this.contState = null;
    if (this.dirListing) throw new BasicError('SYNTAX');
    if (!this.order.length) { this.finish(false); return; }
    if (target === null) this.loadLine(0); else this.gotoLine(target);
    this.jumped = true;
  }

  /* LIST */
  doList() {
    let from = 0, to = 63999;
    if (this.peek().t === 'num') { from = to = this.lineNumber(); }
    if (this.isOp('-')) { this.p++; to = this.peek().t === 'num' ? this.lineNumber() : 63999; }
    const s = this.screen;
    if (this.dirListing) {
      for (const line of this.dirListing) { s.printPetscii(line); s.newline(); }
    } else {
      for (const n of this.order) {
        if (n < from || n > to) continue;
        s.printPetscii(String(n) + ' ');
        let q = false;
        for (const ch of this.prog.get(n).text) {
          if (ch === '"') q = !q;
          s.putPetscii(ch.charCodeAt(0), q);
        }
        s.putPetscii(13);
      }
    }
    if (this.lineIdx < 0) this.finish(false);
  }

  /* LOAD / SAVE / VERIFY */
  doFile(kind) {
    let name = '', dev = 1, sa = 0;
    if (!this.atEnd()) {
      name = this.strExpr();
      if (this.isOp(',')) { this.p++; dev = this.byteExpr(); }
      if (this.isOp(',')) { this.p++; sa = this.byteExpr(); }
    }
    const fromProgram = this.lineIdx >= 0;
    this.state = 'io';
    this.host.fileOp(kind, name, dev, sa, (err) => {
      if (err) { this.handleError(new BasicError(err)); return; }
      if (kind === 'LOAD' && fromProgram && this.order.length) {
        this.clearVars(); this.loadLine(0); this.state = 'run'; return;
      }
      this.state = 'direct';
      this.lineIdx = -1;
      this.host.onReady();
    });
  }

  /* -------------------- expressões -------------------- */
  expr() { return this.orExpr(); }

  orExpr() {
    let a = this.andExpr();
    while (this.isKw('OR')) { this.p++; const b = this.andExpr(); a = int16(a) | int16(b); }
    return a;
  }

  andExpr() {
    let a = this.notExpr();
    while (this.isKw('AND')) { this.p++; const b = this.notExpr(); a = int16(a) & int16(b); }
    return a;
  }

  notExpr() {
    if (this.isKw('NOT')) { this.p++; return ~int16(this.notExpr()); }
    return this.relExpr();
  }

  relExpr() {
    let a = this.addExpr();
    for (;;) {
      let op = '';
      while (this.isOp('<') || this.isOp('=') || this.isOp('>')) op += this.next().v;
      if (!op) return a;
      const b = this.addExpr();
      if ((typeof a) !== (typeof b)) throw new BasicError('TYPE');
      const lt = a < b, gt = a > b, eq = a === b;
      let r;
      switch (op) {
        case '=': r = eq; break;
        case '<': r = lt; break;
        case '>': r = gt; break;
        case '<=': case '=<': r = lt || eq; break;
        case '>=': case '=>': r = gt || eq; break;
        case '<>': case '><': r = !eq; break;
        default: throw new BasicError('SYNTAX');
      }
      a = r ? -1 : 0;
    }
  }

  addExpr() {
    let a = this.mulExpr();
    for (;;) {
      if (this.isOp('+')) {
        this.p++;
        const b = this.mulExpr();
        if ((typeof a) !== (typeof b)) throw new BasicError('TYPE');
        a = a + b;
        if (typeof a === 'string' && a.length > 255) throw new BasicError('LONG');
      } else if (this.isOp('-')) {
        this.p++;
        const b = this.mulExpr();
        if (typeof a !== 'number' || typeof b !== 'number') throw new BasicError('TYPE');
        a = a - b;
      } else return a;
    }
  }

  mulExpr() {
    let a = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = this.next().v;
        const b = this.unary();
        if (typeof a !== 'number' || typeof b !== 'number') throw new BasicError('TYPE');
        if (op === '/' && b === 0) throw new BasicError('DIV0');
        a = op === '*' ? a * b : a / b;
        if (!isFinite(a)) throw new BasicError('OVERFLOW');
      } else return a;
    }
  }

  unary() {
    if (this.isOp('-')) { this.p++; const v = this.unary(); if (typeof v !== 'number') throw new BasicError('TYPE'); return -v; }
    if (this.isOp('+')) { this.p++; return this.unary(); }
    return this.powExpr();
  }

  powExpr() {
    let a = this.primary();
    while (this.isOp('^')) {
      this.p++;
      let neg = false;
      if (this.isOp('-')) { this.p++; neg = true; }
      let b = this.primary();
      if (typeof a !== 'number' || typeof b !== 'number') throw new BasicError('TYPE');
      if (neg) b = -b;
      a = Math.pow(a, b);
      if (Number.isNaN(a)) throw new BasicError('QTY');
      if (!isFinite(a)) throw new BasicError('OVERFLOW');
    }
    return a;
  }

  args(n) {
    this.expectOp('(');
    const out = [];
    for (let i = 0; i < n; i++) { if (i) this.expectOp(','); out.push(this.expr()); }
    this.expectOp(')');
    return out;
  }

  primary() {
    const t = this.next();
    if (t.t === 'num') return t.v;
    if (t.t === 'str') return t.v;
    if (t.t === 'op' && t.v === '(') { const v = this.expr(); this.expectOp(')'); return v; }
    if (t.t === 'id') {
      const key = varKey(t.v);
      if (this.isOp('(')) {
        this.p++;
        const idx = [];
        do { idx.push(Math.floor(this.numExpr())); } while (this.isOp(',') && ++this.p);
        this.expectOp(')');
        const arr = this.getArray(key, idx.length);
        return arr.data[this.arrayOffset(arr, idx)];
      }
      return this.getVar(key);
    }
    if (t.t !== 'kw') throw new BasicError('SYNTAX');
    const num = (v) => { if (typeof v !== 'number') throw new BasicError('TYPE'); return v; };
    const str = (v) => { if (typeof v !== 'string') throw new BasicError('TYPE'); return v; };
    switch (t.v) {
      case 'SGN': return Math.sign(num(this.args(1)[0]));
      case 'INT': return Math.floor(num(this.args(1)[0]));
      case 'ABS': return Math.abs(num(this.args(1)[0]));
      case 'SQR': { const v = num(this.args(1)[0]); if (v < 0) throw new BasicError('QTY'); return Math.sqrt(v); }
      case 'RND': {
        const v = num(this.args(1)[0]);
        if (v < 0) this.seed = Math.floor(Math.abs(v) * 99991) % 2147483646 + 1;
        else if (v === 0 || this.seed === undefined) return Math.random();
        this.seed = (this.seed * 16807) % 2147483647;
        return this.seed / 2147483647;
      }
      case 'LOG': { const v = num(this.args(1)[0]); if (v <= 0) throw new BasicError('QTY'); return Math.log(v); }
      case 'EXP': { const v = Math.exp(num(this.args(1)[0])); if (!isFinite(v)) throw new BasicError('OVERFLOW'); return v; }
      case 'COS': return Math.cos(num(this.args(1)[0]));
      case 'SIN': return Math.sin(num(this.args(1)[0]));
      case 'TAN': return Math.tan(num(this.args(1)[0]));
      case 'ATN': return Math.atan(num(this.args(1)[0]));
      case 'PEEK': { const a = Math.floor(num(this.args(1)[0])); if (a < 0 || a > 65535) throw new BasicError('QTY'); return this.host.peek(a); }
      case 'LEN': return str(this.args(1)[0]).length;
      case 'STR$': return c64Str(num(this.args(1)[0]));
      case 'VAL': return c64Val(str(this.args(1)[0]));
      case 'ASC': { const s = str(this.args(1)[0]); if (!s.length) throw new BasicError('QTY'); return s.charCodeAt(0); }
      case 'CHR$': { const n = Math.floor(num(this.args(1)[0])); if (n < 0 || n > 255) throw new BasicError('QTY'); return String.fromCharCode(n); }
      case 'LEFT$': { const [s, n] = this.args(2); const k = Math.floor(num(n)); if (k < 0 || k > 255) throw new BasicError('QTY'); return str(s).slice(0, k); }
      case 'RIGHT$': { const [s, n] = this.args(2); const k = Math.floor(num(n)); if (k < 0 || k > 255) throw new BasicError('QTY'); return k === 0 ? '' : str(s).slice(-k); }
      case 'MID$': {
        this.expectOp('(');
        const s = str(this.expr()); this.expectOp(',');
        const st = Math.floor(num(this.expr()));
        let len = 255;
        if (this.isOp(',')) { this.p++; len = Math.floor(num(this.expr())); }
        this.expectOp(')');
        if (st < 1 || st > 255 || len < 0 || len > 255) throw new BasicError('QTY');
        return s.substr(st - 1, len);
      }
      case 'FRE': { this.args(1); let f = 38911 - this.programBytes() - this.vars.size * 7; if (f > 32767) f -= 65536; return f; }
      case 'POS': { this.args(1); return this.screen.cx + (this.screen.links[this.screen.cy] ? 40 : 0); }
      case 'USR': throw new BasicError('QTY');
      case 'FN': {
        const nm = this.next();
        if (nm.t !== 'id') throw new BasicError('SYNTAX');
        const fn = this.fns.get(varKey(nm.v));
        if (!fn) throw new BasicError('UNDEFFN');
        const arg = num(this.args(1)[0]);
        const saved = { toks: this.toks, p: this.p, had: this.vars.has(fn.param), old: this.vars.get(fn.param) };
        this.vars.set(fn.param, arg);
        this.toks = fn.toks; this.p = fn.p;
        let v;
        try { v = this.expr(); } finally {
          this.toks = saved.toks; this.p = saved.p;
          if (saved.had) this.vars.set(fn.param, saved.old); else this.vars.delete(fn.param);
        }
        return v;
      }
      default: throw new BasicError('SYNTAX');
    }
  }

}

