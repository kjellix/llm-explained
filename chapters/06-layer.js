/* Chapter 06 — Inside one layer: the residual stream */
(function () {
  "use strict";
  const D = LX.draw, E = LX.ease, clamp = LX.clamp;
  /** sub-progress of x inside [a, b] */
  const seg = (x, a, b) => clamp((x - a) / (b - a));
  const bump = x => Math.sin(Math.PI * clamp(x));

  /** ⊕ symbol on the stream. flash(q) lights it. */
  function plusSign(parent, x, y, color = "embed") {
    const g = LX.el("g", {}, parent);
    const c = LX.el("circle", { cx: x, cy: y, r: 14, fill: LX.col("bg"), stroke: LX.col(color), "stroke-width": 2 }, g);
    LX.el("path", { d: `M${x - 7} ${y} H${x + 7} M${x} ${y - 7} V${y + 7}`, stroke: LX.col(color), "stroke-width": 2, "stroke-linecap": "round" }, g);
    return {
      g,
      show(p) { g.setAttribute("opacity", p); },
      flash(q) { c.setAttribute("fill", LX.mix("bg", color, q * .6)); c.setAttribute("filter", q > .15 ? "url(#lx-glow)" : "none"); },
    };
  }

  /* ----------------------------------------------------------------------
     Layer diagram (component candidate): the residual stream as a straight
     teal line on the left; each sub-block branches off to the right
     (norm → compute) and adds back at a ⊕. Fixed coordinates; move it with
     a transform on .g. Returns handles for every part.
     ---------------------------------------------------------------------- */
  function layerDiagram(parent, { S = 560, C = 860 } = {}) {
    const g = LX.el("g", {}, parent);
    const A = (o) => D.arrow(g, { color: "embed", width: 2, ...o });
    const h = {
      g, S, C,
      seg0: A({ d: `M${S} 872 V494`, width: 3, head: false }),
      seg1: A({ d: `M${S} 466 V124`, width: 3, head: false }),
      seg2: A({ d: `M${S} 96 V46`, width: 3 }),
      inA:  A({ d: `M${S} 800 H${C} V754` }),
      midA: A({ d: `M${C} 698 V652` }),
      outA: A({ d: `M${C} 552 V480 H${S + 18}` }),
      inB:  A({ d: `M${S} 420 H${C} V374` }),
      midB: A({ d: `M${C} 318 V272` }),
      outB: A({ d: `M${C} 172 V110 H${S + 18}` }),
    };
    h.dotA = LX.el("circle", { cx: S, cy: 800, r: 5, fill: LX.col("embed") }, g);
    h.dotB = LX.el("circle", { cx: S, cy: 420, r: 5, fill: LX.col("embed") }, g);
    h.norm1 = D.block(g, { x: C - 130, y: 698, w: 260, h: 54, kind: "norm", label: "RMSNorm", size: 17 });
    h.mixD  = D.block(g, { x: C - 160, y: 552, w: 320, h: 96, kind: "delta", label: "Gated DeltaNet", sub: "token mixer", size: 18 });
    h.mixA  = D.block(g, { x: C - 160, y: 552, w: 320, h: 96, kind: "attn", label: "Gated Attention", sub: "token mixer", size: 18 });
    h.norm2 = D.block(g, { x: C - 130, y: 318, w: 260, h: 54, kind: "norm", label: "RMSNorm", size: 17 });
    h.mlp   = D.block(g, { x: C - 160, y: 172, w: 320, h: 96, kind: "mlp", label: "SwiGLU MLP", sub: "per token", size: 18 });
    h.add1 = plusSign(g, S, 480);
    h.add2 = plusSign(g, S, 110);
    h.labIn  = D.text(g, S - 22, 866, "from the layer below", { mono: true, size: 14, color: "muted", anchor: "end" });
    h.labOut = D.text(g, S - 22, 58, "to the layer above", { mono: true, size: 14, color: "muted", anchor: "end" });
    h.labStream = D.text(g, S - 22, 646, "residual stream", { mono: true, size: 15, color: "embed", anchor: "end" });
    h.labShape  = D.text(g, S - 22, 668, "[T, 5120]", { mono: true, size: 14, color: "muted", anchor: "end" });
    h.labAdd1 = D.text(g, S - 26, 485, "add", { mono: true, size: 14, color: "text-2", anchor: "end" });
    h.labAdd2 = D.text(g, S - 26, 115, "add", { mono: true, size: 14, color: "text-2", anchor: "end" });
    // the route data takes through the computation, and the straight skip route
    h.mainPath = LX.el("path", { d: `M${S} 872 V800 H${C} V480 H${S} V420 H${C} V110 H${S} V46`, fill: "none" }, g);
    h.skipPath = LX.el("path", { d: `M${S} 872 V46`, fill: "none" }, g);
    h.centers = [[h.norm1, C, 725], [h.mixD, C, 600], [h.mixA, C, 600], [h.norm2, C, 345], [h.mlp, C, 220]];
    return h;
  }

  /* ====================================================== residual-stream */
  function buildResidual(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    const abs = (id, f) => ctx.cue(id).start + ctx.cue(id).dur * f;
    const BX = 500, BW = 240, CX = BX + BW / 2, TOP = 50, BOT = 850, EDGE = BX + BW;
    D.label(svg, 80, 92, "The residual stream");

    // band (the conveyor belt) with drifting chevrons
    const defs = svg.querySelector("defs");
    const cp = LX.el("clipPath", { id: "rs-clip" }, defs);
    const clipRect = LX.el("rect", { x: BX, y: BOT, width: BW, height: 0, rx: 12 }, cp);
    const band = LX.el("rect", { x: BX, y: BOT, width: BW, height: 0, rx: 12, fill: LX.mix("bg", "embed", .07), stroke: LX.col("embed"), "stroke-opacity": .55, "stroke-width": 1.5 }, svg);
    const chevG = LX.el("g", { "clip-path": "url(#rs-clip)" }, svg);
    const chevs = Array.from({ length: 15 }, () => LX.el("path", { fill: "none", stroke: LX.col("embed"), "stroke-opacity": .16, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }, chevG));

    // layers
    const LV = [
      { y: 700, n: "Layer 1", k: "delta", sub: "DeltaNet + MLP" },
      { y: 540, n: "Layer 2", k: "delta", sub: "DeltaNet + MLP" },
      { y: 380, n: "Layer 3", k: "delta", sub: "DeltaNet + MLP" },
      { y: 170, n: "Layer 64", k: "attn", sub: "Attention + MLP" },
    ];
    const LX0 = 920, LW = 300, R = LX.rng(5);
    const dots = D.text(svg, LX0 + LW / 2, 284, "⋮  layers 4–63", { mono: true, size: 15, color: "dim", anchor: "middle" });
    const layers = LV.map(L => {
      const b = D.block(svg, { x: LX0, y: L.y - 40, w: LW, h: 80, kind: L.k, label: L.n, sub: L.sub, size: 18 });
      const out = D.arrow(svg, { x1: EDGE, y1: L.y + 18, x2: LX0 - 2, y2: L.y + 18, color: "embed" });
      const back = D.arrow(svg, { x1: LX0, y1: L.y - 18, x2: EDGE + 18, y2: L.y - 18, color: "embed" });
      const plus = plusSign(svg, EDGE, L.y - 18);
      const trav = D.traveller(svg, out.path, { color: "embed", r: 6 });
      const corr = LX.el("g", { opacity: 0 }, svg);
      for (let i = 0; i < 6; i++) LX.el("rect", { x: -36 + i * 12, y: -5, width: 10, height: 10, rx: 2, fill: LX.valueColor((R() * 2 - 1) * .9) }, corr);
      LX.attr(corr, { filter: "url(#lx-glow)" });
      return { b, out, back, plus, trav, corr, L };
    });

    // the packet: 5 token vectors riding the belt
    const NV = 5, NC = 6, K = 5;
    const V = [Array.from({ length: NV * NC }, () => (R() * 2 - 1) * .8)];
    for (let k = 1; k < K; k++) V.push(V[k - 1].map(v => clamp(v + (R() * 2 - 1) * .55, -1, 1)));
    const pk = LX.el("g", {}, svg), cells = [];
    LX.el("rect", { x: -64, y: -84, width: 128, height: 172, rx: 8, fill: LX.mix("bg", "embed", .07) }, pk);
    for (let c = 0; c < NV; c++) for (let r = 0; r < NC; r++)
      cells.push(LX.el("rect", { x: -51 + c * 22, y: -50 + r * 17, width: 14, height: 14, rx: 2, stroke: LX.col("line-2"), "stroke-width": 1 }, pk));
    D.text(pk, 0, -64, "[T, 5120]", { mono: true, size: 15, anchor: "middle", color: "embed" });
    const cnt = D.text(pk, 0, 76, "", { mono: true, size: 14, anchor: "middle", color: "muted" });

    // per-layer action windows (absolute seconds)
    const W = [
      [abs("read", .35), abs("add", .8)],
      [abs("many", .10), abs("many", .24)],
      [abs("many", .32), abs("many", .46)],
      [abs("many", .64), abs("many", .84)],
    ];

    // training signal
    const train = D.arrow(svg, { x1: 450, y1: 110, x2: 450, y2: 836, color: "text-2", width: 1.5 });
    const TL = train.path.getTotalLength();
    const tdots = [0, 1, 2].map(() => LX.el("circle", { r: 4.5, fill: LX.col("text"), opacity: 0 }, svg));
    const tlab = D.text(svg, 0, 0, "training signal flows straight down", { mono: true, size: 14, color: "text-2", anchor: "middle" });
    tlab.setAttribute("transform", "translate(426 470) rotate(-90)");

    ups.push(t => {
      // belt
      const hgt = (BOT - TOP) * ctx.p(t, "belt", 0, .4, E.inOut);
      LX.attr(band, { y: BOT - hgt, height: hgt }); LX.attr(clipRect, { y: BOT - hgt, height: hgt });
      const off = (t * 22) % 60;
      chevs.forEach((c, i) => { const y = BOT - i * 60 + off - 30; c.setAttribute("d", `M${CX - 46} ${y + 14} L${CX} ${y - 8} L${CX + 46} ${y + 14}`); });

      // layers and their branch / merge
      let s = 0, done = 0;
      layers.forEach((l, i) => {
        l.b.show(ctx.p(t, "belt", .5 + i * .08, .8 + i * .08));
        l.plus.show(ctx.p(t, "belt", .6 + i * .08, .9 + i * .08));
        const q = seg(t, W[i][0], W[i][1]);
        l.out.draw(E.out(seg(q, 0, .3)));
        l.trav.at(seg(q, .05, .4));
        l.b.pulse(bump(seg(q, .3, .7)));
        l.back.draw(E.out(seg(q, .45, .65)));
        const c = seg(q, .45, .85);
        if (c > 0 && c < 1) {
          const pt = l.back.path.getPointAtLength(l.back.path.getTotalLength() * E.inOut(c));
          LX.attr(l.corr, { opacity: 1, transform: `translate(${pt.x} ${pt.y})` });
        } else l.corr.setAttribute("opacity", 0);
        l.plus.flash(bump(seg(q, .78, 1)));
        const m = E.inOut(seg(q, .8, 1));
        s += i === 3 ? m * .5 : m;
        if (m > .5) done = i + 1;
      });
      D.fade(dots, ctx.p(t, "belt", .8, 1));
      dots.setAttribute("fill", LX.mix("dim", "embed", bump(ctx.p(t, "many", .46, .64, E.linear))));
      const run = ctx.p(t, "many", .46, .64, E.linear);
      s += run * .5;

      // packet
      let y = 790;
      y = LX.lerp(y, 700, ctx.p(t, "read", 0, .35, E.inOut));
      y = LX.lerp(y, 540, ctx.p(t, "many", 0, .1, E.inOut));
      y = LX.lerp(y, 380, ctx.p(t, "many", .24, .32, E.inOut));
      y = LX.lerp(y, 170, ctx.p(t, "many", .46, .64, E.inOut));
      LX.attr(pk, { transform: `translate(${CX} ${y})`, opacity: ctx.p(t, "belt", .35, .6) });
      const k0 = Math.min(K - 2, Math.floor(s)), f = s - k0;
      cells.forEach((c, i) => c.setAttribute("fill", LX.valueColor(LX.lerp(V[k0][i], V[k0 + 1][i], f))));
      const n = done === 0 ? 0 : done === 1 ? 1 : done === 2 ? 2 : done === 3 ? 3 + Math.round(run * 60) : 64;
      cnt.textContent = n === 0 ? "straight from the embedding" : `after layer ${n}`;

      // training signal
      train.draw(ctx.p(t, "why", 0, .45));
      const u = ctx.p(t, "why", .3, 1, E.linear) * 2;
      tdots.forEach((d, k) => {
        const f = (u + k / 3) % 1;
        if (u <= 0 || f <= 0) return d.setAttribute("opacity", 0);
        const pt = train.path.getPointAtLength(TL * f);
        LX.attr(d, { cx: pt.x, cy: pt.y, opacity: .9 });
      });
      D.fade(tlab, ctx.p(t, "why", .2, .5));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ======================================================= layer-anatomy */
  function buildAnatomy(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    const abs = (id, f) => ctx.cue(id).start + ctx.cue(id).dur * f;
    // camera: frames the part of the layer that is being built, then pulls back
    const cam = LX.el("g", {}, svg);
    const L = layerDiagram(cam);
    const C = L.C;

    // annotations on the right
    const ann = LX.el("g", {}, cam);
    const AX = C + 186;
    const a1 = D.text(ann, AX, 731, "rescale a copy of each vector", { mono: true, size: 15, color: "text-2" });
    const aD = D.text(ann, AX, 590, "48 layers · Gated DeltaNet · 115.9 M", { mono: true, size: 15, color: "delta" });
    const aA = D.text(ann, AX, 616, "16 layers · Gated Attention · 104.9 M", { mono: true, size: 15, color: "attn" });
    const a3 = D.text(ann, AX, 351, "rescale again", { mono: true, size: 15, color: "text-2" });
    const a4 = D.text(ann, AX, 214, "267.4 M parameters", { mono: true, size: 15, color: "mlp" });
    const a5 = D.text(ann, AX, 238, "the same in every layer", { mono: true, size: 14, color: "muted" });

    // stack of 64 for the finale
    const stack = LX.el("g", {}, svg), slabs = [];
    const SX = 1120, SW = 300;
    for (let i = 0; i < 64; i++) {
      const kind = i % 4 === 3 ? "attn" : "delta";
      const r = LX.el("rect", { x: SX, y: 815 - (i + 1) * 11, width: SW, height: 8, rx: 2, fill: LX.mix("bg", kind, kind === "attn" ? .55 : .3), stroke: LX.col(kind), "stroke-width": 1 }, stack);
      slabs.push(r);
    }
    D.label(stack, SX + SW / 2, 84, "64 layers", { anchor: "middle" });
    D.text(stack, SX + SW / 2, 846, "48 Gated DeltaNet + 16 Gated Attention", { mono: true, size: 14, color: "text-2", anchor: "middle" });
    const zoom = LX.el("g", { fill: "none", stroke: LX.col("muted"), "stroke-width": 1, "stroke-dasharray": "4 5" }, svg);
    LX.el("rect", { x: 92, y: 26, width: 704, height: 866, rx: 10 }, zoom);
    LX.el("path", { d: `M796 26 L${SX} ${815 - 11}` }, zoom);
    LX.el("path", { d: `M796 892 L${SX} 812` }, zoom);

    const main = D.traveller(cam, L.mainPath, { color: "embed", r: 8 });
    const skip = D.traveller(cam, L.skipPath, { color: "embed", r: 6 });
    const ML = L.mainPath.getTotalLength();

    // camera keyframes per cue: [centre x, centre y, zoom] in diagram coordinates
    const KF = { in: [640, 690, 1.45], norm1: [800, 700, 1.4], mixer: [820, 650, 1.28], add1: [800, 500, 1.08], mlp: [800, 450, 1], flow: [800, 450, 1] };
    const ORDER = ["in", "norm1", "mixer", "add1", "mlp", "flow"];
    ups.push(t => {
      let i = 0;
      ORDER.forEach((id, k) => { if (t >= ctx.cue(id).start) i = k; });
      const cur = KF[ORDER[i]], prev = KF[ORDER[Math.max(0, i - 1)]];
      const q = i === 0 ? 1 : ctx.p(t, ORDER[i], 0, .35, E.inOut);
      const [cx, cy, k] = cur.map((v, j) => LX.lerp(prev[j], v, q));
      cam.setAttribute("transform", `translate(800 450) scale(${k}) translate(${-cx} ${-cy})`);
    });

    ups.push(t => {
      // build-up
      L.seg0.draw(ctx.p(t, "in", .1, .6));
      [L.labIn, L.labStream, L.labShape].forEach(e => D.fade(e, ctx.p(t, "in", .4, .8)));
      L.inA.draw(ctx.p(t, "norm1", 0, .35)); D.fade(L.dotA, ctx.p(t, "norm1", 0, .1));
      L.norm1.show(ctx.p(t, "norm1", .25, .55)); D.fade(a1, ctx.p(t, "norm1", .4, .7));
      L.midA.draw(ctx.p(t, "mixer", 0, .2));
      const mixIn = ctx.p(t, "mixer", .15, .4);
      // toggle attention ↔ DeltaNet every few seconds once the mixer is shown
      const ph = (t - abs("mixer", .45));
      const cyc = ph < 0 ? 0 : ph % 5;
      const aw = cyc < 2 ? 0 : cyc < 2.6 ? E.inOut((cyc - 2) / .6) : cyc < 4.4 ? 1 : 1 - E.inOut((cyc - 4.4) / .6);
      L.mixD.show(mixIn, 10); L.mixA.show(mixIn, 10);
      L.mixD.g.setAttribute("opacity", mixIn * (1 - aw)); L.mixA.g.setAttribute("opacity", mixIn * aw);
      D.fade(aD, ctx.p(t, "mixer", .3, .6) * (1 - .55 * aw)); D.fade(aA, ctx.p(t, "mixer", .45, .75) * (.45 + .55 * aw));
      L.outA.draw(ctx.p(t, "add1", 0, .4));
      L.add1.show(ctx.p(t, "add1", .3, .55)); D.fade(L.labAdd1, ctx.p(t, "add1", .4, .6));
      L.add1.flash(bump(ctx.p(t, "add1", .35, .75, E.linear)));
      L.seg1.draw(ctx.p(t, "add1", .5, .95));
      L.inB.draw(ctx.p(t, "mlp", 0, .2)); D.fade(L.dotB, ctx.p(t, "mlp", 0, .06));
      L.norm2.show(ctx.p(t, "mlp", .12, .32)); D.fade(a3, ctx.p(t, "mlp", .2, .4));
      L.midB.draw(ctx.p(t, "mlp", .3, .42));
      L.mlp.show(ctx.p(t, "mlp", .38, .58)); D.fade(a4, ctx.p(t, "mlp", .45, .65)); D.fade(a5, ctx.p(t, "mlp", .5, .7));
      L.outB.draw(ctx.p(t, "mlp", .58, .78));
      L.add2.show(ctx.p(t, "mlp", .72, .86)); D.fade(L.labAdd2, ctx.p(t, "mlp", .75, .9));
      L.seg2.draw(ctx.p(t, "mlp", .84, 1)); D.fade(L.labOut, ctx.p(t, "mlp", .88, 1));

      // flow: a vector runs the computation route while a copy rides the skip route
      const m = ctx.p(t, "flow", 0, .5, E.inOut);
      main.at(m); skip.at(m);
      const pt = m > 0 && m < 1 ? L.mainPath.getPointAtLength(ML * m) : null;
      L.centers.forEach(([b, x, y]) => b.pulse(pt ? clamp(1 - Math.hypot(pt.x - x, pt.y - y) / 90) : 0));
      if (pt) { L.add1.flash(clamp(1 - Math.hypot(pt.x - L.S, pt.y - 480) / 40)); L.add2.flash(clamp(1 - Math.hypot(pt.x - L.S, pt.y - 110) / 40)); }

      // shrink to one slab of the stack
      const c = ctx.p(t, "flow", .52, .82, E.inOut);
      L.g.setAttribute("transform", `translate(${-250 * c} 0)`);
      D.fade(ann, 1 - ctx.p(t, "flow", .48, .56));
      slabs.forEach((s, i) => s.setAttribute("opacity", ctx.p(t, "flow", .58 + i * .003, .66 + i * .003)));
      D.fade(stack, ctx.p(t, "flow", .58, .62));
      const lit = ctx.p(t, "flow", .8, .9);
      LX.attr(slabs[0], { fill: LX.mix("bg", "delta", .3 + .5 * lit), filter: lit > .15 ? "url(#lx-glow)" : "none" });
      D.fade(zoom, ctx.p(t, "flow", .8, .92));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ========================================================= mix-vs-think */
  function buildMix(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    D.label(svg, 80, 92, "Five tokens in the residual stream");
    const cg = LX.el("g", { transform: "translate(0 50)" }, svg);
    const TOK = [["The", 760], [" cat", 7993], [" sat", 7338], [" on", 383], [" the", 279]];
    const xs = TOK.map((_, i) => 520 + i * 150);
    const R = LX.rng(23);
    const before = TOK.map(() => Array.from({ length: 8 }, () => (R() * 2 - 1) * .8));
    const after = before.map(v => v.map(x => clamp(x + (R() * 2 - 1) * .6, -1, 1)));
    const cols = TOK.map(([tok], i) => {
      const chip = D.tokenChip(cg, { x: xs[i] - 59, y: 130, h: 50, text: tok, size: 22 });
      const vg = LX.el("g", {}, cg);
      const vec = D.vector(vg, { x: xs[i], y: 225, values: before[i], cell: 20, gap: 5 });
      return { chip, vg, vec };
    });

    // phase 1: token mixer arcs, forward only
    const arcs = [];
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const yb = 480 + 26 * (j - i);
      const x0 = xs[i] + 6, x1 = xs[j] - 12 + i * 5;
      const a = D.arrow(cg, { d: `M${x0} 438 C${x0} ${yb} ${x1} ${yb} ${x1 - .5} 440`, color: "attn", width: 1.6 });
      arcs.push({ a, i, j });
    }
    const back = LX.el("g", { opacity: 0 }, cg);
    LX.el("path", { d: `M${xs[3]} 122 C${xs[3]} 64 ${xs[1]} 64 ${xs[1]} 122`, fill: "none", stroke: LX.col("muted"), "stroke-width": 1.6, "stroke-dasharray": "6 6" }, back);
    D.text(back, (xs[1] + xs[3]) / 2, 86, "✕", { size: 24, color: "text", anchor: "middle", weight: 600 });
    D.text(back, (xs[1] + xs[3]) / 2, 50, "never backwards", { mono: true, size: 14, color: "muted", anchor: "middle" });

    // phase 2: one MLP per token
    const mlps = xs.map(x => {
      const down = D.arrow(cg, { x1: x, y1: 432, x2: x, y2: 604, color: "mlp", width: 1.6 });
      const b = D.block(cg, { x: x - 55, y: 610, w: 110, h: 46, kind: "mlp", label: "MLP", size: 16 });
      const tr = D.traveller(cg, down.path, { color: "mlp", r: 6 });
      return { down, b, tr };
    });
    const same = D.text(cg, (xs[0] + xs[4]) / 2, 694, "identical weights · all five at once · no arrows between tokens", { mono: true, size: 14, color: "muted", anchor: "middle" });

    // legend
    const leg1 = LX.el("g", {}, cg);
    D.text(leg1, 80, 500, "1 · Token mixer", { size: 18, weight: 600, color: "attn" });
    D.text(leg1, 80, 524, "between tokens, forward only", { size: 15, color: "text-2" });
    const leg2 = LX.el("g", {}, cg);
    D.text(leg2, 80, 628, "2 · MLP", { size: 18, weight: 600, color: "mlp" });
    D.text(leg2, 80, 652, "inside each token, on its own", { size: 15, color: "text-2" });

    // last token
    const ring = LX.el("rect", { x: xs[4] - 22, y: 214, width: 44, height: 218, rx: 8, fill: "none", stroke: LX.col("embed"), "stroke-width": 2, opacity: 0, filter: "url(#lx-glow)" }, cg);
    const up = D.arrow(cg, { x1: xs[4], y1: 122, x2: xs[4], y2: 66, color: "logit", width: 2 });
    const nextLab = D.text(cg, xs[4] + 18, 76, "predicts the next token", { mono: true, size: 15, color: "logit" });

    ups.push(t => {
      cols.forEach((c, i) => {
        c.chip.show(ctx.p(t, "cols", .05 + i * .08, .35 + i * .08));
        c.vec.reveal(ctx.p(t, "cols", .2 + i * .08, .6 + i * .08, E.linear));
      });
      // mixer arcs, grouped by source token
      const dimMix = ctx.p(t, "think", 0, .15);
      const last = ctx.p(t, "last", 0, .3);
      arcs.forEach(({ a, i, j }) => {
        a.draw(ctx.p(t, "mix", .08 + i * .1, .4 + i * .1));
        const into4 = j === 4;
        a.g.setAttribute("opacity", 1 - dimMix * .82 + (into4 ? last * .82 : 0));
      });
      D.fade(back, ctx.p(t, "mix", .75, .9));
      D.fade(leg1, ctx.p(t, "mix", 0, .2) * (1 - dimMix * .5));
      // MLPs, all simultaneously
      const mp = ctx.p(t, "think", .15, .5, E.linear);
      mlps.forEach(m => {
        m.down.draw(ctx.p(t, "think", .05, .25));
        m.b.show(ctx.p(t, "think", .1, .3));
        m.tr.at(mp);
        m.b.pulse(bump(ctx.p(t, "think", .4, .75, E.linear)));
      });
      D.fade(same, ctx.p(t, "think", .55, .75));
      D.fade(leg2, ctx.p(t, "think", .1, .3));
      const morph = ctx.p(t, "think", .6, .85);
      cols.forEach((c, i) => c.vec.setValues(before[i].map((v, k) => LX.lerp(v, after[i][k], morph))));
      // the last token gathers everything
      D.fade(ring, last);
      up.draw(ctx.p(t, "last", .3, .55));
      D.fade(nextLab, ctx.p(t, "last", .5, .7));
    });
    return t => ups.forEach(u => u(t));
  }


  /* ===================================================== rmsnorm-worked */
  const fmt = (v, d = 3) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
  function rmsnorm(x, g, eps = 1e-6) {
    const sq = x.map(v => v * v), mean = sq.reduce((a, b) => a + b, 0) / x.length;
    const rms = Math.sqrt(mean + eps), xn = x.map(v => v / rms);
    return { sq, mean, rms, xn, out: xn.map((v, i) => v * g[i]), check: Math.sqrt(xn.reduce((a, v) => a + v * v, 0) / x.length) };
  }

  function buildWorked(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    const X = [2, -1, 3, 0], G = [1, 0.5, 2, 1];
    const A = rmsnorm(X, G), B = rmsnorm(X.map(v => v * 10), G);
    const CW = 128, CH = 64, GAP = 22, X0 = 330;
    const cx = i => X0 + i * (CW + GAP);

    /** a labelled row of value cells; set(values, p) updates text and colour */
    function row(y, label, sub, kind = "embed", scale = 3) {
      const g = LX.el("g", {}, svg);
      D.text(g, 290, y + 30, label, { mono: true, size: 18, color: kind, anchor: "end", weight: 500 });
      if (sub) D.text(g, 290, y + 52, sub, { mono: true, size: 13, color: "muted", anchor: "end" });
      const cells = [0, 1, 2, 3].map(i => {
        const r = LX.el("rect", { x: cx(i), y, width: CW, height: CH, rx: 8, fill: LX.col("panel"), stroke: LX.col("line-2"), "stroke-width": 1.2 }, g);
        const t = D.text(g, cx(i) + CW / 2, y + 41, "", { mono: true, size: 24, anchor: "middle" });
        return { r, t };
      });
      return {
        g,
        set(vals, d = 3) { vals.forEach((v, i) => { cells[i].t.textContent = fmt(v, d); cells[i].r.setAttribute("fill", LX.valueColor(clamp(v / scale, -1, 1) * .8)); }); },
        glow(q) { cells.forEach(c => c.r.setAttribute("stroke", q > .1 ? LX.mix("line-2", "embed", q) : LX.col("line-2"))); },
      };
    }
    D.label(svg, 80, 70, "RMSNorm · worked example with d = 4");
    const rX = row(110, "x", "input"), rS = row(250, "x²", "squares", "norm", 9);
    const rN = row(470, "x / RMS", "normalised"), rG = row(610, "g", "learned weights", "muted", 2), rO = row(750, "output", "x / RMS × g", "mlp");
    rX.set(X, 0); rS.set(A.sq, 0); rN.set(A.xn); rG.set(G, 1); rO.set(A.out);

    // right-hand calculation panel
    const P = LX.el("g", {}, svg), PX = 1000;
    const mean = D.text(P, PX, 290, "", { mono: true, size: 24, color: "text" });
    const eps = D.text(P, PX, 340, "+ ε = 0.000001", { mono: true, size: 18, color: "muted" });
    const rms = D.text(P, PX, 400, "", { mono: true, size: 32, color: "norm", weight: 600 });
    const chk = D.text(P, PX, 510, "", { mono: true, size: 18, color: "embed" });
    const zc = D.text(P, PX, 650, "Qwen3.8 stores w = g − 1:", { mono: true, size: 16, color: "muted" });
    const zc2 = D.text(P, PX, 676, "(0, −0.5, 1, 0) → × (1 + w)", { mono: true, size: 16, color: "muted" });
    const same = D.text(P, PX, 800, "same output as before ✓", { mono: true, size: 22, color: "mlp", weight: 600 });
    const arrows = [0, 1, 2, 3].map(i => D.arrow(svg, { x1: cx(i) + CW / 2, y1: 182, x2: cx(i) + CW / 2, y2: 244, color: "muted", width: 1.5 }));
    const arrN = D.arrow(svg, { d: `M${PX - 20} 400 C ${PX - 120} 420, ${cx(3) + CW + 60} 470, ${cx(3) + CW + 10} 500`, color: "norm", width: 1.5 });

    ups.push(t => {
      // 1 · the input
      rX.g.setAttribute("opacity", ctx.p(t, "x", 0, .3));
      // 2 · squares and their mean
      arrows.forEach((a, i) => a.draw(ctx.p(t, "square", .05 + i * .06, .3 + i * .06)));
      rS.g.setAttribute("opacity", ctx.p(t, "square", .2, .45));
      mean.textContent = `mean = ${fmt(A.sq.reduce((a, b) => a + b, 0), 0)} / 4 = ${fmt(A.mean, 1)}`;
      D.fade(mean, ctx.p(t, "square", .55, .8));
      // 3 · root
      D.fade(eps, ctx.p(t, "root", 0, .25));
      rms.textContent = `RMS = √${fmt(A.mean, 1)} ≈ ${fmt(A.rms)}`;
      D.fade(rms, ctx.p(t, "root", .25, .55));
      // 4 · divide, then weights
      arrN.draw(ctx.p(t, "divide", 0, .2));
      rN.g.setAttribute("opacity", ctx.p(t, "divide", .1, .3));
      chk.textContent = `RMS of this row = ${fmt(A.check)}`;
      D.fade(chk, ctx.p(t, "divide", .3, .45));
      rG.g.setAttribute("opacity", ctx.p(t, "divide", .5, .65));
      rO.g.setAttribute("opacity", ctx.p(t, "divide", .65, .85));
      D.fade(zc, ctx.p(t, "divide", .8, .95)); D.fade(zc2, ctx.p(t, "divide", .82, .97));
      // 5 · ten times larger input
      const s = ctx.p(t, "scale", .05, .35);
      const R = s > .5 ? B : A;
      rX.set(s > .5 ? X.map(v => v * 10) : X, 0);
      rS.set(R.sq, 0);
      mean.textContent = `mean = ${fmt(R.sq.reduce((a, b) => a + b, 0), 0)} / 4 = ${fmt(R.mean, 1)}`;
      rms.textContent = `RMS = √${fmt(R.mean, 1)} ≈ ${fmt(R.rms)}`;
      const flip = Math.sin(Math.PI * s);
      [rX, rS].forEach(r => r.g.setAttribute("transform", `translate(0 ${-6 * flip})`));
      rN.set(R.xn); rO.set(R.out);
      const hold = ctx.p(t, "scale", .45, .65);
      rN.glow(hold); rO.glow(hold);
      D.fade(same, ctx.p(t, "scale", .55, .75));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ================================================== rmsnorm-playground */
  LX.widget("rmsnorm-playground", function (el) {
    const N = 8, EPS = 1e-6;
    let x = [1.2, -0.8, 2.5, 0.3, -1.6, 0.9, -0.2, 1.8], w = Array(N).fill(0), base = null;
    el.innerHTML = `
      <style>
        .rp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 22px; }
        .rp-row { display: grid; grid-template-columns: 34px 1fr 52px; align-items: center; gap: 10px; font-size: 14px; color: var(--lx-text-2); }
        .rp-row output { font-family: var(--lx-mono); text-align: right; color: var(--lx-text); }
        .rp-cells { display: grid; grid-template-columns: 150px repeat(${N}, minmax(0, 1fr)); gap: 4px; align-items: center; margin: 4px 0; font-family: var(--lx-mono); font-size: 12px; }
        .rp-cells .lab { color: var(--lx-text-2); font-size: 12.5px; line-height: 1.25; }
        .rp-cells .c { border-radius: 5px; padding: 6px 2px; text-align: center; color: var(--lx-text); border: 1px solid var(--lx-line-2); overflow: hidden; white-space: nowrap; }
        .rp-cells input { width: 100%; min-width: 0; font: 12px var(--lx-mono); background: var(--lx-panel); color: var(--lx-text); border: 1px solid var(--lx-line-2); border-radius: 5px; padding: 5px 2px; text-align: center; }
        .rp-stats { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 14px 0 6px; font-family: var(--lx-mono); font-size: 14px; color: var(--lx-text-2); }
        .rp-stats b { color: var(--lx-text); font-weight: 600; }
        .rp-btns { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 4px; }
        .rp-btns button { font: 500 13px var(--lx-sans); color: var(--lx-text); background: var(--lx-panel-2); border: 1px solid var(--lx-line-2); border-radius: 8px; padding: 7px 12px; cursor: pointer; }
        .rp-btns button:hover { border-color: var(--lx-embed); }
        .rp-note { font-size: 13.5px; color: var(--lx-muted); margin: 8px 0 0; min-height: 1.4em; }
        .rp-note.ok { color: var(--lx-mlp); }
        @media (max-width: 640px) {
          .rp-grid { grid-template-columns: 1fr; }
          .rp-cells { grid-template-columns: 74px repeat(${N}, minmax(0, 1fr)); gap: 3px; font-size: 10.5px; }
          .rp-cells .lab { font-size: 11px; }
          .rp-cells .c { padding: 5px 0; }
          .rp-cells input { font-size: 10.5px; padding: 4px 0; }
        }
      </style>
      <div class="rp-grid">${x.map((_, i) => `<label class="rp-row"><span class="mono">x<sub>${i + 1}</sub></span><input type="range" min="-3" max="3" step="0.1" data-i="${i}"><output></output></label>`).join("")}</div>
      <div class="rp-stats"></div>
      <div class="rp-cells" data-r="x"></div>
      <div class="rp-cells" data-r="n"></div>
      <div class="rp-cells" data-r="w"></div>
      <div class="rp-cells" data-r="o1"></div>
      <div class="rp-cells" data-r="o2"></div>
      <div class="rp-btns"><button data-a="x10">× 10</button><button data-a="d10">÷ 10</button><button data-a="rand">Random</button><button data-a="reset">Reset</button></div>
      <p class="rp-note"></p>`;
    const sliders = [...el.querySelectorAll('input[type="range"]')];
    const note = el.querySelector(".rp-note");
    // fewer decimals on narrow screens and for large values, so every number fits its cell
    const dec = v => Math.abs(v) >= 9.95 ? 0 : (el.clientWidth < 520 ? 1 : 2);
    const cell = v => `<div class="c" style="background:${LX.valueColor(clamp(v / 3, -1, 1) * .8)}">${fmt(v, dec(v))}</div>`;
    const rowEl = r => el.querySelector(`[data-r="${r}"]`);
    // weight row: stored w (zero-centred), editable
    rowEl("w").innerHTML = `<div class="lab">stored w<br><span style="color:var(--lx-dim)">g = 1 + w</span></div>` + w.map((v, i) => `<input type="number" step="0.1" value="0" data-w="${i}" aria-label="w${i + 1}">`).join("");
    rowEl("w").querySelectorAll("input").forEach(inp => (inp.oninput = () => { w[+inp.dataset.w] = parseFloat(inp.value) || 0; render(); }));

    function render(msg) {
      sliders.forEach((s, i) => { s.value = clamp(x[i], -3, 3); s.nextElementSibling.textContent = fmt(x[i], 2); });
      const sq = x.map(v => v * v), mean = sq.reduce((a, b) => a + b, 0) / N, rms = Math.sqrt(mean + EPS);
      const xn = x.map(v => v / rms), g = w.map(v => 1 + v);
      const o1 = xn.map((v, i) => v * g[i]), o2 = xn.map((v, i) => v * (1 + w[i]));
      el.querySelector(".rp-stats").innerHTML = `<span>mean of squares <b>${fmt(mean, 3)}</b></span><span>RMS <b>${fmt(rms, 3)}</b></span><span>RMS after norm <b>${fmt(Math.sqrt(xn.reduce((a, v) => a + v * v, 0) / N), 3)}</b></span>`;
      rowEl("x").innerHTML = `<div class="lab">input x</div>` + x.map(cell).join("");
      rowEl("n").innerHTML = `<div class="lab">x / RMS</div>` + xn.map(cell).join("");
      rowEl("o1").innerHTML = `<div class="lab">ordinary<br><span style="color:var(--lx-dim)">× g</span></div>` + o1.map(cell).join("");
      rowEl("o2").innerHTML = `<div class="lab">Qwen3.8<br><span style="color:var(--lx-dim)">× (1 + w)</span></div>` + o2.map(cell).join("");
      if (base) {
        const diff = Math.max(...o2.map((v, i) => Math.abs(v - base[i])));
        note.className = "rp-note" + (diff < 1e-6 ? " ok" : "");
        note.textContent = msg || (diff < 1e-6 ? "Input scaled — the output is unchanged (largest difference " + diff.toExponential(1) + ")." : "");
        base = null;
      } else if (msg !== undefined) { note.className = "rp-note"; note.textContent = msg; }
    }
    const snap = () => { const rms = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / N + EPS); base = x.map((v, i) => v / rms * (1 + w[i])); };
    sliders.forEach(s => (s.oninput = () => { x[+s.dataset.i] = parseFloat(s.value); render(""); }));
    el.querySelector(".rp-btns").onclick = e => {
      const a = e.target.dataset && e.target.dataset.a;
      if (!a) return;
      if (a === "x10" || a === "d10") { snap(); x = x.map(v => a === "x10" ? v * 10 : v / 10); render(); }
      if (a === "rand") { x = x.map(() => Math.round((Math.random() * 6 - 3) * 10) / 10); render(""); }
      if (a === "reset") { x = [1.2, -0.8, 2.5, 0.3, -1.6, 0.9, -0.2, 1.8]; w = Array(N).fill(0); rowEl("w").querySelectorAll("input").forEach(i => (i.value = 0)); render("With w = 0 everywhere the norm only rescales: a freshly initialised Qwen3.8 norm."); }
    };
    render("Move the sliders, or press × 10: the input grows, the output does not.");
  });

  LX.chapter({
    id: "layer", num: 6, title: "Inside one layer: the residual stream", toc: "Inside one layer",
    kicker: "A running sum, refined 64 times",
    lede: "The token vectors do not get replaced layer by layer. Each layer reads them, works something out, and adds its result on top. That running total is called the residual stream.",
    body: [
      { prose: `
        <p>Out of the embedding table comes a tensor of shape <code>[T, 5120]</code>, one vector per token. From here on, that tensor is the model's working memory. It flows up through all 64 layers, and every layer makes a small <strong>addition</strong> to it.</p>
        <p>This design is called the <strong>residual stream</strong>. Picture a conveyor belt carrying the vectors upward. At each layer, two workers lift a copy off the belt, study it, and put back a correction. The belt itself is never thrown away.</p>` },

      { scene: {
        id: "residual-stream", title: "The residual stream", build: buildResidual,
        visual: "A vertical teal band (the stream, with slowly drifting chevrons) carries a packet of five token vectors labelled [T, 5120]. Layer boxes 1, 2, 3 and 64 sit to the right. At each layer, an arrow carries a copy into the box (light pulse), a small correction vector rides back into a ⊕ on the band edge, and the packet's colours shift. A counter under the packet reads “after layer N”.",
        cues: [
          { id: "belt",  say: "Think of the token vectors as riding up a conveyor belt. This belt is the residual stream. Its shape stays the same the whole way: one vector of five thousand one hundred and twenty numbers per token.", vis: "The teal band draws upward; the packet of five vectors appears at the bottom, label [T, 5120]; layer boxes fade in." },
          { id: "read",  say: "At each layer, a copy of the vectors is taken off the belt and sent through the layer's calculations.", vis: "The packet rises to Layer 1; a branch arrow carries a copy (light pulse) into the box, which lights up." },
          { id: "add",   say: "The layer's result is not a replacement. It is a correction, and it is added back onto the belt, number by number.", vis: "A small correction vector rides back along the upper arrow into the ⊕, which flashes; the packet's colours shift. Counter: after layer 1." },
          { id: "many",  say: "Then the next layer does the same, and the next. After sixty-four layers, the vectors hold everything the model has worked out about each token and its context.", vis: "Branch and merge repeat for layers 2 and 3; the packet climbs past layers 4–63 (counter runs) and merges at layer 64." },
          { id: "why",   say: "Because every layer only adds, information from early layers is never lost, and during training, the learning signal can flow straight down the belt to every layer. This is what makes very deep models trainable.", vis: "A thin line beside the band, with dots flowing downward, labelled “training signal flows straight down”." },
        ],
      } },

      { prose: `
        <h3>The anatomy of a layer</h3>
        <p>All 64 layers of Qwen3.8-27B share the same outline. Each has two sub-blocks, and each sub-block follows the same three-step pattern: <strong>normalise, compute, add</strong>.</p>
        <ol>
          <li><strong class="c-norm">RMSNorm</strong>: rescale a copy of each vector to a standard size.</li>
          <li><strong>Token mixer</strong>: let each token gather information from earlier tokens. This is either <strong class="c-attn">Gated Attention</strong> (16 layers) or <strong class="c-delta">Gated DeltaNet</strong> (48 layers).</li>
          <li><strong>Add</strong> the result back onto the stream.</li>
          <li><strong class="c-norm">RMSNorm</strong> again.</li>
          <li><strong class="c-mlp">MLP</strong>: process each token on its own, using the large SwiGLU network.</li>
          <li><strong>Add</strong> the result back onto the stream.</li>
        </ol>
        <p>Normalising <em>before</em> each sub-block, rather than after, is called a <strong>pre-norm</strong> design. The stream itself is never normalised along the way. It is allowed to grow and carry information freely. Only the copies sent into each sub-block are rescaled.</p>` },

      { scene: {
        id: "layer-anatomy", title: "One layer, built up piece by piece", build: buildAnatomy,
        visual: "The residual stream is a straight teal line on the left, bottom to top. Each sub-block branches off to the right and adds back at a ⊕ on the stream: Norm (grey-blue) → token mixer (flips between blue “Gated DeltaNet” and violet “Gated Attention”) → ⊕, then Norm → MLP (green) → ⊕. Parameter counts are annotated on the right. At the end a light pulse runs the computation route while a second one rides the straight stream, and the diagram becomes layer 1 of a stack of 64.",
        cues: [
          { id: "in",    say: "A layer receives the residual stream from below. Here is its outline, piece by piece.", vis: "The stream line draws up from the bottom; labels “from the layer below”, “residual stream [T, 5120]”." },
          { id: "norm1", say: "First, R M S norm, short for root mean square normalisation, rescales a copy of each vector, so every token arrives at a similar size.", vis: "A copy branches off the stream to the right into the RMSNorm box; the stream itself continues straight up." },
          { id: "mixer", say: "Then comes the token mixer. This is the only place where tokens exchange information. In Qwen three point eight it is either gated attention or gated DeltaNet, depending on the layer.", vis: "Mixer box appears and toggles between Gated DeltaNet (blue) and Gated Attention (violet); right: 48 layers · 115.9 M / 16 layers · 104.9 M." },
          { id: "add1",  say: "The mixer's output is added back onto the stream through this skip connection.", vis: "The mixer output returns left into a ⊕ on the stream, which flashes." },
          { id: "mlp",   say: "Then the same pattern again: another norm, then the M L P, the multi-layer perceptron, which works on each token separately. Its result is added back too.", vis: "Second branch: RMSNorm → MLP (267.4 M) → ⊕; the stream continues “to the layer above”." },
          { id: "flow",  say: "That is one complete layer. Qwen three point eight stacks sixty-four of them.", vis: "A light pulse runs through norm, mixer, ⊕, norm, MLP, ⊕ while a twin rides the straight stream; the diagram slides left and a stack of 64 slabs appears, with a zoom outline linking it to layer 1." },
        ],
      } },

      { prose: `
        <h3>Two kinds of work: mixing and thinking</h3>
        <p>The two sub-blocks do fundamentally different jobs:</p>
        <div class="lx-table-wrap"><table class="lx-table">
          <tr><th>Sub-block</th><th>Looks at</th><th>Job</th><th class="num">Parameters per layer</th></tr>
          <tr><td><strong class="c-attn">Token mixer</strong></td><td>The current token <em>and earlier tokens</em></td><td>Move information between positions: who is "it", what was the question, which bracket is open</td><td class="num">105 M / 116 M</td></tr>
          <tr><td><strong class="c-mlp">MLP</strong></td><td>One token at a time</td><td>Process what that token now knows: recall facts, combine features, prepare the prediction</td><td class="num">267 M</td></tr>
        </table></div>
        <p>The token mixer is the only place where one position can learn anything about another. The <abbr>MLP</abbr> holds most of the parameters, and is often described as where much of the model's stored knowledge lives.</p>` },

      { scene: {
        id: "mix-vs-think", title: "Mixing between tokens, thinking within a token", build: buildMix,
        visual: "Five token columns (vectors) stand in a row under their chips “The ·cat ·sat ·on ·the”. Phase 1 (violet): curved arrows flow from each column into every later one, and a backward arc above the chips is crossed out; the last column receives the most arrows. Phase 2 (green): the arcs dim and each column sends a pulse down into its own MLP box, all at the same moment, with no arrows between columns.",
        cues: [
          { id: "cols",  say: "Here are five tokens in the stream, each with its own vector.", vis: "Five chips with vector columns beneath them." },
          { id: "mix",   say: "In the token mixer, information flows between positions, but only forward. Each token can look at itself and at the tokens before it, never at tokens that come after.", vis: "Violet arcs from earlier columns to later ones; above the chips a dashed backward arc with ✕, “never backwards”." },
          { id: "think", say: "In the M L P, the multi-layer perceptron, there is no flow between tokens at all. Every token is processed on its own, by exactly the same weights, all at the same time.", vis: "Arcs dim; five identical green MLP boxes light up at once and the vectors change; “identical weights · all five at once”." },
          { id: "last",  say: "After all sixty-four layers, the vector of the last token has gathered what it needs from the whole text. That is the vector the model will use to predict the next token.", vis: "The last column is outlined in teal, the arcs into it brighten, and a pink arrow points up: “predicts the next token”." },
        ],
      } },

      { prose: `
        <h3>The full stack</h3>
        <p>In Qwen3.8-27B the token mixer alternates in a fixed rhythm: three Gated DeltaNet layers, then one Gated Attention layer, repeated 16 times. That gives layers 4, 8, 12, … 64 full attention, and the other 48 use DeltaNet. The two kinds of token mixer complement each other. Full attention is precise but gets more expensive as the text grows. DeltaNet has a fixed cost per token. The hybrid gets most of the precision at a fraction of the cost (<a href="#attention">Chapter 7</a>, <a href="#deltanet">Chapter 8</a>).</p>
        <p>After layer 64, one last RMSNorm (<code>model.norm</code>) rescales the stream once more before it is turned into token scores (<a href="#output">Chapter 11</a>).</p>` },

      { note: `<b>Only the newest token travels through the layers.</b> When the model reads your prompt, all its tokens go through the layers together, in parallel. When it writes, only the <em>newest</em> token goes through the layers. What earlier tokens contributed is kept in a cache, so it does not have to be recomputed. See <a href="#prefill-decode">Chapter 13</a> and <a href="#kv-cache">Chapter 14</a>.` },

      { widget: {
        id: "rmsnorm-playground", title: "Try it: RMSNorm on a small vector",
        sub: "Eight sliders set a small vector. The rows below show its root mean square, the normalised vector, and the result after the learned per-channel weights, in the ordinary form (× g) and in Qwen3.8's zero-centred form (× (1 + w), where the stored w starts at 0). Values beyond ±3 from × 10 are kept, even though the sliders stop at ±3.",
      } },

      { deep: `
        <h3>The layer as equations</h3>
        <p>Let <b>h</b><sub>ℓ</sub> be the residual stream entering layer ℓ, shape <code>[T, 5120]</code>. One pre-norm layer computes:</p>
        <math display="block"><mtable columnalign="right left"><mtr><mtd><msub><mi mathvariant="bold">u</mi><mi>ℓ</mi></msub></mtd><mtd><mo>=</mo><msub><mi mathvariant="bold">h</mi><mi>ℓ</mi></msub><mo>+</mo><msub><mtext>Mixer</mtext><mi>ℓ</mi></msub><mo>(</mo><mtext>RMSNorm</mtext><mo>(</mo><msub><mi mathvariant="bold">h</mi><mi>ℓ</mi></msub><mo>)</mo><mo>)</mo></mtd></mtr><mtr><mtd><msub><mi mathvariant="bold">h</mi><mrow><mi>ℓ</mi><mo>+</mo><mn>1</mn></mrow></msub></mtd><mtd><mo>=</mo><msub><mi mathvariant="bold">u</mi><mi>ℓ</mi></msub><mo>+</mo><msub><mtext>MLP</mtext><mi>ℓ</mi></msub><mo>(</mo><mtext>RMSNorm</mtext><mo>(</mo><msub><mi mathvariant="bold">u</mi><mi>ℓ</mi></msub><mo>)</mo><mo>)</mo></mtd></mtr></mtable></math>
      <div class="lx-read">Layer ℓ receives the stream h<sub>ℓ</sub>. First line: normalise a copy of it, run it through the token mixer (DeltaNet or attention), and <b>add</b> the result back to the stream, giving u<sub>ℓ</sub>. Second line: normalise a copy of u<sub>ℓ</sub>, run it through the MLP, and add that result too. What comes out, h<sub>ℓ+1</sub>, is the input to the next layer. Nothing is ever replaced, only added to.</div>
        <p>Unrolling the additions shows why it is called a stream. The final state is the embedding plus every sub-block's contribution:</p>
        <math display="block"><mrow><msub><mi mathvariant="bold">h</mi><mn>64</mn></msub><mo>=</mo><msub><mi mathvariant="bold">h</mi><mn>0</mn></msub><mo>+</mo><munderover><mo>∑</mo><mrow><mi>ℓ</mi><mo>=</mo><mn>0</mn></mrow><mn>63</mn></munderover><mo>(</mo><msub><mtext>mix</mtext><mi>ℓ</mi></msub><mo>+</mo><msub><mtext>mlp</mtext><mi>ℓ</mi></msub><mo>)</mo></mrow></math>
      <div class="lx-read">The stream after the last layer, h<sub>64</sub>, is the original embedding h<sub>0</sub> plus a long sum: for every layer ℓ from 0 to 63, add what its mixer wrote and what its MLP wrote. Here mix<sub>ℓ</sub> and mlp<sub>ℓ</sub> are short for those two contributions. So the final vector is literally the starting vector plus 128 corrections, two from each of the 64 layers.</div>
        <p>Each layer can read anything earlier layers wrote, and its gradient during training includes a direct "identity" path back to every earlier layer.</p>

        <h3>RMSNorm</h3>
        <p>For one token's vector <b>x</b> of length <i>d</i> = 5,120, with a learned weight vector <b>g</b> (one number per channel) and a tiny constant ε = 10<sup>−6</sup> that prevents division by zero:</p>
        <math display="block"><mrow><mtext>RMS</mtext><mo>(</mo><mi mathvariant="bold">x</mi><mo>)</mo><mo>=</mo><msqrt><mrow><mfrac><mn>1</mn><mi>d</mi></mfrac><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>d</mi></munderover><msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup><mo>+</mo><mi>ε</mi></mrow></msqrt><mo>,</mo><mspace width="1.2em"/><mtext>RMSNorm</mtext><msub><mrow><mo>(</mo><mi mathvariant="bold">x</mi><mo>)</mo></mrow><mi>i</mi></msub><mo>=</mo><mfrac><msub><mi>x</mi><mi>i</mi></msub><mrow><mtext>RMS</mtext><mo>(</mo><mi mathvariant="bold">x</mi><mo>)</mo></mrow></mfrac><mspace width="0.15em"/><msub><mi>g</mi><mi>i</mi></msub></mrow></math>
      <div class="lx-read">First formula: square each of the d = 5,120 numbers of x, add them up, divide by d, add the tiny safety constant ε (0.000001) so it can never be zero, and take the square root. That is RMS(x), the vector's typical size. Second formula: for each channel i, divide x's i-th number by RMS(x), then multiply by that channel's learned weight g<sub>i</sub>. Example: x = (3, 4) gives RMS = √((9 + 16) / 2) ≈ 3.54, so with g = (1, 1) the output is about (0.85, 1.13).</div>
        <p>Unlike the older LayerNorm, it does not subtract the mean. It only rescales, which is cheaper and works about as well in practice. Each layer has two such weight vectors (5,120 numbers each). They are a negligible share of the parameters, but they let every sub-block choose which channels to emphasise.</p>
        <p><strong>A Qwen3.8 detail: zero-centred weights.</strong> Qwen3.8 stores each weight as an offset from 1 and multiplies by (1 + <i>w</i>) instead of <i>g</i>. The stored values start at 0, so a freshly initialised norm applies no extra per-channel scaling. This applies to the two norms in every layer, the final norm, and the per-head norms on queries and keys. The norm inside DeltaNet's output gate is the only one that uses the ordinary form. The arithmetic is otherwise identical.</p>

        <h3>Worked example (d = 4)</h3>
        <p>Take <b>x</b> = (2, −1, 3, 0) and <b>g</b> = (1, 0.5, 2, 1).</p>
        <ol>
          <li>Squares: 4, 1, 9, 0. Mean = 14 / 4 = 3.5.</li>
          <li>RMS = √3.5 ≈ 1.871.</li>
          <li>Divide: <b>x</b> / 1.871 ≈ (1.069, −0.535, 1.604, 0). This vector now has RMS 1.</li>
          <li>Multiply by <b>g</b>: (1.069, −0.267, 3.207, 0).</li>
        </ol>
        <p>Had <b>x</b> been ten times larger, steps 1–3 would give exactly the same result. RMSNorm removes the overall size and keeps only the direction, plus the learned per-channel emphasis.</p>` },

      { scene: {
        id: "rmsnorm-worked", deep: true, title: "Worked example: RMSNorm", build: buildWorked,
        visual: "Rows of value cells on the blueprint grid: x = (2, −1, 3, 0); its squares; on the right the mean, + ε and the RMS; then x / RMS with a check that its RMS is 1; the weights g = (1, 0.5, 2, 1) and the output. Finally the input is made ten times larger and the normalised row and output stay identical. Every number is computed in the scene.",
        cues: [
          { id: "x",      say: "Take a tiny vector with four numbers: two, minus one, three and zero. Here is how R M S norm, root mean square normalisation, rescales it.", vis: "Row x = (2, −1, 3, 0) appears." },
          { id: "square", say: "Square each number, add them up, and divide by four. The squares are four, one, nine and zero, so their mean is three point five.", vis: "Arrows down to the squares (4, 1, 9, 0); right: mean = 14 / 4 = 3.5." },
          { id: "root",   say: "Add a tiny safety constant and take the square root. The root mean square is about one point eight seven: the vector's typical size.", vis: "+ ε = 0.000001; RMS = √3.5 ≈ 1.871." },
          { id: "divide", say: "Divide every number by it. The new vector points the same way, but its root mean square is exactly one. Then each channel is multiplied by its learned weight, here one, one half, two and one.", vis: "x / RMS = (1.069, −0.535, 1.604, 0) with 'RMS of this row = 1.000'; g row; output (1.069, −0.267, 3.207, 0); note that Qwen3.8 stores w = g − 1." },
          { id: "scale",  say: "Now make the input ten times larger. The root mean square grows ten times too, so the normalised vector and the output come out exactly the same. Only the direction survives, plus the learned emphasis per channel.", vis: "x becomes (20, −10, 30, 0), squares (400, 100, 900, 0), RMS ≈ 18.708; the normalised and output rows glow unchanged; 'same output as before ✓'." },
        ],
      } },
    ],
  });
})();
