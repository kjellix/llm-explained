/* Chapter 05 — Embeddings */
(function () {
"use strict";
const D = LX.draw;

/* Deterministic pseudo-embedding row for a token id (illustrative values). */
const rowValues = (id, n) => { const r = LX.rng(id * 7 + 13); return Array.from({ length: n }, () => (r() * 2 - 1) * (.25 + r() * .75)); };
const lerp = LX.lerp, clamp = LX.clamp;

/* ===================================================== scene: embed-lookup */
function buildLookup(ctx) {
  const { svg } = ctx, ups = [];
  D.backdrop(svg);

  /* --- the table ------------------------------------------------------ */
  const TX = 1010, TY = 150, NC = 20, CW = 16, CG = 2, NR = 40, RH = 14, RG = 2;
  const ROW = { 0: 0, 279: 7, 383: 11, 7338: 19, 7993: 22, 248319: 39 };
  const rowY = r => TY + r * (RH + RG);
  D.label(svg, TX, 100, "Embedding table · [248,320 × 5,120]");
  const filler = LX.rng(5);
  const rows = [];
  for (let r = 0; r < NR; r++) {
    const id = Object.keys(ROW).find(k => ROW[k] === r);
    const vals = id != null ? rowValues(+id, NC) : Array.from({ length: NC }, () => (filler() * 2 - 1) * .7);
    const g = LX.el("g", {}, svg);
    const cells = vals.map((v, c) => LX.el("rect", { x: TX + c * (CW + CG), y: rowY(r), width: CW, height: RH, rx: 2, fill: LX.valueColor(v) }, g));
    rows.push({ g, cells, id, vals });
    if (id != null) D.text(svg, TX - 14, rowY(r) + 11.5, Number(id).toLocaleString("en-US"), { mono: true, size: 13, color: "muted", anchor: "end" });
  }
  [3, 15, 30].forEach(r => D.text(svg, TX - 14, rowY(r) + 11, "⋮", { mono: true, size: 14, color: "dim", anchor: "end" }));
  const TW = NC * (CW + CG) - CG, TH = NR * (RH + RG) - RG;
  const fadeTop = D.bracket(svg, { x1: TX, y1: TY - 14, x2: TX + TW, y2: TY - 14, side: "top", label: "5,120 columns (20 shown)" });
  const fadeRight = D.bracket(svg, { x1: TX + TW + 14, y1: TY, x2: TX + TW + 14, y2: TY + TH, side: "right", label: "248,320 rows" });
  const lit = {};
  Object.entries(ROW).forEach(([id, r]) => {
    lit[id] = LX.el("rect", { x: TX - 4, y: rowY(r) - 3, width: TW + 8, height: RH + 6, rx: 4, fill: "none", stroke: LX.col("token"), "stroke-width": 2, opacity: 0 }, svg);
  });

  /* --- tokens --------------------------------------------------------- */
  const TOK = [[" the", 279], [" cat", 7993], [" sat", 7338], [" on", 383], [" the", 279]];
  D.label(svg, 80, 74, "Tokens of “… the cat sat on the”");
  const ptrLayer = LX.el("g", {}, svg);
  const VY = 300, VC = 14, VS = 26.5;
  const toks = TOK.map(([tok, id], i) => {
    const x = 80 + i * 150, cx = x + 59, ry = rowY(ROW[id]) + RH / 2;
    const lane = 104 + i * 7, vx = 900 - i * 8, r = 10, dn = ry > lane ? 1 : -1;
    const ptr = D.arrow(ptrLayer, { d: `M${cx} 160 L${cx} ${lane + r} Q${cx} ${lane} ${cx + r} ${lane} L${vx - r} ${lane} Q${vx} ${lane} ${vx} ${lane + r * dn} L${vx} ${ry - r * dn} Q${vx} ${ry} ${vx + r} ${ry} L${TX - 75} ${ry}`, color: "token", width: 2 });
    const chip = D.tokenChip(svg, { x, y: 160, text: tok, id });
    return { chip, ptr, cx, id, row: ROW[id], vals: rows[ROW[id]].vals };
  });

  /* --- flying cells (row → vertical vector) --------------------------- */
  const flyLayer = LX.el("g", {}, svg);
  toks.forEach(tk => {
    tk.fly = tk.vals.slice(0, VC).map((v, j) => LX.el("rect", { rx: 3, fill: LX.valueColor(v), stroke: LX.col("line-2"), "stroke-width": 1, opacity: 0 }, flyLayer));
  });
  function flyTo(tk, q) {
    tk.fly.forEach((c, j) => {
      const e = LX.ease.inOut(clamp(q * 1.6 - j / VC * .6));
      if (e <= 0) return c.setAttribute("opacity", 0);
      const sx = TX + j * (CW + CG), sy = rowY(tk.row), dx = tk.cx - 11, dy = VY + j * VS;
      LX.attr(c, { x: lerp(sx, dx, e), y: lerp(sy, dy, e) - 70 * Math.sin(Math.PI * e), width: lerp(CW, 22, e), height: lerp(RH, 22, e), opacity: 1 });
    });
  }

  const copyNote = D.text(svg, 925, 610, "copy the row · no arithmetic", { mono: true, size: 15, color: "embed", anchor: "end" });
  const shape = D.bracket(svg, { x1: 80, y1: 690, x2: 798, y2: 690, side: "bottom", label: "5 vectors × 5,120 numbers = [5, 5120]", color: "embed" });
  const same = LX.el("g", {}, svg);
  [0, 4].forEach(i => LX.el("rect", { x: toks[i].cx - 19, y: VY - 8, width: 38, height: VC * VS + 12, rx: 6, fill: "none", stroke: LX.col("embed"), "stroke-width": 2 }, same));
  LX.el("path", { d: `M${toks[0].cx} ${VY + VC * VS + 4} L${toks[0].cx} ${VY + VC * VS + 26} L${toks[4].cx} ${VY + VC * VS + 26} L${toks[4].cx} ${VY + VC * VS + 4}`, stroke: LX.col("embed"), "stroke-width": 1.5, fill: "none", "stroke-dasharray": "5 5" }, same);
  D.text(same, (toks[0].cx + toks[4].cx) / 2, VY + VC * VS + 50, "same token → same row → identical vector · no position yet", { mono: true, size: 15, color: "embed", anchor: "middle" });

  /* --- timing --------------------------------------------------------- */
  const ORDER = [0, 2, 3, 4];
  ups.push(t => {
    const pt = ctx.p(t, "table", 0, .7, LX.ease.linear);
    rows.forEach((r, i) => D.fade(r.g, clamp((pt * 1.4 - i / NR) * 3) * (r.id != null ? .95 : .55)));
    fadeTop.show(ctx.p(t, "table", .55, .75)); fadeRight.show(ctx.p(t, "table", .65, .85));
    toks.forEach(tk => { tk.chip.show(ctx.p(t, "table", .1, .4)); tk.chip.idShow(ctx.p(t, "table", .3, .5)); });

    const st = {}; // per token: point progress, copy progress
    st[1] = [ctx.p(t, "point", .15, .6, LX.ease.inOut), ctx.p(t, "copy", .05, .75, LX.ease.linear)];
    ORDER.forEach((i, k) => { st[i] = [ctx.p(t, "all", .04 + k * .15, .2 + k * .15, LX.ease.inOut), ctx.p(t, "all", .1 + k * .15, .34 + k * .15, LX.ease.linear)]; });
    const sameOn = ctx.p(t, "same", .1, .3);
    const litLevel = {};
    toks.forEach((tk, i) => {
      const [pp, cp] = st[i];
      tk.ptr.draw(pp);
      const dim = (i === 0 || i === 4) ? 1 - .65 * clamp(cp * 3 - 2) * (1 - sameOn) : 1 - .65 * clamp(cp * 3 - 2);
      tk.ptr.g.setAttribute("opacity", dim);
      flyTo(tk, cp);
      const on = clamp((pp - .85) * 7) * (1 - clamp(cp * 2 - 1));
      litLevel[tk.id] = Math.max(litLevel[tk.id] || 0, on);
      tk.chip.glow(on > .3);
    });
    litLevel[279] = Math.max(litLevel[279] || 0, sameOn * (1 - ctx.p(t, "same", .8, 1)));
    Object.entries(lit).forEach(([id, r]) => {
      const q = litLevel[id] || 0;
      r.setAttribute("opacity", q);
      rows[ROW[id]].g.setAttribute("filter", q > .3 ? "url(#lx-glow)" : "none");
    });
    D.fade(copyNote, ctx.p(t, "copy", .1, .3) * (1 - ctx.p(t, "all", .5, .7)));
    shape.show(ctx.p(t, "all", .8, .95) * (1 - sameOn));
    D.fade(same, sameOn);
  });
  return t => ups.forEach(u => u(t));
}

/* ===================================================== scene: meaning-space */
function buildMeaning(ctx) {
  const { svg } = ctx, ups = [];
  D.backdrop(svg);
  const MX = 80, MY = 96, MW = 1440, MH = 730;
  LX.el("rect", { x: MX, y: MY, width: MW, height: MH, rx: 10, fill: LX.mix("bg", "panel", .6), stroke: LX.col("line-2"), "stroke-width": 1 }, svg);
  D.label(svg, MX + 24, MY + 36, "Embedding space · 2-D projection of 5,120 dimensions");
  D.text(svg, MX + MW - 24, MY + 36, "positions illustrative", { mono: true, size: 13, color: "dim", anchor: "end" });

  const CL = {
    animals: { x: 470, y: 225, name: "animals" },
    size:    { x: 1060, y: 195, name: "size" },
    numbers: { x: 1100, y: 515, name: "numbers" },
    people:  { x: 450, y: 480, name: "people & royalty" },
  };
  const NAMED = [
    [" cat", 380, 290, "animals"], [" kitten", 470, 255, "animals"], [" Cat", 300, 322, "animals"], [" katt", 400, 348, "animals"],
    [" dog", 540, 320, "animals"], [" hund", 560, 375, "animals"], [" puppy", 630, 275, "animals"], [" horse", 480, 412, "animals"],
    [" big", 1000, 250, "size"], [" large", 1060, 278, "size"], [" huge", 1130, 240, "size"], [" small", 985, 330, "size"], [" tiny", 1060, 352, "size"],
    [" seven", 1050, 580, "numbers"], [" three", 1130, 560, "numbers"], ["7", 1090, 630, "numbers"], [" ten", 1180, 612, "numbers"], [" five", 1000, 650, "numbers"],
    [" king", 380, 560, "people"], [" queen", 540, 520, "people"], [" man", 360, 690, "people"], [" woman", 520, 650, "people"],
  ];
  const R = LX.rng(11);
  const far = (x, y) => NAMED.every(n => Math.hypot(n[1] - x, n[2] - y) > 70);
  const filler = [];
  while (filler.length < 64) {
    const x = MX + 40 + R() * (MW - 80), y = MY + 70 + R() * (MH - 110);
    if (far(x, y)) filler.push(LX.el("circle", { cx: x, cy: y, r: 3, fill: LX.col("dim") }, svg));
  }
  const clusterLabels = Object.values(CL).map(c => D.label(svg, c.x, c.y, c.name, { color: "embed", anchor: "middle", opacity: 0 }));
  const links = LX.el("g", {}, svg);
  [[" katt", " cat"], [" hund", " dog"]].forEach(([a, b]) => {
    const A = NAMED.find(n => n[0] === a), B = NAMED.find(n => n[0] === b);
    LX.el("line", { x1: A[1], y1: A[2], x2: B[1], y2: B[2], stroke: LX.col("embed"), "stroke-width": 1.2, "stroke-dasharray": "3 4", opacity: .7 }, links);
  });
  const linkNote = D.text(svg, 300, 392, "Norwegian ↔ English", { mono: true, size: 13, color: "embed", anchor: "middle" });

  const dots = NAMED.map(([tok, x, y]) => {
    const g = LX.el("g", {}, svg);
    const c = LX.el("circle", { r: 6, fill: LX.col("embed") }, g);
    const lab = D.tokenText(g, 0, 0, tok, { size: 17, anchor: "start" });
    return { g, c, lab, tok, x, y, x0: MX + 60 + R() * (MW - 120), y0: MY + 80 + R() * (MH - 130) };
  });
  const byTok = t => dots.find(d => d.tok === t);

  /* direction arrows */
  const shorten = (a, b, k = 12) => { const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy); return [a.x + dx / L * k, a.y + dy / L * k, b.x - dx / L * k, b.y - dy / L * k]; };
  const dirArrows = [[" man", " woman"], [" king", " queen"]].map(([a, b]) => {
    const [x1, y1, x2, y2] = shorten(byTok(a), byTok(b));
    return D.arrow(svg, { x1, y1, x2, y2, color: "mtp", width: 2.5 });
  });
  const dirNote = D.text(svg, 700, 600, "same step: man → woman ≈ king → queen", { mono: true, size: 15, color: "mtp" });

  /* id tags */
  const TAGS = [[" big", 2330], [" large", 3349], [" dog", 5388], [" hund", 183612], [" cat", 7993], [" Cat", 16847]];
  const tags = TAGS.map(([tok, id]) => {
    const d = byTok(tok), g = LX.el("g", { opacity: 0 }, svg);
    const txt = "ID " + id.toLocaleString("en-US"), w = txt.length * 8.6 + 16;
    LX.el("rect", { x: d.x - 12 - w, y: d.y - 12, width: w, height: 24, rx: 5, fill: LX.mix("bg", "token", .12), stroke: LX.col("token"), "stroke-width": 1.2 }, g);
    D.text(g, d.x - 12 - w / 2, d.y + 5, txt, { mono: true, size: 14, color: "token", anchor: "middle" });
    return g;
  });
  const idNote = D.text(svg, MX + 24, MY + MH - 26, "IDs (amber) show no pattern · the learned vectors put these pairs side by side", { mono: true, size: 14, color: "text-2" });
  const IDSET = new Set(TAGS.map(t => t[0]));

  /* angle rays */
  const O = { x: 260, y: 780 };
  const angG = LX.el("g", {}, svg);
  LX.el("path", { d: `M${O.x - 8} ${O.y} L${O.x + 8} ${O.y} M${O.x} ${O.y - 8} L${O.x} ${O.y + 8}`, stroke: LX.col("text-2"), "stroke-width": 2 }, angG);
  D.text(angG, O.x + 12, O.y + 24, "origin", { mono: true, size: 13, color: "muted" });
  const rays = [" cat", " dog", " seven"].map(tok => { const d = byTok(tok); return LX.el("line", { x1: O.x, y1: O.y, x2: d.x, y2: d.y, stroke: LX.col("logit"), "stroke-width": 1.8, "stroke-dasharray": "6 5" }, angG); });
  const arc = (a, b, r, color) => {
    const A = Math.atan2(byTok(a).y - O.y, byTok(a).x - O.x), B = Math.atan2(byTok(b).y - O.y, byTok(b).x - O.x);
    let dA = B - A; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI;
    const p = LX.el("path", { d: `M${O.x + r * Math.cos(A)} ${O.y + r * Math.sin(A)} A ${r} ${r} 0 0 ${dA > 0 ? 1 : 0} ${O.x + r * Math.cos(B)} ${O.y + r * Math.sin(B)}`, stroke: LX.col(color), "stroke-width": 3, fill: "none" }, angG);
    const m = A + dA / 2;
    return { p, L: r * Math.abs(dA), mx: O.x + (r + 20) * Math.cos(m), my: O.y + (r + 20) * Math.sin(m) };
  };
  const a1 = arc(" cat", " dog", 250, "logit"), a2 = arc(" cat", " seven", 150, "logit");
  [a1, a2].forEach(a => a.p.setAttribute("stroke-dasharray", `${a.L} ${a.L}`));
  const end = (tok, r) => { const A = Math.atan2(byTok(tok).y - O.y, byTok(tok).x - O.x); return [O.x + r * Math.cos(A), O.y + r * Math.sin(A)]; };
  const e1 = end(" cat", 250), e2 = end(" cat", 150);
  const angLab1 = D.text(svg, e1[0] - 16, e1[1] + 2, "small angle → similar", { mono: true, size: 14, color: "logit", anchor: "end" });
  const angLab2 = D.text(svg, e2[0] - 16, e2[1] + 8, "wide angle → unrelated", { mono: true, size: 14, color: "logit", anchor: "end" });

  ups.push(t => {
    const fm = ctx.p(t, "map", .05, .5);
    filler.forEach(f => D.fade(f, fm * .8));
    const mv = ctx.p(t, "near", .05, .6, LX.ease.inOut);
    const idsOn = ctx.p(t, "ids", .05, .2) * (1 - ctx.p(t, "angle", 0, .15));
    const angOn = ctx.p(t, "angle", .05, .2);
    dots.forEach((d, i) => {
      const x = lerp(d.x0, d.x, mv), y = lerp(d.y0, d.y, mv);
      d.g.setAttribute("transform", `translate(${x} ${y})`);
      LX.attr(d.lab, { x: 11, y: 6 });
      d.c.setAttribute("fill", mv > 0 ? LX.mix("dim", "embed", mv) : LX.col("dim"));
      D.fade(d.lab, ctx.p(t, "near", .5, .75));
      let op = fm;
      if (IDSET.has(d.tok)) d.c.setAttribute("filter", idsOn > .5 ? "url(#lx-glow)" : "none");
      else op *= 1 - .6 * idsOn;
      if (![" cat", " dog", " seven"].includes(d.tok)) op *= 1 - .6 * angOn;
      D.fade(d.g, op);
    });
    clusterLabels.forEach(l => D.fade(l, ctx.p(t, "near", .55, .8) * (1 - .6 * Math.max(idsOn, angOn))));
    D.fade(links, ctx.p(t, "near", .75, .9) * (1 - .7 * Math.max(idsOn, angOn)));
    D.fade(linkNote, ctx.p(t, "near", .78, .95) * (1 - Math.max(idsOn, angOn)));
    dirArrows.forEach((a, i) => { a.draw(ctx.p(t, "dir", .1 + i * .3, .4 + i * .3)); D.fade(a.g, 1 - .7 * Math.max(idsOn, angOn)); });
    D.fade(dirNote, ctx.p(t, "dir", .7, .85) * (1 - Math.max(idsOn, angOn)));
    tags.forEach((g, i) => D.fade(g, ctx.p(t, "ids", .15 + i * .07, .3 + i * .07) * (1 - ctx.p(t, "angle", 0, .15))));
    D.fade(idNote, ctx.p(t, "ids", .55, .7) * (1 - ctx.p(t, "angle", 0, .15)));
    D.fade(angG, angOn);
    rays.forEach((r, i) => D.fade(r, ctx.p(t, "angle", .08 + i * .06, .2 + i * .06)));
    a1.p.setAttribute("stroke-dashoffset", a1.L * (1 - ctx.p(t, "angle", .3, .45)));
    a2.p.setAttribute("stroke-dashoffset", a2.L * (1 - ctx.p(t, "angle", .6, .75)));
    D.fade(angLab1, ctx.p(t, "angle", .4, .5)); D.fade(angLab2, ctx.p(t, "angle", .7, .8));
  });
  return t => ups.forEach(u => u(t));
}

/* ===================================================== scene: embed-sphere */
function buildSphere(ctx) {
  const { svg } = ctx, ups = [];
  D.backdrop(svg);
  const C = { x: 520, y: 480 }, RAD = 270, TILT = .38;
  const norm3 = v => { const L = Math.hypot(...v); return v.map(x => x / L); };
  const proj = (v, phi) => {
    const [x, y, z] = v;
    const x1 = x * Math.cos(phi) + z * Math.sin(phi), z1 = -x * Math.sin(phi) + z * Math.cos(phi);
    const y2 = y * Math.cos(TILT) - z1 * Math.sin(TILT), z2 = y * Math.sin(TILT) + z1 * Math.cos(TILT);
    return { x: C.x + RAD * x1, y: C.y - RAD * y2, z: z2 };
  };
  const phiAt = t => -.3 + .012 * t;

  /* globe wireframe */
  const globe = LX.el("g", {}, svg);
  const outline = LX.el("circle", { cx: C.x, cy: C.y, r: RAD, fill: LX.mix("bg", "embed", .04), stroke: LX.col("norm"), "stroke-width": 1.5 }, globe);
  const curves = [];
  const N = 72;
  [-60, -30, 0, 30, 60].forEach(lat => curves.push(i => { const a = i / N * 2 * Math.PI, la = lat * Math.PI / 180; return [Math.cos(la) * Math.cos(a), Math.sin(la), Math.cos(la) * Math.sin(a)]; }));
  [0, 30, 60, 90, 120, 150].forEach(lon => curves.push(i => { const a = i / N * 2 * Math.PI, lo = lon * Math.PI / 180; return [Math.cos(a) * Math.cos(lo), Math.sin(a), Math.cos(a) * Math.sin(lo)]; }));
  const curveEls = curves.map(() => ({
    back: LX.el("path", { fill: "none", stroke: LX.col("line-2"), "stroke-width": 1, "stroke-dasharray": "3 5" }, globe),
    front: LX.el("path", { fill: "none", stroke: LX.col("norm"), "stroke-width": 1, opacity: .55 }, globe),
  }));
  function drawGlobe(phi) {
    curves.forEach((fn, k) => {
      let f = "", b = "", prevSide = null;
      const pts = Array.from({ length: N + 1 }, (_, i) => proj(fn(i), phi));
      for (let i = 0; i < N; i++) {
        const p = pts[i], q = pts[i + 1], side = (p.z + q.z) / 2 >= 0 ? "f" : "b";
        const seg = (side === prevSide ? "" : `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`) + `L${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
        if (side === "f") { f += side === prevSide ? seg : seg; } else b += seg;
        if (side !== prevSide && prevSide !== null) { /* new subpath started via M */ }
        prevSide = side;
      }
      curveEls[k].front.setAttribute("d", f); curveEls[k].back.setAttribute("d", b);
    });
  }
  const globeLab = D.text(svg, C.x, C.y + RAD + 50, "a 3-D stand-in for a 5,120-D space", { mono: true, size: 14, color: "muted", anchor: "middle" });

  /* token vectors */
  const VEC = [
    [" cat", norm3([.62, .3, .72]), .62],
    [" dog", norm3([.75, .45, .48]), 1.38],
    [" big", norm3([-.7, .4, .59]), .78],
    [" large", norm3([-.55, .62, .56]), 1.24],
    [" seven", norm3([.35, -.85, .15]), .5],
  ];
  const MAP = { " cat": [1150, 420], " dog": [1215, 455], " big": [1330, 370], " large": [1385, 395], " seven": [1290, 620] };
  const vecLayer = LX.el("g", {}, svg);
  const vecs = VEC.map(([tok, dir, len]) => {
    const g = LX.el("g", {}, vecLayer);
    const shaft = LX.el("line", { x1: C.x, y1: C.y, stroke: LX.col("embed"), "stroke-width": 2.5, "stroke-linecap": "round" }, g);
    const head = LX.el("path", { fill: LX.col("embed") }, g);
    const tip = LX.el("circle", { r: 5, fill: LX.col("embed"), opacity: 0 }, g);
    const lab = D.tokenText(g, 0, 0, tok, { size: 18, anchor: "middle" });
    return { tok, dir, len, g, shaft, head, tip, lab };
  });
  LX.el("circle", { cx: C.x, cy: C.y, r: 4, fill: LX.col("text-2") }, svg);

  /* angle arcs on the sphere surface */
  const slerp = (a, b, u) => { const d = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)), s = Math.sin(d); return a.map((x, i) => (Math.sin((1 - u) * d) * x + Math.sin(u * d) * b[i]) / s); };
  // short arc (similar) solid and bright; long arc (unrelated) dashed pink, so the two comparisons never read as one line
  const arcEls = [
    LX.el("path", { fill: "none", stroke: LX.col("text"), "stroke-width": 4, "stroke-linecap": "round" }, svg),
    LX.el("path", { fill: "none", stroke: LX.col("logit"), "stroke-width": 3, "stroke-linecap": "round", "stroke-dasharray": "9 7" }, svg),
  ];


  /* side notes */
  const notes = [
    D.text(svg, 960, 170, "direction = meaning · length = scale", { mono: true, size: 16, color: "embed" }),
    D.text(svg, 960, 205, "RMSNorm: every ‖x̂‖ = √5120 ≈ 71.6", { mono: true, size: 16, color: "norm" }),
    D.text(svg, 960, 240, "━  cat–dog: short arc → similar", { mono: true, size: 16, color: "text" }),
    D.text(svg, 960, 266, "┅  cat–seven: long arc → unrelated", { mono: true, size: 16, color: "logit" }),
  ];

  /* right-hand readout: vector lengths, then angles — fills the space until the flat map takes over */
  const RX = 960, read = LX.el("g", {}, svg);
  D.label(read, RX, 330, "vector length ‖x‖");
  const maxLen = Math.max(...VEC.map(v => v[2]));
  const bars = VEC.map(([tok, , len], i) => {
    const y = 356 + i * 46;
    D.tokenText(read, RX, y + 15, tok, { size: 18, anchor: "start" });
    LX.el("rect", { x: RX + 110, y, width: 330, height: 18, rx: 3, fill: LX.col("line") }, read);
    const bar = LX.el("rect", { x: RX + 110, y, width: 0, height: 18, rx: 3, fill: LX.col("embed") }, read);
    const val = D.text(read, RX + 556, y + 15, "", { mono: true, size: 16, color: "text-2", anchor: "end" });
    return { bar, val, len };
  });
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const deg = (a, b) => Math.acos(clamp(dot3(a, b), -1, 1)) * 180 / Math.PI;
  const angDog = deg(VEC[0][1], VEC[1][1]), angSeven = deg(VEC[0][1], VEC[4][1]);
  const angLab = D.label(read, RX, 620, "angle between directions");
  const angT = [
    D.text(read, RX, 654, `cat – dog     ${angDog.toFixed(0)}°   cos ${Math.cos(angDog * Math.PI / 180).toFixed(2)}`, { mono: true, size: 17, color: "text" }),
    D.text(read, RX, 686, `cat – seven   ${angSeven.toFixed(0)}°   cos ${Math.cos(angSeven * Math.PI / 180).toFixed(2)}`, { mono: true, size: 17, color: "logit" }),
  ];
  angT.forEach(e => e.setAttribute("style", "white-space:pre"));

  /* flat map panel */
  const panel = LX.el("g", {}, svg);
  LX.el("rect", { x: 1060, y: 310, width: 420, height: 390, rx: 10, fill: LX.mix("bg", "panel", .6), stroke: LX.col("line-2") }, panel);
  D.label(panel, 1080, 330, "flat map (2-D projection)");
  D.text(panel, 1270, 735, "e.g. PCA or UMAP · distances approximate", { mono: true, size: 14, color: "muted", anchor: "middle" });
  const flat = VEC.map(([tok]) => {
    const g = LX.el("g", { opacity: 0 }, svg);
    LX.el("circle", { r: 6, fill: LX.col("embed") }, g);
    D.tokenText(g, 11, 6, tok, { size: 16, anchor: "start" });
    const line = LX.el("line", { stroke: LX.col("embed"), "stroke-width": 1, "stroke-dasharray": "3 5", opacity: 0 }, svg);
    return { g, line, to: MAP[tok] };
  });

  ups.push(t => {
    const phi = phiAt(t);
    drawGlobe(phi);
    const flatQ = ctx.p(t, "flatten", .15, .75, LX.ease.inOut);
    const gOp = .45 + .55 * ctx.p(t, "norm", 0, .3);
    D.fade(globe, gOp * (1 - .55 * flatQ));
    outline.setAttribute("stroke-width", 1.5 + 1.5 * ctx.p(t, "norm", .2, .5) * (1 - ctx.p(t, "angles", 0, .3)));
    D.fade(globeLab, ctx.p(t, "arrows", 0, .3));
    const nq = ctx.p(t, "norm", .25, .75, LX.ease.inOut);
    vecs.forEach((v, i) => {
      const grow = ctx.p(t, "arrows", .1 + i * .1, .35 + i * .1);
      const L = lerp(v.len, 1, nq) * grow;
      const P = proj(v.dir.map(x => x * L), phi);
      const back = proj(v.dir, phi).z < 0;
      LX.attr(v.shaft, { x2: P.x, y2: P.y });
      const ang = Math.atan2(P.y - C.y, P.x - C.x), hs = 14;
      v.head.setAttribute("d", `M${P.x} ${P.y} L${P.x - hs * Math.cos(ang - .4)} ${P.y - hs * Math.sin(ang - .4)} L${P.x - hs * Math.cos(ang + .4)} ${P.y - hs * Math.sin(ang + .4)} Z`);
      LX.attr(v.tip, { cx: P.x, cy: P.y, opacity: nq > .95 ? 1 : 0, filter: nq > .95 ? "url(#lx-glow)" : "none" });
      LX.attr(v.lab, { x: P.x + 26 * Math.cos(ang), y: P.y + 26 * Math.sin(ang) + 6 });
      D.fade(v.g, (grow > 0 ? 1 : 0) * (back ? .5 : 1) * (1 - .5 * flatQ));
    });
    // arcs
    const pairs = [[0, 1], [0, 4]];
    pairs.forEach(([a, b], k) => {
      const q = ctx.p(t, "angles", .15 + k * .3, .4 + k * .3);
      const n = 30, u1 = q;
      let d = "";
      for (let i = 0; i <= n; i++) { const P = proj(slerp(vecs[a].dir, vecs[b].dir, i / n * u1), phi); d += (i ? "L" : "M") + P.x.toFixed(1) + " " + P.y.toFixed(1); }
      arcEls[k].setAttribute("d", q > 0 ? d : "");
      D.fade(arcEls[k], 1 - .7 * flatQ);
    });
    // readout panel: lengths shrink/grow to the same value under RMSNorm, then the two angles
    const rOp = ctx.p(t, "arrows", .2, .5) * (1 - ctx.p(t, "flatten", 0, .15));
    D.fade(read, rOp);
    bars.forEach((bb, i) => {
      const grow = ctx.p(t, "arrows", .1 + i * .1, .35 + i * .1);
      const L = lerp(bb.len, 1, nq);
      bb.bar.setAttribute("width", 330 * L / maxLen * grow);
      bb.bar.setAttribute("fill", nq > .95 ? LX.col("norm") : LX.col("embed"));
      bb.val.textContent = grow > 0 ? (L * 71.6).toFixed(1) : "";
    });
    D.fade(angLab, ctx.p(t, "angles", .1, .3));
    D.fade(angT[0], ctx.p(t, "angles", .2, .4)); D.fade(angT[1], ctx.p(t, "angles", .5, .7));
    D.fade(notes[0], ctx.p(t, "arrows", .4, .6));
    D.fade(notes[1], ctx.p(t, "norm", .5, .7));
    D.fade(notes[2], ctx.p(t, "angles", .15, .35)); D.fade(notes[3], ctx.p(t, "angles", .5, .65));
    // flatten
    D.fade(panel, ctx.p(t, "flatten", 0, .2));
    flat.forEach((f, i) => {
      const P = proj(vecs[i].dir, phi);
      const x = lerp(P.x, f.to[0], flatQ), y = lerp(P.y, f.to[1], flatQ);
      LX.attr(f.g, { transform: `translate(${x} ${y})`, opacity: flatQ > 0 ? 1 : 0 });
      LX.attr(f.line, { x1: P.x, y1: P.y, x2: x, y2: y, opacity: flatQ > 0 ? .7 * (1 - ctx.p(t, "flatten", .8, 1)) + .15 : 0 });
    });
  });
  return t => ups.forEach(u => u(t));
}

/* ================================================ scene: cosine-worked (Deeper) */
function buildCosine(ctx) {
  const { svg } = ctx, ups = [];
  D.backdrop(svg);
  const A = [0.6, 0.8, 0], B = [0.8, 0.6, 0], Cv = [0, 0, 1];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const len = u => Math.sqrt(dot(u, u));
  const f2 = x => (Math.abs(x) < 5e-10 ? 0 : x).toFixed(2);
  const ab = dot(A, B), la = len(A), lb = len(B), cosAB = ab / (la * lb);
  const thAB = Math.acos(cosAB) * 180 / Math.PI, ac = dot(A, Cv), thAC = Math.acos(ac / (la * len(Cv))) * 180 / Math.PI;

  /* small oblique 3-D view: x right, y up, z towards the viewer (down-left) */
  const O = { x: 360, y: 560 }, S = 300;
  const P = v => ({ x: O.x + S * v[0] - S * 0.42 * v[2], y: O.y - S * v[1] + S * 0.32 * v[2] });
  const axes = LX.el("g", {}, svg);
  [[[1.15, 0, 0], "x"], [[0, 1.15, 0], "y"], [[0, 0, 1.15], "z"]].forEach(([v, n]) => {
    const p = P(v);
    LX.el("line", { x1: O.x, y1: O.y, x2: p.x, y2: p.y, stroke: LX.col("line-2"), "stroke-width": 1.5 }, axes);
    D.text(axes, p.x + (n === "z" ? -18 : 10), p.y + (n === "y" ? -8 : 6), n, { mono: true, size: 16, color: "muted" });
  });
  D.label(svg, 80, 96, "Worked example · cosine similarity");
  const vec = (v, color, name) => {
    const p = P(v), g = LX.el("g", { opacity: 0 }, svg);
    const ln = LX.el("line", { x1: O.x, y1: O.y, x2: p.x, y2: p.y, stroke: LX.col(color), "stroke-width": 3.5, "stroke-linecap": "round" }, g);
    const ang = Math.atan2(p.y - O.y, p.x - O.x), hs = 15;
    LX.el("path", { d: `M${p.x} ${p.y} L${p.x - hs * Math.cos(ang - .4)} ${p.y - hs * Math.sin(ang - .4)} L${p.x - hs * Math.cos(ang + .4)} ${p.y - hs * Math.sin(ang + .4)} Z`, fill: LX.col(color) }, g);
    const t = D.text(g, p.x + 16 * Math.cos(ang) + 6, p.y + 16 * Math.sin(ang) + 6, name, { size: 22, weight: 600, color });
    t.setAttribute("font-weight", 700);
    return { g, ln, p };
  };
  const va = vec(A, "embed", "a"), vb = vec(B, "token", "b"), vc = vec(Cv, "attn", "c");
  // angle arc a–b (in the xy plane) and right-angle mark a–c
  const angA = Math.atan2(A[1], A[0]), angB = Math.atan2(B[1], B[0]), r = 90;
  const arc = LX.el("path", { d: `M${O.x + r * Math.cos(angB)} ${O.y - r * Math.sin(angB)} A ${r} ${r} 0 0 0 ${O.x + r * Math.cos(angA)} ${O.y - r * Math.sin(angA)}`, fill: "none", stroke: LX.col("text"), "stroke-width": 2.5, opacity: 0 }, svg);
  const arcT = D.text(svg, O.x + 128 * Math.cos((angA + angB) / 2), O.y - 128 * Math.sin((angA + angB) / 2) + 6, `${thAB.toFixed(0)}°`, { mono: true, size: 18, color: "text", anchor: "middle", opacity: 0 });
  LX.el("rect", { x: O.x + 128 * Math.cos((angA + angB) / 2) - 22, y: O.y - 128 * Math.sin((angA + angB) / 2) - 12, width: 44, height: 24, rx: 5, fill: LX.col("bg"), opacity: 0, class: "arcbg" }, svg);
  const arcBg = svg.querySelector(".arcbg"); svg.appendChild(arcT);
  const k = 0.24, qa = [A[0] * k, A[1] * k, 0], qc = [0, 0, k], qac = [A[0] * k, A[1] * k, k];
  const right = LX.el("path", { d: `M${P(qa).x} ${P(qa).y} L${P(qac).x} ${P(qac).y} L${P(qc).x} ${P(qc).y}`, fill: "none", stroke: LX.col("attn"), "stroke-width": 2, opacity: 0 }, svg);
  const rightT = D.text(svg, P(qac).x - 14, P(qac).y - 18, `${thAC.toFixed(0)}°`, { mono: true, size: 18, color: "attn", anchor: "end", opacity: 0 });

  /* calculation panel */
  const X = 900, lines = [];
  const L = (y, str, color = "text", size = 24) => { const t = D.text(svg, X, y, str, { mono: true, size, color, opacity: 0 }); t.setAttribute("style", "white-space:pre"); lines.push(t); return t; };
  D.text(svg, X, 160, `a = (${A.join(", ")})`, { mono: true, size: 22, color: "embed" });
  D.text(svg, X, 196, `b = (${B.join(", ")})`, { mono: true, size: 22, color: "token" });
  D.text(svg, X, 232, `c = (${Cv.join(", ")})`, { mono: true, size: 22, color: "attn" });
  const l1 = L(300, `a·b = ${A[0]}×${B[0]} + ${A[1]}×${B[1]} + ${A[2]}×${B[2]}`, "text-2", 21);
  const l2 = L(338, `    = ${f2(A[0] * B[0])} + ${f2(A[1] * B[1])} + ${f2(A[2] * B[2])} = ${f2(ab)}`);
  const l3 = L(410, `‖a‖ = √(${f2(A[0] ** 2)} + ${f2(A[1] ** 2)} + ${f2(A[2] ** 2)}) = ${f2(la)}`, "text-2", 21);
  const l4 = L(448, `‖b‖ = √(${f2(B[0] ** 2)} + ${f2(B[1] ** 2)} + ${f2(B[2] ** 2)}) = ${f2(lb)}`, "text-2", 21);
  const l5 = L(530, `cos θ = ${f2(ab)} / (${f2(la)} × ${f2(lb)}) = ${f2(cosAB)}`, "text", 26);
  const l6 = L(570, `θ ≈ ${thAB.toFixed(0)}°  → nearly the same direction`, "embed", 21);
  const l7 = L(650, `a·c = ${A[0]}×${Cv[0]} + ${A[1]}×${Cv[1]} + ${A[2]}×${Cv[2]} = ${f2(ac)}`, "text", 24);
  const l8 = L(690, `cos = 0  → θ = ${thAC.toFixed(0)}°, perpendicular: unrelated`, "attn", 21);
  const box = LX.el("rect", { x: X - 16, y: 498, width: 640, height: 92, rx: 8, fill: "none", stroke: LX.col("embed"), "stroke-width": 2, opacity: 0, filter: "url(#lx-glow)" }, svg);

  ups.push(t => {
    D.fade(va.g, ctx.p(t, "dot", 0, .15)); D.fade(vb.g, ctx.p(t, "dot", .08, .23));
    D.fade(l1, ctx.p(t, "dot", .25, .45)); D.fade(l2, ctx.p(t, "dot", .5, .75));
    D.fade(l3, ctx.p(t, "len", .1, .35)); D.fade(l4, ctx.p(t, "len", .4, .65));
    D.fade(l5, ctx.p(t, "cos", .05, .3)); D.fade(box, ctx.p(t, "cos", .25, .45));
    D.fade(arc, ctx.p(t, "cos", .35, .6)); D.fade(arcT, ctx.p(t, "cos", .45, .7)); D.fade(arcBg, .85 * ctx.p(t, "cos", .45, .7)); D.fade(l6, ctx.p(t, "cos", .55, .8));
    D.fade(vc.g, ctx.p(t, "perp", 0, .2)); D.fade(l7, ctx.p(t, "perp", .2, .45));
    D.fade(right, ctx.p(t, "perp", .45, .65)); D.fade(rightT, ctx.p(t, "perp", .5, .7)); D.fade(l8, ctx.p(t, "perp", .55, .8));
  });
  return t => ups.forEach(u => u(t));
}

/* ======================================== widget: embed-neighbours (toy space) */
LX.widget("embed-neighbours", host => {
  // Verified Qwen3.8 token IDs (with leading space) for words that appear here.
  const QID = { cat: 7993, dog: 5388, kitten: 74035, puppy: 39829, big: 2330, large: 3349, huge: 6552, seven: 7840, king: 11148, queen: 27000,
    hund: 183612, katt: 222764, bank: 5883, river: 14367, money: 3117, mat: 5344, floor: 6220, couch: 25313, bed: 4690, roof: 14693, sofa: 30051, sat: 7338 };
  const D16 = 24, R = LX.rng(2026);
  const unit = v => { const n = Math.hypot(...v); return v.map(x => x / n); };
  // directions are made orthogonal to each other (Gram–Schmidt), so the toy space has clean structure
  const taken = [];
  const rand = () => {
    let v = Array.from({ length: D16 }, () => R() * 2 - 1);
    taken.forEach(u => { const d = v.reduce((s, x, i) => s + x * u[i], 0); v = v.map((x, i) => x - d * u[i]); });
    v = unit(v); taken.push(v); return v;
  };
  const add = (...vs) => vs.reduce((a, [w, v]) => a.map((x, i) => x + w * v[i]), new Array(D16).fill(0));
  const noise = s => Array.from({ length: D16 }, () => (R() * 2 - 1) * s);
  // directions
  const G = { animal: rand(), number: rand(), size: rand(), person: rand(), verb: rand(), furniture: rand(), finance: rand(), water: rand() };
  const royal = rand(), female = rand(), young = rand(), nor = rand(), small = rand(), pet = rand(), wild = rand();
  const words = [];
  const W = (w, group, parts, s = .18, lang = "en") => words.push({ w, group, lang, v: add([1, G[group]], ...parts, [1, noise(s)]) });
  // animals (+ young)
  [["cat", pet], ["dog", pet], ["rabbit", pet], ["horse", null], ["cow", null], ["bird", null], ["fish", null], ["mouse", null], ["lion", wild], ["tiger", wild]]
    .forEach(([w, d]) => W(w, "animal", d ? [[.7, d]] : [], .3));
  const base = n => words.find(x => x.w === n).v;
  words.push({ w: "kitten", group: "animal", lang: "en", v: add([1, base("cat")], [.8, young], [1, noise(.08)]) });
  words.push({ w: "puppy", group: "animal", lang: "en", v: add([1, base("dog")], [.8, young], [1, noise(.08)]) });
  words.push({ w: "foal", group: "animal", lang: "en", v: add([1, base("horse")], [.8, young], [1, noise(.08)]) });
  words.push({ w: "calf", group: "animal", lang: "en", v: add([1, base("cow")], [.8, young], [1, noise(.08)]) });
  // numbers
  ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"].forEach(w => W(w, "number", [], .22));
  // size words
  [["big", 0], ["large", 0], ["huge", 0], ["giant", 0], ["small", 1], ["tiny", 1], ["little", 1]].forEach(([w, sm]) => W(w, "size", [[sm ? 1.1 : -1.1, small]], .14));
  // people & royalty
  const person = (w, r, f, y) => W(w, "person", [[r, royal], [f ? 1 : -1, female], [y, young]], .08);
  person("man", 0, 0, 0); person("woman", 0, 1, 0); person("king", 1.2, 0, 0); person("queen", 1.2, 1, 0);
  person("prince", 1.2, 0, .9); person("princess", 1.2, 1, .9); person("boy", 0, 0, .9); person("girl", 0, 1, .9);
  person("father", 0, 0, -.5); person("mother", 0, 1, -.5);
  // verbs
  ["run", "walk", "jump", "sit", "sat", "stand", "eat", "drink", "sleep", "swim"].forEach(w => W(w, "verb", [], .3));
  // furniture
  ["mat", "floor", "couch", "sofa", "bed", "chair", "table", "roof"].forEach(w => W(w, "furniture", [], .3));
  // money / water, and one ambiguous token in between
  ["money", "loan", "account", "cash"].forEach(w => W(w, "finance", [], .3));
  ["river", "lake", "shore", "water"].forEach(w => W(w, "water", [], .3));
  words.push({ w: "bank", group: "finance", lang: "en", v: add([.75, G.finance], [.75, G.water], [1, noise(.1)]) });
  // Norwegian translations: same meaning + a shared "Norwegian" direction
  [["hund", "dog"], ["katt", "cat"], ["hest", "horse"], ["fugl", "bird"], ["stor", "big"], ["liten", "small"], ["sju", "seven"], ["tre", "three"],
   ["konge", "king"], ["dronning", "queen"], ["mann", "man"], ["kvinne", "woman"], ["seng", "bed"], ["bord", "table"], ["elv", "river"], ["penger", "money"]]
    .forEach(([no, en]) => { const e = words.find(x => x.w === en); words.push({ w: no, group: e.group, lang: "no", v: add([1, e.v], [.55, nor], [1, noise(.06)]) }); });
  words.forEach(x => (x.u = unit(x.v)));
  const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

  // display layout: each group sits in its own region; its words go round a ring, ordered by
  // their direction inside the group, so near-synonyms and translations end up side by side
  const CENTRE = { animal: [150, 175], person: [360, 175], number: [570, 175], size: [770, 175],
    verb: [150, 465], furniture: [360, 465], finance: [570, 465], water: [770, 465] };
  const GNAME = { animal: "animals", person: "people", number: "numbers", size: "size", verb: "actions", furniture: "furniture", finance: "money", water: "water" };
  const d1 = rand(), d2 = rand();
  const groups = {};
  words.forEach(x => { if (x.w !== "bank") (groups[x.group] = groups[x.group] || []).push(x); });
  Object.entries(groups).forEach(([g, list]) => {
    const c = CENTRE[g];
    const base = unit(list.reduce((acc, x) => acc.map((v, i) => v + x.u[i]), new Array(D16).fill(0)));
    list.forEach(x => { const r = x.u.map((v, i) => v - base[i]); x.ang = Math.atan2(cos(r, d2), cos(r, d1)); });
    list.sort((a, b) => a.ang - b.ang);
    list.forEach((x, k) => {
      const a = -Math.PI / 2 + k / list.length * 2 * Math.PI;
      x.pos = [c[0] + 52 * Math.cos(a), c[1] + 92 * Math.sin(a)];
      x.right = Math.cos(a) >= -0.01;
    });
  });
  const bank = words.find(x => x.w === "bank"); bank.pos = [655, 465]; bank.right = true;

  const css = `
.enb { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 18px; }
.enb svg { width: 100%; height: auto; display: block; background: var(--lx-bg); border: 1px solid var(--lx-line); border-radius: 10px; touch-action: manipulation; }
.enb .w { cursor: pointer; }
.enb .w text { font: 500 12px var(--lx-mono); fill: var(--lx-text-2); }
.enb .w.no text { fill: var(--lx-muted); font-style: italic; }
.enb .w circle { fill: var(--lx-embed); opacity: .55; }
.enb .w.sel circle { opacity: 1; fill: var(--lx-token); }
.enb .w.sel text { fill: var(--lx-text); font-weight: 700; }
.enb .w.nb circle { opacity: 1; }
.enb .w.nb text { fill: var(--lx-embed); }
.enb .w.dim { opacity: .28; }
.enb .side { font-size: 14px; color: var(--lx-text-2); }
.enb .tabs { display: flex; gap: 6px; margin-bottom: 12px; }
.enb .tabs button { flex: 1; padding: 7px 8px; border-radius: 8px; border: 1px solid var(--lx-line-2); background: var(--lx-bg-2); color: var(--lx-text-2); font: 500 13px var(--lx-sans); cursor: pointer; }
.enb .tabs button[aria-pressed="true"] { border-color: var(--lx-embed); color: var(--lx-text); background: var(--lx-panel); }
.enb select { width: 100%; margin: 4px 0 10px; padding: 7px; border-radius: 8px; background: var(--lx-bg-2); color: var(--lx-text); border: 1px solid var(--lx-line-2); font: 14px var(--lx-mono); }
.enb .row { display: grid; grid-template-columns: 1fr 60px 52px; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--lx-line); font-family: var(--lx-mono); font-size: 13px; }
.enb .row .bar { height: 6px; border-radius: 3px; background: var(--lx-embed); }
.enb .row .id { color: var(--lx-dim); font-size: 11px; }
.enb .note { margin-top: 10px; font-size: 12px; color: var(--lx-dim); line-height: 1.5; }
.enb .res { font: 600 15px var(--lx-mono); color: var(--lx-token); }
@media (max-width: 700px) { .enb { grid-template-columns: 1fr; } .enb .w text { font-size: 15px; } }`;
  if (!document.getElementById("enb-css")) document.head.insertAdjacentHTML("beforeend", `<style id="enb-css">${css}</style>`);

  const tok = w => "·" + w;
  host.innerHTML = `<div class="enb">
    <div><svg viewBox="0 0 900 600" role="img" aria-label="Toy embedding map"></svg></div>
    <div class="side">
      <div class="tabs"><button data-m="nn" aria-pressed="true">Neighbours</button><button data-m="an" aria-pressed="false">A − B + C</button></div>
      <div class="pane nn"><label>Token</label><select class="pick"></select><div class="list"></div></div>
      <div class="pane an" hidden>
        <label>A</label><select class="a"></select><label>minus B</label><select class="b"></select><label>plus C</label><select class="c"></select>
        <div class="out"></div>
      </div>
      <p class="note">Toy space, not Qwen's real embeddings: 24 numbers per token instead of 5,120, built so the groups and directions are easy to see. Similarity is cosine in 24-D; the map is only a 2-D layout for display. Numbers after a word are its real Qwen3.8 token ID (with leading space) where known.</p>
    </div></div>`;
  const svg = host.querySelector("svg"), NS = "http://www.w3.org/2000/svg";
  const order = [...words].sort((a, b) => a.w.localeCompare(b.w));
  const opts = sel => order.map(x => `<option value="${x.w}"${x.w === sel ? " selected" : ""}>${tok(x.w)}${x.lang === "no" ? " (no)" : ""}</option>`).join("");
  host.querySelector(".pick").innerHTML = opts("cat");
  host.querySelector(".a").innerHTML = opts("king"); host.querySelector(".b").innerHTML = opts("man"); host.querySelector(".c").innerHTML = opts("woman");

  Object.entries(CENTRE).forEach(([g, c]) => {
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", c[0]); t.setAttribute("y", c[1] - 116); t.setAttribute("text-anchor", "middle");
    t.setAttribute("style", "font: 600 11px var(--lx-mono); letter-spacing: .14em; fill: var(--lx-dim); text-transform: uppercase");
    t.textContent = GNAME[g]; svg.appendChild(t);
  });
  const arrows = document.createElementNS(NS, "g"); svg.appendChild(arrows);
  words.forEach(x => {
    const g = document.createElementNS(NS, "g"); g.setAttribute("class", "w" + (x.lang === "no" ? " no" : ""));
    g.setAttribute("transform", `translate(${x.pos[0].toFixed(1)} ${x.pos[1].toFixed(1)})`);
    const c = document.createElementNS(NS, "circle"); c.setAttribute("r", 4.5); g.appendChild(c);
    const t = document.createElementNS(NS, "text"); t.setAttribute("x", x.right ? 7 : -7); t.setAttribute("y", 4); t.setAttribute("text-anchor", x.right ? "start" : "end"); t.textContent = x.w; g.appendChild(t);
    g.addEventListener("click", () => { mode("nn"); host.querySelector(".pick").value = x.w; showNN(x.w); });
    svg.appendChild(g); x.el = g;
  });
  const byW = w => words.find(x => x.w === w);
  const nearest = (u, exclude, n) => words.filter(x => !exclude.includes(x.w)).map(x => ({ x, s: cos(u, x.u) })).sort((a, b) => b.s - a.s).slice(0, n);
  const row = (x, s) => `<div class="row"><span>${tok(x.w)}${QID[x.w] ? ` <span class="id">${QID[x.w].toLocaleString("en-US")}</span>` : ""}</span><span><span class="bar" style="display:block;width:${Math.max(4, s * 100)}%"></span></span><span>${s.toFixed(2)}</span></div>`;
  const line = (a, b, cls) => { const l = document.createElementNS(NS, "line"); l.setAttribute("x1", a.pos[0]); l.setAttribute("y1", a.pos[1]); l.setAttribute("x2", b.pos[0]); l.setAttribute("y2", b.pos[1]); l.setAttribute("stroke", cls); l.setAttribute("stroke-width", 1.5); l.setAttribute("stroke-dasharray", "4 4"); arrows.appendChild(l); };
  function mark(sel, nbs) {
    arrows.innerHTML = "";
    words.forEach(x => { x.el.classList.toggle("sel", sel.includes(x.w)); x.el.classList.toggle("nb", nbs.includes(x.w)); x.el.classList.toggle("dim", !sel.includes(x.w) && !nbs.includes(x.w)); });
  }
  function showNN(w) {
    const x = byW(w), nb = nearest(x.u, [w], 5);
    host.querySelector(".list").innerHTML = `<p style="margin:2px 0 6px">Five nearest by cosine similarity:</p>` + nb.map(r => row(r.x, r.s)).join("");
    mark([w], nb.map(r => r.x.w)); nb.forEach(r => line(x, r.x, "var(--lx-embed)"));
  }
  function showAN() {
    const a = byW(host.querySelector(".a").value), b = byW(host.querySelector(".b").value), c = byW(host.querySelector(".c").value);
    const v = unit(a.u.map((x, i) => x - b.u[i] + c.u[i]));
    const res = nearest(v, [a.w, b.w, c.w], 3);
    host.querySelector(".out").innerHTML = `<p style="margin:6px 0">${tok(a.w)} − ${tok(b.w)} + ${tok(c.w)} ≈ <span class="res">${tok(res[0].x.w)}</span></p>` + res.map(r => row(r.x, r.s)).join("");
    mark([a.w, b.w, c.w], [res[0].x.w]); line(b, a, "var(--lx-muted)"); line(c, res[0].x, "var(--lx-token)");
  }
  function mode(m) {
    host.querySelectorAll(".tabs button").forEach(bt => bt.setAttribute("aria-pressed", String(bt.dataset.m === m)));
    host.querySelector(".pane.nn").hidden = m !== "nn"; host.querySelector(".pane.an").hidden = m !== "an";
    m === "nn" ? showNN(host.querySelector(".pick").value) : showAN();
  }
  host.querySelectorAll(".tabs button").forEach(bt => (bt.onclick = () => mode(bt.dataset.m)));
  host.querySelector(".pick").onchange = e => showNN(e.target.value);
  ["a", "b", "c"].forEach(k => (host.querySelector("." + k).onchange = showAN));
  showNN("cat");
});

LX.chapter({
  id: "embeddings", num: 5, title: "Embeddings", toc: "Embeddings",
  kicker: "From an ID to a vector",
  lede: "A token ID is only a name. The embedding table swaps each name for a vector of 5,120 numbers, the model's first description of what that token means.",
  body: [
    { prose: `
      <p>After tokenization we have a list of whole numbers. They are just positions in a list: token 7,993 (<code>·cat</code>) is not "bigger" than token 383 (<code>·on</code>) in any useful sense. The model needs something it can calculate with, so each ID is replaced by a vector.</p>
      <p>Those vectors live in the <strong>embedding table</strong>, a matrix with one row per vocabulary token. In Qwen3.8-27B it has shape <code>[248320, 5120]</code>: 248,320 rows of 5,120 numbers, about <strong>1.27 billion parameters</strong>.</p>` },

    { scene: {
      id: "embed-lookup", title: "Looking up a row", build: buildLookup,
      visual: "A tall embedding table fills the right side: a grid of value cells with sample row numbers 0 … 248,319 down the edge, brackets for 248,320 rows and 5,120 columns (20 shown). Token chips for “… the cat sat on the” (real IDs 279, 7993, 7338, 383, 279) sit on the left. For each chip, an amber pointer runs to its row; the row lights up and its cells fly out, one by one, into a vertical vector under the chip.",
      cues: [
        { id: "table", say: "This is the embedding table. It has one row for every token in the vocabulary, two hundred and forty-eight thousand three hundred and twenty rows, and each row holds five thousand one hundred and twenty numbers.", vis: "The table draws itself; brackets label [248,320 rows] and [5,120 columns]." },
        { id: "point", say: "To embed a token, the model goes to the row with that token's ID. Token seven thousand nine hundred and ninety-three, space-cat, points to row seven thousand nine hundred and ninety-three.", vis: "An amber pointer runs from the “·cat” chip to row 7,993, which lights up." },
        { id: "copy",  say: "And it simply copies that row out. Nothing is multiplied and nothing is added. It is a lookup, like finding a page in a book by its number.", vis: "The row’s cells fly out one by one into a vertical vector under the chip; note: “copy the row · no arithmetic”." },
        { id: "all",   say: "Every token in the prompt gets its own row. Five tokens become five vectors, a matrix of shape five by five thousand one hundred and twenty.", vis: "Four more pointers fire in quick succession; five vectors stand side by side; label [5, 5120]." },
        { id: "same",  say: "If the same token appears twice, it gets exactly the same vector both times. At this point, the model does not yet know where in the sentence a token stands.", vis: "Both “·the” chips point to the same row; their vectors are identical and briefly outlined together." },
      ],
    } },

    { prose: `
      <h3>The first two steps involve no arithmetic</h3>
      <p>Surprisingly, nothing has been calculated so far. Tokenizing and embedding are pure bookkeeping:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Step</th><th>What happens</th><th>Arithmetic?</th><th>Result shape</th></tr>
        <tr><td><strong class="c-token">Tokenize</strong></td><td>Fixed rules cut text into tokens and look up IDs</td><td>None</td><td class="num">[T] whole numbers</td></tr>
        <tr><td><strong class="c-embed">Embed</strong></td><td>Copy row <i>ID</i> from the embedding table</td><td>None, a lookup</td><td class="num">[T, 5120]</td></tr>
        <tr><td><strong class="c-norm">Layer 1 begins</strong></td><td><abbr>RMSNorm</abbr>, then the first matrix multiplications</td><td>Yes: the first real computation</td><td class="num">[T, 5120] → …</td></tr>
      </table></div>
      <p>So the first numbers the model actually <em>computes</em> come from normalising these vectors at the start of layer 1, and then multiplying them by that layer's weight matrices (<a href="#layer">Chapter 6</a>).</p>

      <h3>A space of meaning</h3>
      <p>The rows were not written by hand. They started as random numbers and were adjusted during training, like every other parameter. Training pushes tokens that are used in similar ways toward similar vectors. You can picture each token as a point in a space with 5,120 directions:</p>
      <ul>
        <li>Tokens with related meanings end up <strong>close together</strong>: <code>·cat</code>, <code>·kitten</code>, <code>·dog</code>.</li>
        <li>Some <strong>directions</strong> carry consistent meaning. Moving from <code>·king</code> toward <code>·queen</code> goes roughly the same way as moving from <code>·man</code> toward <code>·woman</code>.</li>
        <li>Most of the 5,120 directions do not correspond to anything a human would name. The meaning is spread across many numbers at once.</li>
      </ul>` },

    { scene: {
      id: "meaning-space", title: "Similar meaning, nearby vectors", build: buildMeaning,
      visual: "A dark 2-D map (a flattened view of the 5,120-dimensional space, labelled as such). Token dots drift in and settle into loose clusters: animals, numbers, size words, Norwegian words near their English counterparts. Then two arrows appear: man → woman and king → queen, parallel. Then real token IDs are tagged on neighbours to show the numbers were unrelated. Finally, a protractor-style arc measures the angle between ·cat and ·dog (small) and between ·cat and ·seven (large). All similarity values are illustrative.",
      cues: [
        { id: "map",   say: "We cannot draw five thousand one hundred and twenty directions, so here is a flattened map of the embedding space. Each dot is one token.", vis: "Grey dots fade in randomly; label “2-D projection of a 5,120-D space”." },
        { id: "near",  say: "After training, tokens that are used in similar ways sit close together. Animals gather in one region, numbers in another, and translations such as hund and dog often land near each other.", vis: "Dots glide into clusters; labels fade in: animals, size, numbers, people & royalty; dotted links katt–cat and hund–dog (Norwegian ↔ English)." },
        { id: "dir",   say: "Directions can carry meaning too. The step from man to woman points roughly the same way as the step from king to queen.", vis: "Two parallel arrows draw: man → woman, king → queen." },
        { id: "ids",   say: "Remember that the token IDs had no pattern. Big is two thousand three hundred and thirty, large is three thousand three hundred and forty-nine. Yet here, their vectors sit side by side. The similarity was learned.", vis: "·big and ·large highlight next to each other, their unrelated IDs shown as small tags; same for ·dog (5388) and ·hund (183612), ·cat and ·Cat." },
        { id: "angle", say: "The model measures similarity with the angle between vectors. Cat and dog point in similar directions. Cat and seven point in very different directions.", vis: "Rays from an origin to ·cat, ·dog and ·seven; a small arc between ·cat and ·dog (“small angle → similar”), a wide arc between ·cat and ·seven (“wide angle → unrelated”)." },
      ],
    } },

    { scene: {
      id: "embed-sphere", title: "Directions on a sphere", build: buildSphere,
      visual: "A wireframe globe (a 3-D stand-in for 5,120 dimensions, labelled as such) on the blueprint grid. Token vectors of different lengths shoot out from the centre as arrows. RMSNorm then pulls every arrowhead onto the globe's surface. Arcs between arrowheads show angles. Finally the globe is 'photographed' flat into the 2-D map from the previous scene, with a note: distances on the map are approximate.",
      cues: [
        { id: "arrows",  say: "Think of each vector as an arrow from the centre of a space. Its direction is what it means. Its length is mostly a matter of scale.", vis: "Arrows of different lengths for ·cat, ·dog, ·seven, ·big, ·large." },
        { id: "norm",    say: "Before every layer, a step called R M S norm, root mean square normalisation, rescales each vector to the same size. All the arrowheads land on the surface of a sphere.", vis: "Arrowheads glide onto the globe surface; a label shows the common length √5120 ≈ 71.6." },
        { id: "angles",  say: "On a sphere, the natural way to compare two points is the angle between them. That is exactly how the model compares tokens: small angle, similar meaning.", vis: "A short solid arc on the surface between ·cat and ·dog (similar), a long dashed pink arc between ·cat and ·seven (unrelated)." },
        { id: "flatten", say: "The real sphere has five thousand one hundred and twenty dimensions. To draw it, we squash it onto a flat map. That is what every two-dimensional picture of embeddings is: a projection, with distances only roughly right.", vis: "The arrowheads fly from the globe into a flat 2-D map panel; caption “e.g. PCA or UMAP · distances approximate”." },
      ],
    } },

    { prose: `
      <h3>Clusters without a clustering algorithm</h3>
      <p>The groups in the map look like the output of a clustering algorithm such as k-means, and running k-means on the embedding vectors typically does find meaningful groups: animals, numbers, verbs, punctuation, Norwegian words. Because similarity is an angle, the best-suited variant is <em>spherical</em> k-means, which uses cosine similarity as its distance.</p>
      <p>But the model itself never runs k-means. The clusters are a side effect of training: tokens that appear in similar contexts receive similar updates, so their vectors drift together. Clustering is a tool <em>we</em> use to look inside. There are two real echoes of the idea inside the model, though. Attention scores every earlier token by similarity and blends them with soft weights, which closely resembles the soft-assignment step of k-means (<a href="#attention">Chapter 7</a>). And in Mixture-of-Experts models, a router sends each token to the experts whose learned vectors it is most similar to.</p>

      <h3>One vector per token, whatever the context</h3>
      <p>The embedding table has exactly one row for <code>·bank</code> (ID 5,883). A river bank and a savings bank start from the same vector. The table cannot know which one you mean. That is the job of the 64 layers that follow. Each layer mixes in information from the surrounding tokens. Somewhere along the stack, the vector at the position of <code>·bank</code> moves toward "river" or toward "money", depending on the sentence. Researchers call these later vectors <em>contextual embeddings</em>.</p>

      <h3>Two things the embedding does not do</h3>
      <p><strong>It does not encode position.</strong> Older models added a "position vector" to every embedding. Qwen3.8 does not. The vectors leaving the embedding table say only <em>which</em> token, not <em>where</em>. Position is added later, inside each attention layer, by rotating parts of the query and key vectors (<abbr>RoPE</abbr>, <a href="#attention">Chapter 7</a>). Layers without attention find order in a different way (<a href="#deltanet">Chapter 8</a>).</p>
      <p><strong>It is not reused at the output.</strong> At the very end, the model needs the opposite operation: from a vector to a score for every token. Some models reuse the embedding table for that. Qwen3.8-27B has a separate output table, <code>lm_head</code>, with the same size, another 1.27 billion parameters (<a href="#output">Chapter 11</a>).</p>` },

    { widget: {
      id: "embed-neighbours", title: "Explore: nearest neighbours",
      sub: "Tap a word to see its five nearest neighbours by cosine similarity, or try word arithmetic such as king − man + woman. A toy space, built to make the ideas visible.",
    } },

    { deep: `
      <h3>Lookup is a multiplication in disguise</h3>
      <p>Write the embedding table as a matrix <i>E</i> of shape <code>[|V|, d]</code>, with |<i>V</i>| = 248,320 and <i>d</i> = 5,120. A token with ID <i>i</i> can be written as a <em>one-hot</em> vector <b>e</b><sub><i>i</i></sub>: 248,320 zeros with a single 1 at position <i>i</i>. Then:</p>
      <math display="block"><mrow><msub><mi mathvariant="bold">h</mi><mn>0</mn></msub><mo>=</mo><msubsup><mi mathvariant="bold">e</mi><mi>i</mi><mi>T</mi></msubsup><mi>E</mi><mo>=</mo><msub><mi>E</mi><mrow><mi>i</mi><mo>,</mo><mo>:</mo></mrow></msub></mrow></math>
      <div class="lx-read">h<sub>0</sub> is the token's starting vector, before layer 1. e<sub>i</sub> is the one-hot vector for token ID i (all zeros except a 1 at position i), and the small T turns it into a row so it can multiply the table E. Multiplying that row by E keeps only row i of the table and throws everything else away, so the result is simply E<sub>i,:</sub>, “row i, all columns”. Example: for <code>·cat</code>, i = 7,993, and h<sub>0</sub> is row 7,993 of the table: 5,120 numbers.</div>
      <p>Multiplying by a one-hot vector picks out row <i>i</i>. Mathematically the embedding is a matrix product. In practice nobody performs 248,320 × 5,120 multiplications by zero: the computer just reads row <i>i</i>. That is why we call it a lookup.</p>
      <h3>Measuring similarity</h3>
      <p>The dot product of two vectors grows when they point the same way and are long. Dividing by their lengths gives the <em>cosine similarity</em>, which depends only on the angle θ between them:</p>
      <math display="block"><mrow><mtext>cos</mtext><mo>⁡</mo><mi>θ</mi><mo>=</mo><mfrac><mrow><mi mathvariant="bold">a</mi><mo>·</mo><mi mathvariant="bold">b</mi></mrow><mrow><mo>‖</mo><mi mathvariant="bold">a</mi><mo>‖</mo><mspace width="0.2em"/><mo>‖</mo><mi mathvariant="bold">b</mi><mo>‖</mo></mrow></mfrac><mo>,</mo><mspace width="1em"/><mo>‖</mo><mi mathvariant="bold">a</mi><mo>‖</mo><mo>=</mo><msqrt><mrow><munder><mo>∑</mo><mi>i</mi></munder><msubsup><mi>a</mi><mi>i</mi><mn>2</mn></msubsup></mrow></msqrt></mrow></math>
      <div class="lx-read">First part: take the dot product of a and b, then divide it by the length of a times the length of b. The result, cos θ, depends only on the angle θ between the two vectors, not on how long they are. Second part: the length of a vector is found by squaring every one of its numbers, adding the squares up, and taking the square root. Example from the text: a = (0.6, 0.8, 0), b = (0.8, 0.6, 0) give 0.96 / (1 × 1) = 0.96.</div>
      <p>The value is 1 for the same direction, 0 for unrelated (perpendicular) directions, and −1 for opposite directions. In high dimensions, two random vectors are almost always close to perpendicular. So even a modest cosine such as 0.3 is a strong sign that two tokens are related (see the sphere section below).</p>
      <h3>Worked example</h3>
      <p>Take <b>a</b> = (0.6, 0.8, 0) and <b>b</b> = (0.8, 0.6, 0). Then <b>a</b>·<b>b</b> = 0.48 + 0.48 = 0.96, both lengths are 1, so cos θ = 0.96 (an angle of about 16°). For <b>c</b> = (0, 0, 1), <b>a</b>·<b>c</b> = 0: perpendicular, unrelated.</p>
      <h3>Why the vectors live on a sphere</h3>
      <p>RMSNorm divides a vector by its root-mean-square value (<a href="#layer">Chapter 6</a>):</p>
      <math display="block"><mrow><mover><mi mathvariant="bold">x</mi><mo>^</mo></mover><mo>=</mo><mfrac><mi mathvariant="bold">x</mi><mrow><mtext>rms</mtext><mo>(</mo><mi mathvariant="bold">x</mi><mo>)</mo></mrow></mfrac><mo>,</mo><mspace width="1em"/><mtext>rms</mtext><mo>(</mo><mi mathvariant="bold">x</mi><mo>)</mo><mo>=</mo><msqrt><mrow><mfrac><mn>1</mn><mi>d</mi></mfrac><munder><mo>∑</mo><mi>i</mi></munder><msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup></mrow></msqrt><mspace width="1em"/><mo>⇒</mo><mspace width="1em"/><mo>‖</mo><mover><mi mathvariant="bold">x</mi><mo>^</mo></mover><mo>‖</mo><mo>=</mo><msqrt><mi>d</mi></msqrt><mo>=</mo><msqrt><mn>5120</mn></msqrt><mo>≈</mo><mn>71.6</mn></mrow></math>
      <div class="lx-read">x is one token's vector of d = 5,120 numbers, and x̂ (“x hat”) is its normalised version. To get rms(x): square every number in x, add the squares up, divide by d to get the average square, and take the square root. Then divide every number in x by that rms value. The arrow says what follows: the normalised vector always has length √d, which for 5,120 numbers is about 71.6, whatever x looked like before.</div>
      <p>Every normalised vector therefore has the same length, about 71.6. Geometrically, they all lie on a sphere of that radius in 5,120 dimensions. The learned per-channel weights then stretch that sphere a little along some axes, so in reality it is a slightly squashed sphere (an ellipsoid). Only direction carries information, which is why angle, or cosine, is the natural measure.</p>
      <p>High-dimensional spheres are roomy. Two random directions in 5,120 dimensions have a cosine close to 0, typically within about ±0.014 (that is, 1/√5120). So a cosine of 0.3 between two tokens is far beyond chance.</p>
      <h3>Size of the two vocabulary tables</h3>
      <p>Embedding: 248,320 × 5,120 = 1,271,398,400 parameters. The separate output table <code>lm_head</code> is the same size again. Together they are about 2.54 billion, roughly 9% of the whole model, spent purely on getting into and out of vector space.</p>` },

    { scene: {
      id: "cosine-worked", deep: true, title: "Worked example: cosine similarity", build: buildCosine,
      visual: "Left: a small 3-D view with x, y and z axes and three arrows, a = (0.6, 0.8, 0), b = (0.8, 0.6, 0) and c = (0, 0, 1). Right: the calculation, line by line, with every number computed in the scene: the dot product a·b, the lengths ‖a‖ and ‖b‖, cos θ = 0.96 with the 16° arc between a and b, then a·c = 0 with a right-angle mark.",
      cues: [
        { id: "dot",  say: "Take two vectors, a and b. Their dot product multiplies matching numbers and adds them up: point six times point eight, plus point eight times point six, plus zero. That gives point nine six.", vis: "Arrows a and b appear; the products and their sum, 0.96, appear line by line." },
        { id: "len",  say: "Next, the length of each vector: square every number, add the squares, and take the square root. Both a and b have length exactly one.", vis: "‖a‖ = √(0.36 + 0.64 + 0) = 1 and ‖b‖ = 1." },
        { id: "cos",  say: "Divide the dot product by the two lengths, and you have the cosine: point nine six. That corresponds to an angle of about sixteen degrees. The two vectors point almost the same way.", vis: "cos θ = 0.96 / (1 × 1) = 0.96 in a glowing box; a 16° arc between a and b." },
        { id: "perp", say: "Now compare a with c, which points straight along the third axis. Every product is zero, so the cosine is zero. They meet at a right angle: as unrelated as two directions can be.", vis: "Arrow c appears; a·c = 0; a right-angle mark and 90° between a and c." },
      ],
    } },
  ],
});
})();
