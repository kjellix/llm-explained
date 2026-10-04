/* Chapter 02 — Transformers, hybrids and model families */
(function () {
  "use strict";
  const D = LX.draw, E = LX.ease, clamp = LX.clamp, el = LX.el, col = LX.col;
  const bump = x => Math.sin(Math.PI * clamp(x));

  /** ⊕ on the residual stream (as in chapter 06). */
  function plusSign(parent, x, y, color = "embed") {
    const g = el("g", {}, parent);
    const c = el("circle", { cx: x, cy: y, r: 12, fill: col("bg"), stroke: col(color), "stroke-width": 2 }, g);
    el("path", { d: `M${x - 6} ${y} H${x + 6} M${x} ${y - 6} V${y + 6}`, stroke: col(color), "stroke-width": 2, "stroke-linecap": "round" }, g);
    return { g, flash(q) { c.setAttribute("fill", LX.mix("bg", color, q * .6)); c.setAttribute("filter", q > .15 ? "url(#lx-glow)" : "none"); } };
  }

  /** A titled card with a framed area for a small diagram. */
  function card(parent, { x, y, w, h, kind, title, lines }) {
    const g = el("g", {}, parent);
    const r = el("rect", { x, y, width: w, height: h, rx: 8, fill: LX.mix("bg", kind, .08), stroke: col(kind), "stroke-width": 1.4 }, g);
    D.text(g, x + 170, y + 34, title, { size: 18, weight: 600, color: kind });
    (lines || []).forEach((ln, i) => D.text(g, x + 170, y + 66 + i * 24, ln, { size: 15, color: i === lines.length - 1 ? "muted" : "text-2" }));
    return { g, r, x, y, w, h,
      show(p) { g.setAttribute("opacity", p); g.setAttribute("transform", `translate(0 ${(1 - p) * 10})`); },
      lit(q) { r.setAttribute("fill", LX.mix("bg", kind, .08 + q * .22)); r.setAttribute("filter", q > .2 ? "url(#lx-glow)" : "none"); } };
  }

  /* ======================================================== same-skeleton */
  function buildSkeleton(ctx) {
    const svg = ctx.svg;
    D.backdrop(svg);
    const ups = [];
    D.label(svg, 80, 62, "The shared skeleton", { size: 14 });
    const X0 = 200, W = 360, CX = X0 + W / 2;

    // five parts, top to bottom
    const tok = D.block(svg, { x: X0, y: 90, w: W, h: 54, kind: "token", label: "Tokenizer", size: 17 });
    const a1 = D.arrow(svg, { x1: CX, y1: 146, x2: CX, y2: 176, color: "muted" });
    const emb = D.block(svg, { x: X0, y: 178, w: W, h: 54, kind: "embed", label: "Embedding table", size: 17 });
    const a2 = D.arrow(svg, { x1: CX, y1: 234, x2: CX, y2: 264, color: "muted" });

    const blockG = el("g", {}, svg);
    const frame = el("rect", { x: 150, y: 266, width: 460, height: 334, rx: 10, fill: LX.mix("bg", "panel", .5), stroke: col("line-2"), "stroke-width": 1.5, "stroke-dasharray": "6 5" }, blockG);
    D.label(blockG, 166, 290, "one block", { size: 14 });
    const timesN = D.text(svg, 622, 300, "× N", { size: 30, weight: 650, color: "text" });
    const stream = D.arrow(blockG, { d: "M190 300 V594", color: "embed", width: 3 });
    const inM = D.arrow(blockG, { d: "M190 330 H258", color: "embed" });
    const outM = D.arrow(blockG, { d: "M420 392 V412 H204", color: "embed" });
    const inP = D.arrow(blockG, { d: "M190 462 H258", color: "embed" });
    const outP = D.arrow(blockG, { d: "M420 544 V562 H204", color: "embed" });
    const add1 = plusSign(blockG, 190, 412), add2 = plusSign(blockG, 190, 562);
    // the mixer slot: four interchangeable fillings, cross-faded
    const MIX = [
      { kind: "attn", label: "Full attention" },
      { kind: "attn", label: "Sliding window" },
      { kind: "delta", label: "Gated DeltaNet" },
      { kind: "cache", label: "Mamba (state space)" },
    ];
    const mixBase = D.block(blockG, { x: 260, y: 300, w: 320, h: 92, kind: "attn", label: "Token mixer", sub: "tokens exchange information", size: 18 });
    const mixAlt = MIX.map(m => D.block(blockG, { x: 260, y: 300, w: 320, h: 92, kind: m.kind, label: m.label, sub: "token mixer", size: 18, strong: true }));
    // the MLP slot: dense box, or experts + router
    const mlpBox = D.block(blockG, { x: 260, y: 452, w: 320, h: 92, kind: "mlp", label: "MLP", sub: "each token on its own", size: 18 });
    const expG = el("g", { opacity: 0 }, blockG);
    const router = el("circle", { cx: 278, cy: 498, r: 9, fill: col("mlp") }, expG);
    D.text(expG, 278, 530, "router", { mono: true, size: 14, color: "muted", anchor: "middle" });
    const experts = [];
    for (let i = 0; i < 8; i++) {
      const ex = 304 + i * 34;
      el("path", { d: `M287 498 L${ex + 13} ${474}`, stroke: col("line-2"), "stroke-width": 1, fill: "none" }, expG);
      experts.push(el("rect", { x: ex, y: 474, width: 26, height: 48, rx: 4, fill: LX.mix("bg", "mlp", .12), stroke: col("mlp"), "stroke-width": 1.2 }, expG));
    }
    const a3 = D.arrow(svg, { x1: CX, y1: 602, x2: CX, y2: 634, color: "muted" });
    const out = D.block(svg, { x: X0, y: 636, w: W, h: 54, kind: "logit", label: "Output layer", sub: "a score for every token", size: 17 });
    const loop = D.arrow(svg, { d: "M200 663 H112 V117 H196", color: "cache", width: 2 });
    const loopLab = D.text(svg, 112, 728, "loop: sample → append → repeat", { mono: true, size: 14, color: "cache" });
    const pulsePath = el("path", { d: "M380 117 V663 H112 V117 H380", fill: "none" }, svg);
    const trav = D.traveller(svg, pulsePath, { color: "embed", r: 7 });

    // right side: mixer cards (2×2)
    D.label(svg, 690, 62, "What goes into the mixer slot", { size: 14 });
    const cw = 410, ch = 178;
    const cards = [
      card(svg, { x: 690, y: 84, w: cw, h: ch, kind: "attn", title: "Full attention", lines: ["GPT-2, Llama 1–3", "every token sees all earlier ones"] }),
      card(svg, { x: 1120, y: 84, w: cw, h: ch, kind: "attn", title: "Sliding window", lines: ["Mistral 7B, Gemma 3, gpt-oss", "only the last w tokens"] }),
      card(svg, { x: 690, y: 278, w: cw, h: ch, kind: "delta", title: "Linear · Gated DeltaNet", lines: ["Qwen3-Next, Qwen3.8,", "Kimi Linear, MiniMax-01", "a fixed-size memory per head"] }),
      card(svg, { x: 1120, y: 278, w: cw, h: ch, kind: "cache", title: "State space · Mamba", lines: ["Mamba, Jamba, Nemotron-H", "a recurrent fixed-size state"] }),
    ];
    // mini diagrams inside the cards
    const tri = (c, band) => { // causal attention pattern, 8×8
      const s = 15, gx = c.x + 22, gy = c.y + 30;
      for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) {
        const on = k <= r && (band == null || r - k < band);
        el("rect", { x: gx + k * (s + 2), y: gy + r * (s + 2), width: s, height: s, rx: 2, fill: on ? LX.mix("bg", "attn", .75) : col("zero") }, c.g);
      }
    };
    tri(cards[0]); tri(cards[1], 3);
    { const c = cards[2], s = 23, gx = c.x + 30, gy = c.y + 26, R = LX.rng(5); // fixed 4×4 memory
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) el("rect", { x: gx + k * (s + 4), y: gy + r * (s + 4), width: s, height: s, rx: 3, fill: LX.valueColor((R() * 2 - 1) * .8) }, c.g);
      D.text(c.g, gx + 52, gy + 134, "fixed size", { mono: true, size: 14, color: "delta", anchor: "middle" }); }
    { const c = cards[3], gx = c.x + 20, gy = c.y + 70; // recurrent chain of states
      for (let i = 0; i < 4; i++) {
        el("rect", { x: gx + i * 36, y: gy, width: 26, height: 26, rx: 4, fill: LX.mix("bg", "cache", .5), stroke: col("cache"), "stroke-width": 1.2 }, c.g);
        if (i < 3) el("path", { d: `M${gx + i * 36 + 27} ${gy + 13} H${gx + i * 36 + 35}`, stroke: col("cache"), "stroke-width": 1.5 }, c.g);
      }
      D.text(c.g, gx + 66, gy + 60, "one state", { mono: true, size: 14, color: "cache", anchor: "middle" }); }

    // right side: MLP forms
    D.label(svg, 690, 492, "What goes into the MLP slot", { size: 14 });
    const dense = card(svg, { x: 690, y: 506, w: cw, h: 128, kind: "mlp", title: "Dense", lines: ["Llama 3, Gemma, Qwen3.8-27B", "every parameter, every token"] });
    const moe = card(svg, { x: 1120, y: 506, w: cw, h: 128, kind: "mlp", title: "Mixture of experts", lines: ["Mixtral, DeepSeek-V3, Llama 4,", "gpt-oss, Flash-Next", "a router picks a few experts"] });
    el("rect", { x: 712, y: 540, width: 130, height: 60, rx: 6, fill: LX.mix("bg", "mlp", .45), stroke: col("mlp") }, dense.g);
    const moeLit = [];
    for (let i = 0; i < 8; i++) {
      const b = el("rect", { x: 1138 + (i % 4) * 34, y: 534 + Math.floor(i / 4) * 38, width: 26, height: 30, rx: 4, fill: LX.mix("bg", "mlp", .12), stroke: col("mlp"), "stroke-width": 1.2 }, moe.g);
      if (i === 1 || i === 6) moeLit.push(b);
    }

    // hybrid strips
    const hyG = el("g", {}, svg);
    D.label(hyG, 690, 676, "Qwen3.8 · 16 × [ 3 × Gated DeltaNet + 1 × attention ]", { size: 14, color: "text-2" });
    const bars = [];
    for (let i = 0; i < 64; i++) {
      const attn = i % 4 === 3;
      bars.push({ attn, r: el("rect", { x: 690 + i * 13.125, y: 688, width: 10, height: 44, rx: 2, fill: LX.mix("bg", attn ? "attn" : "delta", attn ? .7 : .4) }, hyG) });
    }
    D.label(hyG, 690, 768, "Jamba · 1 attention : 7 Mamba", { size: 14, color: "text-2" });
    const jbars = [];
    for (let i = 0; i < 32; i++) {
      const attn = i % 8 === 4;
      jbars.push(el("rect", { x: 690 + i * 26.25, y: 780, width: 22, height: 30, rx: 2, fill: LX.mix("bg", attn ? "attn" : "cache", attn ? .7 : .45) }, hyG));
    }
    const conn = D.arrow(svg, { d: "M612 440 C 650 440, 650 710, 684 710", color: "line-2", width: 1.5 });

    ups.push(t => {
      // skeleton draws itself
      const sk = (a, b) => ctx.p(t, "skeleton", a, b);
      tok.show(sk(0, .14)); a1.draw(sk(.12, .2)); emb.show(sk(.18, .32)); a2.draw(sk(.3, .38));
      D.fade(blockG, sk(.36, .55)); D.fade(timesN, sk(.5, .62));
      stream.draw(sk(.4, .6)); a3.draw(sk(.6, .68)); out.show(sk(.64, .78));
      loop.draw(sk(.76, .95)); D.fade(loopLab, sk(.85, 1));
      const lp = ctx.p(t, "skeleton", .5, 1, E.linear);
      trav.at(lp > 0 && lp < 1 ? lp : (t > ctx.cue("hybrid").end - .01 ? 0 : 0));
      // block slots
      const bk = ctx.p(t, "block", 0, .6);
      [inM, outM, inP, outP].forEach((a, i) => a.draw(ctx.p(t, "block", .05 + i * .1, .25 + i * .1)));
      mixBase.pulse(bump(ctx.p(t, "block", .1, .5, E.linear)) * .9);
      mlpBox.pulse(bump(ctx.p(t, "block", .5, .9, E.linear)) * .9);
      add1.flash(bump(ctx.p(t, "block", .3, .5, E.linear))); add2.flash(bump(ctx.p(t, "block", .7, .9, E.linear)));
      void bk;
      // mixer variants cycle
      const mi = ctx.p(t, "mixer", 0, 1, E.linear);
      const which = t < ctx.cue("mixer").start ? -1 : Math.min(3, Math.floor(mi * 4 + 1e-6));
      cards.forEach((c, i) => {
        c.show(ctx.p(t, "mixer", i * .22, i * .22 + .12));
        const on = which === i && t < ctx.cue("mixer").end;
        c.lit(on ? .6 + .4 * bump((mi * 4) % 1) : 0);
      });
      const finalMix = t >= ctx.cue("hybrid").start ? 2 : (t >= ctx.cue("mixer").end ? -1 : which);
      mixAlt.forEach((b, i) => b.g.setAttribute("opacity", i === finalMix ? 1 : 0));
      mixBase.g.setAttribute("opacity", finalMix < 0 ? 1 : 0);
      // MLP: split into experts, router lights two, merge back
      const sp = ctx.p(t, "mlp", .05, .25) * (1 - ctx.p(t, "mlp", .8, .97));
      D.fade(expG, sp); mlpBox.g.setAttribute("opacity", 1 - sp);
      const lit = ctx.p(t, "mlp", .3, .45) * (1 - ctx.p(t, "mlp", .75, .85));
      experts.forEach((e, i) => { const on = (i === 1 || i === 6) ? lit : 0; e.setAttribute("fill", LX.mix("bg", "mlp", .12 + on * .7)); e.setAttribute("filter", on > .3 ? "url(#lx-glow)" : "none"); });
      router.setAttribute("filter", lit > .3 ? "url(#lx-glow)" : "none");
      dense.show(ctx.p(t, "mlp", .02, .15)); moe.show(ctx.p(t, "mlp", .2, .35));
      dense.lit(ctx.p(t, "mlp", .02, .15) * (1 - ctx.p(t, "mlp", .2, .3)) + ctx.p(t, "mlp", .85, .95) * (1 - ctx.p(t, "hybrid", 0, .1)));
      moe.lit(lit);
      moeLit.forEach(b => { b.setAttribute("fill", LX.mix("bg", "mlp", .12 + lit * .7)); });
      // hybrid strips + pulse sweeping along
      D.fade(hyG, ctx.p(t, "hybrid", 0, .15)); conn.draw(ctx.p(t, "hybrid", .05, .2));
      const sw = ctx.p(t, "hybrid", .15, .75, E.inOut) * 70 - 3;
      bars.forEach((b, i) => {
        const q = clamp(1 - Math.abs(sw - i) / 3);
        b.r.setAttribute("fill", LX.mix("bg", b.attn ? "attn" : "delta", (b.attn ? .7 : .4) + q * .3));
        b.r.setAttribute("opacity", ctx.p(t, "hybrid", .02 + i * .002, .1 + i * .002));
      });
      jbars.forEach((b, i) => b.setAttribute("opacity", ctx.p(t, "hybrid", .55 + i * .005, .65 + i * .005)));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ========================================================== family-tree */
  function buildTree(ctx) {
    const svg = ctx.svg;
    D.backdrop(svg);
    const ups = [];
    const xOf = yr => 150 + (yr - 2017) * 102;
    const SPINE = 236, LANE_END = 1150;
    D.label(svg, 80, 56, "A family tree since 2017", { size: 14 });

    // year axis
    const axG = el("g", {}, svg);
    el("line", { x1: 140, y1: 776, x2: LANE_END, y2: 776, stroke: col("line-2"), "stroke-width": 1.5 }, axG);
    for (let y = 2017; y <= 2026; y++) {
      el("line", { x1: xOf(y), y1: 770, x2: xOf(y), y2: 782, stroke: col("line-2") }, axG);
      D.text(axG, xOf(y), 806, String(y), { mono: true, size: 14, color: "muted", anchor: "middle" });
    }

    const L = [
      { key: "enc", y: 100, name: "Encoders", nodes: [{ yr: 2018.8, t: "BERT", pos: "up" }] },
      { key: "closed", y: 170, name: "Closed", dashed: true, nodes: [
        { yr: 2023.2, t: "GPT-4", pos: "up" }, { yr: 2023.5, t: "Claude", pos: "down" },
        { yr: 2023.95, t: "Gemini · MoE", pos: "up" }, { yr: 2025.6, t: "GPT-5", pos: "up" }] },
      { key: "gpt", y: 240, name: "GPT · OpenAI", nodes: [
        { yr: 2018.45, t: "GPT", pos: "up" }, { yr: 2019.1, t: "GPT-2", pos: "up" }, { yr: 2020.4, t: "GPT-3 · 175 B", pos: "up" },
        { yr: 2025.6, t: "gpt-oss · open, MoE", pos: "up" }] },
      { key: "llama", y: 310, name: "Llama · Meta", nodes: [
        { yr: 2023.15, t: "Llama", pos: "up" }, { yr: 2023.55 }, { yr: 2024.3, t: "Llama 3", pos: "up" },
        { yr: 2025.27, t: "Llama 4 · MoE", pos: "up" }] },
      { key: "mistral", y: 380, name: "Mistral", nodes: [
        { yr: 2023.7, t: "Mistral 7B · window", pos: "up" }, { yr: 2023.95, t: "Mixtral · 8 experts, 2 active", pos: "down" }] },
      { key: "gemma", y: 450, name: "Gemma · Google", nodes: [{ yr: 2025.2, t: "Gemma 3 · 5 local : 1 global", pos: "up" }] },
      { key: "deepseek", y: 520, name: "DeepSeek", nodes: [{ yr: 2024.97, t: "DeepSeek-V3 · MoE, MLA, MTP", pos: "up" }] },
      { key: "qwen", y: 590, name: "Qwen · Alibaba", nodes: [
        { yr: 2025.33, t: "Qwen3", pos: "up" }, { yr: 2025.7, t: "Qwen3-Next · hybrid 3 : 1", pos: "down", anchor: "end", dx: 30 },
        { yr: 2026.13 }, { yr: 2026.3 }, { yr: 2026.62, t: "Qwen3.8", pos: "up", anchor: "end", dx: -22, key: "qwen38" }] },
      { key: "lin", y: 660, name: "Linear hybrids", nodes: [
        { yr: 2025.05, t: "MiniMax-01 · 7 : 1", pos: "up" }, { yr: 2025.83, t: "Kimi Linear", pos: "down" }] },
      { key: "ssm", y: 730, name: "State space", nodes: [
        { yr: 2023.92, t: "Mamba", pos: "up", anchor: "end", dx: 6 }, { yr: 2024.2, t: "Jamba · 7 : 1", pos: "down", anchor: "start", dx: -6 },
        { yr: 2025.3, t: "Nemotron-H · Mamba-2", pos: "up" }] },
    ];
    const lane = k => L.find(l => l.key === k);
    let q38 = null;

    // root and spine
    const root = el("g", {}, svg);
    el("circle", { cx: 120, cy: 420, r: 13, fill: LX.mix("bg", "embed", .5), stroke: col("embed"), "stroke-width": 2 }, root);
    D.text(root, 120, 390, "Transformer", { size: 18, weight: 650, anchor: "middle" });
    D.text(root, 120, 458, "2017", { mono: true, size: 14, color: "muted", anchor: "middle" });
    D.text(root, 120, 478, "encoder + decoder", { mono: true, size: 14, color: "muted", anchor: "middle" });
    const encBranch = D.arrow(svg, { d: `M120 407 C 120 200, 200 100, ${xOf(2018.8) - 10} 100`, color: "norm", width: 1.5, head: false });
    const decBranch = D.arrow(svg, { d: `M133 420 H${SPINE}`, color: "embed", width: 2.5, head: false });
    const spine = el("path", { d: `M${SPINE} 170 V730`, stroke: col("embed"), "stroke-width": 2.5, fill: "none" }, svg);
    const spineLen = 560; spine.setAttribute("stroke-dasharray", spineLen);

    // ---------------------------------------------------- adoption matrix
    const COLS = [
      { key: "moe", kind: "mlp", h: ["Mixture", "of", "experts"] },
      { key: "sw", kind: "attn", h: ["", "Sliding", "window"] },
      { key: "lin", kind: "delta", h: ["Linear", "attention", "hybrid"] },
      { key: "ssm", kind: "cache", h: ["State", "space", "hybrid"] },
      { key: "few", kind: "embed", h: ["Few full", "attention", "layers"] },
    ];
    const CX0 = 1206, CW = 76, cx = i => CX0 + i * CW;
    // cell values: 1 = yes, .5 = partial, "?" = not published; optional caption
    const M = {
      closed:   { moe: [1, "Gemini"], sw: ["?"], lin: ["?"], ssm: ["?"], few: ["?"] },
      gpt:      { moe: [1], sw: [1], few: [.5, "1 : 1"] },
      llama:    { moe: [1] },
      mistral:  { moe: [1], sw: [1] },
      gemma:    { sw: [1], few: [1, "1 in 6"] },
      deepseek: { moe: [1] },
      qwen:     { moe: [1], lin: [1], few: [1, "1 in 4"] },
      lin:      { moe: [1], lin: [1], few: [1, "1 in 8"] },
      ssm:      { moe: [1], ssm: [1], few: [1, "≈ 8 %"] },
    };
    const headG = el("g", {}, svg);
    COLS.forEach((c, i) => {
      c.h.forEach((ln, k) => D.text(headG, cx(i), 104 + k * 16, ln, { size: 13, weight: 600, color: c.kind, anchor: "middle" }));
      el("line", { x1: cx(i), y1: 148, x2: cx(i), y2: 748, stroke: col("grid-2"), "stroke-width": 1 }, headG);
    });
    const cells = [];   // {g, lane, col, appear(cue range)}
    function cell(parent, x, y, v, kind) {
      const g = el("g", { opacity: 0 }, parent);
      if (v === "?") D.text(g, x, y + 6, "?", { size: 18, weight: 600, color: "dim", anchor: "middle" });
      else {
        el("circle", { cx: x, cy: y, r: 10, fill: v === 1 ? col(kind) : "none", stroke: col(kind), "stroke-width": 2 }, g);
        if (v === .5) el("path", { d: `M${x} ${y - 10} A10 10 0 0 0 ${x} ${y + 10} Z`, fill: col(kind) }, g);
      }
      return g;
    }

    // lanes, row guides and cells
    L.forEach(ln => {
      ln.g = el("g", {}, svg);
      const x1 = ln.key === "enc" ? xOf(2018.8) - 10 : SPINE;
      const x2 = Math.max(...ln.nodes.map(n => xOf(n.yr))) + 18;
      ln.line = el("path", { d: `M${x1} ${ln.y} H${x2}`, stroke: col(ln.key === "enc" ? "norm" : ln.dashed ? "muted" : "embed"), "stroke-width": ln.dashed ? 1.5 : 2,
        "stroke-dasharray": ln.dashed ? "6 5" : `${x2 - x1}`, fill: "none", opacity: ln.dashed ? .8 : .55 }, ln.g);
      ln.len = x2 - x1;
      ln.nameT = D.text(ln.g, (ln.key === "enc" ? x1 + 4 : SPINE + 10), ln.y + 22, ln.name.toUpperCase(), { mono: true, size: 14, color: "muted", ls: 1 });
      ln.nodes.forEach(n => {
        const x = xOf(n.yr), y = ln.y;
        n.g = el("g", {}, ln.g);
        n.dot = el("circle", { cx: x, cy: y, r: n.t ? 6.5 : 4.5, fill: ln.dashed ? col("bg") : col("text"), stroke: col(ln.dashed ? "muted" : "embed"),
          "stroke-width": 1.8, "stroke-dasharray": ln.dashed ? "3 2" : "none" }, n.g);
        if (n.t) n.label = D.text(n.g, x + (n.dx || 0), n.pos === "down" ? y + 30 : y - 16, n.t, { size: 15, anchor: n.anchor || "middle", color: ln.dashed ? "muted" : "text" });
        if (n.key === "qwen38") q38 = { x, y, n };
      });
      const m = M[ln.key];
      if (!m) return;
      ln.guide = el("line", { x1: x2 + 10, y1: ln.y, x2: cx(4) + 30, y2: ln.y, stroke: col("line-2"), "stroke-width": 1, "stroke-dasharray": "2 5", opacity: 0 }, svg);
      COLS.forEach((c, i) => {
        const v = m[c.key];
        if (!v) return;
        const g = cell(svg, cx(i), ln.y, v[0], c.kind);
        if (v[1]) D.text(g, cx(i), ln.y + 26, v[1], { mono: true, size: 12, color: "muted", anchor: "middle" });
        cells.push({ g, lane: ln.key, col: c.key, v: v[0], row: L.indexOf(ln) });
      });
    });
    const closedNote = D.text(svg, 520, 160, "architecture not published", { mono: true, size: 14, color: "muted", anchor: "middle" });

    // shared band under the axis
    const band = el("g", {}, svg);
    const bandR = el("rect", { x: 140, y: 826, width: 1392, height: 44, rx: 8, fill: LX.mix("bg", "norm", .08), stroke: col("norm"), "stroke-width": 1.3 }, band);
    D.text(band, 160, 854, "SHARED BY NEARLY ALL OPEN FAMILIES", { mono: true, size: 13, color: "norm", ls: 1.5 });
    D.text(band, 520, 854, "RMSNorm pre-norm  ·  gated MLP (SwiGLU / GeGLU)  ·  RoPE  ·  GQA or MLA", { size: 16, color: "text" });

    // few-full-attention column sweep highlight
    const fewBar = el("rect", { x: cx(4) - 26, y: 150, width: 52, height: 0, rx: 8, fill: LX.mix("bg", "embed", .25), opacity: 0, filter: "url(#lx-glow)" }, svg);
    svg.insertBefore(fewBar, headG);

    // Qwen row highlight
    const qy = lane("qwen").y;
    const qRow = el("rect", { x: SPINE - 6, y: qy - 36, width: cx(4) + 36 - SPINE + 6, height: 70, rx: 10, fill: "none", stroke: col("delta"), "stroke-width": 2, filter: "url(#lx-glow)", opacity: 0 }, svg);
    const qHalo = el("circle", { cx: q38.x, cy: q38.y, r: 18, fill: "none", stroke: col("delta"), "stroke-width": 3, filter: "url(#lx-glow)", opacity: 0 }, svg);
    const qNote = D.text(svg, cx(4) + 36, qy - 46, "Qwen3.8-27B itself is dense · sibling Flash-Next is MoE", { size: 14, color: "delta", anchor: "end", opacity: 0 });

    const showLane = (ln, p) => {
      ln.line.setAttribute("stroke-dashoffset", ln.dashed ? 0 : ln.len * (1 - p));
      ln.line.setAttribute("opacity", (ln.dashed ? .8 : .55) * (ln.dashed ? p : 1));
      D.fade(ln.nameT, p);
      ln.nodes.forEach((n, i) => n.g.setAttribute("opacity", clamp(p * ln.nodes.length - i)));
    };

    ups.push(t => {
      D.fade(axG, ctx.p(t, "root", 0, .3));
      D.fade(root, ctx.p(t, "root", .05, .35));
      encBranch.draw(ctx.p(t, "split", 0, .3));
      decBranch.draw(ctx.p(t, "split", .3, .45));
      spine.setAttribute("stroke-dashoffset", spineLen * (1 - ctx.p(t, "split", .4, .7) * .25 - ctx.p(t, "open", 0, .5) * .75));
      const encFade = 1 - .55 * ctx.p(t, "split", .7, 1);
      showLane(lane("enc"), ctx.p(t, "split", .15, .4)); lane("enc").g.setAttribute("opacity", encFade);
      encBranch.g.setAttribute("opacity", encFade);
      showLane(lane("gpt"), ctx.p(t, "split", .45, 1, E.linear) * .75 + ctx.p(t, "ideas", 0, .2) * .25);
      ["llama", "mistral", "gemma", "deepseek", "qwen"].forEach((k, i) => showLane(lane(k), ctx.p(t, "open", .1 + i * .1, .45 + i * .1, E.linear)));
      showLane(lane("ssm"), ctx.p(t, "ideas", .1, .35, E.linear));
      showLane(lane("lin"), ctx.p(t, "ideas", .2, .45, E.linear));
      showLane(lane("closed"), ctx.p(t, "closed", 0, .5, E.linear));
      D.fade(closedNote, ctx.p(t, "closed", .3, .5));

      // matrix
      D.fade(headG, ctx.p(t, "ideas", 0, .12));
      L.forEach(ln => { if (ln.guide) ln.guide.setAttribute("opacity", ln.key === "closed" ? ctx.p(t, "closed", .3, .5) : ctx.p(t, "ideas", 0, .2)); });
      const colWin = { moe: [.12, .4], sw: [.38, .6], lin: [.58, .8], ssm: [.78, 1] };
      cells.forEach(c => {
        let p;
        if (c.lane === "closed") p = ctx.p(t, "closed", .45 + (c.col === "moe" ? 0 : .08 * ["sw", "lin", "ssm", "few"].indexOf(c.col)), .6 + .08 * ["moe", "sw", "lin", "ssm", "few"].indexOf(c.col));
        else if (c.col === "few") p = ctx.p(t, "converge", .45 + c.row * .045, .52 + c.row * .045);
        else { const w = colWin[c.col]; const f = (c.row - 2) / 8; p = ctx.p(t, "ideas", w[0] + f * (w[1] - w[0]) * .6, w[0] + f * (w[1] - w[0]) * .6 + .1); }
        c.g.setAttribute("opacity", p);
      });
      // shared band, then the few-full-attention column fills top to bottom
      const bp = ctx.p(t, "converge", 0, .15);
      D.fade(band, bp);
      bandR.setAttribute("fill", LX.mix("bg", "norm", .08 + .25 * bump(ctx.p(t, "converge", .05, .45, E.linear))));
      const sw = ctx.p(t, "converge", .45, .95, E.inOut);
      fewBar.setAttribute("opacity", sw > 0 ? .9 * (1 - .6 * ctx.p(t, "qwen", 0, .2)) : 0);
      fewBar.setAttribute("height", 600 * sw);
      // qwen
      const qp = ctx.p(t, "qwen", 0, .25);
      qRow.setAttribute("opacity", qp); qHalo.setAttribute("opacity", qp); D.fade(qNote, ctx.p(t, "qwen", .2, .4));
      qHalo.setAttribute("r", 17 + 3 * Math.sin(t * 3));
    });
    return t => ups.forEach(u => u(t));
  }


LX.chapter({
  id: "families", num: 2, title: "Transformers, hybrids and model families", toc: "Transformers & families",
  kicker: "One skeleton, many variations",
  lede: "Almost every language model today is a transformer or a close descendant of one. Qwen3.8 is one branch of a large family tree. Once you know the shared skeleton, every model becomes easier to understand.",
  body: [
    { prose: `
      <p>This course follows one specific model, Qwen3.8-27B, released with open weights in August 2026, because real numbers make ideas concrete. But very little of what happens inside it is unique to Qwen. GPT, Llama, Gemma, Mistral, DeepSeek and Qwen are all built from the same five parts. What differs between them is a handful of choices about how those parts are filled in.</p>

      <h3>The shared skeleton</h3>
      <ol>
        <li><strong class="c-token">A tokenizer</strong> cuts text into tokens and gives each one an <abbr>ID</abbr>.</li>
        <li><strong class="c-embed">An embedding table</strong> turns each ID into a vector.</li>
        <li><strong class="c-delta">A stack of identical blocks.</strong> Each block has a <em>token mixer</em>, which lets tokens exchange information, and an <abbr>MLP</abbr>, which processes each token on its own. Both use normalisation and add their result to a running residual stream.</li>
        <li><strong class="c-logit">An output layer</strong> turns the final vector into a score for every token in the vocabulary.</li>
        <li><strong class="c-cache">A loop</strong> that samples one token, appends it, and runs again.</li>
      </ol>
      <p>Training is the same everywhere, too: predict the next token across trillions of tokens of text. A model's "personality" comes from its data and later fine-tuning, much more than from its blueprint.</p>` },

    { scene: {
      id: "same-skeleton", title: "Same skeleton, swappable parts", build: buildSkeleton,
      visual: "Left: the five-part skeleton (tokenizer → embedding → block × N → output layer, with a loop back). Right: cards showing what can fill the mixer slot (full attention, sliding window, Gated DeltaNet, Mamba) and the MLP slot (dense, mixture of experts), each with example models. Bottom right: hybrid stacks as bar strips, Qwen3.8 (3 : 1 DeltaNet : attention) and Jamba (7 : 1 Mamba : attention).",
      cues: [
        { id: "skeleton", say: "Nearly every modern language model has the same skeleton. A tokenizer, an embedding table, a stack of identical blocks, an output layer, and the loop around it.", vis: "The five parts draw themselves top to bottom: tokenizer, embedding table, one block (marked × N), output layer, and an orange loop arrow back to the tokenizer; a light pulse travels the loop." },
        { id: "block",    say: "Each block has two slots. A token mixer, where tokens exchange information, and an M L P, a multi-layer perceptron, where each token is processed on its own.", vis: "Inside the block, arrows branch from the residual stream into the token-mixer slot and the MLP slot and add back at two ⊕ signs; each slot lights in turn." },
        { id: "mixer",    say: "Most of the differences between model families come down to what goes into the mixer slot. Classic full attention compares every token with every earlier one. Sliding-window attention only looks a fixed distance back. Linear attention and state-space models keep a fixed-size memory instead.", vis: "Four cards appear with mini diagrams and example models: full attention (causal triangle), sliding window (diagonal band), Gated DeltaNet (fixed 4 × 4 memory), Mamba (one recurrent state). The mixer box in the skeleton swaps to each in turn." },
        { id: "mlp",      say: "The M L P slot has two common forms. A dense M L P runs every parameter for every token. A mixture of experts has many smaller M L Ps and a router that sends each token to only a few of them.", vis: "The MLP box splits into eight experts with a router that lights two of them; cards compare Dense and Mixture of experts; then the box merges back into one dense MLP." },
        { id: "hybrid",   say: "A hybrid mixes different mixers in one stack. Qwen 3.8 uses three Gated DeltaNet blocks for every full-attention block. Other hybrids pair attention with Mamba layers instead.", vis: "A connector runs from the block to a strip of 64 bars, Qwen3.8's 16 × [3 Gated DeltaNet + 1 attention], swept by a light pulse; a second strip shows Jamba's 1 attention : 7 Mamba. The mixer slot settles on Gated DeltaNet." },
      ],
    } },

    { prose: `
      <h3>Where transformers came from</h3>
      <p>The transformer was introduced in 2017 in a paper called "Attention Is All You Need". It was built for machine translation and had two halves: an <em>encoder</em> that read the source sentence, and a <em>decoder</em> that wrote the translation. Its key idea was attention: instead of reading text one word at a time, as the older recurrent networks (<abbr>RNN</abbr>s) did, every token could look directly at every other token. That made training highly parallel, and it scaled.</p>
      <p>The two halves soon went separate ways:</p>
      <ul>
        <li><strong>Encoder-only</strong> models such as <abbr>BERT</abbr> (2018) read a whole text in both directions at once. They are good at understanding, classifying and searching text, but they do not write.</li>
        <li><strong>Decoder-only</strong> models such as <abbr>GPT</abbr> (2018) read left to right and predict the next token. Practically every chat model today, including Qwen3.8, is a decoder-only model. That is why this course is entirely about the decoder.</li>
      </ul>

      <h3>Three choices that tell models apart</h3>` },

    { html: `<div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Choice</th><th>Options</th><th>Examples</th></tr>
        <tr><td rowspan="4"><strong class="c-attn">Token mixer</strong></td><td>Full attention: every token sees every earlier token</td><td>GPT-2, Llama 1–3, most open models before 2024</td></tr>
        <tr><td>Sliding-window attention: only the last few thousand tokens</td><td>Mistral 7B; Gemma 3 (5 local layers per global layer); gpt-oss alternates full and windowed layers</td></tr>
        <tr><td>Linear attention, Gated DeltaNet: a fixed-size memory per head</td><td>Qwen3-Next and Qwen3.5–3.8 (3 : 1 with full attention); Kimi Linear; MiniMax-01 (7 : 1)</td></tr>
        <tr><td>State-space models: a recurrent fixed-size state</td><td>Mamba; Jamba (1 attention layer per 7 Mamba layers); NVIDIA Nemotron-H (Mamba-2, about 8% attention)</td></tr>
        <tr><td rowspan="2"><strong class="c-mlp">MLP</strong></td><td>Dense: every parameter works on every token</td><td>Llama 3, Gemma, Qwen3.8-27B</td></tr>
        <tr><td>Mixture of Experts (<abbr>MoE</abbr>): a router picks a few experts per token</td><td>Mixtral (8 experts, 2 active), DeepSeek-V3 (671 B total, 37 B active), Qwen3-235B-A22B, Llama 4, gpt-oss, Gemini 1.5 and 2.5, Flash-Next</td></tr>
        <tr><td rowspan="3"><strong class="c-cache">Keys and values</strong></td><td>One key/value head per query head (<abbr>MHA</abbr>)</td><td>The original transformer, GPT-2</td></tr>
        <tr><td>Shared key/value heads (<abbr>GQA</abbr>)</td><td>Llama 2 70B, all of Llama 3, Mistral, Qwen3.8</td></tr>
        <tr><td>Compressed latent keys and values (<abbr>MLA</abbr>)</td><td>DeepSeek-V2 and V3</td></tr>
      </table></div>` },

    { scene: {
      id: "family-tree", title: "A family tree since 2017", build: buildTree,
      visual: "A timeline 2017 → 2026. The Transformer root splits into an encoder branch (BERT, fading) and a decoder spine with one lane per family: closed (dashed), GPT, Llama, Mistral, Gemma, DeepSeek, Qwen, linear-attention hybrids, state-space models. Each lane continues into a row of an adoption matrix with five idea columns (● yes, ◐ partly, ? not published), so you read across from a family to its ideas. A band under the axis lists the recipe shared by nearly all open families. The 'few full-attention layers' column fills last; finally the Qwen row lights up.",
      cues: [
        { id: "root",    say: "In twenty seventeen, the transformer was invented for translation. It had an encoder that reads and a decoder that writes.", vis: "Root node 'Transformer 2017' with encoder and decoder halves." },
        { id: "split",   say: "The encoder branch led to models like BERT, which understand text but do not write. The decoder branch led to G P T, the generative pre-trained transformer, and to almost every chat model since.", vis: "Encoder branch → BERT (2018), fading aside; decoder branch → GPT (2018), GPT-2, GPT-3 growing right." },
        { id: "open",    say: "Open families followed: Llama, Mistral, Gemma, Qwen and DeepSeek. Their weights can be downloaded and run on your own hardware.", vis: "Lanes for Llama, Mistral, Gemma, DeepSeek and Qwen grow from the decoder spine, with dated nodes and short labels." },
        { id: "ideas",   say: "Along the way, new ideas spread from family to family. Mixture of experts, to grow capacity without growing the cost per token. Sliding windows and hybrids, to make long texts cheaper.", vis: "An adoption matrix appears to the right of the lanes, with columns Mixture of experts, Sliding window, Linear-attn hybrid, State-space hybrid, Few full-attn layers; each family's row fills with dots column by column; lanes for linear and state-space hybrids appear (MiniMax-01, Kimi Linear, Mamba, Jamba, Nemotron-H)." },
        { id: "closed",  say: "Some of the best-known models, such as later G P T versions and Claude, do not publish their architecture. Google has said that Gemini is a mixture-of-experts transformer. What is known suggests they all share the same basic skeleton.", vis: "A dashed lane for closed models: GPT-4, Claude, GPT-5 ('architecture not published'), and Gemini; their matrix row shows Mixture of experts (Gemini) and ? for everything else." },
        { id: "converge", say: "Look across the families and a common recipe appears. Almost all now use the same normalisation, the same kind of gated multi-layer perceptron, rotary positions and shared key-value heads. And the newest models are converging on one more idea: only a few layers pay for full attention, and the rest use something cheaper.", vis: "A band under the timeline lights up: shared by nearly all open families: RMSNorm pre-norm · gated MLP · RoPE · GQA or MLA. Then a light sweeps down the 'Few full-attn layers' column and it fills row by row: gpt-oss ◐ 1 : 1, Gemma 1 in 6, Qwen 1 in 4, linear hybrids 1 in 8, state space ≈ 8 %." },
        { id: "qwen",    say: "Qwen 3.8 sits at the end of the hybrid branch. It inherits the decoder design, the normalisation, the gated multi-layer perceptron, rotary positions and shared key-value heads from the mainstream, and adds Gated DeltaNet and gated attention.", vis: "The Qwen row is outlined and glows, Qwen3.8 gets a halo, and a note reads 'Qwen3.8-27B itself is dense · sibling Flash-Next is MoE'." },
      ],
    } },

    { prose: `
      <h3>The families are converging</h3>
      <p>Seen from a distance, the families have spent the last few years moving towards one shared recipe. A model released today almost always combines:</p>
      <ul>
        <li>a decoder-only stack with <abbr>RMSNorm</abbr> before each sub-block,</li>
        <li>a gated <abbr>MLP</abbr> (SwiGLU or its <abbr>GELU</abbr> sibling),</li>
        <li>rotary positions (<abbr>RoPE</abbr>),</li>
        <li>shared or compressed keys and values (<abbr>GQA</abbr> or <abbr>MLA</abbr>),</li>
        <li>a vocabulary of roughly 128,000 to 260,000 tokens,</li>
        <li>and, for the largest models, a mixture of experts.</li>
      </ul>
      <p>The newest shift is about the token mixer. Full attention gives exact recall over the whole text, but its cost grows with every token. Model after model now keeps only a <em>fraction</em> of its layers on full attention and gives the rest something cheaper with a fixed or bounded memory:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Model</th><th>Cheap layers</th><th class="num">Cheap : full</th></tr>
        <tr><td>Qwen3-Next, Qwen3.5–3.8</td><td>Gated DeltaNet</td><td class="num">3 : 1</td></tr>
        <tr><td>Kimi Linear</td><td>Kimi Delta Attention, a refinement of Gated DeltaNet</td><td class="num">mostly linear</td></tr>
        <tr><td>MiniMax-01</td><td>Lightning (linear) attention</td><td class="num">7 : 1</td></tr>
        <tr><td>Jamba</td><td>Mamba (state space)</td><td class="num">7 : 1</td></tr>
        <tr><td>Nemotron-H</td><td>Mamba-2 (state space)</td><td class="num">≈ 92% : 8%</td></tr>
        <tr><td>Gemma 3</td><td>Sliding-window attention, 1,024 tokens</td><td class="num">5 : 1</td></tr>
        <tr><td>gpt-oss</td><td>Sliding-window attention</td><td class="num">1 : 1</td></tr>
      </table></div>
      <p>The cheap layers differ in how they work, but the idea is the same: a few full-attention layers keep exact long-range recall, and the many cheap layers make long contexts affordable. Other ideas spread the same way. Multi-token prediction, popularised by DeepSeek-V3, is now built into Qwen3.8.</p>

      <h3>What Qwen3.8 shares with almost everyone</h3>
      <p>Most of the parts in this course are standard in modern open models, so what you learn here carries over directly:</p>
      <ul>
        <li>decoder-only, trained to predict the next token</li>
        <li>byte-level <abbr>BPE</abbr> tokenization</li>
        <li><abbr>RMSNorm</abbr> before each sub-block (pre-norm) and a residual stream</li>
        <li>a gated MLP: <abbr>SwiGLU</abbr> in Llama, Mistral and Qwen; Gemma uses a close relative with GELU</li>
        <li>rotary position embedding (<abbr>RoPE</abbr>)</li>
        <li>grouped-query attention (<abbr>GQA</abbr>) to keep the <abbr>KV</abbr> cache small</li>
      </ul>

      <h3>What makes it unusual</h3>
      <ul>
        <li><strong>A 3 : 1 hybrid.</strong> Only 16 of its 64 layers use full attention. The other 48 use Gated DeltaNet, a linear-attention layer with a fixed-size memory (<a href="#deltanet">Chapter 8</a>).</li>
        <li><strong>Gated attention.</strong> Each attention head's output passes through a learned gate (<a href="#attention">Chapter 7</a>).</li>
        <li><strong>Partial rotary positions.</strong> Only a quarter of each head's numbers are rotated.</li>
        <li><strong>A built-in multi-token prediction head</strong> for faster decoding, an idea also used by DeepSeek-V3 (<a href="#mtp">Chapter 15</a>).</li>
        <li><strong>A built-in vision encoder</strong>, so the same model reads images (<a href="#vision">Chapter 16</a>).</li>
      </ul>` },

    { note: `<b>A sibling with experts.</b> Flash-Next belongs to the same Qwen3.8 family but takes the other fork in the MLP choice. It has 48 layers with a hidden size of 2,560, and each MLP is a mixture of 512 small experts: for every token, a router picks 10 of them, and one shared expert always runs. Same skeleton, same hybrid mixer pattern, different trade-offs: a much larger total number of parameters, but far fewer used per token.` },

    { deep: `
      <h3>How the choices change the cost</h3>
      <p>For a context of <i>T</i> tokens, the mixer choice decides how cost and memory grow:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Mixer</th><th>Work to write one token</th><th>Memory kept per sequence</th></tr>
        <tr><td>Full attention</td><td>grows with <i>T</i></td><td>keys and values for all <i>T</i> tokens</td></tr>
        <tr><td>Sliding window of size <i>w</i></td><td>grows with <i>w</i>, then stays flat</td><td>keys and values for the last <i>w</i> tokens</td></tr>
        <tr><td>Linear attention, DeltaNet, state-space</td><td>constant</td><td>a fixed-size state</td></tr>
      </table></div>
      <p>The key/value choice changes the size of what is kept. Per token and per attention layer, with <i>h</i><sub>kv</sub> key/value heads of size <i>d</i>, the cache holds 2 · <i>h</i><sub>kv</sub> · <i>d</i> numbers:</p>
      <math display="block"><mrow><msub><mi>M</mi><mtext>token</mtext></msub><mo>=</mo><mn>2</mn><mo>·</mo><msub><mi>h</mi><mtext>kv</mtext></msub><mo>·</mo><mi>d</mi><mo>·</mo><msub><mi>L</mi><mtext>attn</mtext></msub><mo>·</mo><mi>b</mi></mrow></math>
      <div class="lx-read">For each token, every attention layer stores one key and one value vector for each key/value head. Multiply: 2 (key and value) × the number of key/value heads × the size of each head × the number of attention layers × the bytes per number. For Qwen3.8: 2 × 4 × 256 × 16 × 2 bytes = 65,536 bytes, which is 64 KiB per token.</div>
      <p>Qwen3.8 combines two savings. <abbr>GQA</abbr> uses 4 key/value heads instead of 24, and the hybrid design has only 16 attention layers instead of 64. With one key/value head per query head in every one of 64 layers, the same model would need 2 × 24 × 256 × 64 × 2 bytes = 1.5 <abbr>MiB</abbr> per token, 24 times more.</p>
      <h3>Dense versus mixture of experts</h3>
      <p>In a dense model, total parameters and parameters used per token are the same: about 27 billion for Qwen3.8-27B. A mixture-of-experts model separates the two. It may hold several hundred billion parameters in total, but each token only passes through the router's chosen few. Compute per token follows the <em>active</em> parameters, while memory must still hold <em>all</em> of them.</p>` },
  ],
});
})();
