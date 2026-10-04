/* Chapter 07 — Full attention */
(function () {
  "use strict";
  const D = LX.draw, E = LX.ease, clamp = LX.clamp;
  const seg = (x, a, b) => clamp((x - a) / (b - a));
  const bump = x => Math.sin(Math.PI * clamp(x));
  /** number with a real minus sign */
  const fmt = (v, d = 2) => (v < -0.0005 ? "−" : "") + Math.abs(v).toFixed(d);
  const softmax = xs => { const m = Math.max(...xs), e = xs.map(x => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0); return e.map(x => x / s); };
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  /** frame (rounded outline) around a horizontal vector */
  function frame(parent, x, y, w, h, color, o = {}) {
    return LX.el("rect", { x, y, width: w, height: h, rx: o.rx ?? 7, fill: o.fill ?? "none", stroke: LX.col(color), "stroke-width": o.sw ?? 1.5, opacity: o.opacity ?? 1 }, parent);
  }
  /** horizontal vector centred on cx, with a coloured frame. */
  function framedVec(parent, cx, cy, values, color, cell = 20, gap = 4) {
    const g = LX.el("g", {}, parent);
    const w = values.length * (cell + gap) - gap;
    const fr = frame(g, cx - w / 2 - 8, cy - cell / 2 - 8, w + 16, cell + 16, color);
    const v = D.vector(g, { x: cx - w / 2, y: cy, values, cell, gap, dir: "h", outline: false });
    return { g, fr, v, w: w + 16, left: cx - w / 2 - 8, right: cx + w / 2 + 8 };
  }

  /* ============================================================ attn-qkv */
  function buildQKV(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    const R = LX.rng(61);
    const rv = n => Array.from({ length: n }, () => (R() * 2 - 1) * (.3 + R() * .7));
    const TOK = ["The", " cat", " sat", " on", " the", " mat"];
    const CX = i => 350 + i * 180;
    D.label(svg, 80, 64, "Attention · how one token finds another");
    const mark = svg.childNodes.length;                     // everything after this moves down 60 px

    const chips = TOK.map((t, i) => D.tokenChip(svg, { x: CX(i) - 75, y: 96, w: 150, h: 56, text: t }));
    const arc = D.arrow(svg, { d: "M700 92 C 680 30, 560 30, 540 90", color: "attn", width: 2 });
    const who = D.text(svg, 620, 30, "who sat?", { mono: true, size: 16, color: "attn", anchor: "middle" });
    const future = D.text(svg, CX(4), 186, "later tokens · not visible to ·sat", { mono: true, size: 14, color: "dim", anchor: "middle" });

    /* sat's own vector and the three projections */
    const HV = rv(8);
    const link = D.arrow(svg, { x1: 710, y1: 156, x2: 710, y2: 196, color: "embed", width: 1.5, head: false });
    const hvec = D.vector(svg, { x: 710 - 94, y: 212, values: HV, cell: 20, gap: 4, dir: "h" });
    const hLab = D.text(svg, 710, 248, "·sat · vector [5120]", { mono: true, size: 14, color: "embed", anchor: "middle" });
    const ROLE = [
      { k: "Q", name: "query", desc: "what am I looking for?", color: LX.col("attn"), y: 330 },
      { k: "K", name: "key", desc: "what do I have to offer?", color: LX.mix("attn", "text", .45), y: 430 },
      { k: "V", name: "value", desc: "what I hand over if chosen", color: LX.col("embed"), y: 530 },
    ];
    const qkvLab = D.text(svg, 1010, 290, "QKV · query, key, value", { mono: true, size: 14, color: "muted" });
    const parts = ROLE.map((r, i) => {
      const a = D.arrow(svg, { d: `M812 212 C 900 212, 900 ${r.y}, 984 ${r.y}`, color: r.color, width: 1.5 });
      const wl = D.text(svg, 864, i === 0 ? 262 : i === 1 ? 352 : 440, "W" + "qkv"[i], { mono: true, size: 17, color: "text-2", anchor: "end" });
      const fv = framedVec(svg, 1080, r.y, rv(6), r.color);
      fv.fr.setAttribute("stroke", r.color);
      const letter = D.text(svg, 1170, r.y + 8, r.k, { size: 24, weight: 650, color: r.color });
      // icon + caption
      const ig = LX.el("g", {}, svg), ix = 1222, iy = r.y;
      if (i === 0) {
        LX.el("circle", { cx: ix, cy: iy, r: 15, fill: "none", stroke: r.color, "stroke-width": 2 }, ig);
        D.text(ig, ix, iy + 7, "?", { size: 19, weight: 700, anchor: "middle", color: r.color });
      } else if (i === 1) {
        LX.el("path", { d: `M${ix - 16} ${iy - 10} H${ix + 6} L${ix + 16} ${iy} L${ix + 6} ${iy + 10} H${ix - 16} Z`, fill: "none", stroke: r.color, "stroke-width": 2, "stroke-linejoin": "round" }, ig);
        LX.el("circle", { cx: ix + 5, cy: iy, r: 3, fill: r.color }, ig);
      } else {
        LX.el("rect", { x: ix - 14, y: iy - 14, width: 28, height: 28, rx: 3, fill: "none", stroke: r.color, "stroke-width": 2 }, ig);
        LX.el("path", { d: `M${ix} ${iy - 14} V${iy + 14} M${ix - 14} ${iy} H${ix + 14}`, stroke: r.color, "stroke-width": 1.5 }, ig);
      }
      D.text(ig, ix + 30, iy - 3, r.name, { size: 17, weight: 600, color: "text" });
      D.text(ig, ix + 30, iy + 19, r.desc, { size: 15, color: "text-2" });
      return { a, wl, fv, letter, ig };
    });

    /* keys of the visible tokens, and the probing query */
    const VIS = [0, 1, 2];
    const QT = [1.5, 1.0];                                   // toy 2-D query of ·sat
    const KT = [[0.1, -0.2], [1.2, 0.9], [0.4, 0.3]];        // toy keys of The, cat, sat
    const scores = KT.map(k => dot(QT, k));
    const weights = softmax(scores);
    const keyLab = D.text(svg, 262, 336, "keys", { mono: true, size: 14, color: "muted", anchor: "end" });
    const scLab = D.text(svg, 262, 386, "scores", { mono: true, size: 14, color: "muted", anchor: "end" });
    const keys = VIS.map(i => framedVec(svg, CX(i), 330, rv(5), ROLE[1].color));
    keys.forEach(k => k.fr.setAttribute("stroke", ROLE[1].color));
    const scoreT = VIS.map((i, j) => D.text(svg, CX(i), 386, "q · k = " + fmt(scores[j]), { mono: true, size: 16, anchor: "middle", color: j === 1 ? "attn" : "text-2", weight: j === 1 ? 600 : 400 }));
    const probe = frame(svg, 0, 0, 156, 36, "attn", { sw: 2.5 });
    probe.setAttribute("filter", "url(#lx-glow)");

    /* values, flows, output */
    const valLab = D.text(svg, 262, 456, "values", { mono: true, size: 14, color: "muted", anchor: "end" });
    const VV = VIS.map(() => rv(5));
    const vals = VIS.map((i, j) => framedVec(svg, CX(i), 450, VV[j], "embed"));
    const OUT = VV[0].map((_, c) => VV.reduce((s, v, j) => s + weights[j] * v[c], 0));
    const flows = VIS.map((i, j) => {
      const a = D.arrow(svg, { d: `M${CX(i)} 470 C ${CX(i)} 560, 710 520, 710 600`, color: "attn", width: Math.max(1.5, weights[j] * 12), head: j === 2 });
      a.path.setAttribute("stroke-opacity", .35 + weights[j] * .65);
      const wt = D.text(svg, CX(i) + 22, 500, Math.round(weights[j] * 100) + "%", { mono: true, size: 16, weight: 600, color: j === 1 ? "attn" : "text-2" });
      return { a, wt };
    });
    const outV = framedVec(svg, 710, 640, OUT.map(v => v * 1.6), "attn");
    const outLab = D.text(svg, 710, 690, "blend for ·sat = Σ weight × value", { mono: true, size: 14, color: "attn", anchor: "middle" });
    const shiftLab = D.text(svg, 604, 218, "now carries a little of ·cat →", { mono: true, size: 14, color: "attn", anchor: "end" });
    const HV2 = HV.map((v, c) => v * .55 + (OUT[c % OUT.length]) * .9);

    ups.push(t => {
      // need
      chips.forEach((c, i) => c.show(ctx.p(t, "need", .02 + i * .05, .25 + i * .05)));
      chips[2].glow(ctx.p(t, "need", .35, .45) > .5 && t < ctx.cue("three").start);
      arc.draw(ctx.p(t, "need", .45, .8));
      D.fade(arc.g, t < ctx.cue("three").start ? 1 : .45);
      D.fade(who, ctx.p(t, "need", .7, .9) * (t < ctx.cue("three").start ? 1 : .45));
      // three
      link.draw(ctx.p(t, "three", 0, .15));
      hvec.reveal(ctx.p(t, "three", .05, .3, E.linear));
      D.fade(hLab, ctx.p(t, "three", .15, .3));
      parts.forEach((pt, i) => {
        pt.a.draw(ctx.p(t, "three", .3 + i * .08, .55 + i * .08));
        D.fade(pt.wl, ctx.p(t, "three", .4 + i * .08, .6 + i * .08));
        D.fade(pt.fv.g, ctx.p(t, "three", .55 + i * .08, .72 + i * .08));
        D.fade(pt.letter, ctx.p(t, "three", .6 + i * .08, .75 + i * .08));
      });
      D.fade(qkvLab, ctx.p(t, "three", .75, .95));
      // match
      const m = ctx.p(t, "match", 0, .15);
      chips.forEach((c, i) => { if (i > 2) D.fade(c.g, 1 - .6 * m); });
      D.fade(future, m);
      D.fade(keyLab, m); D.fade(scLab, ctx.p(t, "match", .3, .4));
      const fadeKeys = 1 - .55 * ctx.p(t, "mix", 0, .15);
      keys.forEach((k, j) => D.fade(k.g, ctx.p(t, "match", .05 + j * .05, .2 + j * .05) * fadeKeys));
      // probe: from the Q vector to sat's, cat's and The's key
      const stops = [[1080, 330], [CX(2), 330], [CX(1), 330], [CX(0), 330]];
      const legs = [[.18, .32], [.42, .54], [.64, .76]];
      let px = stops[0][0];
      legs.forEach(([a, b], k) => { const q = E.inOut(seg(ctx.p(t, "match", 0, 1, E.linear), a, b)); if (q > 0) px = LX.lerp(stops[k][0], stops[k + 1][0], q); });
      LX.attr(probe, { x: px - 78, y: 312 });
      D.fade(probe, ctx.p(t, "match", .16, .2) * (1 - ctx.p(t, "match", .86, .95)));
      [2, 1, 0].forEach((j, k) => D.fade(scoreT[j], ctx.p(t, "match", legs[k][1] - .02, legs[k][1] + .06)));
      const best = ctx.p(t, "match", .8, .9);
      chips[1].glow(best > .5 && t < ctx.cue("mix").end);
      keys[1].fr.setAttribute("filter", best > .5 ? "url(#lx-glow)" : "none");
      // mix
      D.fade(valLab, ctx.p(t, "mix", 0, .15));
      vals.forEach((v, j) => D.fade(v.g, ctx.p(t, "mix", .02 + j * .05, .18 + j * .05)));
      flows.forEach((f, j) => { f.a.draw(ctx.p(t, "mix", .2 + j * .05, .5 + j * .05)); D.fade(f.wt, ctx.p(t, "mix", .45, .6)); });
      D.fade(outV.g, ctx.p(t, "mix", .55, .7));
      outV.v.reveal(ctx.p(t, "mix", .55, .75, E.linear));
      D.fade(outLab, ctx.p(t, "mix", .62, .75));
      const sh = ctx.p(t, "mix", .78, .95);
      hvec.setValues(HV.map((v, c) => LX.lerp(v, HV2[c], sh)));
      D.fade(shiftLab, sh);
      const cdim = 1 - .6 * ctx.p(t, "mix", 0, .2);
      parts.forEach((pt, i) => D.fade(pt.ig, ctx.p(t, "roles", .05 + i * .3, .3 + i * .3) * cdim));
    });
    const shiftG = LX.el("g", { transform: "translate(0 60)" });
    while (svg.childNodes.length > mark) shiftG.appendChild(svg.childNodes[mark]);
    svg.appendChild(shiftG);
    return t => ups.forEach(u => u(t));
  }

  /* ========================================================= attn-scores */
  // The same numbers as the worked example in the Deeper box: head size d = 2.
  const SC = {
    tok: ["The", " big", " cat", " sat"],
    q: [[1, 0], [0, 1.5], [1.5, 0.5], [2, 1]],
    k: [[1, 0], [0, 1], [1, 1], [0.5, 0.5]],
    v: [[1, 0], [0, 1], [2, 2], [1, 1]],
  };
  SC.raw = SC.q.map(q => SC.k.map(k => dot(q, k) / Math.sqrt(2)));
  SC.w = SC.raw.map((row, r) => { const s = softmax(row.slice(0, r + 1)); return row.map((_, c) => (c <= r ? s[c] : 0)); });
  SC.out = [0, 1].map(d => SC.w[3].reduce((s, w, j) => s + w * SC.v[j][d], 0));

  function buildScores(ctx) {
    const { svg } = ctx, ups = [];
    const defs = D.backdrop(svg);
    const pat = LX.el("pattern", { id: "attn-hatch", width: 10, height: 10, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    LX.el("rect", { width: 10, height: 10, fill: LX.col("bg") }, pat);
    LX.el("line", { x1: 0, y1: 0, x2: 0, y2: 10, stroke: LX.col("line-2"), "stroke-width": 3 }, pat);

    D.label(svg, 80, 64, "Scores for one head · toy vectors with d = 2 (the Deeper example)");
    const N = 4, CELL = 112, GAP = 6, X0 = 300, Y0 = 200, ST = CELL + GAP;
    const cx = c => X0 + c * ST + CELL / 2, cy = r => Y0 + r * ST + CELL / 2;
    const headK = D.text(svg, X0, Y0 - 52, "keys · the tokens being looked at →", { mono: true, size: 14, color: "muted" });
    const headQ = D.text(svg, X0 - 18, Y0 - 52, "queries ↓", { mono: true, size: 14, color: "muted", anchor: "end" });
    const colL = SC.tok.map((tk, c) => D.tokenText(svg, cx(c), Y0 - 16, tk, { size: 19 }));
    const rowL = SC.tok.map((tk, r) => D.tokenText(svg, X0 - 18, cy(r) + 7, tk, { size: 19, anchor: "end" }));
    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const g = LX.el("g", {}, svg);
      const bg = LX.el("rect", { x: X0 + c * ST, y: Y0 + r * ST, width: CELL, height: CELL, rx: 6, fill: LX.col("panel"), stroke: LX.col("line-2"), "stroke-width": 1 }, g);
      const hatch = LX.el("rect", { x: X0 + c * ST, y: Y0 + r * ST, width: CELL, height: CELL, rx: 6, fill: "url(#attn-hatch)", opacity: 0 }, g);
      const raw = D.text(g, cx(c), cy(r) + 8, fmt(SC.raw[r][c], 3), { mono: true, size: 22, anchor: "middle", color: "text" });
      const wt = D.text(g, cx(c), cy(r) + 8, fmt(SC.w[r][c], 3), { mono: true, size: 22, anchor: "middle", color: "text", weight: 600, opacity: 0 });
      cells.push({ r, c, g, bg, hatch, raw, wt, masked: c > r });
    }
    const badge = D.text(svg, X0 + (N * ST - GAP) / 2, Y0 + N * ST + 34, "q · k ÷ √d  ·  here √2 (toy, d = 2)  ·  in Qwen3.8 √256 = 16", { mono: true, size: 15, color: "attn", anchor: "middle" });
    const maskLab = D.text(svg, X0 + (N * ST - GAP) / 2, Y0 + N * ST + 64, "above the diagonal = the future → −∞ → weight 0", { mono: true, size: 15, color: "muted", anchor: "middle" });
    const sums = SC.w.map((row, r) => D.text(svg, X0 + N * ST + 6, cy(r) + 7, "Σ = " + row.reduce((a, b) => a + b, 0).toFixed(3), { mono: true, size: 15, color: "logit" }));
    const rowHi = frame(svg, X0 - 6, Y0 + 3 * ST - 6, N * ST - GAP + 12, CELL + 12, "attn", { sw: 2.5, rx: 9 });
    rowHi.setAttribute("filter", "url(#lx-glow)");

    /* blend panel */
    const PX = 900;
    const pLab = D.label(svg, PX, Y0 - 52, "Row ·sat · blend the values");
    const RY = j => Y0 + 40 + j * 86;
    const lines = SC.tok.map((tk, j) => {
      const g = LX.el("g", {}, svg);
      D.tokenText(g, PX, RY(j) + 7, tk, { size: 16, anchor: "start", color: "muted" });
      D.text(g, 1036, RY(j) + 7, "×", { size: 20, color: "muted", anchor: "middle" });
      const vv = D.vector(g, { x: 1060, y: RY(j), values: SC.v[j].map(x => x / 2), cell: 26, gap: 5, dir: "h" });
      D.text(g, 1132, RY(j) + 7, `(${SC.v[j].join(", ")})`, { mono: true, size: 17, color: "text-2" });
      D.text(g, 1232, RY(j) + 7, "=", { size: 20, color: "muted", anchor: "middle" });
      const prod = SC.v[j].map(x => x * SC.w[3][j]);
      D.text(g, 1256, RY(j) + 7, `(${fmt(prod[0], 3)}, ${fmt(prod[1], 3)})`, { mono: true, size: 17, color: "text" });
      return { g, vv };
    });
    const flyW = SC.w[3].map((w, j) => D.text(svg, 0, 0, fmt(w, 3), { mono: true, size: 20, weight: 600, anchor: "middle", color: "attn" }));
    const sumG = LX.el("g", {}, svg);
    LX.el("line", { x1: PX, y1: RY(4) - 40, x2: 1500, y2: RY(4) - 40, stroke: LX.col("line-2"), "stroke-width": 1.5 }, sumG);
    D.text(sumG, PX, RY(4) + 7, "output for ·sat", { size: 17, weight: 600, color: "attn" });
    const outVec = D.vector(sumG, { x: 1060, y: RY(4), values: SC.out.map(x => x / 2), cell: 26, gap: 5, dir: "h" });
    D.text(sumG, 1256, RY(4) + 7, `(${fmt(SC.out[0], 3)}, ${fmt(SC.out[1], 3)})`, { mono: true, size: 19, weight: 600, color: "attn" });
    D.text(sumG, PX, RY(4) + 44, "the biggest share comes from ·cat (weight " + fmt(SC.w[3][2], 3) + ")", { mono: true, size: 14, color: "muted" });

    ups.push(t => {
      // grid
      cells.forEach((cl, k) => {
        D.fade(cl.bg, ctx.p(t, "grid", .05 + k * .02, .3 + k * .02));
        D.fade(cl.raw, ctx.p(t, "raw", .05 + k * .04, .15 + k * .04) * (1 - (cl.masked ? 0 : ctx.p(t, "soft", .05 + cl.r * .2, .22 + cl.r * .2))));
      });
      D.fade(headK, ctx.p(t, "grid", .3, .5)); D.fade(headQ, ctx.p(t, "grid", .3, .5));
      colL.forEach((l, c) => D.fade(l, ctx.p(t, "grid", .35 + c * .08, .55 + c * .08)));
      rowL.forEach((l, r) => D.fade(l, ctx.p(t, "grid", .5 + r * .08, .7 + r * .08)));
      const bq = ctx.p(t, "raw", .72, .85);
      D.fade(badge, bq);
      badge.setAttribute("filter", bump(ctx.p(t, "raw", .75, 1, E.linear)) > .3 ? "url(#lx-glow)" : "none");
      // mask
      let mk = 0;
      cells.forEach(cl => {
        if (!cl.masked) return;
        const q = ctx.p(t, "mask", .1 + mk * .07, .3 + mk * .07); mk++;
        D.fade(cl.hatch, q);
        cl.raw.textContent = q > .5 ? "−∞" : fmt(SC.raw[cl.r][cl.c], 3);
        cl.raw.setAttribute("fill", LX.col(q > .5 ? "dim" : "text"));
      });
      D.fade(maskLab, ctx.p(t, "mask", .6, .8));
      // softmax row by row
      cells.forEach(cl => {
        if (cl.masked) return;
        const q = ctx.p(t, "soft", .05 + cl.r * .2, .22 + cl.r * .2);
        cl.bg.setAttribute("fill", LX.mix("panel", "attn", q * (.1 + .8 * SC.w[cl.r][cl.c])));
        D.fade(cl.wt, q);
      });
      sums.forEach((s, r) => D.fade(s, ctx.p(t, "soft", .18 + r * .2, .25 + r * .2)));
      // blend
      D.fade(rowHi, ctx.p(t, "blend", 0, .08));
      D.fade(pLab, ctx.p(t, "blend", .02, .1));
      flyW.forEach((f, j) => {
        const q = ctx.p(t, "blend", .06 + j * .05, .3 + j * .05, E.inOut);
        LX.attr(f, { x: LX.lerp(cx(j), 990, q), y: LX.lerp(cy(3) + 8, RY(j) + 7, q) });
        D.fade(f, q > 0 ? 1 : 0);
      });
      lines.forEach((l, j) => { D.fade(l.g, ctx.p(t, "blend", .3 + j * .1, .42 + j * .1)); l.vv.reveal(ctx.p(t, "blend", .3 + j * .1, .45 + j * .1, E.linear)); });
      D.fade(sumG, ctx.p(t, "blend", .75, .9));
      outVec.reveal(ctx.p(t, "blend", .78, .95, E.linear));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ============================================================ attn-gqa */
  function buildGQA(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    D.label(svg, 80, 64, "One attention layer · heads");
    const X0 = 100, TOT = 1000, BW = 34, BG = 8, BY = 240, BH = 110;
    const wide = TOT / 24;
    const qLab = D.text(svg, X0, BY - 44, "query vector · 6,144 numbers = 24 heads × 256", { mono: true, size: 15, color: "attn" });
    const bars = Array.from({ length: 24 }, (_, i) => {
      const grp = Math.floor(i / 6);
      const r = LX.el("rect", { y: BY, height: BH, rx: 3, fill: LX.mix("bg", "attn", grp % 2 ? .55 : .35), stroke: LX.col("attn"), "stroke-width": 1 }, svg);
      const lab = D.text(svg, 0, BY - 10, String(i + 1), { mono: true, size: 14, color: "muted", anchor: "middle" });
      return { r, lab, grp };
    });
    const hLab = D.text(svg, X0, BY + BH + 28, "h1 … h24 · each head: its own query of 256 numbers", { mono: true, size: 14, color: "muted" });
    const KY = 560, KH = 110, KW = 210;
    const gx = g => X0 + g * 6 * (BW + BG) + (6 * (BW + BG) - BG) / 2;
    const kv = [0, 1, 2, 3].map(g => {
      const G = LX.el("g", {}, svg), x = gx(g) - KW / 2;
      LX.el("rect", { x, y: KY, width: KW, height: KH, rx: 6, fill: LX.mix("bg", "cache", .12), stroke: LX.col("cache"), "stroke-width": 1.5 }, G);
      LX.el("line", { x1: x + KW / 2, y1: KY + 36, x2: x + KW / 2, y2: KY + KH - 10, stroke: LX.col("cache"), "stroke-opacity": .5 }, G);
      D.text(G, x + KW / 2, KY + 24, `KV head ${g + 1}`, { mono: true, size: 15, weight: 500, color: "cache", anchor: "middle" });
      D.text(G, x + KW / 4, KY + 76, "K 256", { mono: true, size: 15, color: "text-2", anchor: "middle" });
      D.text(G, x + 3 * KW / 4, KY + 76, "V 256", { mono: true, size: 15, color: "text-2", anchor: "middle" });
      return G;
    });
    const links = bars.map((b, i) => {
      const g = b.grp, bx = X0 + i * (BW + BG) + BW / 2, tx = gx(g) - 70 + (i % 6) * 28;
      const l = LX.el("path", { d: `M${bx} ${BY + BH + 40} C ${bx} ${BY + BH + 120}, ${tx} ${KY - 80}, ${tx} ${KY - 2}`, fill: "none", stroke: LX.col("attn"), "stroke-opacity": .55, "stroke-width": 1.5 }, svg);
      const L = l.getTotalLength(); l.setAttribute("stroke-dasharray", `${L} ${L}`);
      return { l, L };
    });
    const brackets = [0, 1, 2, 3].map(g => D.bracket(svg, { x1: X0 + g * 6 * (BW + BG), y1: BY + BH + 46, x2: X0 + g * 6 * (BW + BG) + 6 * (BW + BG) - BG, y2: BY + BH + 46, side: "bottom", label: "", color: "attn" }));
    const gqaLab = D.text(svg, X0, KY + KH + 50, "GQA · grouped-query attention: 6 query heads share each key/value head", { mono: true, size: 15, color: "text-2" });

    /* memory meter */
    const MX = 1180, MW = 340;
    const bytes = h => h * 256 * 2 * 2;                     // heads × dims × (K,V) × 2 bytes (bf16)
    const kib = b => b / 1024;
    const mG = LX.el("g", {}, svg);
    D.label(mG, MX, 210, "KV cache · per token, per layer");
    D.text(mG, MX, 262, "24 KV heads (no sharing)", { size: 15, color: "text-2" });
    LX.el("rect", { x: MX, y: 274, width: MW, height: 28, rx: 3, fill: LX.mix("bg", "cache", .25), stroke: LX.col("cache") }, mG);
    D.text(mG, MX + MW, 262, `${kib(bytes(24))} KiB`, { mono: true, size: 15, color: "cache", anchor: "end" });
    D.text(mG, MX, 352, "4 KV heads (GQA)", { size: 15, color: "text-2" });
    const gBar = LX.el("rect", { x: MX, y: 364, width: MW, height: 28, rx: 3, fill: LX.col("cache") }, mG);
    const gVal = D.text(mG, MX + MW, 352, "", { mono: true, size: 15, color: "cache", anchor: "end", weight: 600 });
    D.text(mG, MX, 440, `4 × 256 × 2 (K, V) × 2 bytes`, { mono: true, size: 14, color: "muted" });
    D.text(mG, MX, 464, `= ${bytes(4).toLocaleString("en-US")} bytes = ${kib(bytes(4))} KiB`, { mono: true, size: 14, color: "muted" });
    D.text(mG, MX, 500, `× 16 attention layers = ${kib(bytes(4)) * 16} KiB per token`, { mono: true, size: 14, color: "text-2" });
    const sixth = D.text(mG, MX + MW / 6 + 12, 384, "6× smaller", { mono: true, size: 14, color: "cache" });

    ups.push(t => {
      const sp = ctx.p(t, "split", .25, .7, E.inOut);
      bars.forEach((b, i) => {
        const x = LX.lerp(X0 + i * wide, X0 + i * (BW + BG), sp), w = LX.lerp(wide + .5, BW, sp);
        LX.attr(b.r, { x, width: w });
        b.r.setAttribute("opacity", ctx.p(t, "split", 0, .2));
        LX.attr(b.lab, { x: x + w / 2, opacity: ctx.p(t, "split", .6 + i * .01, .75 + i * .01) });
        b.r.setAttribute("stroke-opacity", sp);
      });
      D.fade(qLab, ctx.p(t, "split", .05, .2));
      D.fade(hLab, ctx.p(t, "split", .75, .9));
      // share
      kv.forEach((g, k) => D.fade(g, ctx.p(t, "share", .05 + k * .06, .25 + k * .06)));
      links.forEach((l, i) => l.l.setAttribute("stroke-dashoffset", l.L * (1 - ctx.p(t, "share", .25 + bars[i].grp * .08 + (i % 6) * .01, .55 + bars[i].grp * .08))));
      brackets.forEach((b, g) => b.show(ctx.p(t, "share", .3 + g * .08, .5 + g * .08)));
      D.fade(gqaLab, ctx.p(t, "share", .7, .9));
      // why
      D.fade(mG, ctx.p(t, "why", 0, .15));
      const sh = ctx.p(t, "why", .3, .7, E.inOut);
      gBar.setAttribute("width", LX.lerp(MW, MW / 6, sh));
      gVal.textContent = `${Math.round(LX.lerp(kib(bytes(24)), kib(bytes(4)), sh))} KiB`;
      D.fade(sixth, ctx.p(t, "why", .7, .85));
      kv.forEach(g => g.setAttribute("filter", bump(ctx.p(t, "why", .3, .8, E.linear)) > .4 ? "url(#lx-glow)" : "none"));
    });
    return t => ups.forEach(u => u(t));
  }

  /* =========================================================== attn-rope */
  const THETA = i => Math.pow(1e7, -2 * i / 64);           // Qwen3.8: base 10,000,000, 64 rotated dims
  const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  const sci = x => { const e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e); return `${m.toFixed(2)} × 10${String(e).split("").map(c => SUP[c]).join("")}`; };

  /** an arrow from (cx, cy) at an angle (radians, counter-clockwise) */
  function polarArrow(parent, cx, cy, color, width = 3) {
    const g = LX.el("g", {}, parent);
    const shaft = LX.el("line", { x1: cx, y1: cy, stroke: color, "stroke-width": width, "stroke-linecap": "round" }, g);
    const head = LX.el("path", { d: "M-14 -8 L0 0 L-14 8", fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    return {
      g,
      set(a, len) {
        const x = cx + len * Math.cos(a), y = cy - len * Math.sin(a);
        LX.attr(shaft, { x2: x, y2: y });
        head.setAttribute("transform", `translate(${x} ${y}) rotate(${-a * 180 / Math.PI})`);
      },
    };
  }

  function buildRope(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    D.label(svg, 80, 64, "Rotary position embedding · RoPE");

    /* order: dog bites man vs man bites dog */
    const EMB = { dog: [1, 0.2], man: [0.3, 1] }, QB = [1.1, 0.6];
    const sDog = dot(QB, EMB.dog), sMan = dot(QB, EMB.man);
    const orderG = LX.el("g", {}, svg);
    const panel = (cx, words) => {
      words.forEach((w, i) => D.tokenChip(orderG, { x: cx - 200 + i * 140, y: 100, w: 120, h: 48, text: w, size: 20 }));
      D.text(orderG, cx - 130, 196, "bites → dog", { mono: true, size: 16, color: "text-2" });
      D.text(orderG, cx + 130, 196, fmt(sDog), { mono: true, size: 16, color: "attn", anchor: "end", weight: 600 });
      D.text(orderG, cx - 130, 224, "bites → man", { mono: true, size: 16, color: "text-2" });
      D.text(orderG, cx + 130, 224, fmt(sMan), { mono: true, size: 16, color: "attn", anchor: "end", weight: 600 });
    };
    panel(420, ["dog", " bites", " man"]);
    panel(1180, ["man", " bites", " dog"]);
    D.text(orderG, 800, 218, "=", { size: 44, color: "text", anchor: "middle" });
    D.text(orderG, 800, 270, "without positions the scores are identical · who bit whom is lost", { mono: true, size: 14, color: "muted", anchor: "middle" });

    /* the plane */
    const PX = 330, PY = 505, PR = 150;
    const plane = LX.el("g", {}, svg);
    LX.el("circle", { cx: PX, cy: PY, r: PR, fill: "none", stroke: LX.col("line-2"), "stroke-width": 1.5 }, plane);
    LX.el("line", { x1: PX - PR - 20, y1: PY, x2: PX + PR + 20, y2: PY, stroke: LX.col("line-2") }, plane);
    LX.el("line", { x1: PX, y1: PY - PR - 20, x2: PX, y2: PY + PR + 20, stroke: LX.col("line-2") }, plane);
    D.text(plane, PX, PY - PR - 28, "pair 0 · two of the 64 rotated numbers", { mono: true, size: 14, color: "muted", anchor: "middle" });
    const QC = LX.col("attn"), KC = LX.mix("attn", "text", .45);
    const qArrow = polarArrow(svg, PX, PY, QC, 3.5), kArrow = polarArrow(svg, PX, PY, KC, 3);
    const PHQ = 0.4, PHK = 2.9, LQ = 1.0, LK = 0.85;     // base angles and lengths of the toy pair
    const arcP = LX.el("path", { fill: "none", stroke: LX.col("logit"), "stroke-width": 2 }, svg);
    const qTag = D.text(svg, 0, 0, "q", { size: 20, weight: 650, color: "attn", anchor: "middle" });
    const kTag = D.text(svg, 0, 0, "k", { size: 20, weight: 650, color: "attn", anchor: "middle" });

    /* readouts */
    const RX = 560;
    const rotG = LX.el("g", {}, svg);
    const rPos = D.text(rotG, RX, 420, "", { mono: true, size: 20, color: "text" });
    const rAng = D.text(rotG, RX, 456, "", { mono: true, size: 17, color: "text-2" });
    D.text(rotG, RX, 492, `θ₀ = 10,000,000^(−2·0/64) = ${THETA(0).toFixed(2)} rad per token`, { mono: true, size: 15, color: "muted" });
    const relG = LX.el("g", {}, svg);
    const lQ = D.text(relG, RX, 400, "", { mono: true, size: 18, color: "attn" });
    const lK = D.text(relG, RX, 432, "", { mono: true, size: 18, color: "text-2" });
    const lA = D.text(relG, RX, 470, "", { mono: true, size: 17, color: "text-2" });
    const lS = D.text(relG, RX, 512, "", { mono: true, size: 22, weight: 600, color: "logit" });
    const plus = D.text(relG, RX, 556, "both tokens move +10 positions → same score", { mono: true, size: 15, color: "attn" });

    /* speeds */
    const spG = LX.el("g", {}, svg);
    const DX = 116, DS = 31, DY = 752;
    D.text(spG, DX - 6, 708, "32 rotating pairs (64 numbers) · θᵢ = 10,000,000^(−2i/64) rad per token", { mono: true, size: 14, color: "text-2" });
    const mLab = D.text(spG, 1100, 708, "", { mono: true, size: 14, color: "attn", anchor: "end" });
    const dials = Array.from({ length: 32 }, (_, i) => {
      const x = DX + i * DS;
      LX.el("circle", { cx: x, cy: DY, r: 12, fill: LX.col("bg-2"), stroke: LX.col("line-2"), "stroke-width": 1.2 }, spG);
      const hand = LX.el("line", { x1: x, y1: DY, x2: x, y2: DY - 10, stroke: QC, "stroke-width": 2, "stroke-linecap": "round" }, spG);
      D.text(spG, x, DY + 32, "THW"[i % 3], { mono: true, size: 14, color: "muted", anchor: "middle" });
      return { x, hand, th: THETA(i) };
    });
    D.text(spG, DX - 6, DY + 60, `fast: θ₀ = ${THETA(0).toFixed(1)}`, { mono: true, size: 14, color: "attn" });
    D.text(spG, DX + 31 * DS + 6, DY + 60, `slow: θ₃₁ = ${sci(THETA(31))}`, { mono: true, size: 14, color: "text-2", anchor: "end" });
    D.text(spG, DX - 6, DY + 86, "T · H · W = time · height · width, interleaved (all equal for plain text)", { mono: true, size: 14, color: "muted" });
    const cG = LX.el("g", {}, spG);
    D.text(cG, 1180, 722, "192 numbers · content only, never rotated", { mono: true, size: 14, color: "muted" });
    const R = LX.rng(9);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 24; c++)
      LX.el("rect", { x: 1180 + c * 13, y: 736 + r * 13, width: 10, height: 10, rx: 2, fill: LX.valueColor((R() * 2 - 1) * .8) }, cG);

    ups.push(t => {
      // order
      D.fade(orderG, ctx.p(t, "order", 0, .2) * (t < ctx.cue("rot").start ? 1 : .4 + .6 * (1 - ctx.p(t, "rot", 0, .15))));
      // rot: one arrow, positions 0..3
      D.fade(plane, ctx.p(t, "rot", 0, .15));
      const steps = ctx.p(t, "rot", .2, .9, E.linear) * 3;
      const m = Math.floor(steps) + E.inOut(clamp((steps % 1) * 2.2));
      const mRot = Math.min(3, m);
      // rel: q at 7 (+10), k at 4 (+10)
      const toSeven = ctx.p(t, "rel", 0, .15, E.inOut);
      const shift = 10 * ctx.p(t, "rel", .45, .85, E.inOut);
      const mq = (t < ctx.cue("rel").start ? mRot : LX.lerp(3, 7, toSeven)) + shift;
      const nk = 4 + shift;
      const aq = PHQ + mq * THETA(0), ak = PHK + nk * THETA(0);
      qArrow.set(aq, PR * LQ); D.fade(qArrow.g, ctx.p(t, "rot", .1, .2));
      kArrow.set(ak, PR * LK); const kv = ctx.p(t, "rel", .1, .25); D.fade(kArrow.g, kv);
      LX.attr(qTag, { x: PX + (PR + 22) * Math.cos(aq), y: PY - (PR + 22) * Math.sin(aq) + 7 }); D.fade(qTag, ctx.p(t, "rot", .1, .2));
      LX.attr(kTag, { x: PX + (PR * LK + 22) * Math.cos(ak), y: PY - (PR * LK + 22) * Math.sin(ak) + 7 }); D.fade(kTag, kv);
      // angle arc between them
      const r0 = 46;
      let a0 = ak, a1 = aq; while (a1 < a0) a1 += 2 * Math.PI; while (a1 - a0 > Math.PI) a0 += 2 * Math.PI;
      const pA = [PX + r0 * Math.cos(a0), PY - r0 * Math.sin(a0)], pB = [PX + r0 * Math.cos(a1), PY - r0 * Math.sin(a1)];
      arcP.setAttribute("d", `M${pA[0]} ${pA[1]} A ${r0} ${r0} 0 0 ${a1 > a0 ? 0 : 1} ${pB[0]} ${pB[1]}`);
      D.fade(arcP, ctx.p(t, "rel", .25, .35));
      // readouts
      D.fade(rotG, ctx.p(t, "rot", .15, .3) * (1 - ctx.p(t, "rel", 0, .1)));
      rPos.textContent = `position m = ${mRot.toFixed(1)}`;
      rAng.textContent = `angle = m · θ₀ = ${(mRot * THETA(0)).toFixed(2)} rad = ${Math.round(mRot * THETA(0) * 180 / Math.PI)}°`;
      D.fade(relG, ctx.p(t, "rel", .1, .25));
      lQ.textContent = `query at position m = ${mq.toFixed(1)}`;
      lK.textContent = `key   at position n = ${nk.toFixed(1)}`;
      const between = aq - ak;
      lA.textContent = `angle between = ${fmt(between)} rad (${Math.round(between * 180 / Math.PI)}°) · set by m − n = ${fmt(mq - nk, 1)}`;
      const score = LQ * LK * Math.cos(aq - ak);
      lS.textContent = `score q · k = ${fmt(score, 3)}`;
      D.fade(plus, ctx.p(t, "rel", .42, .5));
      plus.setAttribute("filter", t > ctx.cue("rel").start + ctx.cue("rel").dur * .45 && t < ctx.cue("rel").start + ctx.cue("rel").dur * .85 ? "url(#lx-glow)" : "none");
      // speeds
      D.fade(spG, ctx.p(t, "speeds", 0, .15));
      const pos = 50 * ctx.p(t, "speeds", .1, .95, E.linear);
      mLab.textContent = `position m = ${Math.round(pos)}`;
      dials.forEach(d => { const a = Math.PI / 2 - pos * d.th; LX.attr(d.hand, { x2: d.x + 10 * Math.cos(a), y2: DY - 10 * Math.sin(a) }); });
      D.fade(cG, ctx.p(t, "speeds", .55, .7));
    });
    return t => ups.forEach(u => u(t));
  }


  /* ============================================== widget: attention-explorer */
  // A toy: hand-made small vectors, every number computed live in the browser.
  const AX_PRESETS = [
    { name: "The big cat sat", dims: ["d1", "d2"], tok: SC.tok, q: SC.q, k: SC.k, v: SC.v,
      note: "The same 2-number vectors as the worked example below." },
    { name: "The animal didn't cross the street because it was tired",
      dims: ["animal", "place", "action", "glue"],
      tok: ["The", " animal", " didn't", " cross", " the", " street", " because", " it", " was", " tired"],
      // keys: what each token offers; queries: what each token looks for (4 toy features)
      k: [[0, 0, 0, 1], [2, 0.3, 0, 0], [0, 0, 1, 0.5], [0, 0, 2, 0], [0, 0, 0, 1], [0.2, 2, 0, 0], [0, 0, 0.5, 1], [0.6, 0.6, 0, 0.5], [0, 0, 1, 0.5], [1, 0, 0.5, 0]],
      q: [[0, 0, 0, 1], [0, 0, 0, 1], [1, 0, 0, 0], [1, 0, 0, 0.5], [0, 0, 1, 0], [0, 0, 1, 0.5], [0, 0, 1, 0], [2, 0, 0, 0], [1, 0, 0, 0], [1.5, 0, 0, 0]],
      v: null,  // values = keys
      note: "4 toy features: animal, place, action, glue. Click the row for ·it: its query looks for an animal." },
  ];
  LX.widget("attention-explorer", host => {
    let P = AX_PRESETS[0], scale = 1, causal = true, row = 3, view = "weights";
    host.innerHTML = `
      <div class="ax-bar">
        <label class="ax-sel">Sentence <select class="ax-preset">${AX_PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join("")}</select></label>
        <div class="ax-views" role="group">${["scores", "scaled", "weights"].map(v => `<button data-v="${v}" aria-pressed="${v === view}">${v === "scores" ? "q · k" : v === "scaled" ? "÷ √d × scale" : "softmax weights"}</button>`).join("")}</div>
      </div>
      <div class="lx-range"><span>Sharpness (scale)</span><input class="ax-scale" type="range" min="0" max="4" step="0.05" value="1"><output>1.00×</output></div>
      <label class="ax-check"><input type="checkbox" class="ax-causal" checked> Causal mask (a token may not look ahead)</label>
      <p class="ax-note"></p>
      <div class="ax-wrap"><div class="ax-grid"></div></div>
      <div class="ax-detail"></div>
      <p class="ax-toy">Toy example: hand-made vectors with 2 or 4 numbers. In Qwen3.8 each head uses 256 numbers, and the vectors are learned.</p>`;
    const $ = sel => host.querySelector(sel);
    const css = document.createElement("style");
    css.textContent = `
      .ax-bar{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;margin-bottom:6px}
      .ax-sel{font-size:14px;color:var(--lx-text-2);display:flex;gap:8px;align-items:center;max-width:100%;min-width:0;flex:1 1 260px}
      .ax-sel select{flex:1;min-width:0;max-width:440px;background:var(--lx-panel);color:var(--lx-text);border:1px solid var(--lx-line-2);border-radius:7px;padding:6px 8px;font:500 13px var(--lx-sans)}
      .ax-views{display:flex;gap:4px;flex-wrap:wrap}
      .ax-views button{font:500 12px var(--lx-mono);color:var(--lx-muted);background:var(--lx-panel);border:1px solid var(--lx-line);border-radius:7px;padding:6px 9px;cursor:pointer}
      .ax-views button[aria-pressed=true]{color:var(--lx-text);border-color:var(--lx-attn);background:var(--lx-panel-2)}
      .ax-check{display:flex;gap:8px;align-items:center;font-size:14px;color:var(--lx-text-2);margin:4px 0}
      .ax-note,.ax-toy{font-size:13.5px;color:var(--lx-muted);margin:8px 0}
      .ax-wrap{overflow-x:auto;margin:10px 0}
      .ax-grid{display:grid;gap:3px;width:max-content}
      .ax-grid .h{font:500 11.5px var(--lx-mono);color:var(--lx-text-2);display:flex;align-items:flex-end;justify-content:center;writing-mode:vertical-rl;transform:rotate(180deg);height:78px;white-space:nowrap}
      .ax-grid .r{font:500 12px var(--lx-mono);color:var(--lx-text-2);display:flex;align-items:center;justify-content:flex-end;padding-right:6px;white-space:nowrap;cursor:pointer;border-radius:5px}
      .ax-grid .r.on{color:var(--lx-text);background:var(--lx-panel-2)}
      .ax-grid .c{width:34px;height:30px;border-radius:4px;display:grid;place-items:center;font:500 10.5px var(--lx-mono);color:var(--lx-text);cursor:pointer;border:1px solid transparent}
      .ax-grid .c.on{border-color:var(--lx-attn)}
      .ax-grid .c.m{background:repeating-linear-gradient(45deg,var(--lx-panel),var(--lx-panel) 3px,var(--lx-bg) 3px,var(--lx-bg) 6px);color:var(--lx-dim)}
      .ax-detail{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:6px}
      .ax-detail h5{margin:0 0 6px;font:600 11px var(--lx-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--lx-attn)}
      .ax-b{display:grid;grid-template-columns:76px 1fr 52px;gap:8px;align-items:center;font:500 12px var(--lx-mono);color:var(--lx-text-2);margin:3px 0}
      .ax-b i{display:block;height:10px;border-radius:2px;background:var(--lx-attn)}
      .ax-b i.o{background:var(--lx-embed)} .ax-b span:last-child{text-align:right;color:var(--lx-text)}
      @media (max-width:560px){.ax-grid .c{width:26px;height:26px;font-size:9px}}`;
    host.appendChild(css);

    const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
    const fmt = x => (x < 0 ? "−" : "") + Math.abs(x).toFixed(2);
    function compute() {
      const n = P.tok.length, d = P.q[0].length, V = P.v || P.k;
      const raw = P.q.map(q => P.k.map(k => dot(q, k)));
      const scaled = raw.map(r => r.map(x => x / Math.sqrt(d) * scale));
      const W = scaled.map((r, i) => {
        const allowed = r.map((_, j) => !causal || j <= i);
        const m = Math.max(...r.filter((_, j) => allowed[j]));
        const e = r.map((x, j) => (allowed[j] ? Math.exp(x - m) : 0));
        const z = e.reduce((a, b) => a + b, 0);
        return e.map(x => x / z);
      });
      const out = W.map(w => V[0].map((_, c) => w.reduce((s, wj, j) => s + wj * V[j][c], 0)));
      return { n, d, raw, scaled, W, out, V };
    }
    function render() {
      const R = compute(), n = R.n;
      row = Math.min(row, n - 1);
      $(".ax-note").textContent = P.note;
      const g = $(".ax-grid");
      g.style.gridTemplateColumns = `auto repeat(${n}, auto)`;
      let h = `<div></div>` + P.tok.map(t => `<div class="h">${t.replace(/^ /, "·")}</div>`).join("");
      const M = view === "scores" ? R.raw : view === "scaled" ? R.scaled : R.W;
      const mx = Math.max(...M.flat().map(Math.abs)) || 1;
      for (let i = 0; i < n; i++) {
        h += `<div class="r${i === row ? " on" : ""}" data-r="${i}">${P.tok[i].replace(/^ /, "·")}</div>`;
        for (let j = 0; j < n; j++) {
          const masked = causal && j > i;
          const val = M[i][j];
          const a = view === "weights" ? val : Math.abs(val) / mx;
          const bg = masked ? "" : `background:${LX.mix("panel", val < 0 && view !== "weights" ? "neg" : "attn", Math.min(1, .12 + .88 * a))}`;
          h += `<div class="c${masked ? " m" : ""}${i === row ? " on" : ""}" data-r="${i}" style="${bg}" title="${P.tok[i].trim()} → ${P.tok[j].trim()}">${masked ? "−∞" : view === "weights" ? (val >= .995 ? "1" : val.toFixed(2).replace(/^0/, "")) : fmt(val)}</div>`;
        }
      }
      g.innerHTML = h;
      g.querySelectorAll("[data-r]").forEach(e => (e.onclick = () => { row = +e.dataset.r; render(); }));
      // detail for the selected row
      const w = R.W[row], o = R.out[row];
      const omax = Math.max(...o.map(Math.abs), 1e-9);
      $(".ax-detail").innerHTML = `
        <div><h5>${P.tok[row].replace(/^ /, "·")} looks at</h5>${P.tok.map((t, j) => `<div class="ax-b"><span>${t.replace(/^ /, "·")}</span><i style="width:${(w[j] * 100).toFixed(1)}%"></i><span>${(w[j] * 100).toFixed(1)}%</span></div>`).join("")}</div>
        <div><h5>Blended output (weights × values)</h5>${o.map((x, c) => `<div class="ax-b"><span>${P.dims[c]}</span><i class="o" style="width:${(Math.abs(x) / omax * 100).toFixed(1)}%"></i><span>${fmt(x)}</span></div>`).join("")}
        <p class="ax-note" style="margin-top:8px">Sum of weights: ${w.reduce((a, b) => a + b, 0).toFixed(3)}</p></div>`;
    }
    $(".ax-preset").onchange = e => { P = AX_PRESETS[+e.target.value]; row = P === AX_PRESETS[1] ? 7 : 3; render(); };
    host.querySelectorAll(".ax-views button").forEach(b => (b.onclick = () => {
      view = b.dataset.v; host.querySelectorAll(".ax-views button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); render();
    }));
    $(".ax-scale").oninput = e => { scale = +e.target.value; e.target.nextElementSibling.textContent = scale.toFixed(2) + "×"; render(); };
    $(".ax-causal").onchange = e => { causal = e.target.checked; render(); };
    render();
  });

  LX.chapter({
  id: "attention", num: 7, title: "Attention: how tokens look at each other", toc: "Attention (full)",
  kicker: "The layer that mixes tokens",
  lede: "A token on its own knows only itself. Attention is how each token gathers information from the tokens before it, weighted by how relevant each one is.",
  body: [
    { prose: `
      <p>After embedding, the vector for <em>"bank"</em> is the same whether the text is about rivers or money. Something has to let each token look at its neighbours and update itself. In 16 of Qwen3.8's 64 layers, that something is <strong>full attention</strong>: every token can look directly at every earlier token.</p>
      <p>The other 48 layers use a cheaper relative, Gated DeltaNet, which is the subject of <a href="#deltanet">Chapter 8</a>. Understanding full attention first makes that chapter much easier.</p>` },

    { scene: {
      id: "attn-qkv", title: "Query, key and value", build: buildQKV,
      visual: "The sentence “The cat sat on the mat” as token chips. Below “sat”, its vector branches through three matrices (Wq, Wk, Wv) into a query, a key and a value on the right, each with an icon: question mark, tag, parcel. Then The, cat and sat show their keys (later tokens dim), a glowing copy of sat's query sweeps across them and a score appears under each. Finally their values flow into a blend for “sat”, line thickness = weight, and sat's vector shifts colour. Scores and weights are computed from small toy vectors.",
      cues: [
        { id: "need",  say: "Take the word sat. To understand it, the model needs to know who sat. The answer is in an earlier token, cat. Attention is the mechanism that lets sat find it.", vis: "Chips appear; “·sat” glows; an arrow from “·sat” back to “·cat” labelled “who sat?”." },
        { id: "three", say: "Each token turns its vector into three new vectors, using three learned matrices. A query, a key and a value. Together they are called Q K V.", vis: "·sat's vector [5120] appears under its chip and branches through Wq, Wk, Wv into Q, K and V vectors; label “QKV · query, key, value”." },
        { id: "roles", say: "The query says what this token is looking for. The key says what a token has to offer. And the value is the information it will actually hand over if it is chosen.", vis: "Icons and captions appear one by one: query ? “what am I looking for?”, key tag “what do I have to offer?”, value parcel “what I hand over if chosen”." },
        { id: "match", say: "The query of sat is compared with the key of every earlier token. Where they match well, as with cat, the score is high. Where they do not, as with the, it is low.", vis: "Later tokens dim; keys appear under The, cat, sat; a glowing query frame slides over sat → cat → The and a score appears under each (0.90, 2.70, −0.05); “·cat” lights up." },
        { id: "mix",   say: "The scores become weights that add up to one, and the values are blended using those weights. Sat now carries a little bit of cat inside its own vector.", vis: "Values appear; flows to a blend vector with thickness = softmax weight (5%, 81%, 13%); ·sat's vector shifts colour, “now carries a little of ·cat”." },
      ],
    } },

    { prose: `
      <h3>Three questions every token asks</h3>
      <p>Every token computes three vectors from its hidden state, together called <abbr>QKV</abbr>:</p>
      <ul>
        <li><strong>Query</strong>: "what am I looking for?"</li>
        <li><strong>Key</strong>: "what do I contain?" This is the label other tokens' queries are matched against.</li>
        <li><strong>Value</strong>: "what will I pass on if someone attends to me?"</li>
      </ul>
      <p>Each is produced by multiplying the token's 5,120-number vector by a learned matrix. The match between a query and a key is a single number, their <strong>dot product</strong>. Similar directions give a large score; unrelated directions give a score near zero.</p>

      <h3>From scores to a blend</h3>
      <p>For one token, the steps are:</p>
      <ol>
        <li>Compute a score against every earlier token (and itself): query · key.</li>
        <li>Divide each score by 16 to keep the numbers in a comfortable range.</li>
        <li><strong>Mask the future.</strong> A token may not look at tokens that come after it. Those scores are set to minus infinity, so they end up with weight zero. This is called the <em>causal mask</em>. It is what makes the model a next-token predictor and not a fill-in-the-blank one.</li>
        <li>Apply <strong>softmax</strong>: turn the scores into positive weights that add up to 1.</li>
        <li>Add up the value vectors, each multiplied by its weight.</li>
      </ol>
      <p>The result is a new vector for the token: a mix of information from the tokens it found relevant.</p>` },

    { scene: {
      id: "attn-scores", title: "The score matrix, the mask and softmax", build: buildScores,
      visual: "A 4 × 4 grid for the tokens “The big cat sat”: rows are the tokens asking (queries), columns the tokens being looked at (keys). The numbers are the worked example from the Deeper box (toy head size 2), computed live. Scaled scores fill in, the upper-right triangle is hatched as −∞, each row turns into softmax weights (violet heat, Σ = 1.000). Finally the row of “sat” flies out to the right and blends four value vectors into the output (1.363, 1.243).",
      cues: [
        { id: "grid",  say: "Let us do this for all tokens at once. Each row is a token asking a question. Each column is a token that might answer. Every cell is one query compared with one key.", vis: "Empty 4 × 4 grid; row labels = queries, column labels = keys (The, big, cat, sat)." },
        { id: "raw",   say: "Fill in every dot product and divide by the square root of the head size. In Qwen 3.8 a head has two hundred and fifty-six numbers, so that is sixteen. Our toy vectors have only two, so here we divide by the square root of two. These are the raw attention scores.", vis: "Scaled scores appear cell by cell; badge “÷ √d · here √2 (toy) · in Qwen3.8 √256 = 16” pulses." },
        { id: "mask",  say: "Now the causal mask. A token is not allowed to see the future, so every cell above the diagonal is blanked out. The word big can see the and itself, but not cat or sat.", vis: "Upper-triangle cells fill with hatching one by one and read −∞; caption “above the diagonal = the future → −∞ → weight 0”." },
        { id: "soft",  say: "Softmax then works row by row. It turns each row of scores into weights between zero and one that add up to exactly one. Bright cells are where a token is paying attention.", vis: "Row by row the scores turn into weights (violet heat); “Σ = 1.000” appears at the end of each row." },
        { id: "blend", say: "Finally, each row of weights blends the value vectors. For sat, the biggest share of the weight lands on cat, so the output for sat leans toward the value of cat, plus a little of everything else.", vis: "Row “sat” is outlined; its four weights fly to the right; each multiplies its value vector; the products add up to the output (1.363, 1.243)." },
      ],
    } },

    { note: `<b>A link to k-means.</b> If you know k-means clustering, attention will look familiar. Soft k-means assigns each point to every cluster centre with a weight given by a softmax over similarities, then takes a weighted average. Attention does the same thing with roles swapped around: the query is compared with every key, a softmax turns the similarities into weights, and the result is a weighted average of the values. The big differences are that the "centres" (keys and values) are the other tokens themselves, recomputed for every sentence, and that queries, keys and values are learned projections rather than raw points.` },

    { widget: {
      id: "attention-explorer", title: "Attention heatmap explorer",
      sub: "Pick a sentence, click a row to see what that token attends to, and drag the sharpness slider to watch softmax go from evenly spread to all-on-one. Every number is computed live from small hand-made vectors.",
    } },

    { prose: `
      <h3>Many heads, many questions</h3>
      <p>One query can only ask one question at a time. So the vector is split into <strong>heads</strong> that each run attention independently, in parallel. This is called <abbr>MHA</abbr>. Qwen3.8's attention layers have <strong>24 query heads</strong>, each working on vectors of 256 numbers.</p>
      <p>Nobody tells the heads what to look for; they specialise during training. Researchers have found heads that look at the previous token, heads that find the matching opening bracket or quote, heads that link a verb to its subject, and "copying" heads that find an earlier occurrence of the current token and look at what came after it. The 24 outputs are joined back together into one vector.</p>

      <h3>Sharing keys and values</h3>
      <p>Keys and values from earlier tokens have to be kept in memory while the model writes (the KV cache, <a href="#kv-cache">Chapter 14</a>). To keep that memory small, Qwen3.8 uses <abbr>GQA</abbr>: there are only <strong>4 key/value heads</strong>, and each one is shared by a group of <strong>6 query heads</strong>. Six different questions are asked of the same set of keys. This makes the stored keys and values six times smaller than with 24 separate key/value heads, with little loss of quality.</p>` },

    { scene: {
      id: "attn-gqa", title: "24 query heads, 4 key/value heads", build: buildGQA,
      visual: "Top row: 24 violet query-head bars (alternate groups of 6 shaded). Bottom row: 4 key/value blocks in orange (the cached part). Lines connect each group of 6 query heads to its shared key/value head. A memory meter on the right compares cache size per token per layer: 24 KV heads vs 4 KV heads, with the byte arithmetic.",
      cues: [
        { id: "split", say: "The attention layer splits its work into twenty-four heads. Each head has its own query of two hundred and fifty-six numbers, and looks for its own kind of relationship.", vis: "One wide violet bar (6,144 numbers) splits into 24 head bars numbered 1–24." },
        { id: "share", say: "But there are only four key and value heads. Each one is shared by a group of six query heads. This trick is called G Q A, grouped-query attention.", vis: "4 orange KV blocks (K 256 | V 256) appear below; lines run from each group of 6 query heads to its shared block; groups bracketed; caption “GQA · grouped-query attention”." },
        { id: "why",   say: "Sharing saves memory. Keys and values must be stored for every earlier token. With four heads instead of twenty-four, that storage is six times smaller: four kilobytes per token per layer instead of twenty-four.", vis: "Memory meter: 24 KV heads = 24 KiB vs 4 KV heads, bar shrinks to 4 KiB (“6× smaller”); 4 × 256 × 2 × 2 bytes = 4,096 bytes; × 16 layers = 64 KiB per token." },
      ],
    } },

    { prose: `
      <h3>Rotary positions: where each token is</h3>
      <p>A dot product does not care about order: "dog bites man" and "man bites dog" would give the same scores. The model needs to know positions. Qwen3.8 uses <abbr>RoPE</abbr>: before queries and keys are compared, pairs of their numbers are <strong>rotated</strong> by an angle that grows with the token's position.</p>
      <p>The useful property: when a rotated query meets a rotated key, the result depends only on <em>how far apart</em> the two tokens are, not where they sit in the text. "Two tokens back" means the same thing at position 10 and at position 100,000. Different pairs rotate at very different speeds, from fast (fine local order) to extremely slow (long-range position).</p>
      <p>Qwen3.8 applies the rotation to only <strong>64 of the 256 numbers</strong> in each head (a "partial rotary" factor of 25%). The other 192 numbers stay position-free, so they can match on pure content. Those 64 numbers form 32 pairs, and they are shared out between <em>time</em>, <em>height</em> and <em>width</em> (11, 11 and 10 pairs). The sharing is <em>interleaved</em> (time, height, width, time, height, width …) rather than in three blocks, so each axis gets both fast-turning and slow-turning pairs. For text, all three groups simply follow the token's position. For images and video, they let a token know where in the picture it sits. This variant is called <abbr>mRoPE</abbr>, and <a href="#vision">Chapter 16</a> comes back to it.</p>` },

    { scene: {
      id: "attn-rope", title: "Rotary position embedding", build: buildRope,
      visual: "Top: “dog bites man” vs “man bites dog” with identical scores. Below, a 2-D plane with one pair of query numbers as an arrow (violet) and one pair of key numbers (lighter). Angles use the real Qwen3.8 rate for pair 0, θ₀ = 1 rad per token. The query arrow turns as the position counts up; then query at 7 and key at 4 are compared (score readout), and both move +10 positions: both arrows spin, the score stays the same. Bottom: 32 dials turning at θᵢ = 10,000,000^(−2i/64) (fast to effectively still), labelled T/H/W, beside 192 never-rotated content numbers.",
      cues: [
        { id: "order", say: "Attention on its own is blind to order. Dog bites man and man bites dog would look exactly the same. So we need to mark where each token is.", vis: "The two sentences side by side, each with bites → dog 1.22 and bites → man 0.93, and an equals sign." },
        { id: "rot",   say: "Rotary position embedding, or rope, takes pairs of numbers in the query and the key, and rotates them like clock hands. The further along the text, the further they turn.", vis: "Plane with one arrow (pair 0); it turns 1 rad per step as the position goes 0, 1, 2, 3; readout “angle = m · θ₀”." },
        { id: "rel",   say: "Here is the clever part. When two rotated arrows are compared, only the angle between them matters. Shift both tokens along by ten places, and the score stays exactly the same. The model sees relative distance.", vis: "Query at position 7, key at 4, angle arc and score 0.746. Both move +10 → arrows spin together, score stays 0.746." },
        { id: "speeds",say: "Different pairs turn at different speeds. Fast pairs track nearby order, slow pairs track position across very long texts. In Qwen 3.8, only sixty-four of the two hundred and fifty-six numbers in each head are rotated. The rest are left free to match on meaning alone.", vis: "32 dials turning at θᵢ = 10,000,000^(−2i/64) as the position runs to 50: θ₀ = 1.0 spins, θ₃₁ ≈ 1.65 × 10⁻⁷ stays still; T/H/W letters under the dials; 192 still cells labelled “content only, never rotated”." },
      ],
    } },

    { prose: `
      <h3>Two small but important additions</h3>
      <p><strong>Normalised queries and keys.</strong> Before the rotation, each head's query and key are rescaled with <abbr>RMSNorm</abbr> (<code>q_norm</code>, <code>k_norm</code>). This keeps scores from growing huge and makes training more stable.</p>
      <p><strong>An output gate.</strong> Qwen3.8's attention is <em>gated</em>. The query projection produces twice as many numbers as needed: half are the queries, the other half are a <strong>gate</strong>. After attention, each output number is multiplied by sigmoid(gate), a value between 0 and 1. A head that has found nothing useful can quietly turn itself down. Without such a gate, softmax forces every row to sum to 1, so heads tend to dump unwanted attention on the first token (an "attention sink"). The gate relieves that pressure. In the Qwen team's study of this gate, the share of attention landing on the first token fell from an average of 46.7% to 4.8%, and the largest activation values in the network dropped from about 1,053 to 94.</p>

      <h3>The attention layer in numbers</h3>` },

    { html: `<div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Matrix</th><th>Shape</th><th class="num">Parameters</th><th>Produces</th></tr>
        <tr><td><code>q_proj</code></td><td class="num">5120 → 12288</td><td class="num">62.9 M</td><td>24 queries × 256, plus 24 gates × 256</td></tr>
        <tr><td><code>k_proj</code></td><td class="num">5120 → 1024</td><td class="num">5.2 M</td><td>4 keys × 256</td></tr>
        <tr><td><code>v_proj</code></td><td class="num">5120 → 1024</td><td class="num">5.2 M</td><td>4 values × 256</td></tr>
        <tr><td><code>o_proj</code></td><td class="num">6144 → 5120</td><td class="num">31.5 M</td><td>24 head outputs × 256, mixed back to the hidden size</td></tr>
        <tr><td><code>q_norm</code>, <code>k_norm</code></td><td class="num">256 + 256</td><td class="num">512</td><td>RMSNorm weights</td></tr>
        <tr class="sum"><td>Attention part of one layer</td><td></td><td class="num">104.9 M</td><td>× 16 layers = 1.68 billion</td></tr>
      </table></div>` },

    { prose: `
      <h3>The price: looking at everything</h3>
      <p>Full attention is exact: any token can retrieve any earlier token perfectly. But that exactness has a cost that grows with the length of the text. Reading a prompt of <code>T</code> tokens means filling a <code>T × T</code> score grid in every head, so the work grows with the <em>square</em> of the length. When writing, each new token compares itself with every earlier one, so every step costs a little more than the last. All those earlier keys and values must also be kept in memory. That is the KV cache of <a href="#kv-cache">Chapter 14</a>.</p>
      <p>This cost is exactly why Qwen3.8 uses full attention in only one layer out of every four. The next chapter shows what it uses in the other three.</p>` },

    { deep: `
      <h3>The attention formula</h3>
      <p>For one head, stack the queries, keys and values of all <code>T</code> tokens into matrices <i>Q</i>, <i>K</i>, <i>V</i> of shape <code>[T, d]</code> with <i>d</i> = 256:</p>
      <math display="block"><mrow><mtext>Attention</mtext><mo>(</mo><mi>Q</mi><mo>,</mo><mi>K</mi><mo>,</mo><mi>V</mi><mo>)</mo><mo>=</mo><mtext>softmax</mtext><mrow><mo>(</mo><mfrac><mrow><mi>Q</mi><msup><mi>K</mi><mi>T</mi></msup></mrow><msqrt><mi>d</mi></msqrt></mfrac><mo>+</mo><mi>M</mi><mo>)</mo></mrow><mi>V</mi></mrow></math>
      <div class="lx-read">Q, K and V hold the queries, keys and values of all T tokens, one row per token, each row 256 numbers (d = 256). Q times K<sup>T</sup> compares every query with every key by a dot product, giving a T × T table of scores. Divide every score by √256 = 16, add the mask M (which makes scores for future tokens minus infinity), and run softmax along each row to turn the scores into weights that add up to 1. Finally multiply by V: each token's output is the weighted mix of all the value rows it is allowed to see.</div>
      <p><i>M</i> is the causal mask: 0 on and below the diagonal, −∞ above it. Softmax works on each row:</p>
      <math display="block"><mrow><mtext>softmax</mtext><msub><mrow><mo>(</mo><mi mathvariant="bold">s</mi><mo>)</mo></mrow><mi>i</mi></msub><mo>=</mo><mfrac><msup><mi>e</mi><msub><mi>s</mi><mi>i</mi></msub></msup><mrow><munder><mo>∑</mo><mi>j</mi></munder><msup><mi>e</mi><msub><mi>s</mi><mi>j</mi></msub></msup></mrow></mfrac></mrow></math>
      <div class="lx-read">s is one row of scores (one token's scores against every token it may look at). For score number i: raise e (about 2.718) to the power of that score. Do the same for every score j in the row and add those up. Divide the first by the total. The result is a set of positive weights that add up to 1, and bigger scores get much bigger shares. Example: scores (2, 1, 0) become about 0.67, 0.24 and 0.09.</div>
      <p>Dividing by √<i>d</i> keeps softmax from saturating. If the entries of <b>q</b> and <b>k</b> are roughly independent with variance 1, their dot product has variance <i>d</i>. Dividing by √<i>d</i> = 16 brings it back to variance 1, so softmax does not saturate into a single 1 and many 0s.</p>

      <h3>A worked example with tiny vectors</h3>
      <p>Four tokens, head size <i>d</i> = 2 (the same numbers as the score-matrix animation above, where the tokens are “The big cat sat”). We compute the output for the 4th token, whose query is <b>q</b> = (2, 1). It may look at all four tokens (including itself):</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Token</th><th class="num">key</th><th class="num">q · k</th><th class="num">÷ √2</th><th class="num">e<sup>x</sup></th><th class="num">weight</th><th class="num">value</th></tr>
        <tr><td>1</td><td class="num">(1, 0)</td><td class="num">2.0</td><td class="num">1.414</td><td class="num">4.113</td><td class="num">0.237</td><td class="num">(1, 0)</td></tr>
        <tr><td>2</td><td class="num">(0, 1)</td><td class="num">1.0</td><td class="num">0.707</td><td class="num">2.028</td><td class="num">0.117</td><td class="num">(0, 1)</td></tr>
        <tr><td>3</td><td class="num">(1, 1)</td><td class="num">3.0</td><td class="num">2.121</td><td class="num">8.342</td><td class="num">0.480</td><td class="num">(2, 2)</td></tr>
        <tr><td>4</td><td class="num">(0.5, 0.5)</td><td class="num">1.5</td><td class="num">1.061</td><td class="num">2.888</td><td class="num">0.166</td><td class="num">(1, 1)</td></tr>
        <tr class="sum"><td>Sum</td><td></td><td></td><td></td><td class="num">17.372</td><td class="num">1.000</td><td></td></tr>
      </table></div>
      <p>Output = 0.237·(1, 0) + 0.117·(0, 1) + 0.480·(2, 2) + 0.166·(1, 1) = <strong>(1.363, 1.243)</strong>. Token 3 had the best-matching key, so its value dominates. For token 2, the mask would leave only tokens 1 and 2 in the sum.</p>
      <p>The animation “The score matrix, the mask and softmax” above plays this exact calculation step by step, and the attention explorer lets you change the vectors, the mask and the sharpness yourself.</p>

      <h3>The full gated attention layer of Qwen3.8</h3>
      <p>For input hidden states <i>X</i> of shape <code>[T, 5120]</code> (already RMS-normalised):</p>
      <ol>
        <li>[<i>Q</i>, <i>G</i>] = <i>X</i> <i>W</i><sub>q</sub>, split into 24 query heads and 24 gate heads of 256 each. <i>K</i> = <i>X W</i><sub>k</sub>, <i>V</i> = <i>X W</i><sub>v</sub>: 4 heads of 256 each.</li>
        <li><i>Q</i> ← RMSNorm(<i>Q</i>), <i>K</i> ← RMSNorm(<i>K</i>) per head.</li>
        <li>Apply rotary positions to the first 64 dimensions of each query and key head.</li>
        <li>Query head <i>h</i> uses key/value head ⌊<i>h</i> / 6⌋. Compute attention for all 24 heads.</li>
        <li><i>O</i> ← <i>O</i> ⊙ σ(<i>G</i>), with σ = sigmoid and ⊙ = element-wise product.</li>
        <li>Concatenate the 24 heads into <code>[T, 6144]</code> and multiply by <i>W</i><sub>o</sub> to get back to <code>[T, 5120]</code>.</li>
      </ol>

      <h3>Rotary embedding as a formula</h3>
      <p>RoPE treats each pair (<i>x</i><sub>2<i>i</i></sub>, <i>x</i><sub>2<i>i</i>+1</sub>) as a point in a plane and rotates it by angle <i>m</i>·θ<sub><i>i</i></sub> at position <i>m</i> (implementations usually pair dimension <i>i</i> with dimension <i>i</i> + 32 instead of neighbours, which works the same way):</p>
      <math display="block"><mrow><mrow><mo>(</mo><mtable><mtr><mtd><msubsup><mi>x</mi><mrow><mn>2</mn><mi>i</mi></mrow><mo>′</mo></msubsup></mtd></mtr><mtr><mtd><msubsup><mi>x</mi><mrow><mn>2</mn><mi>i</mi><mo>+</mo><mn>1</mn></mrow><mo>′</mo></msubsup></mtd></mtr></mtable><mo>)</mo></mrow><mo>=</mo><mrow><mo>(</mo><mtable><mtr><mtd><mi>cos</mi><mi>m</mi><msub><mi>θ</mi><mi>i</mi></msub></mtd><mtd><mo>−</mo><mi>sin</mi><mi>m</mi><msub><mi>θ</mi><mi>i</mi></msub></mtd></mtr><mtr><mtd><mi>sin</mi><mi>m</mi><msub><mi>θ</mi><mi>i</mi></msub></mtd><mtd><mi>cos</mi><mi>m</mi><msub><mi>θ</mi><mi>i</mi></msub></mtd></mtr></mtable><mo>)</mo></mrow><mrow><mo>(</mo><mtable><mtr><mtd><msub><mi>x</mi><mrow><mn>2</mn><mi>i</mi></mrow></msub></mtd></mtr><mtr><mtd><msub><mi>x</mi><mrow><mn>2</mn><mi>i</mi><mo>+</mo><mn>1</mn></mrow></msub></mtd></mtr></mtable><mo>)</mo></mrow></mrow></math>
      <div class="lx-read">Take one pair of numbers from a query or key, x<sub>2i</sub> and x<sub>2i+1</sub>, and treat them as a point on a flat plane. Rotate that point around the centre by the angle m·θ<sub>i</sub>, where m is the token's position in the text and θ<sub>i</sub> is the turning speed of pair i. The matrix of cos and sin is just the standard recipe for rotating a point; the primed values on the left are the rotated pair. Example: with θ<sub>i</sub> = 0.1, the token at position 5 has that pair turned by 0.5 radians (about 29°).</div>
      <p>The frequencies fall off geometrically, θ<sub><i>i</i></sub> = <i>b</i><sup>−2<i>i</i>/<i>r</i></sup>, where <i>r</i> = 64 is the number of rotated dimensions and the base <i>b</i> is 10,000,000 in Qwen3.8. That very large base makes the slowest pairs turn extremely slowly, which suits its 262,144-token context. Because rotations compose, (<i>R<sub>m</sub></i> <b>q</b>) · (<i>R<sub>n</sub></i> <b>k</b>) = <b>q</b> · (<i>R</i><sub><i>n</i>−<i>m</i></sub> <b>k</b>): the score depends only on the offset <i>n</i> − <i>m</i>.</p>

      <h3>Cost</h3>
      <p>Per head, computing <i>QK</i><sup>T</sup> for a prompt costs about <i>T</i>² · <i>d</i> multiply-adds, which grows quadratically. When generating, the new token needs <i>T</i> · <i>d</i> for its scores and another <i>T</i> · <i>d</i> for the value blend, so each step grows linearly with the context length.</p>` },
  ],
});
})();
