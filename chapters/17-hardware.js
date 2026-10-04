/* Chapter 17 — Hardware: memory, compute and many users */
(function () {
  "use strict";
  const clamp = LX.clamp, lerp = LX.lerp;

  /* ---- the numbers every scene in this chapter is computed from ---- */
  const W_Q4 = 18.97e9;            // bytes of 4-bit weights (Qwen3.8-27B Q4_K_M)
  const P = 27.78e9;               // parameters
  const F = 2 * P;                 // operations per token (rule of thumb used in this chapter)
  const I1 = F / W_Q4;             // ≈ 2.93 operations per byte for one user
  const CHIPS = {
    m1u:  { name: "Apple M1 Ultra",  short: "M1 Ultra", bw: 800e9,  c: 21e12 },
    m3u:  { name: "Apple M3 Ultra",  short: "M3 Ultra", bw: 819e9,  c: 28e12 },
    h100: { name: "NVIDIA H100 SXM", short: "H100",     bw: 3350e9, c: 989e12 },
  };
  for (const k in CHIPS) {
    const ch = CHIPS[k];
    ch.ridge = ch.c / ch.bw;       // FLOP per byte where the roof turns flat
    ch.users = ch.ridge / I1;      // batch size that fills the compute
    ch.one = ch.bw / W_Q4;         // one-user upper bound, tokens/s
    ch.ceil = ch.c / F;            // compute ceiling, tokens/s
  }
  const tps = (ch, b) => Math.min(b * ch.bw / W_Q4, ch.c / F);
  const busy = (ch, b) => Math.min(1, b * I1 / ch.ridge);
  const hash = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
  const fmt = (v, d = 0) => v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const sig2 = v => { const m = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / m) * m; };
  const logLerp = (a, b, p) => Math.exp(lerp(Math.log(a), Math.log(b), p));

  /* ================================================================ one user */
  function oneUser(ctx) {
    const D = LX.draw, svg = ctx.svg, el = LX.el, col = LX.col, mix = LX.mix;
    D.backdrop(svg);
    const ch = CHIPS.m1u, b1 = busy(ch, 1);
    const stripOff = mix("bg", "token", .28), stripOn = mix("bg", "token", .9);
    const coreOff = mix("bg", "embed", .1);

    // memory
    const mg = el("g", {}, svg);
    D.label(mg, 120, 172, "Memory · 19 GB of weights");
    const strips = [];
    for (let r = 0; r < 36; r++) strips.push(el("rect", { x: 120, y: 190 + r * 13, width: 240, height: 10, rx: 2, fill: stripOff }, mg));

    // pipe
    const pg = el("g", {}, svg);
    const py = 424, ph = 36, px0 = 360, px1 = 790;
    const pipe = el("rect", { x: px0, y: py - ph / 2, width: px1 - px0, height: ph, fill: mix("bg", "token", .07) }, pg);
    el("line", { x1: px0, y1: py - ph / 2, x2: px1, y2: py - ph / 2, stroke: col("line-2"), "stroke-width": 2 }, pg);
    el("line", { x1: px0, y1: py + ph / 2, x2: px1, y2: py + ph / 2, stroke: col("line-2"), "stroke-width": 2 }, pg);
    const bwT = D.text(pg, (px0 + px1) / 2, py - 44, `${fmt(ch.bw / 1e9)} GB/s`, { size: 30, weight: 650, anchor: "middle", color: "token" });
    D.text(pg, (px0 + px1) / 2, py + 50, "memory bandwidth: bytes per second", { size: 16, anchor: "middle", color: "text-2" });

    // chip
    const cg = el("g", {}, svg);
    D.label(cg, 790, 172, `Chip · ${ch.short} · ${fmt(ch.c / 1e12)} TFLOPS`);
    const chipBox = el("rect", { x: 790, y: 190, width: 440, height: 468, rx: 10, fill: col("bg-2"), stroke: col("embed"), "stroke-width": 1.5 }, cg);
    const n = 14, cs = 24, gap = 5.5, gw = n * cs + (n - 1) * gap, gx = 790 + (440 - gw) / 2, gy = 190 + (468 - gw) / 2;
    const cores = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      cores.push(el("rect", { x: gx + c * (cs + gap), y: gy + r * (cs + gap), width: cs, height: cs, rx: 3, fill: coreOff }, cg));
    D.text(cg, 1010, 690, "compute: operations per second", { size: 16, anchor: "middle", color: "text-2" });

    // busy meter
    const bg = el("g", {}, svg);
    D.label(bg, 1290, 172, "Compute busy");
    el("rect", { x: 1290, y: 190, width: 40, height: 468, rx: 6, fill: col("panel"), stroke: col("line-2") }, bg);
    const bFill = el("rect", { x: 1290, y: 658, width: 40, height: 0, rx: 6, fill: col("embed") }, bg);
    const bPct = D.text(bg, 1344, 650, "", { mono: true, size: 24, color: "embed" });

    // weight packets in the pipe
    const pk = [];
    for (let k = 0; k < 5; k++) pk.push(el("rect", { x: px0, y: py - 10, width: 46, height: 20, rx: 3, fill: col("token"), opacity: 0 }, svg));

    // bottom lines
    const cnt = D.text(svg, 120, 722, "", { mono: true, size: 20 });
    const ratio = D.text(svg, 120, 760, `${fmt(F / 1e9, 1)} G operations ÷ ${fmt(W_Q4 / 1e9)} GB ≈ ${fmt(I1, 1)} operations per byte   ·   this chip could do ${fmt(ch.ridge)} per byte`, { mono: true, size: 18, color: "text-2", opacity: 0 });
    const formula = D.text(svg, 120, 822, `${fmt(ch.bw / 1e9)} GB/s ÷ ${fmt(W_Q4 / 1e9)} GB ≈ ${fmt(ch.one)} tokens per second`, { size: 36, weight: 650, color: "token", opacity: 0 });
    const fSub = D.text(svg, 900, 822, "upper bound for one user · set by memory, not compute", { size: 18, color: "text-2", opacity: 0 });

    const S = ctx.cue("stream").start;
    return t => {
      mg.setAttribute("opacity", ctx.p(t, "two", 0, .35));
      pg.setAttribute("opacity", ctx.p(t, "two", .15, .5));
      cg.setAttribute("opacity", ctx.p(t, "two", .3, .65));
      bg.setAttribute("opacity", ctx.p(t, "ratio", .2, .5));

      const on = t >= S, s = Math.max(0, t - S), ps = ctx.p(t, "stream", 0, .15);
      const hi = on ? Math.floor(s * 9) % strips.length : -1;
      strips.forEach((r, i) => r.setAttribute("fill", i === hi ? stripOn : stripOff));
      pk.forEach((r, k) => {
        const ph2 = (s * .6 + k / pk.length) % 1;
        r.setAttribute("x", px0 + ph2 * (px1 - px0 - 46));
        r.setAttribute("opacity", on ? ps * Math.min(1, ph2 * 8, (1 - ph2) * 8) : 0);
      });
      // cores flash briefly when weights arrive: only ≈ b1 of them are ever busy
      const fi = Math.floor(s * 5), fr = (s * 5) % 1;
      cores.forEach((c, i) => {
        const lit = on && hash(i, fi) < b1;
        c.setAttribute("fill", lit ? mix("bg", "embed", .15 + .75 * (1 - fr)) : coreOff);
      });

      const q = ctx.p(t, "stream", .1, .85, LX.ease.linear);
      cnt.textContent = on ? `read ${fmt(W_Q4 / 1e9 * q, 1)} GB   ·   ${fmt(F / 1e9 * q, 1)} G operations   (one token)` : "";
      ratio.setAttribute("opacity", ctx.p(t, "ratio", 0, .3));
      const m = ctx.p(t, "ratio", .3, .8) * b1;
      bFill.setAttribute("height", 468 * m); bFill.setAttribute("y", 658 - 468 * m);
      bPct.textContent = t >= ctx.cue("ratio").start ? `${Math.round(m * 100)}%` : "";

      const pb = ctx.p(t, "bound", .05, .4);
      formula.setAttribute("opacity", pb); fSub.setAttribute("opacity", ctx.p(t, "bound", .3, .6));
      const glow = ctx.active(t, "bound") || t >= ctx.cue("bound").end;
      pipe.setAttribute("fill", mix("bg", "token", glow ? .07 + .25 * pb : .07));
      bwT.setAttribute("filter", glow && pb > .5 ? "url(#lx-glow)" : "none");
      chipBox.setAttribute("stroke-opacity", 1);
    };
  }

  /* ================================================================ batching */
  function batching(ctx) {
    const D = LX.draw, svg = ctx.svg, el = LX.el, col = LX.col, mix = LX.mix;
    D.backdrop(svg);
    const offC = mix("bg", "embed", .08), litC = mix("bg", "embed", .8), satC = mix("bg", "cache", .85);
    const panelsG = el("g", {}, svg);

    function mkPanel(ch, px, n, cs, gap, note) {
      const g = el("g", {}, panelsG);
      D.text(g, px, 100, ch.name, { size: 26, weight: 650 });
      D.text(g, px, 128, `${fmt(ch.bw / 1e9)} GB/s · ${fmt(ch.c / 1e12)} TFLOPS · ridge ≈ ${fmt(ch.ridge)} FLOP/byte`, { mono: true, size: 14, color: "muted" });
      for (let r = 0; r < 20; r++) el("rect", { x: px, y: 170 + r * 15, width: 60, height: 11, rx: 2, fill: mix("bg", "token", .3) }, g);
      const pyc = 320, ph = ch.bw / 80e9;
      el("rect", { x: px + 60, y: pyc - ph / 2, width: 170, height: ph, fill: mix("bg", "token", .14), stroke: col("line-2") }, g);
      D.text(g, px + 145, pyc - ph / 2 - 10, `${fmt(ch.bw / 1e9)} GB/s`, { mono: true, size: 14, color: "token", anchor: "middle" });
      const gw = n * cs + (n - 1) * gap, gx = px + 260, gy = pyc - gw / 2;
      const cells = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
        cells.push(el("rect", { x: gx + c * (cs + gap), y: gy + r * (cs + gap), width: cs, height: cs, rx: Math.min(3, cs / 4), fill: offC }, g));
      const R = LX.rng(n * 31 + 7), rank = cells.map((_, i) => i);
      for (let i = rank.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rank[i], rank[j]] = [rank[j], rank[i]]; }
      const fans = [];
      for (let k = 0; k < 12; k++) fans.push(el("line", { x1: px + 230, y1: pyc, x2: gx - 6, y2: gy + (k + .5) * gw / 12, stroke: col("token"), "stroke-width": 1.2, opacity: 0 }, g));
      if (note) D.text(g, gx, gy + gw + 26, note, { size: 14, color: "muted" });
      D.label(g, px + 260, 506, "Compute busy");
      el("rect", { x: px + 260, y: 516, width: 340, height: 18, rx: 4, fill: col("panel"), stroke: col("line-2") }, g);
      const meter = el("rect", { x: px + 260, y: 516, width: 0, height: 18, rx: 4, fill: col("embed") }, g);
      const pct = D.text(g, px + 612, 531, "", { mono: true, size: 18, color: "embed" });
      D.label(g, px, 588, "All users together · tokens/s (log scale)");
      el("rect", { x: px, y: 600, width: 600, height: 26, rx: 4, fill: col("panel"), stroke: col("line-2") }, g);
      const bar = el("rect", { x: px, y: 600, width: 0, height: 26, rx: 4, fill: col("embed") }, g);
      const LMAX = Math.log10(20000), X = v => 600 * clamp((Math.log10(v) - 1) / (LMAX - 1));
      [[10, "10"], [100, "100"], [1000, "1,000"], [10000, "10,000"]].forEach(([v, l]) => {
        el("line", { x1: px + X(v), y1: 628, x2: px + X(v), y2: 636, stroke: col("line-2") }, g);
        D.text(g, px + X(v), 652, l, { mono: true, size: 13, color: "dim", anchor: "middle" });
      });
      const val = D.text(g, px, 694, "", { size: 24, weight: 600 });
      const per = D.text(g, px, 724, "", { size: 17, color: "text-2" });
      const x4 = D.text(g, px + 380, 694, "≈ 4× in total · same speed each", { size: 18, color: "embed", opacity: 0 });
      const state = D.text(g, px, 760, "", { size: 17, color: "cache", opacity: 0 });
      return {
        ch, g, x4, state,
        set(b) {
          const bz = busy(ch, b), lit = Math.round(bz * cells.length), sat = bz >= .999;
          cells.forEach((c, i) => c.setAttribute("fill", rank[i] < lit ? (sat ? satC : litC) : offC));
          const nf = Math.min(12, Math.round(b));
          fans.forEach((f, k) => f.setAttribute("opacity", k < nf ? .7 : 0));
          meter.setAttribute("width", 340 * bz); meter.setAttribute("fill", col(sat ? "cache" : "embed"));
          meter.setAttribute("filter", sat ? "url(#lx-glow)" : "none");
          pct.textContent = `${Math.round(bz * 100)}%`; pct.setAttribute("fill", col(sat ? "cache" : "embed"));
          const v = tps(ch, b);
          bar.setAttribute("width", X(v)); bar.setAttribute("fill", col(sat ? "cache" : "embed"));
          val.textContent = `${fmt(v)} tokens/s in total`;
          per.textContent = `${fmt(v / b, v / b < 10 ? 1 : 0)} tokens/s per user`;
          return bz;
        },
      };
    }
    const mac = mkPanel(CHIPS.m3u, 80, 8, 22, 6, null);
    const nv = mkPanel(CHIPS.h100, 830, 20, 10, 3, `grid not to scale: ≈ ${fmt(CHIPS.h100.c / CHIPS.m3u.c)}× the Mac's compute`);

    const bG = el("g", {}, panelsG);
    D.label(bG, 800, 800, "Users sharing each weight read", { anchor: "middle" });
    const bT = D.text(bG, 800, 850, "", { size: 40, weight: 650, anchor: "middle" });

    /* ---- roofline (log–log) ---- */
    const rg = el("g", { opacity: 0 }, svg);
    const cx0 = 300, cw = 1000, cy0 = 150, ch = 560, LX0 = 0, LX1 = 3, LY0 = 11, LY1 = 15.3;
    const X = I => cx0 + (Math.log10(I) - LX0) / (LX1 - LX0) * cw;
    const Y = f => cy0 + ch - (Math.log10(f) - LY0) / (LY1 - LY0) * ch;
    D.label(rg, cx0, 128, "Operations per second (log scale)");
    [[1e11, "100 G"], [1e12, "1 T"], [1e13, "10 T"], [1e14, "100 T"], [1e15, "1 P"]].forEach(([f, l]) => {
      el("line", { x1: cx0, y1: Y(f), x2: cx0 + cw, y2: Y(f), stroke: col("line"), "stroke-width": 1 }, rg);
      D.text(rg, cx0 - 12, Y(f) + 5, l, { mono: true, size: 14, color: "muted", anchor: "end" });
    });
    [[1, "1"], [10, "10"], [100, "100"], [1000, "1,000"]].forEach(([I, l]) => {
      el("line", { x1: X(I), y1: cy0, x2: X(I), y2: cy0 + ch, stroke: col("line"), "stroke-width": 1 }, rg);
      D.text(rg, X(I), cy0 + ch + 26, l, { mono: true, size: 14, color: "muted", anchor: "middle" });
    });
    el("rect", { x: cx0, y: cy0, width: cw, height: ch, fill: "none", stroke: col("line-2") }, rg);
    D.text(rg, cx0 + cw / 2, cy0 + ch + 60, "arithmetic intensity: operations per byte read (log scale)", { size: 16, color: "text-2", anchor: "middle" });
    const roofs = [[CHIPS.m3u, "norm"], [CHIPS.h100, "embed"]].map(([c, k]) => {
      const d = `M${X(1)} ${Y(c.bw)} L${X(c.ridge)} ${Y(c.c)} L${X(1000)} ${Y(c.c)}`;
      const path = el("path", { d, fill: "none", stroke: col(k), "stroke-width": 3, "stroke-linejoin": "round" }, rg);
      const L = path.getTotalLength(); path.setAttribute("stroke-dasharray", `${L} ${L}`);
      const deco = el("g", { opacity: 0 }, rg);
      el("line", { x1: X(c.ridge), y1: Y(c.c), x2: X(c.ridge), y2: cy0 + ch, stroke: col(k), "stroke-width": 1.5, "stroke-dasharray": "5 5" }, deco);
      D.text(deco, X(c.ridge) + 8, cy0 + ch - 10, `ridge ≈ ${fmt(c.ridge)}`, { mono: true, size: 14, color: k });
      D.text(deco, X(1000) - 8, Y(c.c) - 12, `${c.name} · flat from ≈ ${fmt(sig2(c.users))} users`, { size: 16, weight: 600, color: k, anchor: "end" });
      const one = el("circle", { cx: X(I1), cy: Y(I1 * c.bw), r: 7, fill: col("bg"), stroke: col(k), "stroke-width": 2.5, opacity: 0 }, rg);
      const dot = el("circle", { r: 9, fill: col(k), filter: "url(#lx-glow)", opacity: 0 }, rg);
      const dl = D.text(rg, 0, 0, "", { mono: true, size: 15, color: k, opacity: 0 });
      return { c, k, path, L, deco, one, dot, dl };
    });
    const oneL = D.text(rg, X(I1) - 30, Y(I1 * CHIPS.h100.bw) - 60, `1 user · ${fmt(I1, 1)} FLOP/byte`, { size: 15, color: "text-2", anchor: "start", opacity: 0 });
    el("line", { x1: X(I1), y1: Y(I1 * CHIPS.h100.bw) - 10, x2: X(I1), y2: Y(I1 * CHIPS.h100.bw) - 52, stroke: LX.col("text-2"), "stroke-width": 1, "stroke-dasharray": "3 3", class: "oneLead" }, rg);
    const oneLead = rg.querySelector(".oneLead");
    const memL = D.text(rg, X(1.15), cy0 + ch - 14, "← memory-bound (sloped roof)", { size: 15, color: "token", opacity: 0 });
    const cmpL = D.text(rg, (X(CHIPS.m3u.ridge) + X(CHIPS.h100.ridge)) / 2, Y(CHIPS.m3u.c) + 40, "compute-bound (flat roof) →", { size: 15, color: "cache", anchor: "middle", opacity: 0 });

    const bAt = t => {
      if (t < ctx.cue("share").start) return 1;
      if (t < ctx.cue("macful").start) return logLerp(1, 4, ctx.p(t, "share", .2, .7, LX.ease.inOut));
      if (t < ctx.cue("nvidia").start) return logLerp(4, 12, ctx.p(t, "macful", .1, .6, LX.ease.inOut));
      const pB = ctx.p(t, "nvidia", .55, .95, LX.ease.inOut);
      return pB > 0 ? logLerp(40, 100, pB) : logLerp(12, 40, ctx.p(t, "nvidia", .05, .45, LX.ease.inOut));
    };

    return t => {
      const intro = ctx.p(t, "share", 0, .25);
      const out = ctx.p(t, "roof", 0, .25);
      panelsG.setAttribute("opacity", intro * (1 - out));
      const b = bAt(t);
      mac.set(b); const nbz = nv.set(b);
      bT.textContent = `B = ${Math.round(b)}`;
      const fx = ctx.p(t, "free", .1, .4) * (1 - ctx.p(t, "macful", 0, .2));
      mac.x4.setAttribute("opacity", fx); nv.x4.setAttribute("opacity", fx);
      mac.state.textContent = "compute-bound: more users only share the same speed";
      mac.state.setAttribute("opacity", ctx.p(t, "macful", .55, .75));
      nv.state.textContent = nbz < .95 ? "still memory-bound: extra users are nearly free" : "compute nearly full at ≈ 100 users";
      nv.state.setAttribute("fill", col(nbz < .95 ? "embed" : "cache"));
      nv.state.setAttribute("opacity", ctx.p(t, "nvidia", .1, .3));

      rg.setAttribute("opacity", ctx.p(t, "roof", .15, .4));
      const pr = ctx.p(t, "roof", .25, .5, LX.ease.inOut);
      const b2 = logLerp(1, 100, ctx.p(t, "roof", .55, .95, LX.ease.inOut));
      roofs.forEach((r, i) => {
        r.path.setAttribute("stroke-dashoffset", r.L * (1 - pr));
        r.deco.setAttribute("opacity", ctx.p(t, "roof", .42, .55));
        r.one.setAttribute("opacity", ctx.p(t, "roof", .45, .55));
        const I = I1 * b2, f = Math.min(I * r.c.bw, r.c.c), vis = ctx.p(t, "roof", .55, .6);
        r.dot.setAttribute("cx", X(I)); r.dot.setAttribute("cy", Y(f)); r.dot.setAttribute("opacity", vis);
        r.dl.setAttribute("x", X(I) + 14); r.dl.setAttribute("y", Y(f) + 26);
        r.dl.textContent = `B = ${Math.round(b2)}`; r.dl.setAttribute("opacity", vis);
      });
      oneL.setAttribute("opacity", ctx.p(t, "roof", .45, .55)); oneLead.setAttribute("opacity", ctx.p(t, "roof", .45, .55));
      memL.setAttribute("opacity", ctx.p(t, "roof", .5, .6)); cmpL.setAttribute("opacity", ctx.p(t, "roof", .5, .6));
    };
  }

  const HW = { oneUser, batching };

