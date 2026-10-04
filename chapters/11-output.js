/* Chapter 11 — From a vector to probabilities */
(function () {
  "use strict";
  const D = LX.draw, el = LX.el, col = LX.col, mix = LX.mix, clamp = LX.clamp;
  const bump = (t, a, b) => { const x = clamp((t - a) / (b - a)); return Math.sin(Math.PI * x); };

  /* The chapter's worked example: five logits → softmax, computed here. */
  const EX = [[" mat", 4.1, 5344], [" floor", 3.3, 6220], [" couch", 2.6, 25313], [" bed", 1.9, 4690], [" roof", 0.5, 14693]];
  const EXP = EX.map(e => Math.exp(e[1]));
  const SUM = EXP.reduce((a, b) => a + b, 0);
  const PROB = EXP.map(v => v / SUM);

  /** Illustrative full-vocabulary logits, one bar per `per` tokens (deterministic). */
  function vocabLogits(n) {
    const R = LX.rng(4242), z = [];
    for (let i = 0; i < n; i++) {
      // sum of uniforms ≈ normal; most tokens score low, a little higher for common (low-ID) tokens
      const g = (R() + R() + R() + R() - 2) * 1.4;
      z.push(clamp(-2.6 + g - i / n * 1.2, -6, 0.6));
    }
    return z;
  }
  /** Bars as a single path (fast): xs from x0, width w each, heights h[i], baseline y. */
  function barPath(x0, w, y, hs, gap = 0) {
    let d = "";
    hs.forEach((h, i) => { if (h > 0.2) d += `M${(x0 + i * (w + gap)).toFixed(1)} ${y}v${(-h).toFixed(1)}h${w}v${h.toFixed(1)}z`; });
    return d;
  }

  /* ============================================================ lm-head */
  function buildLmHead(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    const R = LX.rng(1010);

    /* left: the top of the stack */
    const topLab = D.label(svg, 80, 92, "After layer 64 · one vector per position");
    const TOK = ["The", " cat", " sat", " on", " the"];
    const cols = TOK.map((t, i) => {
      const x = 80 + i * 92;
      const chip = D.tokenChip(svg, { x, y: 120, w: 80, h: 44, text: t, size: 18 });
      const vals = Array.from({ length: 12 }, () => (R() * 2 - 1) * (.3 + R() * .7));
      const vec = D.vector(svg, { x: x + 40, y: 196, values: vals, cell: 20, gap: 4 });
      const cg = el("g", {}, svg); cg.appendChild(chip.g); cg.appendChild(vec.g);
      return { chip, vec, vals, cg };
    });
    const last = cols[4];
    const hl = el("rect", { x: 466, y: 186, width: 44, height: 304, rx: 6, fill: "none", stroke: col("embed"), "stroke-width": 2 }, svg);
    const lastLab = D.text(svg, 80, 530, "only the last position predicts what comes next", { mono: true, size: 14, color: "embed" });

    /* final norm */
    const a1 = D.arrow(svg, { x1: 516, y1: 338, x2: 566, y2: 338, color: "embed" });
    const norm = D.block(svg, { x: 576, y: 306, w: 150, h: 64, kind: "norm", label: "Final norm", sub: "RMSNorm" });
    const rms = Math.sqrt(last.vals.reduce((a, v) => a + v * v, 0) / last.vals.length);
    const nvals = last.vals.map(v => v / rms);
    const mx = Math.max(...nvals.map(Math.abs));
    const a2 = D.arrow(svg, { x1: 732, y1: 338, x2: 772, y2: 338, color: "embed" });
    const nvec = D.vector(svg, { x: 800, y: 196, values: nvals.map(v => v / mx), cell: 20, gap: 4 });
    const nLab = D.text(svg, 651, 404, `÷ rms (${rms.toFixed(2)}) → rms 1`, { mono: true, size: 14, color: "norm", anchor: "middle" });
    const vLab = D.text(svg, 800, 512, "[5120]", { mono: true, size: 14, color: "embed", anchor: "middle" });

    /* lm_head slab */
    const SX = 870, SW = 650, SY = 200, SH = 110;
    const slab = el("g", {}, svg);
    el("rect", { x: SX, y: SY, width: SW, height: SH, rx: 4, fill: mix("bg", "logit", .08), stroke: col("logit"), "stroke-width": 1.5 }, slab);
    let hatch = "";
    for (let x = SX + 5; x < SX + SW; x += 5) hatch += `M${x} ${SY + 2}V${SY + SH - 2}`;
    el("path", { d: hatch, stroke: mix("bg", "logit", .28), "stroke-width": 1 }, slab);
    const slabLab = D.text(svg, SX, SY - 18, "lm_head · [248,320 × 5,120]", { mono: true, size: 16, weight: 500, color: "logit" });
    const br1 = D.bracket(svg, { x1: SX, y1: SY + SH + 10, x2: SX + SW, y2: SY + SH + 10, side: "bottom", label: "248,320 rows · one per vocabulary token", color: "logit" });
    const br2 = D.bracket(svg, { x1: SX + SW + 10, y1: SY, x2: SX + SW + 10, y2: SY + SH, side: "right", label: "5,120", color: "muted" });
    const a3 = D.arrow(svg, { d: `M812 338 H845 V255 H864`, color: "embed" });
    const sweep = el("rect", { x: SX, y: SY, width: 6, height: SH, fill: col("embed"), opacity: 0, filter: "url(#lx-glow)" }, svg);

    /* logits barcode */
    const N = 325, BW = 2, BY = 600, BH = 150, ZMIN = -6, ZMAX = 4.4;
    const z = vocabLogits(N);
    // place the five example tokens at their real ID positions
    const posOf = id => Math.round(id / 248320 * N);
    EX.forEach(e => (z[posOf(e[2])] = Math.max(z[posOf(e[2])], e[1])));
    const hOf = v => (v - ZMIN) / (ZMAX - ZMIN) * BH;
    const clip = el("clipPath", { id: "lmh-clip" }, svg.querySelector("defs"));
    const clipR = el("rect", { x: SX, y: BY - BH - 10, width: 0, height: BH + 20 }, clip);
    const barcode = el("path", { d: barPath(SX, BW, BY, z.map(hOf)), fill: col("logit"), opacity: .75, "clip-path": "url(#lmh-clip)" }, svg);
    const base = el("line", { x1: SX, y1: BY, x2: SX + SW, y2: BY, stroke: col("line-2") }, svg);
    const bcLab = D.text(svg, SX + SW, BY + 26, "logits [248,320] · one score per token · illustrative", { mono: true, size: 14, color: "logit", anchor: "end" });

    /* zoom */
    const zx0 = SX, zx1 = SX + 74;
    const zr = el("rect", { x: zx0 - 3, y: BY - BH - 6, width: zx1 - zx0 + 6, height: BH + 12, rx: 4, fill: "none", stroke: col("text-2"), "stroke-width": 1.5, "stroke-dasharray": "4 3" }, svg);
    const ZP = { x: 80, y: 600, w: 700, base: 820 };
    const zpanel = el("g", {}, svg);
    el("rect", { x: ZP.x, y: ZP.y - 30, width: ZP.w, height: 270, rx: 8, fill: col("bg-2"), stroke: col("line"), "stroke-width": 1 }, zpanel);
    D.label(zpanel, ZP.x + 18, ZP.y - 6, "Zoom · the highest logits");
    const conn = el("path", { d: `M${zx0 - 3} ${BY + 6} L${ZP.x + ZP.w} ${ZP.y - 30} M${zx1 + 3} ${BY + 6} L${ZP.x + ZP.w} ${ZP.y + 240}`, stroke: col("dim"), "stroke-width": 1, "stroke-dasharray": "3 4", fill: "none" }, svg);
    const zbars = EX.map(([tok, v, id], i) => {
      const x = ZP.x + 60 + i * 128, w = 70;
      const r = el("rect", { x, y: ZP.base, width: w, height: 0, rx: 3, fill: col("logit"), opacity: i === 0 ? 1 : .6 }, svg);
      const val = D.text(svg, x + w / 2, ZP.base - 8, v.toFixed(1), { mono: true, size: 16, color: i === 0 ? "logit" : "text-2", anchor: "middle" });
      const tt = D.tokenText(svg, x + w / 2, ZP.base + 26, tok, { size: 18 });
      const it = D.text(svg, x + w / 2, ZP.base + 46, "ID " + id, { mono: true, size: 13, color: "muted", anchor: "middle" });
      return { r, val, tt, it, v };
    });
    const tail = D.text(svg, ZP.x + ZP.w - 18, ZP.y + 20, "the other ≈ 248,315 tokens score far lower", { mono: true, size: 14, color: "muted", anchor: "end" });

    ups.push(t => {
      /* last */
      cols.forEach((c, i) => {
        c.chip.show(ctx.p(t, "last", .02 + i * .04, .2 + i * .04));
        c.vec.reveal(ctx.p(t, "last", .05 + i * .04, .35 + i * .04, LX.ease.linear));
        c.cg.setAttribute("opacity", i < 4 ? 1 - .7 * ctx.p(t, "last", .5, .75) : 1);
      });
      D.fade(topLab, ctx.p(t, "last", 0, .15));
      D.fade(hl, ctx.p(t, "last", .55, .75));
      hl.setAttribute("filter", bump(t, ctx.cue("last").start + ctx.cue("last").dur * .6, ctx.cue("last").end) > .2 ? "url(#lx-glow)" : "none");
      D.fade(lastLab, ctx.p(t, "last", .65, .85));

      /* norm */
      a1.draw(ctx.p(t, "norm", 0, .2));
      norm.show(ctx.p(t, "norm", .1, .3));
      norm.pulse(bump(t, ctx.cue("norm").start + ctx.cue("norm").dur * .25, ctx.cue("norm").start + ctx.cue("norm").dur * .6));
      a2.draw(ctx.p(t, "norm", .45, .6));
      nvec.reveal(ctx.p(t, "norm", .55, .9, LX.ease.linear));
      D.fade(nLab, ctx.p(t, "norm", .4, .6));
      D.fade(vLab, ctx.p(t, "norm", .8, 1));

      /* head */
      const hs = ctx.p(t, "head", 0, .35);
      slab.setAttribute("opacity", hs);
      slab.setAttribute("transform", `translate(${(1 - hs) * 20} 0)`);
      D.fade(slabLab, ctx.p(t, "head", .25, .5));
      br1.show(ctx.p(t, "head", .45, .7));
      br2.show(ctx.p(t, "head", .55, .8));
      a3.draw(ctx.p(t, "head", .7, .9));

      /* scores: sweep across the rows, barcode grows behind it */
      const sw = ctx.p(t, "scores", .05, .75, LX.ease.inOut);
      clipR.setAttribute("width", SW * sw);
      sweep.setAttribute("x", SX + (SW - 6) * sw);
      sweep.setAttribute("opacity", sw > 0 && sw < 1 ? .85 : 0);
      D.fade(base, ctx.p(t, "scores", 0, .1));
      D.fade(bcLab, ctx.p(t, "scores", .7, .9));

      /* zoom */
      D.fade(zr, ctx.p(t, "zoom", 0, .15));
      D.fade(conn, ctx.p(t, "zoom", .1, .25));
      D.fade(zpanel, ctx.p(t, "zoom", .1, .25));
      zbars.forEach((b, i) => {
        const q = ctx.p(t, "zoom", .25 + i * .08, .55 + i * .08);
        const h = b.v / 4.1 * 150 * q;
        b.r.setAttribute("y", ZP.base - h); b.r.setAttribute("height", h);
        b.val.setAttribute("y", ZP.base - h - 8);
        [b.val, b.tt, b.it].forEach(e => D.fade(e, q));
      });
      D.fade(tail, ctx.p(t, "zoom", .8, .95));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ============================================================ softmax */
  function buildSoftmax(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);

    /* left: five bars over a zero line */
    const Y0 = 600, S1 = 60, S2 = 380 / EXP[0], BX = 140, BWD = 60, STEP = 96;
    const head = D.label(svg, 80, 92, "Five logits · the chapter's worked example");
    const axis = el("g", {}, svg);
    el("line", { x1: 100, y1: Y0, x2: 610, y2: Y0, stroke: col("line-2"), "stroke-width": 1.5 }, axis);
    const ticks = el("g", {}, svg);
    for (let v = -1; v <= 4; v++) {
      el("line", { x1: 100, y1: Y0 - v * S1, x2: 108, y2: Y0 - v * S1, stroke: col("muted") }, ticks);
      D.text(ticks, 94, Y0 - v * S1 + 5, String(v), { mono: true, size: 13, color: "muted", anchor: "end" });
    }
    const zeroLab = D.text(svg, 616, Y0 + 5, "0", { mono: true, size: 13, color: "muted" });
    const bars = EX.map(([tok, z], i) => {
      const x = BX + i * STEP;
      const r = el("rect", { x, y: Y0, width: BWD, height: 0, rx: 3, fill: col("logit"), opacity: i === 0 ? 1 : .65 }, svg);
      const v1 = D.text(svg, x + BWD / 2, 0, z.toFixed(1), { mono: true, size: 16, color: "text", anchor: "middle" });
      const v2 = D.text(svg, x + BWD / 2, 0, EXP[i].toFixed(1), { mono: true, size: 16, color: "logit", anchor: "middle" });
      const tt = D.tokenText(svg, x + BWD / 2, Y0 + 34, tok, { size: 18 });
      return { r, v1, v2, tt, z, x };
    });

    /* e^x inset, plotted from the formula */
    const IX = 680, IY = 170, IW = 280, IH = 330, XMIN = -1, XMAX = 4.3, YMAX = Math.exp(XMAX);
    const ix = v => IX + (v - XMIN) / (XMAX - XMIN) * IW, iy = v => IY + IH - v / YMAX * IH;
    const inset = el("g", {}, svg);
    el("rect", { x: IX - 20, y: IY - 40, width: IW + 40, height: IH + 80, rx: 8, fill: col("bg-2"), stroke: col("line"), "stroke-width": 1 }, inset);
    D.text(inset, IX - 4, IY - 14, "y = eˣ", { mono: true, size: 15, color: "logit" });
    el("line", { x1: IX, y1: IY + IH, x2: IX + IW, y2: IY + IH, stroke: col("line-2") }, inset);
    let d = "";
    for (let k = 0; k <= 80; k++) { const v = XMIN + (XMAX - XMIN) * k / 80; d += (k ? "L" : "M") + ix(v).toFixed(1) + " " + iy(Math.exp(v)).toFixed(1); }
    const curve = el("path", { d, fill: "none", stroke: col("logit"), "stroke-width": 2 }, inset);
    const CL = curve.getTotalLength();
    curve.setAttribute("stroke-dasharray", `${CL} ${CL}`);
    const dots = EX.map(([, z]) => el("circle", { cx: ix(z), cy: iy(Math.exp(z)), r: 5, fill: col("logit"), opacity: 0 }, inset));
    D.text(inset, IX + IW, IY + IH + 24, "x = logit", { mono: true, size: 13, color: "muted", anchor: "end" });
    const sumLab = D.text(svg, 375, 140, `sum = ${EXP.map(v => v.toFixed(1)).join(" + ")} = ${SUM.toFixed(2)}`, { mono: true, size: 15, color: "text-2", anchor: "middle" });

    /* stacked 100% column */
    const CX = 1030, CW = 64, CT = 190, CHT = 400;
    const colFrame = el("rect", { x: CX, y: CT, width: CW, height: CHT, rx: 3, fill: "none", stroke: col("line-2") }, svg);
    let acc = 0;
    const segs = PROB.map((p, i) => {
      const y = CT + acc * CHT; acc += p;
      return el("rect", { x: CX, y, width: CW, height: p * CHT, fill: mix("bg", "logit", 1 - i * .17), stroke: col("bg"), "stroke-width": 1, opacity: 0 }, svg);
    });
    const colLab = D.text(svg, CX + CW / 2, CT - 14, "100%", { mono: true, size: 15, color: "text", anchor: "middle" });
    const divLab = D.text(svg, CX + CW / 2, CT + CHT + 28, `each ÷ ${SUM.toFixed(2)}`, { mono: true, size: 14, color: "muted", anchor: "middle" });

    /* fanned-out probabilities */
    const PX = 1170, PW = 300;
    const prow = PROB.map((p, i) => {
      const y = 230 + i * 74;
      const t = D.tokenText(svg, PX, y, EX[i][0], { size: 19, anchor: "start", color: i === 0 ? "text" : "text-2" });
      const bg = el("rect", { x: PX, y: y + 12, width: PW, height: 14, rx: 2, fill: col("line") }, svg);
      const b = el("rect", { x: PX, y: y + 12, width: 0, height: 14, rx: 2, fill: col("logit"), opacity: i === 0 ? 1 : .6 }, svg);
      const pc = D.text(svg, PX + PW, y, (p * 100).toFixed(1) + "%", { mono: true, size: 15, color: i === 0 ? "logit" : "muted", anchor: "end" });
      return { t, bg, b, pc, p };
    });
    const probLab = D.label(svg, PX, 190, "Probabilities");
    const sum1 = D.text(svg, PX + PW, 230 + 5 * 74 - 12, `sum = ${(PROB.reduce((a, b) => a + b, 0)).toFixed(3)}`, { mono: true, size: 14, color: "text-2", anchor: "end" });

    /* whole vocabulary: long flat tail */
    const VN = 340, VX = 140, VW = 4, VY = 830, VH = 110;
    const vz = vocabLogits(VN);
    EX.forEach((e, i) => (vz[[1, 2, 6, 3, 4][i]] = e[1]));
    const vmax = Math.max(...vz), vexp = vz.map(v => Math.exp(v - vmax));
    const vbars = el("path", { d: barPath(VX, VW, VY, vexp.map(v => Math.max(1, v * VH))), fill: col("logit"), opacity: .8 }, svg);
    const vbase = el("line", { x1: VX, y1: VY, x2: VX + VN * VW, y2: VY, stroke: col("line-2") }, svg);
    const vLab = D.text(svg, VX + VN * VW, VY - 40, "all 248,320 probabilities · almost all ≈ 0 · illustrative", { mono: true, size: 14, color: "logit", anchor: "end" });
    const tailLab = D.text(svg, VX + 700, VY - 12, "long flat tail ≈ 0", { mono: true, size: 14, color: "muted", anchor: "middle" });
    const vClip = el("clipPath", { id: "smx-clip" }, svg.querySelector("defs"));
    const vClipR = el("rect", { x: VX, y: VY - VH - 10, width: 0, height: VH + 20 }, vClip);
    vbars.setAttribute("clip-path", "url(#smx-clip)");

    ups.push(t => {
      D.fade(head, ctx.p(t, "logits", 0, .15));
      D.fade(axis, ctx.p(t, "logits", 0, .2));
      const e = ctx.p(t, "exp", .2, .8, LX.ease.inOut);
      D.fade(ticks, ctx.p(t, "logits", .05, .25) * (1 - ctx.p(t, "exp", .1, .3)));
      D.fade(zeroLab, ctx.p(t, "logits", .05, .25));
      bars.forEach((b, i) => {
        const g = ctx.p(t, "logits", .1 + i * .1, .4 + i * .1);
        const hLog = b.z * S1 * g, hExp = EXP[i] * S2;
        let h = LX.lerp(hLog, hExp, e);
        /* in the norm cue, bars slide into the stacked column */
        const n = ctx.p(t, "norm", .05, .45, LX.ease.inOut);
        b.r.setAttribute("opacity", (i === 0 ? 1 : .65) * (1 - .7 * n));
        b.r.setAttribute("y", Y0 - Math.max(h, 0)); b.r.setAttribute("height", Math.abs(h));
        b.v1.setAttribute("y", Y0 - h - 10); b.v2.setAttribute("y", Y0 - h - 10);
        D.fade(b.v1, g * (1 - clamp(e * 2)) * (1 - n));
        D.fade(b.v2, clamp(e * 2 - 1) * (1 - .55 * n));
        D.fade(b.tt, g * (1 - .6 * n));
      });
      D.fade(inset, ctx.p(t, "exp", 0, .15) * (1 - .6 * ctx.p(t, "norm", .1, .3)));
      curve.setAttribute("stroke-dashoffset", CL * (1 - ctx.p(t, "exp", .05, .35)));
      dots.forEach((dd, i) => D.fade(dd, ctx.p(t, "exp", .3 + i * .06, .45 + i * .06)));
      D.fade(sumLab, ctx.p(t, "exp", .75, .95) * (1 - ctx.p(t, "norm", .05, .25)));

      const st = ctx.p(t, "norm", .2, .5);
      D.fade(colFrame, st);
      segs.forEach((s, i) => D.fade(s, ctx.p(t, "norm", .2 + i * .05, .4 + i * .05)));
      D.fade(colLab, ctx.p(t, "norm", .45, .55));
      D.fade(divLab, ctx.p(t, "norm", .3, .45));
      D.fade(probLab, ctx.p(t, "norm", .5, .6));
      prow.forEach((r, i) => {
        const q = ctx.p(t, "norm", .55 + i * .06, .8 + i * .04);
        [r.t, r.bg, r.pc].forEach(x => D.fade(x, q));
        r.b.setAttribute("width", PW * r.p / PROB[0] * q);
      });
      D.fade(sum1, ctx.p(t, "norm", .85, .95));

      const v = ctx.p(t, "vocab", .1, .7, LX.ease.inOut);
      vClipR.setAttribute("width", VN * VW * v);
      D.fade(vbase, ctx.p(t, "vocab", 0, .1));
      D.fade(vLab, ctx.p(t, "vocab", .6, .8));
      D.fade(tailLab, ctx.p(t, "vocab", .7, .9));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ============================================================ chapter */
  LX.chapter({
  id: "output", num: 11, title: "From a vector to probabilities", toc: "Logits & softmax",
  kicker: "The output head",
  lede: "After 64 layers, the last token's vector holds the model's whole verdict. One final normalisation and one huge matrix turn it into a score for each of the 248,320 tokens. Softmax then turns those scores into probabilities.",
  body: [
    { prose: `
      <p>At the top of the stack, every token position has a 5,120-number vector that has been refined by all 64 layers. To predict the <em>next</em> token we only need one of them: the vector at the <strong>last position</strong>. It has, through the token mixers, gathered whatever it needed from every earlier token.</p>
      <p>Two steps remain: <strong>score</strong> every possible token, then turn the scores into <strong>probabilities</strong>.</p>` },

    { scene: {
      id: "lm-head", title: "One vector in, 248,320 scores out",
      build: buildLmHead,
      visual: "The top of the layer stack, with five token columns. Only the last column (' the') stays lit. Its vector passes through a small grey RMSNorm box, then into a very wide pink matrix (lm_head, drawn as a long horizontal slab). Out of it comes a long horizontal strip of 248,320 thin bars, too dense to see individually, like a barcode. The camera then zooms into the tallest few bars, which are labelled ' mat', ' floor', ' couch', ' bed', ' roof'.",
      cues: [
        { id: "last",   say: "After the last layer, every position has a vector. But to predict what comes after the word the, only the last position matters. Its vector has already gathered what it needs from all the earlier tokens.", vis: "Four columns dim; the last one glows teal." },
        { id: "norm",   say: "It goes through one final RMSNorm, the root mean square normalisation, so its overall size is under control.", vis: "Vector passes through the grey Final norm box (÷ rms, computed); the rescaled vector [5120] appears to its right." },
        { id: "head",   say: "Then comes the output head. It is a matrix with one row for every token in the vocabulary, two hundred and forty-eight thousand three hundred and twenty rows, each five thousand one hundred and twenty numbers long.", vis: "Wide pink slab labelled lm_head [248320 × 5120]." },
        { id: "scores", say: "Each row takes a dot product with the vector. The result is one score per token. These raw scores are called logits. A high logit means this token fits well here.", vis: "A teal band sweeps across the rows of lm_head while a barcode of logits grows beneath it (one bar per ~760 tokens, illustrative); label: logits [248,320]." },
        { id: "zoom",   say: "Zoom in on the highest scores. Mat, floor, couch, bed. Almost all of the other two hundred and forty-eight thousand tokens score far lower.", vis: "A dashed box marks the peaks at the low-ID end of the barcode; a zoom panel shows mat 4.1, floor 3.3, couch 2.6, bed 1.9, roof 0.5 with their real IDs (5344, 6220, 25313, 4690, 14693)." },
      ],
    } },

    { prose: `
      <h3>Logits: raw scores</h3>
      <p>A <strong>logit</strong> is just a number, positive or negative, with no fixed range. Only the differences between logits matter. A token whose logit is 2 higher than another's will end up about 7.4 times more likely (e<sup>2</sup> ≈ 7.4).</p>
      <p>The output matrix, <code>lm_head</code>, has 248,320 × 5,120 = 1,271,398,400 parameters. Each row can be seen as a "direction" for one token: the more the final vector points that way, the higher that token scores. In Qwen3.8-27B this matrix is <em>not</em> shared with the embedding table at the input (<a href="#embeddings">Chapter 5</a>). The model learned separate tables for reading and for writing.</p>

      <h3>Softmax: from scores to probabilities</h3>
      <p>Probabilities must be positive and add up to 1. <strong>Softmax</strong> gets there in two moves:</p>
      <ol>
        <li><strong>Exponentiate</strong> each logit: <i>e</i><sup>logit</sup>. Every result is positive, and bigger logits grow much faster. That makes the leaders pull away.</li>
        <li><strong>Normalise</strong>: divide each by the sum of all of them. Now they add up to exactly 1.</li>
      </ol>` },

    { scene: {
      id: "softmax", title: "Softmax squeezes scores into probabilities",
      build: buildSoftmax,
      visual: "Five vertical bars on a number line that includes negative values (logits 4.1, 3.3, 2.6, 1.9, 0.5). Step 1: each bar morphs through an e^x curve shown at the side, so the tallest grows dramatically and the small ones shrink. Step 2: the five bars are stacked into one 100% column, then laid out again as percentages: 55.2%, 24.8%, 12.3%, 6.1%, 1.5%.",
      cues: [
        { id: "logits", say: "Here are five logits. Mat at four point one, floor at three point three, down to roof at zero point five. They are scores, not yet probabilities.", vis: "Five pink bars with values; axis shows 0 line." },
        { id: "exp",    say: "Step one. Raise e to the power of each score. Everything becomes positive, and the gaps widen. The leader pulls ahead.", vis: "A y = eˣ curve draws in an inset with the five logits marked on it; bars morph to 60.3, 27.1, 13.5, 6.7, 1.6 (computed); sum = 109.25." },
        { id: "norm",   say: "Step two. Divide each by the total, so they add up to one. Now we have probabilities. Mat fifty-five percent, floor twenty-five, couch twelve, bed six, roof under two.", vis: "The exp bars dim; their shares stack into one 100% column (each ÷ 109.25), then fan out as bars: 55.2%, 24.8%, 12.3%, 6.1%, 1.5%; sum = 1.000." },
        { id: "vocab",  say: "In the real model this happens across all two hundred and forty-eight thousand tokens at once. Most of them end up with probabilities so tiny they will practically never be chosen.", vis: "A full-width probability barcode grows along the bottom: a few spikes at the start, then a long flat tail labelled ≈ 0 (illustrative)." },
      ],
    } },

    { prose: `
      <p>The result is the model's complete answer to "what comes next?": a probability for every token. How one token is actually <em>picked</em> from this list, and how temperature changes the list first, is the subject of the next chapter (<a href="#sampling">Chapter 12</a>).</p>

      <h3>Only the last position, but all positions were computed</h3>
      <p>When the model reads a prompt of, say, 2,000 tokens, all 2,000 positions travel through all 64 layers. Their intermediate results are needed, because later tokens attend to them and they fill the cache. But only the last position goes through <code>lm_head</code>, because only its prediction is used. (During <em>training</em>, every position's prediction is scored at once, which is what makes training on long texts efficient.)</p>
      <p>Scoring the whole vocabulary is not cheap. The output head costs 1.27 billion multiply-adds for every token the model writes, nearly as much as five of the big MLP blocks (267 million each). That is one reason vocabularies don't grow without limit.</p>` },

    { deep: `
      <h3>The formulas</h3>
      <p>With final hidden state <b>h</b> ∈ ℝ<sup>5120</sup> at the last position and output matrix <i>W</i><sub>out</sub> ∈ ℝ<sup>248320×5120</sup>:</p>
      <math display="block"><mrow><mi mathvariant="bold">z</mi><mo>=</mo><msub><mi>W</mi><mtext>out</mtext></msub><mspace width="0.2em"/><mtext>RMSNorm</mtext><mo>(</mo><mi mathvariant="bold">h</mi><mo>)</mo><mo>,</mo><mspace width="1.2em"/><msub><mi>p</mi><mi>i</mi></msub><mo>=</mo><mtext>softmax</mtext><msub><mrow><mo>(</mo><mi mathvariant="bold">z</mi><mo>)</mo></mrow><mi>i</mi></msub><mo>=</mo><mfrac><msup><mi>e</mi><msub><mi>z</mi><mi>i</mi></msub></msup><mrow><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow><mn>248320</mn></munderover><msup><mi>e</mi><msub><mi>z</mi><mi>j</mi></msub></msup></mrow></mfrac></mrow></math>
      <div class="lx-read">h is the last token's 5,120-number vector after all 64 layers. Normalise it, then multiply by the output matrix W<sub>out</sub> to get z: 248,320 scores (logits), one per vocabulary token. To turn score i into a probability p<sub>i</sub>: raise e to the power z<sub>i</sub>, and divide by the sum of e to the power of <b>every</b> score, all 248,320 of them. The probabilities are all positive and add up to 1.</div>

      <h3>Worked example</h3>
      <p>Pretend the vocabulary has only five tokens:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Token</th><th class="num">Logit <i>z</i></th><th class="num"><i>z</i> − max</th><th class="num"><i>e</i><sup><i>z</i> − max</sup></th><th class="num">Probability</th><th class="num">log-prob</th></tr>
        <tr><td>·mat</td><td class="num">4.1</td><td class="num">0.0</td><td class="num">1.0000</td><td class="num">0.5523</td><td class="num">−0.594</td></tr>
        <tr><td>·floor</td><td class="num">3.3</td><td class="num">−0.8</td><td class="num">0.4493</td><td class="num">0.2482</td><td class="num">−1.394</td></tr>
        <tr><td>·couch</td><td class="num">2.6</td><td class="num">−1.5</td><td class="num">0.2231</td><td class="num">0.1232</td><td class="num">−2.094</td></tr>
        <tr><td>·bed</td><td class="num">1.9</td><td class="num">−2.2</td><td class="num">0.1108</td><td class="num">0.0612</td><td class="num">−2.794</td></tr>
        <tr><td>·roof</td><td class="num">0.5</td><td class="num">−3.6</td><td class="num">0.0273</td><td class="num">0.0151</td><td class="num">−4.194</td></tr>
        <tr class="sum"><td>Sum</td><td></td><td></td><td class="num">1.8106</td><td class="num">1.0000</td><td></td></tr>
      </table></div>

      <h3>Numerical stability</h3>
      <p>Real logits can be large, and <i>e</i><sup>100</sup> overflows ordinary floating-point numbers. Softmax does not change if you subtract the same constant from every logit, because the factor <i>e</i><sup>−c</sup> cancels between top and bottom. So implementations always subtract the maximum logit first (third column). The largest exponent is then <i>e</i><sup>0</sup> = 1, and nothing can overflow.</p>

      <h3>Log-probabilities</h3>
      <p>Probabilities of long texts become astronomically small (a product of thousands of numbers below 1), so software works with their natural logarithms. These <strong>log-probs</strong> are always ≤ 0, and they add instead of multiply. The log-prob of a token is simply its logit minus the log of the sum: log <i>p</i><sub><i>i</i></sub> = <i>z</i><sub><i>i</i></sub> − log Σ<sub><i>j</i></sub> <i>e</i><sup><i>z</i><sub><i>j</i></sub></sup>. In the table, that is <i>z</i> − 4.1 − ln 1.8106 = <i>z</i> − 4.694. The training loss from <a href="#big-picture">Chapter 1</a> is exactly the negative log-prob of the correct token: here 0.594 if the answer was "mat".</p>` },
  ],
});
})();
