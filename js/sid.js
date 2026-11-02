/* =========================================================================
 *  sid.js — SID 6581 simplificado (3 vozes) com Web Audio
 *  ---------------------------------------------------------------------
 *  Registradores em $D400-$D418 (54272-54296), como no C64:
 *    voz n (n=0..2), base = 54272 + 7*n
 *      +0/+1  frequência (lo/hi)      +2/+3  largura de pulso (12 bits)
 *      +4     controle: bit0 GATE, 16 triângulo, 32 dente-de-serra,
 *             64 pulso, 128 ruído
 *      +5     ATTACK/DECAY            +6     SUSTAIN/RELEASE
 *    54296    volume geral (0-15)
 *  O filtro analógico não é emulado.
 * ========================================================================= */
'use strict';

class MiniSID {
  constructor() {
    this.regs = new Uint8Array(32);
    this.ctx = null;
    this.muted = false;
    this.voices = [0, 1, 2].map(() => ({ phase: 0, env: 0, state: 'off', gate: 0, noise: 0, nstep: -1 }));
  }

  static ATTACK_MS = [2, 8, 16, 24, 38, 56, 68, 80, 100, 250, 500, 800, 1000, 3000, 5000, 8000];
  static DECAY_MS = [6, 24, 48, 72, 114, 168, 204, 240, 300, 750, 1500, 2400, 3000, 9000, 15000, 24000];

  /** Precisa ser chamado a partir de um gesto do usuário (clique/tecla) */
  unlock() {
    try {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.node = this.ctx.createScriptProcessor(2048, 0, 1);
      this.node.onaudioprocess = (e) => this.renderAudio(e.outputBuffer.getChannelData(0));
      this.node.connect(this.ctx.destination);
    } catch (err) { this.ctx = null; }
  }

  reset() {
    this.regs.fill(0);
    this.voices.forEach((v) => { v.phase = 0; v.env = 0; v.state = 'off'; v.gate = 0; });
  }

  write(r, val) {
    if (r < 0 || r > 28) return;
    this.regs[r] = val & 255;
    if (r === 4 || r === 11 || r === 18) {
      const v = this.voices[(r - 4) / 7];
      const g = val & 1;
      if (g && !v.gate) v.state = 'attack';
      if (!g && v.gate) v.state = 'release';
      v.gate = g;
    }
  }

  read(r) {
    if (r === 27) return (Math.random() * 256) | 0;            // OSC3 (muito usado como RND)
    if (r === 28) return (this.voices[2].env * 255) | 0;       // ENV3
    if (r === 25 || r === 26) return 255;                      // paddles
    return 0;
  }

  renderAudio(out) {
    const sr = this.ctx.sampleRate;
    const clk = 985248;                                       // PAL
    const vol = this.muted ? 0 : (this.regs[24] & 15) / 15;
    for (let i = 0; i < out.length; i++) {
      let mix = 0;
      for (let n = 0; n < 3; n++) {
        const v = this.voices[n];
        const b = n * 7;
        const ctrl = this.regs[b + 4];
        const ad = this.regs[b + 5], srr = this.regs[b + 6];
        /* envelope ADSR */
        const sus = (srr >> 4) / 15;
        if (v.state === 'attack') {
          v.env += 1000 / (MiniSID.ATTACK_MS[ad >> 4] * sr);
          if (v.env >= 1) { v.env = 1; v.state = 'decay'; }
        } else if (v.state === 'decay') {
          if (v.env > sus) v.env = Math.max(sus, v.env - 1000 / (MiniSID.DECAY_MS[ad & 15] * sr));
        } else if (v.state === 'release') {
          v.env = Math.max(0, v.env - 1000 / (MiniSID.DECAY_MS[srr & 15] * sr));
          if (v.env === 0) v.state = 'off';
        }
        if (v.env <= 0) continue;
        /* oscilador */
        const freq = this.regs[b] | (this.regs[b + 1] << 8);
        v.phase += (freq * clk / 16777216) / sr;
        if (v.phase >= 1) v.phase -= Math.floor(v.phase);
        let w = 0, k = 0;
        if (ctrl & 16) { w += 1 - 4 * Math.abs(v.phase - 0.5); k++; }
        if (ctrl & 32) { w += 2 * v.phase - 1; k++; }
        if (ctrl & 64) {
          const pw = ((this.regs[b + 2] | ((this.regs[b + 3] & 15) << 8)) / 4096) || 0.5;
          w += v.phase < pw ? 1 : -1; k++;
        }
        if (ctrl & 128) {
          const step = Math.floor(v.phase * 16);
          if (step !== v.nstep) { v.nstep = step; v.noise = Math.random() * 2 - 1; }
          w += v.noise; k++;
        }
        if (k) mix += (w / k) * v.env;
      }
      out[i] = mix * vol * 0.22;
    }
  }
}