LX.chapter({
  id: "hardware", num: 17, title: "Memory, compute and many users", toc: "Hardware: Mac vs NVIDIA",
  kicker: "Why a GPU server scales with users and a Mac does not",
  lede: "Writing one token needs two things: reading every weight from memory, and doing the arithmetic. Which one runs out first decides how fast a model writes, and how many people it can serve at once.",
  body: [
    { prose: `
      <p>Every chip has two speed limits. <strong>Memory bandwidth</strong> is how many bytes per second it can read from memory. <strong>Compute</strong> is how many arithmetic operations (<abbr>FLOP</abbr>s) per second it can do. A model's speed depends on which limit it hits first. This chapter explains why the answer is different for one user and for many, and why that makes an NVIDIA server and an Apple Silicon Mac behave so differently.</p>
      <p>We use the numbers from earlier chapters. Qwen3.8-27B quantized to <abbr>Q4</abbr> (about 5.5 bits per weight on average, because some tensors are kept at higher precision) is about <strong>19 GB</strong>. Writing one token costs about <strong>55.6 billion operations</strong> by the rule of thumb of two per parameter (<a href="#numbers">Chapter 3</a>). The exact count for a text token is a little lower, 51.2 billion (<a href="#recap">Chapter 18</a>), which does not change any conclusion here.</p>` },

    { scene: {
      id: "hw-one-user", title: "One user: the arithmetic waits for memory", build: HW.oneUser,
      visual: "Left: a memory block (19 GB of weights drawn as a stack of amber strips). Centre: a pipe labelled 800 GB/s. Right: an M1 Ultra-class chip drawn as a 14 × 14 grid of compute cores (21 TFLOPS), with a vertical 'compute busy' meter. Weight packets stream through the pipe; a strip in memory lights as it is read; only about one core in nine flashes at any moment. All numbers are computed from 18.97 GB, 27.78 B parameters and the chip's bandwidth and compute.",
      cues: [
        { id: "two",    say: "A chip has two speed limits. How fast it can read from memory, and how fast it can calculate.", vis: "Memory block, pipe (800 GB/s, memory bandwidth) and core grid (21 TFLOPS, compute) fade in." },
        { id: "stream", say: "To write one token, the model must read all of its weights, about nineteen gigabytes, and do about fifty-five billion operations with them.", vis: "Packets stream through the pipe, memory strips light in turn; counter runs to 'read 19.0 GB · 55.6 G operations (one token)'." },
        { id: "ratio",  say: "That is only about three operations for every byte read. Every modern chip can calculate far faster than that. So the cores finish their work and then sit waiting for the next weights to arrive.", vis: "Line: 55.6 G operations ÷ 19 GB ≈ 2.9 per byte · this chip could do 26 per byte. Cores flash briefly and go dark; the busy meter fills to 11%." },
        { id: "bound",  say: "For one user, writing speed is set by memory bandwidth alone. Eight hundred gigabytes per second divided by nineteen gigabytes gives at most about forty-two tokens per second.", vis: "Formula: 800 GB/s ÷ 19 GB ≈ 42 tokens per second · 'upper bound for one user · set by memory, not compute'; the pipe and its label glow." },
      ],
    } },

    { prose: `
      <h3>Operations per byte: arithmetic intensity</h3>
      <p>The key ratio is <strong>arithmetic intensity</strong>: how many operations are done for each byte read from memory. Every chip also has a break-even intensity, called its <strong>ridge point</strong>: its compute divided by its bandwidth. Below the ridge, a job is <em>memory-bound</em> and the cores wait. Above it, the job is <em>compute-bound</em> and memory waits.</p>
      <p>Writing tokens for a single user has an intensity of about 2.9 operations per byte (55.6 G operations ÷ 19 GB). Every chip in the table below has a ridge point between 26 and 370. So for one user, <strong>every chip is memory-bound</strong>, and most of its compute sits idle.</p>

      <h3>Many users: read once, use many times</h3>
      <p>Now let a server write for <i>B</i> users at the same time, which is called <strong>batching</strong>. The trick is that all users share the same weights. In each step, the chip reads each weight <em>once</em> and uses it for all <i>B</i> users' tokens. The bytes read stay almost the same, but the arithmetic is multiplied by <i>B</i>, and so is the intensity: about 2.9 × <i>B</i>.</p>
      <p>As long as the chip is memory-bound, adding users is almost free: each step takes the same time but produces <i>B</i> tokens instead of one. Total throughput grows nearly linearly. That continues until the intensity reaches the ridge point. From there the chip is compute-bound, and more users only share the same fixed amount of arithmetic.</p>` },

    { scene: {
      id: "hw-batching", title: "Many users: the same bytes, more work", build: HW.batching,
      visual: "Two panels side by side: Apple M3 Ultra (819 GB/s, 28 TFLOPS, ridge ≈ 34) and NVIDIA H100 SXM (3,350 GB/s, 989 TFLOPS, ridge ≈ 295), each with memory, a pipe whose thickness follows bandwidth, a core grid (the H100 grid is larger, with a note that the real compute ratio is ≈ 35×), a 'compute busy' meter and a log-scale bar of total tokens per second. A counter B (users sharing each weight read) moves 1 → 4 → 12 → 40 → 100; fan lines show one weight read feeding B users. Busy = B × 2.93 ÷ ridge; total = min(B × bandwidth ÷ 19 GB, compute ÷ 55.6 G). Then the panels give way to a log–log roofline chart with both roofs, their ridge points and dots moving right as B grows.",
      cues: [
        { id: "share",  say: "Now let the chip write for several users at once. Each weight is read from memory once, and used for every user's token in the same step.", vis: "B = 4: four fan lines from each pipe; Mac busy 34%, H100 4%." },
        { id: "free",   say: "While the chip is waiting on memory anyway, those extra users cost almost nothing. Four users get almost four times the total output.", vis: "Total bars grow (Mac 173 tok/s, H100 706 tok/s); per-user speed stays 43 / 177; note '≈ 4× in total · same speed each'." },
        { id: "macful", say: "But a Mac has relatively little compute for its bandwidth. Around ten to twelve users, its cores are fully busy. From there, more users just share the same speed.", vis: "B = 12: Mac meter reaches 100% and turns orange; its total stops at 504 tok/s; note 'compute-bound: more users only share the same speed'." },
        { id: "nvidia", say: "An N V I D I A data-centre chip has about thirty-five times more compute and four times more bandwidth. Its cores stay hungry far longer, up to around a hundred users, so total output keeps climbing.", vis: "B = 40 → 100: H100 total climbs to ≈ 17,660 tok/s while its meter reaches 99%; the Mac stays at 504 with per-user speed falling to 5 tok/s." },
        { id: "roof",   say: "This picture has a name: the roofline. A sloped roof where memory limits you, and a flat roof where compute does. The more compute a chip has per byte of bandwidth, the further to the right its roof turns flat.", vis: "Log–log roofline: sloped memory roofs and flat compute roofs for both chips, ridge lines at ≈ 34 and ≈ 295, '1 user · 2.9 FLOP/byte' rings far down both slopes, then dots slide right as B goes to 100: the Mac's lands on its flat roof, the H100's just reaches its corner. Labels: 'flat from ≈ 12 users' / 'flat from ≈ 100 users'." },
      ],
    } },

    { html: `<div class="lx-prose"><h3>The numbers for real chips</h3>
      <p>Bandwidth and dense 16-bit matrix throughput, and what they mean for Qwen3.8-27B at Q4 (19 GB, 55.6 G operations per token). "Users to fill" is the ridge point divided by 2.9: roughly the batch size at which the chip stops being memory-bound. The last two columns are theoretical ceilings. Real systems reach perhaps 50–80% of them.</p></div>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Chip</th><th class="num">Bandwidth GB/s</th><th class="num">FP16 TFLOPS</th><th class="num">Ridge FLOP/byte</th><th class="num">Users to fill</th><th class="num">1 user, max tok/s</th><th class="num">All users, max tok/s</th></tr>
        <tr><td>Apple M1 Max</td><td class="num">400</td><td class="num">10.4</td><td class="num">26</td><td class="num">≈ 9</td><td class="num">21</td><td class="num">190</td></tr>
        <tr><td>Apple M1 Ultra</td><td class="num">800</td><td class="num">21</td><td class="num">26</td><td class="num">≈ 9</td><td class="num">42</td><td class="num">380</td></tr>
        <tr><td>Apple M2 Ultra</td><td class="num">800</td><td class="num">27.2</td><td class="num">34</td><td class="num">≈ 12</td><td class="num">42</td><td class="num">490</td></tr>
        <tr><td>Apple M3 Ultra*</td><td class="num">819</td><td class="num">≈ 28</td><td class="num">≈ 34</td><td class="num">≈ 12</td><td class="num">43</td><td class="num">≈ 500</td></tr>
        <tr><td>Apple M4 Max</td><td class="num">546</td><td class="num">18.4</td><td class="num">34</td><td class="num">≈ 12</td><td class="num">29</td><td class="num">330</td></tr>
        <tr><td>Apple M5 Max*</td><td class="num">614</td><td class="num">≈ 70</td><td class="num">≈ 114</td><td class="num">≈ 39</td><td class="num">32</td><td class="num">≈ 1,260</td></tr>
        <tr><td>Apple M5 Ultra*</td><td class="num">1,228</td><td class="num">≈ 140</td><td class="num">≈ 114</td><td class="num">≈ 39</td><td class="num">65</td><td class="num">≈ 2,500</td></tr>
        <tr><td>NVIDIA RTX 4090 (24 GB)</td><td class="num">1,008</td><td class="num">165</td><td class="num">164</td><td class="num">≈ 56</td><td class="num">53</td><td class="num">2,970</td></tr>
        <tr><td>NVIDIA RTX 5090 (32 GB)</td><td class="num">1,792</td><td class="num">210</td><td class="num">117</td><td class="num">≈ 40</td><td class="num">94</td><td class="num">3,770</td></tr>
        <tr><td>NVIDIA H100 SXM</td><td class="num">3,350</td><td class="num">989</td><td class="num">295</td><td class="num">≈ 100</td><td class="num">177</td><td class="num">17,800</td></tr>
        <tr><td>NVIDIA H200</td><td class="num">4,800</td><td class="num">989</td><td class="num">206</td><td class="num">≈ 70</td><td class="num">253</td><td class="num">17,800</td></tr>
        <tr><td>NVIDIA B200</td><td class="num">8,000</td><td class="num">2,250</td><td class="num">281</td><td class="num">≈ 96</td><td class="num">422</td><td class="num">40,500</td></tr>
        <tr><td>NVIDIA DGX Spark*</td><td class="num">273</td><td class="num">≈ 100</td><td class="num">≈ 370</td><td class="num">≈ 125</td><td class="num">14</td><td class="num">≈ 1,800</td></tr>
      </table></div>
      <p class="c-muted" style="max-width:var(--lx-read)">* Apple does not publish TFLOPS. Values for M1–M4 are the GPU's 32-bit peak, which 16-bit matrix work also runs at. Values marked * are derived from core counts, operations per cycle and clock speed, and may be off by ±15%. NVIDIA values are dense (no sparsity), from NVIDIA's specifications. Server GPUs usually run 8- or 16-bit weights rather than Q4, which changes the absolute numbers but not the pattern.</p>` },

    { prose: `
      <h3>What this means in practice</h3>
      <ul>
        <li><strong>For one person, a Mac is competitive.</strong> Single-user speed is set by bandwidth, and an Ultra-class Mac has 800+ GB/s plus enough unified memory to hold large models that would need several gaming GPUs. It does this quietly and at low power.</li>
        <li><strong>For many people, compute decides.</strong> An M1 to M4 Mac runs out of compute at around 10 concurrent users, and adding more barely raises total throughput. An H100 has about 35 times the compute and keeps scaling to around a hundred. That is why model providers serve thousands of users from GPU servers.</li>
        <li><strong>Prompt reading is compute-bound everywhere.</strong> Prefill processes thousands of tokens at once (<a href="#prefill-decode">Chapter 13</a>), so its intensity is high and it runs at the compute roof. This is where a Mac feels slowest: a long prompt takes many seconds before the first token appears.</li>
        <li><strong>The M5 generation narrows the gap.</strong> M5 chips add matrix units ("neural accelerators") to every GPU core, the equivalent of NVIDIA's tensor cores. Apple measured 3.5–4× faster time-to-first-token than M4, but only about 1.2× faster writing, which tracks the bandwidth increase. That is exactly what the roofline predicts. The ridge point moves from about 30 to about 110.</li>
      </ul>
      <p>Published measurements match the picture. A 2026 study of an M5 Pro running the closely related Qwen3.6-27B at Q4 reports about 18 tokens per second for a single stream, right where its 307 GB/s of bandwidth puts the ceiling. In a benchmark of serving engines, going from 1 to 16 concurrent users raised total throughput on an Apple M5 Pro by between 0.8× and 3.7×, depending on the engine, while CUDA engines on an NVIDIA system scaled by about 7–8× under the same test. That test used very small models, where overheads weigh more, but the direction is the same: the Mac runs out of compute early.</p>
      <p class="c-muted">Sources: BaseRT (arXiv 2607.19438); SiliconBench (arXiv 2609.19169).</p>

      <h3>Why speculative decoding helps less on a Mac</h3>
      <p>Speculative decoding and <abbr>MTP</abbr> (<a href="#mtp">Chapter 15</a>) are another way to spend idle compute: verify several drafted tokens in one pass, using arithmetic the chip was not using anyway. On a chip with lots of spare compute, that is nearly free. On a Mac with little headroom, the verification pass is a real cost. When few drafts are accepted, as often happens on free-flowing prose and code, it can end up slower than plain decoding.</p>` },

    { widget: {
      id: "batch-roofline", title: "Try it: how many users before the roof?",
      sub: "Pick a chip, a model and a context length. The chart shows total and per-user writing speed as more users share the chip, and where the compute roof is reached.",
    } },

    { deep: `
      <h3>The roofline model</h3>
      <p>For a chip with bandwidth <i>B</i><sub>mem</sub> (bytes/s) and compute <i>C</i> (FLOP/s), a job that does <i>F</i> operations on <i>M</i> bytes takes at least</p>
      <math display="block"><mrow><mi>t</mi><mo>≥</mo><mi>max</mi><mrow><mo>(</mo><mfrac><mi>M</mi><msub><mi>B</mi><mtext>mem</mtext></msub></mfrac><mo>,</mo><mfrac><mi>F</mi><mi>C</mi></mfrac><mo>)</mo></mrow><mo>,</mo><mspace width="1.5em"/><mtext>intensity</mtext><mspace width="0.3em"/><mi>I</mi><mo>=</mo><mfrac><mi>F</mi><mi>M</mi></mfrac><mo>,</mo><mspace width="1.5em"/><mtext>ridge</mtext><mo>=</mo><mfrac><mi>C</mi><msub><mi>B</mi><mtext>mem</mtext></msub></mfrac></mrow></math>
      <div class="lx-read">A job must both read M bytes and do F operations. Reading takes M divided by the bandwidth; computing takes F divided by the compute speed C. The job takes at least as long as the slower of the two, so the time is at least the larger of those two numbers. Intensity I is operations per byte of the job; the ridge is operations per byte the chip can sustain. If I is below the ridge, memory is the bottleneck; above it, compute is.</div>
      <h3>Batched decode</h3>
      <p>With <i>P</i> parameters stored in <i>W</i> bytes, one decode step for <i>b</i> users does <i>F</i> ≈ 2<i>P</i><i>b</i> operations and reads about <i>W</i> bytes of weights. Aggregate throughput is then roughly</p>
      <math display="block"><mrow><mtext>tokens/s</mtext><mo>≈</mo><mi>min</mi><mrow><mo>(</mo><mfrac><mrow><mi>b</mi><mspace width="0.15em"/><msub><mi>B</mi><mtext>mem</mtext></msub></mrow><mi>W</mi></mfrac><mo>,</mo><mfrac><mi>C</mi><mrow><mn>2</mn><mi>P</mi></mrow></mfrac><mo>)</mo></mrow><mo>,</mo><mspace width="1.5em"/><msup><mi>b</mi><mo>*</mo></msup><mo>≈</mo><mfrac><mrow><mi>C</mi><mo>/</mo><msub><mi>B</mi><mtext>mem</mtext></msub></mrow><mrow><mn>2</mn><mi>P</mi><mo>/</mo><mi>W</mi></mrow></mfrac></mrow></math>
      <div class="lx-read">b is the number of users served together, P the parameter count and W the bytes of weights. First term: each step reads W bytes once and gives b tokens, so the memory limit is b times bandwidth divided by W. Second term: each token needs 2P operations, so the compute limit is C divided by 2P. Throughput is whichever limit is lower. b* is the user count where the two limits meet: the chip's ridge divided by the job's operations per byte for one user (2P / W ≈ 2.93). Example: H100 ridge 295 / 2.93 ≈ 100 users.</div>
      <p>For Qwen3.8-27B at Q4: <i>P</i> = 27.78 × 10<sup>9</sup>, <i>W</i> ≈ 18.97 GB, so 2<i>P</i>/<i>W</i> ≈ 2.93 operations per byte. For an M2 Ultra (ridge 34): <i>b</i>* ≈ 12. For an H100 (ridge 295): <i>b</i>* ≈ 100.</p>
      <h3>What each user adds</h3>
      <p>Weights are shared, but each user's own memory is not. Per decode step, each user also reads their KV cache (64 <abbr>KiB</abbr> per token of context, <a href="#kv-cache">Chapter 14</a>) and reads and writes their DeltaNet state (2 × 144 <abbr>MiB</abbr>). At 8,192 tokens of context, that is about 0.5 GiB + 0.28 GiB ≈ 0.8 GiB per user per step, against 19 GB of shared weights. With 24 users, the per-user traffic matches the weights themselves, which bends the curve down before the compute roof is reached. Long contexts lower the useful batch size on every chip. They hurt more where bandwidth is scarce.</p>
      <h3>Quantization costs compute</h3>
      <p>Q4 weights must be unpacked to 16-bit before the multiply. That adds arithmetic to every weight read. On a GPU with spare compute this is invisible. On a chip that is already near its compute roof, it lowers the batch size at which the roof is hit.</p>` },
  ],
});
})();

/* ======================================================= batch-roofline widget */
(function () {
  "use strict";
  // bandwidth GB/s, dense 16-bit TFLOPS; derived = Apple publishes no TFLOPS (estimated)
  const CHIPS = [
    ["Apple M1 Max", 400, 10.4], ["Apple M1 Ultra", 800, 21], ["Apple M2 Ultra", 800, 27.2], ["Apple M3 Ultra", 819, 28, true],
    ["Apple M4 Max", 546, 18.4], ["Apple M5 Max", 614, 70, true], ["Apple M5 Ultra", 1228, 140, true],
    ["NVIDIA RTX 4090 (24 GB)", 1008, 165], ["NVIDIA RTX 5090 (32 GB)", 1792, 210], ["NVIDIA H100 SXM", 3350, 989],
    ["NVIDIA H200", 4800, 989], ["NVIDIA B200", 8000, 2250], ["NVIDIA DGX Spark", 273, 100, true],
  ];
  const KV_TOKEN = 65536, STATE = 2 * 144 * 2 ** 20;                    // Qwen3.8 per-user traffic per step
  const INPUT = "background:var(--lx-panel);border:1px solid var(--lx-line-2);color:var(--lx-text);border-radius:7px;padding:6px 8px;font:500 14px var(--lx-mono);width:100%;min-width:0;";
  const n0 = v => Math.round(v).toLocaleString("en-US");
  LX.widget("batch-roofline", el => {
    const st = { chip: 2, bw: 800, tf: 27.2, gb: 18.97, pb: 27.78, ctx: 8192, extra: false };
    const fld = (key, label, step) => `<label style="display:grid;gap:4px;font-size:13px;color:var(--lx-text-2)">${label}<input type="number" min="0" step="${step}" data-k="${key}" value="${st[key]}" style="${INPUT}"></label>`;
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
        <label style="display:grid;gap:4px;font-size:13px;color:var(--lx-text-2);grid-column:1/-1">Chip
          <select class="br-chip" style="${INPUT}">${CHIPS.map((c, i) => `<option value="${i}" ${i === st.chip ? "selected" : ""}>${c[0]}${c[3] ? " *" : ""} · ${c[1]} GB/s · ${c[2]} TFLOPS</option>`).join("")}<option value="-1">Custom…</option></select></label>
        ${fld("bw", "Bandwidth (GB/s)", 1)}${fld("tf", "Compute (TFLOPS)", 0.1)}${fld("gb", "Model size (GB)", 0.01)}${fld("pb", "Parameters (billions)", 0.01)}${fld("ctx", "Context per user (tokens)", 256)}
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin:12px 0 0;font-size:14px;color:var(--lx-text-2)"><input type="checkbox" class="br-extra"> Include each user's KV cache and DeltaNet state traffic (Qwen3.8: 64 KiB × context + 2 × 144 MiB per step)</label>
      <div class="br-out" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:14px 0 10px"></div>
      <svg class="br-chart" viewBox="0 0 640 310" style="width:100%;height:auto;display:block" role="img" aria-label="Tokens per second against number of users"></svg>
      <p style="margin:6px 0 0;font-size:12.5px;color:var(--lx-muted)">Teal: total tokens/s for all users. Amber: tokens/s each user sees. Both axes logarithmic. Theoretical ceilings; real systems reach perhaps 50–80 %. * Apple publishes no TFLOPS; these values are estimates.</p>`;
    const out = el.querySelector(".br-out"), svg = el.querySelector(".br-chart"), sel = el.querySelector(".br-chip");
    const card = (label, val, color = "var(--lx-text)") => `<div style="background:var(--lx-panel);border:1px solid var(--lx-line);border-radius:10px;padding:10px 12px"><div style="font:500 11px var(--lx-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--lx-muted)">${label}</div><div style="font:650 20px var(--lx-sans);color:${color}">${val}</div></div>`;
    function model(b) {
      const W = st.gb * 1e9, BW = st.bw * 1e9, C = st.tf * 1e12, F = 2 * st.pb * 1e9;
      const extra = st.extra ? b * (KV_TOKEN * st.ctx + STATE) : 0;
      const tMem = (W + extra) / BW, tComp = b * F / C, t = Math.max(tMem, tComp);
      return { total: b / t, per: 1 / t, compute: tComp >= tMem };
    }
    function render() {
      const users = []; for (let b = 1; b <= 256; b++) users.push(b);
      const pts = users.map(model);
      const knee = pts.findIndex(p => p.compute) + 1;                   // first user count that is compute-bound
      const ridge = st.tf * 1e12 / (st.bw * 1e9), intensity = 2 * st.pb / st.gb;
      out.innerHTML = card("1 user", n0(pts[0].total) + " tok/s", "var(--lx-token)")
        + card("Ridge point", ridge.toFixed(0) + " FLOP/byte") + card("Compute-bound from", knee ? knee + " users" : "never (≤ 256)", "var(--lx-cache)")
        + card("256 users, total", n0(pts[255].total) + " tok/s", "var(--lx-embed)");
      const VW = el.clientWidth && el.clientWidth < 520 ? 400 : 640; svg.setAttribute("viewBox", `0 0 ${VW} 310`);
      const X0 = 64, X1 = VW - 16, Y0 = 22, Y1 = 262;
      const lx = b => X0 + Math.log2(b) / 8 * (X1 - X0);
      const vals = pts.flatMap(p => [p.total, p.per]);
      const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...vals)))), hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...vals))));
      const ly = v => Y1 - (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * (Y1 - Y0);
      let h = "";
      for (let e = Math.log10(lo); e <= Math.log10(hi) + 1e-9; e++) {
        const v = Math.pow(10, e);
        h += `<line x1="${X0}" y1="${ly(v)}" x2="${X1}" y2="${ly(v)}" style="stroke:var(--lx-line)"/><text x="${X0 - 8}" y="${ly(v) + 4}" text-anchor="end" style="fill:var(--lx-muted);font:15px var(--lx-mono)">${v >= 1000 ? v / 1000 + "k" : v}</text>`;
      }
      (VW < 640 ? [1, 4, 16, 64, 256] : [1, 2, 4, 8, 16, 32, 64, 128, 256]).forEach(b => { h += `<text x="${lx(b)}" y="${Y1 + 20}" text-anchor="middle" style="fill:var(--lx-muted);font:15px var(--lx-mono)">${b}</text>`; });
      h += `<text x="${(X0 + X1) / 2}" y="${Y1 + 42}" text-anchor="middle" style="fill:var(--lx-muted);font:15px var(--lx-mono)">users sharing the chip</text>`;
      if (knee) h += `<line x1="${lx(knee)}" y1="${Y0}" x2="${lx(knee)}" y2="${Y1}" style="stroke:var(--lx-cache)" stroke-dasharray="4 4"/><text x="${lx(knee) + 6}" y="${Y0 + 14}" style="fill:var(--lx-cache);font:600 15px var(--lx-mono)">compute roof · ${knee} users</text>`;
      const line = key => users.map((b, i) => `${i ? "L" : "M"}${lx(b).toFixed(1)} ${ly(pts[i][key]).toFixed(1)}`).join("");
      h += `<path d="${line("total")}" style="fill:none;stroke:var(--lx-embed);stroke-width:2.5"/><path d="${line("per")}" style="fill:none;stroke:var(--lx-token);stroke-width:2.5"/>`;
      h += `<text x="${X1}" y="${ly(pts[255].total) - 8}" text-anchor="end" style="fill:var(--lx-embed);font:600 16px var(--lx-mono)">total</text>`;
      h += `<text x="${X1}" y="${ly(pts[255].per) + 16}" text-anchor="end" style="fill:var(--lx-token);font:600 16px var(--lx-mono)">per user</text>`;
      h += `<text x="${X0 + 6}" y="${Y0 + (knee ? 34 : 14)}" style="fill:var(--lx-dim);font:15px var(--lx-mono)">one user: ${intensity.toFixed(1)} FLOP/byte</text>`;
      svg.innerHTML = h;
    }
    const sync = () => el.querySelectorAll("input[data-k]").forEach(i => (i.value = st[i.dataset.k]));
    sel.onchange = () => { st.chip = +sel.value; if (st.chip >= 0) { st.bw = CHIPS[st.chip][1]; st.tf = CHIPS[st.chip][2]; sync(); } render(); };
    el.querySelectorAll("input[data-k]").forEach(inp => inp.addEventListener("input", () => {
      st[inp.dataset.k] = Math.max(0.001, Number(inp.value) || 0.001);
      if (inp.dataset.k === "bw" || inp.dataset.k === "tf") { sel.value = "-1"; st.chip = -1; }
      render();
    }));
    el.querySelector(".br-extra").onchange = e => { st.extra = e.target.checked; render(); };
    render();
  });
})();
