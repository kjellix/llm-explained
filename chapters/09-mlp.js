/* Chapter 09 — The MLP and SwiGLU */
(function () {
  "use strict";
  const D = LX.draw, el = LX.el, col = LX.col, mix = LX.mix, clamp = LX.clamp;
  const silu = v => v / (1 + Math.exp(-v));
  const sigm = v => 1 / (1 + Math.exp(-v));
  const f2 = v => (v < 0 ? "−" : "") + Math.abs(v).toFixed(2);

  /* ---------------------------------------------------------------- helpers */
  function plusSign(parent, x, y, color = "embed") {
    const g = el("g", {}, parent);
    const c = el("circle", { cx: x, cy: y, r: 14, fill: col("bg"), stroke: col(color), "stroke-width": 2 }, g);
    el("path", { d: `M${x - 7} ${y} H${x + 7} M${x} ${y - 7} V${y + 7}`, stroke: col(color), "stroke-width": 2, "stroke-linecap": "round" }, g);
    return { g, show(p) { g.setAttribute("opacity", p); }, flash(q) { c.setAttribute("fill", mix("bg", color, q * .6)); c.setAttribute("filter", q > .15 ? "url(#lx-glow)" : "none"); } };
  }
  /** Element-wise product sign ⊙ */
  function odot(parent, x, y, color = "mlp") {
    const g = el("g", {}, parent);
    el("circle", { cx: x, cy: y, r: 16, fill: col("bg"), stroke: col(color), "stroke-width": 2 }, g);
    el("circle", { cx: x, cy: y, r: 3.5, fill: col(color) }, g);
    return g;
  }
  /** Text with a dark plate behind it, for labels drawn over busy areas. */
  function plate(parent, x, y, str, o = {}) {
    const g = el("g", {}, parent);
    const size = o.size || 14, w = str.length * size * (o.mono === false ? .55 : .6) + 16;
    const x0 = o.anchor === "end" ? x - w + 8 : o.anchor === "middle" ? x - w / 2 : x - 8;
    el("rect", { x: x0, y: y - size - 4, width: w, height: size + 12, rx: 5, fill: col("bg"), opacity: .88, stroke: col("line"), "stroke-width": 1 }, g);
    D.text(g, x, y, str, { mono: o.mono !== false, size, color: o.color || "text-2", anchor: o.anchor || "start", weight: o.weight || 400 });
    return g;
  }
  /** One <path> holding many small square dots: far cheaper than one element per dot. */
  function dotPath(x0, y0, cols, rows, pitch, size, keep = () => true) {
    let d = "";
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      if (keep(c, r)) d += `M${(x0 + c * pitch).toFixed(1)} ${(y0 + r * pitch).toFixed(1)}h${size}v${size}h-${size}z`;
    return d;
  }
  const lerp = LX.lerp;

  /* ================================================== scene: mlp-shape */
  function buildShape(ctx) {
    const { svg } = ctx;
    D.backdrop(svg);
    const R = LX.rng(808);
    const NX = 10, NH = 34;
    const rnd = () => R() * 2 - 1;
    const x = Array.from({ length: NX }, rnd);
    const Wg = Array.from({ length: NH }, () => Array.from({ length: NX }, rnd));
    const Wu = Array.from({ length: NH }, () => Array.from({ length: NX }, rnd));
    const Wd = Array.from({ length: NX }, () => Array.from({ length: NH }, rnd));
    const dot = (w, v) => w.reduce((s, wi, i) => s + wi * v[i], 0);
    const gate = Wg.map(w => .9 * dot(w, x));
    const up = Wu.map(w => .9 * dot(w, x));
    const sg = gate.map(silu);
    const h = sg.map((s, i) => s * up[i]);
    const out = Wd.map(w => .35 * dot(w, h));
    const norm = a => { const m = Math.max(...a.map(Math.abs)); return a.map(v => v / m); };
    const gMax = Math.max(...gate.map(Math.abs), ...up.map(Math.abs));
    // the two features we narrate: most negative gate, most positive gate
    const iNeg = gate.indexOf(Math.min(...gate)), iPos = gate.indexOf(Math.max(...gate));

    const ups = [];
    /* residual stream */
    const RY = 778;
    const resid = el("path", { d: `M80 ${RY} H1520`, stroke: col("embed"), "stroke-width": 3, fill: "none", opacity: .7 }, svg);
    D.label(svg, 80, RY - 14, "residual stream");
    const trav = D.traveller(svg, resid, { color: "embed", r: 6 });

    /* x */
    const xg = el("g", {}, svg);
    const xv = D.vector(xg, { x: 647.5, y: 120, values: x, cell: 26, gap: 5, dir: "h" });
    D.text(xg, 628, 126, "x", { mono: true, size: 20, color: "embed", anchor: "end", weight: 600 });
    D.text(xg, 972, 126, "[5120] · 10 shown", { mono: true, size: 14, color: "muted" });

    /* fans: gate_proj and up_proj */
    const fanG = el("polygon", { points: "647,142 796,142 756,304 80,304", fill: mix("bg", "mlp", .1), stroke: col("mlp"), "stroke-width": 1.5, "stroke-linejoin": "round" }, svg);
    const fanU = el("polygon", { points: "804,142 953,142 1520,304 844,304", fill: mix("bg", "mlp", .1), stroke: col("mlp"), "stroke-width": 1.5, "stroke-linejoin": "round" }, svg);
    const fanGl = el("g", {}, svg), fanUl = el("g", {}, svg);
    D.text(fanGl, 470, 262, "gate_proj", { mono: true, size: 17, color: "mlp", anchor: "middle", weight: 500 });
    D.text(fanGl, 470, 284, "5120 → 17408", { mono: true, size: 14, color: "muted", anchor: "middle" });
    D.text(fanUl, 1130, 262, "up_proj", { mono: true, size: 17, color: "mlp", anchor: "middle", weight: 500 });
    D.text(fanUl, 1130, 284, "5120 → 17408", { mono: true, size: 14, color: "muted", anchor: "middle" });

    /* gate and up rows */
    const C = 16, G = 4, W = NH * (C + G) - G;          // 676
    const gRow = D.vector(svg, { x: 80, y: 318, values: gate.map(v => v / gMax), cell: C, gap: G, dir: "h" });
    const uRow = D.vector(svg, { x: 844, y: 318, values: up.map(v => v / gMax), cell: C, gap: G, dir: "h" });
    const gLab = D.text(svg, 80, 350, "gate · [17408] · 34 shown", { mono: true, size: 14, color: "muted" });
    const uLab = D.text(svg, 844, 350, "up · [17408] · 34 shown", { mono: true, size: 14, color: "muted" });

    /* SiLU box */
    const sBox = el("g", {}, svg);
    el("rect", { x: 300, y: 370, width: 120, height: 48, rx: 6, fill: mix("bg", "mlp", .12), stroke: col("mlp"), "stroke-width": 1.5 }, sBox);
    let sd = "";
    for (let i = 0; i <= 30; i++) { const v = -4 + i * 8 / 30; sd += (i ? "L" : "M") + (312 + i * 1.3).toFixed(1) + " " + (406 - silu(v) * 6).toFixed(1); }
    el("path", { d: sd, stroke: col("mlp"), "stroke-width": 2, fill: "none" }, sBox);
    D.text(sBox, 400, 400, "SiLU", { mono: true, size: 15, color: "text", anchor: "end", weight: 500 });
    const sIn = D.arrow(svg, { x1: 360, y1: 330, x2: 360, y2: 366, color: "mlp", width: 1.5 });
    const sOut = D.arrow(svg, { x1: 360, y1: 420, x2: 360, y2: 440, color: "mlp", width: 1.5 });
    const sgRow = D.vector(svg, { x: 80, y: 456, values: sg.map(v => v / gMax), cell: C, gap: G, dir: "h" });
    const sgLab = D.text(svg, 80, 488, "SiLU(gate)", { mono: true, size: 14, color: "muted" });

    /* highlight boxes for the two narrated features */
    const hl = [];
    const box = (x0, y0, color) => { const r = el("rect", { x: x0 - 3, y: y0 - 3, width: C + 6, height: C + 6, rx: 4, fill: "none", stroke: col(color), "stroke-width": 2, opacity: 0 }, svg); hl.push(r); return r; };
    const cx = (left, i) => left + i * (C + G);
    const hG = [box(cx(80, iNeg), 310, "text"), box(cx(80, iPos), 310, "text")];
    const hS = [box(cx(80, iNeg), 448, "text"), box(cx(80, iPos), 448, "text")];
    const hU = [box(cx(844, iNeg), 310, "text"), box(cx(844, iPos), 310, "text")];

    /* ⊙ and product row */
    const mL = D.arrow(svg, { d: "M756 468 C 770 520, 780 540, 786 548", color: "mlp", width: 1.5, head: false });
    const mR = D.arrow(svg, { d: "M844 330 C 836 420, 820 500, 814 546", color: "mlp", width: 1.5, head: false });
    const od = odot(svg, 800, 562);
    const pLeft = 800 - W / 2;
    const pRow = D.vector(svg, { x: pLeft, y: 612, values: norm(h), cell: C, gap: G, dir: "h" });
    const hP = [box(cx(pLeft, iNeg), 604, "text"), box(cx(pLeft, iPos), 604, "text")];
    const pLab = D.text(svg, pLeft - 16, 617, "gate ⊙ up", { mono: true, size: 14, color: "muted", anchor: "end" });

    /* callout with real numbers */
    const co = el("g", {}, svg);
    D.label(co, 900, 392, "two of the 17,408 features, computed");
    const colsX = [900, 1040, 1160, 1300, 1420];
    const head = ["feature", "gate", "SiLU", "up", "product"];
    const cells = head.map((hd, k) => {
      const g = el("g", {}, co);
      D.text(g, colsX[k], 424, hd, { mono: true, size: 14, color: "dim" });
      [iNeg, iPos].forEach((i, r) => {
        const v = [`#${i + 1}`, f2(gate[i]), f2(sg[i]), f2(up[i]), f2(h[i])][k];
        D.text(g, colsX[k], 456 + r * 30, v, { mono: true, size: 16, color: k === 4 ? "mlp" : "text" });
      });
      return g;
    });
    const coNote = D.text(co, 900, 532, "a negative gate shrinks its feature to a small value; a positive gate lets it through", { size: 14, color: "muted" });

    /* down_proj and output */
    const fanD = el("polygon", { points: `${pLeft},628 ${pLeft + W},628 953,688 647,688`, fill: mix("bg", "mlp", .1), stroke: col("mlp"), "stroke-width": 1.5, "stroke-linejoin": "round" }, svg);
    const fanDl = el("g", {}, svg);
    D.text(fanDl, 1160, 660, "down_proj", { mono: true, size: 17, color: "mlp", weight: 500 });
    D.text(fanDl, 1160, 682, "17408 → 5120", { mono: true, size: 14, color: "muted" });
    const oRow = D.vector(svg, { x: 647.5, y: 706, values: norm(out), cell: 26, gap: 5, dir: "h" });
    const oLab = D.text(svg, 628, 712, "out", { mono: true, size: 16, color: "embed", anchor: "end", weight: 600 });
    const oArr = D.arrow(svg, { x1: 800, y1: 722, x2: 800, y2: 760, color: "embed", width: 2 });
    const plus = plusSign(svg, 800, RY);

    /* formula card */
    const card = el("g", {}, svg);
    el("rect", { x: 330, y: 806, width: 940, height: 62, rx: 8, fill: col("panel"), stroke: col("mlp"), "stroke-width": 1.5 }, card);
    const ft = D.text(card, 800, 846, "", { mono: true, size: 22, anchor: "middle" });
    [["SwiGLU", "mlp"], ["(x) = down( ", "text"], ["SiLU", "mlp"], ["(gate · x) ⊙ (up · x) )", "text"]].forEach(([s, c]) => { const t = el("tspan", { fill: col(c) }, ft); t.textContent = s; });

    ups.push(t => {
      const pin = ctx.p(t, "in", 0, .5);
      xg.setAttribute("opacity", pin); xg.setAttribute("transform", `translate(${(1 - pin) * -40} 0)`);
      D.fade(resid, .25 + .45 * ctx.p(t, "in", .3, .7));

      D.fade(fanG, ctx.p(t, "expand", 0, .3)); D.fade(fanGl, ctx.p(t, "expand", .1, .35));
      D.fade(fanU, ctx.p(t, "expand", .05, .35)); D.fade(fanUl, ctx.p(t, "expand", .15, .4));
      gRow.reveal(ctx.p(t, "expand", .3, .8, LX.ease.linear)); uRow.reveal(ctx.p(t, "expand", .35, .85, LX.ease.linear));
      D.fade(gLab, ctx.p(t, "expand", .7, .9)); D.fade(uLab, ctx.p(t, "expand", .75, .95));

      D.fade(sBox, ctx.p(t, "act", 0, .2)); sIn.draw(ctx.p(t, "act", .05, .2)); sOut.draw(ctx.p(t, "act", .2, .3));
      sgRow.reveal(ctx.p(t, "act", .25, .7, LX.ease.linear)); D.fade(sgLab, ctx.p(t, "act", .6, .8));
      const hla = ctx.p(t, "act", .55, .7);
      hG.concat(hS).forEach(r => D.fade(r, hla));
      D.fade(co, ctx.p(t, "act", .6, .8));
      [0, 1, 2].forEach(k => D.fade(cells[k], ctx.p(t, "act", .65 + k * .08, .8 + k * .08)));
      const pm = ctx.p(t, "mul", .55, .75);
      D.fade(cells[3], pm); D.fade(cells[4], ctx.p(t, "mul", .65, .85)); D.fade(coNote, ctx.p(t, "mul", .8, .95));

      mL.draw(ctx.p(t, "mul", 0, .3)); mR.draw(ctx.p(t, "mul", 0, .3));
      D.fade(od, ctx.p(t, "mul", .2, .35));
      pRow.reveal(ctx.p(t, "mul", .3, .75, LX.ease.linear)); D.fade(pLab, ctx.p(t, "mul", .6, .8));
      const hlb = ctx.p(t, "mul", .5, .65);
      hU.concat(hP).forEach(r => D.fade(r, hlb));
      // highlights retire when the output is formed
      const off = 1 - ctx.p(t, "down", 0, .2);
      if (t >= ctx.cue("down").start) hl.forEach(r => D.fade(r, off * Number(r.getAttribute("opacity") > 0 ? 1 : 0)));

      D.fade(fanD, ctx.p(t, "down", 0, .25)); D.fade(fanDl, ctx.p(t, "down", .1, .3));
      oRow.reveal(ctx.p(t, "down", .2, .55, LX.ease.linear)); D.fade(oLab, ctx.p(t, "down", .4, .55));
      oArr.draw(ctx.p(t, "down", .55, .7)); plus.show(ctx.p(t, "down", .6, .7));
      const tr = ctx.p(t, "down", .7, 1, LX.ease.inOut);
      trav.at(tr > 0 && tr < 1 ? .5 + tr * .5 : 0);
      plus.flash(LX.clamp(1 - Math.abs(ctx.p(t, "down", .6, .85, LX.ease.linear) - .5) * 2.2));

      const pc = ctx.p(t, "name", 0, .3);
      card.setAttribute("opacity", pc); card.setAttribute("transform", `translate(0 ${(1 - pc) * 10})`);
    });
    return t => ups.forEach(u => u(t));
  }

  /* ================================================== scene: silu-curve */
  function buildSilu(ctx) {
    const { svg } = ctx;
    D.backdrop(svg);
    // plot box: x ∈ [−6, 6], y ∈ [−1, 6], equal scale
    const X0 = 200, X1 = 1200, Y0 = 160, Y1 = 160 + 7 * 1000 / 12;
    const sx = (X1 - X0) / 12, sy = (Y1 - Y0) / 7;
    const px = v => X0 + (v + 6) * sx, py = v => Y1 - (v + 1) * sy;
    const ax = el("g", {}, svg);
    el("rect", { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, fill: col("bg"), opacity: .55, stroke: col("line"), "stroke-width": 1 }, ax);
    for (let v = -6; v <= 6; v++) {
      el("line", { x1: px(v), y1: Y0, x2: px(v), y2: Y1, stroke: col(v === 0 ? "line-2" : "grid-2"), "stroke-width": 1 }, ax);
      if (v % 2 === 0) D.text(ax, px(v), Y1 + 24, (v < 0 ? "−" : "") + Math.abs(v), { mono: true, size: 14, color: "muted", anchor: "middle" });
    }
    for (let v = -1; v <= 6; v++) {
      el("line", { x1: X0, y1: py(v), x2: X1, y2: py(v), stroke: col(v === 0 ? "line-2" : "grid-2"), "stroke-width": 1 }, ax);
      D.text(ax, X0 - 12, py(v) + 5, (v < 0 ? "−" : "") + Math.abs(v), { mono: true, size: 14, color: "muted", anchor: "end" });
    }
    el("line", { x1: X0, y1: py(0), x2: X1, y2: py(0), stroke: col("muted"), "stroke-width": 1.5 }, ax);
    el("line", { x1: px(0), y1: Y0, x2: px(0), y2: Y1, stroke: col("muted"), "stroke-width": 1.5 }, ax);
    D.text(ax, X1 - 4, py(0) + 26, "input x", { mono: true, size: 14, color: "muted" });
    D.text(ax, px(0) + 10, Y0 - 12, "output", { mono: true, size: 14, color: "muted" });

    const curve = (fn, a = -6, b = 6, n = 360, clipY = 6) => {
      let d = "";
      for (let i = 0; i <= n; i++) { const v = a + (b - a) * i / n; d += (i ? "L" : "M") + px(v).toFixed(2) + " " + py(Math.min(clipY, fn(v))).toFixed(2); }
      return d;
    };
    const sig = el("path", { d: curve(sigm), stroke: col("mlp"), "stroke-width": 1.5, "stroke-dasharray": "6 6", fill: "none", opacity: 0 }, svg);
    const relu = D.arrow(svg, { d: curve(v => Math.max(0, v)), color: "muted", width: 3, head: false });
    const siluP = D.arrow(svg, { d: curve(silu), color: "mlp", width: 3.5, head: false });

    /* legend */
    const lg = [
      [D.text(svg, 1270, 200, "ReLU(x) = max(0, x)", { mono: true, size: 16, color: "text-2" }), "muted"],
      [D.text(svg, 1270, 235, "SiLU(x) = x · σ(x)", { mono: true, size: 16, color: "mlp" }), "mlp"],
      [D.text(svg, 1270, 270, "σ(x): switch 0 → 1", { mono: true, size: 16, color: "muted" }), "mlp"],
    ];
    const sw = lg.map(([t, c], i) => el("line", { x1: 1240, y1: 194 + i * 35, x2: 1260, y2: 194 + i * 35, stroke: col(c), "stroke-width": 3, "stroke-dasharray": i === 2 ? "4 4" : null }, svg));

    /* marker + readout */
    const mk = el("circle", { r: 8, fill: col("text"), stroke: col("bg"), "stroke-width": 2, opacity: 0, filter: "url(#lx-glow)" }, svg);
    const ro = plate(svg, 0, 0, "", { size: 16 });
    const roText = ro.querySelector("text"), roRect = ro.querySelector("rect");
    const setRO = (x, y, s, c) => {
      roText.textContent = s; roText.setAttribute("x", x); roText.setAttribute("y", y); roText.setAttribute("fill", col(c));
      const w = s.length * 9.6 + 16; LX.attr(roRect, { x: x - 8, y: y - 20, width: w });
    };
    const fmt = v => (v < 0 ? "−" : "") + Math.abs(v).toFixed(2);

    /* minimum, found numerically */
    let lo = -3, hi = 0;
    for (let k = 0; k < 80; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (silu(m1) < silu(m2)) hi = m2; else lo = m1; }
    const xm = (lo + hi) / 2, ym = silu(xm);
    const minDot = el("circle", { cx: px(xm), cy: py(ym), r: 6, fill: col("mlp"), opacity: 0 }, svg);

    /* zoom inset (upper-left of the plot, where both curves are flat) */
    const IX0 = 236, IY0 = 186, IW = 440, IH = 280;
    const ins = el("g", { opacity: 0 }, svg);
    el("rect", { x: IX0, y: IY0, width: IW, height: IH, rx: 8, fill: col("panel"), stroke: col("mlp"), "stroke-width": 1.5 }, ins);
    D.label(ins, IX0 + 16, IY0 + 26, "zoom: x from −4 to 0.6");
    const zx = v => IX0 + 30 + (v + 4) / 4.6 * (IW - 60), zy = v => IY0 + 50 + (0.6 - v) / 1.0 * (IH - 80);
    el("line", { x1: IX0 + 20, y1: zy(0), x2: IX0 + IW - 20, y2: zy(0), stroke: col("muted"), "stroke-width": 1 }, ins);
    el("line", { x1: zx(0), y1: IY0 + 40, x2: zx(0), y2: IY0 + IH - 20, stroke: col("muted"), "stroke-width": 1 }, ins);
    let zd = "", rd = "";
    for (let i = 0; i <= 200; i++) { const v = -4 + 4.6 * i / 200; zd += (i ? "L" : "M") + zx(v).toFixed(1) + " " + zy(silu(v)).toFixed(1); rd += (i ? "L" : "M") + zx(v).toFixed(1) + " " + zy(Math.max(0, v)).toFixed(1); }
    el("path", { d: rd, stroke: col("muted"), "stroke-width": 2, fill: "none" }, ins);
    el("path", { d: zd, stroke: col("mlp"), "stroke-width": 3, fill: "none" }, ins);
    el("line", { x1: zx(xm), y1: zy(0), x2: zx(xm), y2: zy(ym), stroke: col("mlp"), "stroke-width": 1, "stroke-dasharray": "3 3" }, ins);
    el("circle", { cx: zx(xm), cy: zy(ym), r: 6, fill: col("mlp") }, ins);
    D.text(ins, zx(xm) - 14, zy(ym) + 26, `minimum ≈ ${fmt(ym).replace(/(\.\d{2})$/, "$1")}`, { mono: true, size: 15, color: "text", anchor: "end" });
    D.text(ins, zx(xm) - 14, zy(ym) + 46, `at x ≈ ${fmt(xm)}`, { mono: true, size: 15, color: "text-2", anchor: "end" });
    D.text(ins, zx(-4) - 4, zy(0) - 8, "0", { mono: true, size: 13, color: "muted" });
    // precise labels with three decimals
    ins.querySelectorAll("text")[1].textContent = `minimum ≈ −${Math.abs(ym).toFixed(3)}`;
    ins.querySelectorAll("text")[2].textContent = `at x ≈ −${Math.abs(xm).toFixed(3)}`;
    const lead = el("path", { d: `M${px(xm)} ${py(ym)} L${zx(xm)} ${IY0 + IH}`, stroke: col("mlp"), "stroke-width": 1, "stroke-dasharray": "4 4", fill: "none", opacity: 0 }, svg);

    return t => {
      // ReLU draws, marker visits −2 then 3
      relu.draw(ctx.p(t, "relu", 0, .35, LX.ease.inOut));
      D.fade(lg[0][0], ctx.p(t, "relu", .2, .4)); D.fade(sw[0], ctx.p(t, "relu", .2, .4));
      D.fade(lg[1][0], ctx.p(t, "silu", .2, .4)); D.fade(sw[1], ctx.p(t, "silu", .2, .4));
      D.fade(lg[2][0], ctx.p(t, "silu", .45, .6)); D.fade(sw[2], ctx.p(t, "silu", .45, .6));
      siluP.draw(ctx.p(t, "silu", 0, .4, LX.ease.inOut));
      D.fade(sig, .55 * ctx.p(t, "silu", .45, .65));

      let mx = null, fn = null, c = "text";
      if (ctx.active(t, "relu") && t > ctx.cue("relu").start + ctx.cue("relu").dur * .4) {
        const q = ctx.p(t, "relu", .45, .9, LX.ease.inOut); mx = lerp(-2, 3, q); fn = v => Math.max(0, v); c = "text";
        setRO(px(mx) + 18, py(fn(mx)) - 18, `ReLU(${fmt(mx)}) = ${fmt(fn(mx))}`, "text");
      } else if (ctx.active(t, "silu") && t > ctx.cue("silu").start + ctx.cue("silu").dur * .6) {
        const q = ctx.p(t, "silu", .62, .95, LX.ease.inOut); mx = lerp(-2, 3, q); fn = silu; c = "mlp";
        setRO(px(mx) + 18, py(fn(mx)) - 18, `SiLU(${fmt(mx)}) = ${fmt(fn(mx))}`, "mlp");
      }
      if (mx != null) { LX.attr(mk, { cx: px(mx), cy: py(fn(mx)), opacity: 1, fill: col(c) }); D.fade(ro, 1); }
      else { D.fade(mk, 0); D.fade(ro, 0); }

      const z = ctx.p(t, "dip", .1, .4);
      D.fade(minDot, ctx.p(t, "dip", 0, .15)); D.fade(lead, z); D.fade(ins, z);
    };
  }

  /* ================================================== scene: mlp-neurons */
  function buildNeurons(ctx) {
    const { svg } = ctx;
    D.backdrop(svg);
    const P = 4, S = 2.4;                       // dot pitch and size: everything to scale
    const IN = { x: 80, y: 302, c: 80, r: 64 }, NE = { x: 528, y: 174, c: 136, r: 128 }, OUT = { x: 1200, y: 302, c: 80, r: 64 };
    const R = LX.rng(1708);
    const at = (B, c, r) => [B.x + c * P + S / 2, B.y + r * P + S / 2];
    const ups = [];

    /* input block */
    const inG = el("g", {}, svg);
    el("path", { d: dotPath(IN.x, IN.y, IN.c, IN.r, P, S), fill: col("embed"), opacity: .85 }, inG);
    D.text(inG, IN.x + 160, IN.y + 290, "5,120 numbers", { mono: true, size: 16, color: "embed", anchor: "middle", weight: 500 });
    D.text(inG, IN.x + 160, IN.y + 312, "80 × 64 dots", { mono: true, size: 14, color: "muted", anchor: "middle" });

    /* neuron block: base + two firing patterns (each a single path) */
    const neG = el("g", {}, svg);                // transformed in the last cue
    const clipId = "ne-clip";
    const cp = el("clipPath", { id: clipId }, svg.querySelector("defs"));
    const clipR = el("rect", { x: NE.x - 2, y: NE.y - 2, width: 0, height: NE.r * P + 4 }, cp);
    const neInner = el("g", { "clip-path": `url(#${clipId})` }, neG);
    const base = el("path", { d: dotPath(NE.x, NE.y, NE.c, NE.r, P, S), fill: col("mlp") }, neInner);
    const pat = seed => {
      const r = LX.rng(seed), lvl = new Map();
      for (let i = 0; i < NE.c * NE.r; i++) { const u = r(); if (u < .035) lvl.set(i, 2); else if (u < .11) lvl.set(i, 1); }
      return {
        bright: el("path", { d: dotPath(NE.x, NE.y, NE.c, NE.r, P, S, (c, rr) => lvl.get(rr * NE.c + c) === 2), fill: mix("mlp", "#ffffff", .45), opacity: 0 }, neInner),
        mid: el("path", { d: dotPath(NE.x, NE.y, NE.c, NE.r, P, S, (c, rr) => lvl.get(rr * NE.c + c) === 1), fill: col("mlp"), opacity: 0 }, neInner),
      };
    };
    const pA = pat(11), pB = pat(29);
    const neLab = el("g", {}, svg);
    D.text(neLab, NE.x + 272, NE.y + 548, "17,408 neurons", { mono: true, size: 16, color: "mlp", anchor: "middle", weight: 500 });
    D.text(neLab, NE.x + 272, NE.y + 570, "136 × 128 dots", { mono: true, size: 14, color: "muted", anchor: "middle" });
    const ratio = el("g", {}, svg);
    D.text(ratio, 800, 138, "drawn to scale · 17,408 ÷ 5,120 = 3.4×", { mono: true, size: 15, color: "text-2", anchor: "middle" });
    const a1 = D.arrow(svg, { x1: 412, y1: 430, x2: 514, y2: 430, color: "mlp", width: 2 });

    /* output block */
    const outG = el("g", {}, svg);
    el("path", { d: dotPath(OUT.x, OUT.y, OUT.c, OUT.r, P, S), fill: col("embed"), opacity: .85 }, outG);
    const outLab = el("g", {}, svg);
    D.text(outLab, OUT.x + 160, OUT.y + 290, "5,120 numbers out", { mono: true, size: 16, color: "embed", anchor: "middle", weight: 500 });

    /* one neuron, zoomed */
    const NC = 68, NR = 64, [nx, ny] = at(NE, NC, NR);
    const one = el("g", { opacity: 0 }, svg);
    const fanIn = el("g", {}, one), fanOut = el("g", {}, one);
    const lines = (n, from, toFn, bow, color, op, parent) => {
      for (let i = 0; i < n; i++) {
        const [x1, y1] = from(i), [x2, y2] = toFn(i);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + bow;
        el("path", { d: `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`, stroke: color, "stroke-width": 1, fill: "none", opacity: op }, parent);
      }
    };
    const rIn = () => at(IN, Math.floor(R() * IN.c), Math.floor(R() * IN.r));
    const rOut = () => at(OUT, Math.floor(R() * OUT.c), Math.floor(R() * OUT.r));
    lines(30, rIn, () => [nx - 30, ny - 6], -150, col("mlp"), .32, fanIn);
    lines(30, rIn, () => [nx - 30, ny + 6], 150, mix("mlp", "#ffffff", .45), .32, fanIn);
    lines(48, () => [nx + 30, ny], rOut, 0, col("embed"), .35, fanOut);
    const node = el("circle", { cx: nx, cy: ny, r: 30, fill: mix("bg", "mlp", .4), stroke: col("mlp"), "stroke-width": 2.5, filter: "url(#lx-glow)" }, one);
    D.text(one, nx, ny + 7, "0.8", { mono: true, size: 20, color: "text", anchor: "middle", weight: 600 });
    const lbls = el("g", {}, one);
    plate(lbls, nx, ny - 52, "output: 1 number per token", { anchor: "middle", size: 16, color: "text" });
    plate(lbls, nx, ny + 70, "connections: 15,360 weights", { anchor: "middle", size: 16, color: "mlp" });
    plate(lbls, 600, 222, "gate · 5,120 weights", { anchor: "middle", color: "mlp" });
    plate(lbls, 600, 652, "up · 5,120 weights", { anchor: "middle", color: "text-2" });
    plate(lbls, 1080, 250, "down · 5,120 weights", { anchor: "middle", color: "embed" });
    const nodeGrow = el("circle", { cx: nx, cy: ny, r: 2, fill: "none", stroke: col("text"), "stroke-width": 2, opacity: 0 }, svg);

    /* firing labels */
    const fire = el("g", { opacity: 0 }, svg);
    const tokA = D.text(fire, 800, 138, "token: ·cat", { mono: true, size: 16, color: "token", anchor: "middle", weight: 500 });
    const tokB = D.text(fire, 800, 138, "token: ·sat", { mono: true, size: 16, color: "token", anchor: "middle", weight: 500 });
    const fireNote = D.text(fire, 800, 160, "bright = strong response · most neurons stay near zero", { size: 14, color: "muted", anchor: "middle" });

    /* back: converge into output, add to the stream */
    const conv = [-150, -70, 0, 70, 150].map(dy => D.arrow(svg, { d: `M1080 ${430 + dy} C 1130 ${430 + dy}, 1150 ${430 + dy * .4}, 1190 ${430 + dy * .25}`, color: "mlp", width: 1.5 }));
    const RY = 800;
    const resid = el("path", { d: `M80 ${RY} H1520`, stroke: col("embed"), "stroke-width": 3, fill: "none" }, svg);
    const residLab = D.label(svg, 80, RY - 14, "residual stream");
    const dArr = D.arrow(svg, { x1: 1360, y1: 640, x2: 1360, y2: RY - 18, color: "embed", width: 2 });
    const plus = plusSign(svg, 1360, RY);
    const trav = D.traveller(svg, resid, { color: "embed", r: 6 });

    /* stack of 64 layers */
    const SX = 1000, SW = 380, SH = 6, SG = 2.5, SB = 770;
    const slabY = i => SB - (i + 1) * (SH + SG) + SG;
    const stack = el("g", {}, svg);
    const slabs = Array.from({ length: 64 }, (_, i) => el("rect", { x: SX, y: slabY(i), width: SW, height: SH, rx: 1.5, fill: mix("bg", "mlp", .55), opacity: 0 }, stack));
    const stLab = el("g", { opacity: 0 }, svg);
    D.text(stLab, SX + SW / 2, slabY(63) - 18, "64 layers, one MLP each", { mono: true, size: 15, color: "text-2", anchor: "middle" });
    D.text(stLab, SX - 16, slabY(0) + 6, "one layer = 17,408 neurons →", { mono: true, size: 14, color: "muted", anchor: "end" });
    const cnt = el("g", { opacity: 0 }, svg);
    D.label(cnt, 120, 360, "neurons in all MLPs");
    const cntN = D.text(cnt, 120, 420, "17,408", { mono: true, size: 56, color: "mlp", weight: 600 });
    const cntF = D.text(cnt, 120, 456, "64 × 17,408", { mono: true, size: 16, color: "muted" });
    const conn = el("g", { opacity: 0 }, svg);
    D.label(conn, 120, 530, "connections (all parameters)");
    D.text(conn, 120, 584, "27.8 billion", { mono: true, size: 44, color: "text", weight: 600 });
    D.text(conn, 120, 616, "each neuron: 1 output, 15,360 weights", { mono: true, size: 15, color: "muted" });

    ups.push(t => {
      /* width / expand */
      D.fade(inG, ctx.p(t, "width", .1, .5));
      clipR.setAttribute("width", (NE.c * P + 4) * ctx.p(t, "expand", .1, .6, LX.ease.inOut));
      a1.draw(ctx.p(t, "expand", 0, .15));
      D.fade(neLab, ctx.p(t, "expand", .55, .75));
      D.fade(ratio, ctx.p(t, "expand", .65, .85) * (1 - ctx.p(t, "fire", 0, .1)));

      /* one */
      const o1 = ctx.p(t, "one", 0, .15), o0 = 1 - ctx.p(t, "fire", 0, .15);
      const dim = o1 * o0;
      base.setAttribute("opacity", (1 - .75 * dim) * (1 - .55 * ctx.p(t, "fire", .1, .3)));
      D.fade(inG, ctx.p(t, "width", .1, .5) * (1 - .45 * dim));
      const g = ctx.p(t, "one", .05, .2);
      LX.attr(nodeGrow, { r: 2 + 28 * g, opacity: g > 0 && g < 1 ? 1 - g : 0 });
      D.fade(one, ctx.p(t, "one", .15, .3) * o0);
      D.fade(fanIn, ctx.p(t, "one", .3, .5)); D.fade(fanOut, ctx.p(t, "one", .55, .7));
      D.fade(lbls, ctx.p(t, "one", .3, .45));
      D.fade(outG, .3 * ctx.p(t, "one", .5, .65) * o0 + ctx.p(t, "back", 0, .3));

      /* fire: token A, then token B */
      const fa = ctx.p(t, "fire", .15, .35), fb = ctx.p(t, "fire", .6, .75);
      const keep = 1 - ctx.p(t, "stack", 0, .2);
      [pA.bright, pA.mid].forEach(e => D.fade(e, fa * (1 - fb) * keep));
      [pB.bright, pB.mid].forEach(e => D.fade(e, fb * keep));
      D.fade(fire, ctx.p(t, "fire", .15, .3) * (1 - ctx.p(t, "back", 0, .2)));
      D.fade(tokA, 1 - fb); D.fade(tokB, fb);

      /* back */
      conv.forEach((a, i) => a.draw(ctx.p(t, "back", .1 + i * .04, .4 + i * .04)));
      D.fade(outLab, ctx.p(t, "back", .1, .3));
      D.fade(resid, .2 + .8 * ctx.p(t, "back", .4, .55)); D.fade(residLab, ctx.p(t, "back", .4, .55));
      dArr.draw(ctx.p(t, "back", .5, .7)); plus.show(ctx.p(t, "back", .55, .7));
      plus.flash(LX.clamp(1 - Math.abs(ctx.p(t, "back", .65, .9, LX.ease.linear) - .5) * 2.2));
      const tr = ctx.p(t, "back", .72, 1, LX.ease.inOut);
      trav.at(tr > 0 && tr < 1 ? (1360 - 80) / 1440 + tr * (1 - (1360 - 80) / 1440) : 0);

      /* stack: everything else fades, the neuron block becomes slab 1 */
      const fade = 1 - ctx.p(t, "stack", 0, .2);
      [inG, outG, outLab, neLab, resid, residLab, plus.g].forEach(e => e.setAttribute("opacity", Math.min(Number(e.getAttribute("opacity") ?? 1), fade)));
      conv.forEach(a => a.g.setAttribute("opacity", fade)); dArr.g.setAttribute("opacity", fade); a1.g.setAttribute("opacity", fade);
      const q = ctx.p(t, "stack", .15, .45, LX.ease.inOut);
      const sxs = lerp(1, SW / (NE.c * P), q), sys = lerp(1, SH / (NE.r * P), q);
      const tx = lerp(0, SX - NE.x * (SW / (NE.c * P)), q), ty = lerp(0, slabY(0) - NE.y * (SH / (NE.r * P)), q);
      neG.setAttribute("transform", `translate(${tx} ${ty}) scale(${sxs} ${sys})`);
      neG.setAttribute("opacity", 1 - ctx.p(t, "stack", .42, .48));
      const nShown = Math.round(lerp(1, 64, ctx.p(t, "stack", .45, .78, LX.ease.inOut)));
      slabs.forEach((s, i) => s.setAttribute("opacity", t >= ctx.cue("stack").start + ctx.cue("stack").dur * .44 && i < nShown ? 1 : 0));
      // light pulse up the finished stack
      const pu = ctx.p(t, "stack", .8, 1, LX.ease.inOut) * 70 - 3;
      slabs.forEach((s, i) => { const h = clamp(1 - Math.abs(pu - i) / 4); s.setAttribute("fill", mix("bg", "mlp", .55 + .4 * h)); });
      D.fade(stLab, ctx.p(t, "stack", .5, .65));
      D.fade(cnt, ctx.p(t, "stack", .4, .55));
      cntN.textContent = (17408 * nShown).toLocaleString("en-US");
      cntF.textContent = `${nShown} × 17,408`;
      D.fade(conn, ctx.p(t, "stack", .78, .92));
    });
    return t => ups.forEach(u => u(t));
  }

LX.chapter({
  id: "mlp", num: 9, title: "The MLP and SwiGLU", toc: "MLP & SwiGLU",
  kicker: "Where each token thinks on its own",
  lede: "Attention and DeltaNet move information between tokens. The MLP then works on each token by itself, and it holds most of the model's parameters.",
  body: [
    { prose: `
      <p>Every one of the 64 layers ends with the same block, the <abbr>MLP</abbr>, also called the <abbr>FFN</abbr>. The token-mixing part has just gathered context from other tokens. The MLP takes each token's vector on its own and transforms it, without looking at any other token.</p>
      <p>A good mental picture: the token-mixing part <em>collects the clues</em>, and the MLP <em>looks things up and draws conclusions</em>. Much of what the model "knows", such as facts, word meanings and patterns of grammar, appears to be stored in MLP weights.</p>` },

    { scene: {
      id: "mlp-shape", title: "Expand, gate, compress",
      build: buildShape,
      visual: "Top: the token vector x (5,120, shown as 10 cells). Two green trapezoids (gate_proj, up_proj) fan it out into two wide rows of 34 cells (17,408): gate and up. Gate passes through a SiLU box into a SiLU(gate) row; it meets up at a ⊙ node, giving the product row. A third trapezoid (down_proj) squeezes it back to 10 cells, which are added onto the residual stream at a + node. All cell values are computed from small random matrices in the scene; a table shows two features' real numbers.",
      cues: [
        { id: "in",     say: "Here is one token's vector arriving at the MLP, the multi-layer perceptron. It holds five thousand one hundred and twenty numbers.", vis: "Input vector slides in from the left, label [5120]." },
        { id: "expand", say: "First, two different weight matrices each stretch it out to seventeen thousand four hundred and eight numbers, more than three times wider. One copy is called the gate, the other is called up.", vis: "Two green matrices; two tall vectors grow out of them, labelled gate [17408] and up [17408]." },
        { id: "act",    say: "The gate goes through a smooth bend called SiLU. Large positive values pass almost unchanged. Negative values are pushed close to zero.", vis: "SiLU box appears; SiLU(gate) row fills (negative gates shrink towards zero); two features are outlined and a table shows their gate and SiLU values." },
        { id: "mul",    say: "Then the gate and the up vector are multiplied, number by number. Wherever the gate is near zero, that part of up is switched off. Wherever the gate is large, it passes through.", vis: "SiLU(gate) and up meet at a ⊙ node; the product row fills; the table adds up and product for the two features." },
        { id: "down",   say: "A third matrix, called down, compresses the result back to five thousand one hundred and twenty numbers, and that is added onto the token's vector in the residual stream.", vis: "down_proj trapezoid squeezes 34 cells to 10; an arrow drops into the + node and a light pulse runs along the residual stream." },
        { id: "name",   say: "This recipe, a gate with the SiLU bend multiplied with a second projection, is called SwiGLU, the swish-gated linear unit. It is what Qwen 3.8 uses in all sixty-four layers.", vis: "Formula card: SwiGLU(x) = down( SiLU(gate · x) ⊙ (up · x) )." },
      ],
    } },

    { prose: `
      <h3>Three matrices</h3>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Tensor</th><th>Shape</th><th class="num">Parameters</th><th>Job</th></tr>
        <tr><td><code>gate_proj</code></td><td class="num">[17408, 5120]</td><td class="num">89,128,960</td><td>Decides which features switch on</td></tr>
        <tr><td><code>up_proj</code></td><td class="num">[17408, 5120]</td><td class="num">89,128,960</td><td>Computes the feature values</td></tr>
        <tr><td><code>down_proj</code></td><td class="num">[5120, 17408]</td><td class="num">89,128,960</td><td>Writes the result back to hidden size</td></tr>
        <tr class="sum"><td>One MLP</td><td></td><td class="num">267,386,880</td><td>≈ 70% of every layer</td></tr>
        <tr class="sum"><td>All 64 MLPs</td><td></td><td class="num">17,112,760,320</td><td>≈ 62% of the whole model</td></tr>
      </table></div>
      <p>The MLP is the heaviest part of each layer by far. It holds 267.4 million of a DeltaNet layer's 383.3 million parameters, and 267.4 of an attention layer's 372.3 million. Across the model that adds up to 17.1 billion parameters, which is why the MLP dominates the cost of writing each token.</p>

      <h3>Why a bend is essential</h3>
      <p>Matrix multiplication is <em>linear</em>: doubling the input doubles the output, and two matrices in a row can always be replaced by a single matrix. If every layer were only matrix multiplications, all 64 layers would collapse into one big matrix, and the model could only draw straight lines through its data.</p>
      <p>A <strong>non-linear activation function</strong> breaks that. It bends the numbers, so stacked layers can build up curved, complicated decisions. The classic choice is <abbr>ReLU</abbr>, which simply sets negative values to zero. Qwen3.8 uses <abbr>SiLU</abbr> (also called Swish), a smooth version of the same idea.</p>` },

    { scene: {
      id: "silu-curve", title: "ReLU versus SiLU",
      build: buildSilu,
      visual: "A clean plot from x = −6 to 6 on the blueprint grid. ReLU is drawn first as a grey hinge (flat at zero, then a 45° line). SiLU is then drawn in green on top: it follows ReLU for large |x|, dips slightly below zero around x ≈ −1.3, and is smooth at the origin. A small marker slides along both curves showing input → output values.",
      cues: [
        { id: "relu",  say: "This grey line is ReLU, the rectified linear unit. Anything negative becomes zero, anything positive passes straight through. It is simple, but it has a sharp corner at zero.", vis: "ReLU hinge draws itself; marker at x = −2 → 0 and x = 3 → 3." },
        { id: "silu",  say: "This green curve is SiLU, the sigmoid linear unit. It multiplies each number by a smooth switch between zero and one. For big positive values the switch is fully on. For big negative values it is off.", vis: "SiLU curve draws over ReLU; sigmoid switch shown as a faint dashed S-curve beneath it." },
        { id: "dip",   say: "Near zero it is smooth, and it even dips a little below zero. That smooth shape tends to help training, and lets small negative signals carry some information.", vis: "A dot marks the dip; an inset zooms in on x from −4 to 0.6, labelled minimum ≈ −0.278 at x ≈ −1.278 (found numerically)." },
      ],
    } },

    { prose: `
      <h3>Why the gate helps</h3>
      <p>A plain MLP has one path: expand, bend, compress. SwiGLU has two parallel paths, and one of them controls the other. The <code>gate</code> path decides <em>how much</em> of each of the 17,408 features to let through, and the <code>up</code> path decides <em>what value</em> that feature carries. Because the gate depends on the input, the MLP can switch whole groups of features on or off for each token. In experiments, gated MLPs reached better quality for the same number of parameters (Shazeer, 2020), which is why almost every modern model uses one.</p>

      <h3>The MLP as a memory</h3>
      <p>One useful way to read the MLP: each of the 17,408 rows of <code>gate_proj</code> and <code>up_proj</code> is a <strong>key</strong> that looks for a pattern in the token's vector. The matching column of <code>down_proj</code> is the <strong>value</strong> it writes back when that pattern is found. If the vector says something like "the capital of France is …", some features fire, and their columns in <code>down_proj</code> push the vector towards "Paris". With 17,408 such key–value pairs in each of 64 layers, the MLPs hold about 1.1 million of them.</p>` },

    { prose: `
      <h3>Counting the neurons</h3>
      <p>In a neural network, a <strong>neuron</strong> is one unit that takes a weighted sum of its inputs, passes it through a bend such as SiLU, and sends the result onward. Two different kinds of numbers belong to a neuron, and it is easy to mix them up:</p>
      <ul>
        <li><strong>Its output, the activation: one number.</strong> For each token, a neuron produces exactly one value, such as 0.8 or −0.02. That number is computed fresh for every token and then thrown away.</li>
        <li><strong>Its weights: many numbers.</strong> These are the fixed, learned strengths of its connections: how much it listens to each input, and how much its one output adds to each output channel. They are part of the model's parameters and never change during use.</li>
      </ul>
      <p>Both counts describe the same neuron: one number of output per token, thousands of connection weights. In Qwen3.8's MLP, each of the 17,408 features in the middle is one neuron. Because of the gate, each one is a slightly richer "gated neuron": it has two weighted sums (gate and up) that are multiplied together, and its own set of outgoing weights (one column of <code>down_proj</code>).</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Count</th><th class="num">Value</th><th>How</th></tr>
        <tr><td>Neurons per MLP</td><td class="num">17,408</td><td>The intermediate width</td></tr>
        <tr><td>Output per neuron, per token</td><td class="num">1</td><td>Its activation: SiLU(gate) × up</td></tr>
        <tr><td>Weights (connections) per neuron</td><td class="num">15,360</td><td>5,120 into the gate + 5,120 into up + 5,120 out through down</td></tr>
        <tr><td>MLP neurons in the whole model</td><td class="num">1,114,112</td><td>64 layers × 17,408</td></tr>
        <tr><td>Connections (all parameters)</td><td class="num">27.8 billion</td><td>Every weight is one connection strength</td></tr>
      </table></div>
      <p>The 5,120 numbers of the residual stream are not neurons in this sense. They behave more like the wires of a shared bus that every layer reads from and writes to. The attention and DeltaNet blocks are organised in <em>heads</em> rather than neurons (<a href="#attention">Chapter 7</a>, <a href="#deltanet">Chapter 8</a>).</p>
      <p>For scale: a human brain has roughly 86 billion neurons and on the order of 100 trillion synapses. A model parameter is closer to a synapse (one connection strength) than to a neuron. A biological neuron is also far more complex than a weighted sum and a bend. Counted that way, Qwen3.8 has about a million "neurons" and 27.8 billion "synapses". It is a useful sense of proportion, not a like-for-like comparison.</p>` },

    { scene: {
      id: "mlp-neurons", title: "Counting the neurons",
      build: buildNeurons,
      visual: "Everything drawn to scale with dots. Left: the token's 5,120 numbers as an 80 × 64 block of tiny teal dots. Middle: the MLP's 17,408 neurons as a 136 × 128 block of green dots (visibly 3.4× the area). Right: back to 5,120 teal dots. Then a zoom into one green dot with fans of hair-thin lines in (gate, up) and out (down). Then a sparse firing pattern. Finally the block shrinks into one slab of a 64-slab stack, with a counter running to 1,114,112.",
      cues: [
        { id: "width",  say: "Let's count. A token arrives at the MLP as five thousand one hundred and twenty numbers. Here they are, one tiny dot each.", vis: "80 × 64 teal dot block fades in; label 5,120." },
        { id: "expand", say: "The MLP, the multi-layer perceptron, widens this into seventeen thousand four hundred and eight neurons. That is about three and a half times as many. The two blocks are drawn to scale.", vis: "136 × 128 green dot block grows out of it; label 17,408; ratio 3.4×." },
        { id: "one",    say: "Zoom into one single neuron. For each token, it produces just one number, its activation. To compute that one number, it weighs all five thousand one hundred and twenty inputs twice, once for its gate and once for its value. Then it sends its one number out through five thousand one hundred and twenty outgoing weights. One output, but fifteen thousand three hundred and sixty connections.", vis: "Zoom on one dot showing a single value (e.g. 0.8); two fans of 5,120 hair-lines in, one fan out; labels: output = 1 number · connections = 15,360 weights." },
        { id: "fire",   say: "For any given token, only a minority of neurons respond strongly. Most stay close to zero. Different tokens light up different neurons.", vis: "Block returns dimmed; a sparse scatter of bright dots for token ·cat, then a different scatter for token ·sat." },
        { id: "back",   say: "The outputs of all the neurons are combined back into five thousand one hundred and twenty numbers, and added to the token's vector.", vis: "Curved arrows converge into the 5,120-dot output block; an arrow drops into a + node on the residual stream and a pulse runs along it." },
        { id: "stack",  say: "Every one of the sixty-four layers has its own seventeen thousand four hundred and eight neurons. In total, about one point one million neurons, joined by twenty-seven point eight billion connections.", vis: "The neuron block shrinks into the bottom slab; 64 slabs stack up while a counter runs 17,408 → 1,114,112; then 27.8 billion connections; a light pulse climbs the stack." },
      ],
    } },

    { note: `<b>A variant: Mixture of Experts.</b> Some models, such as Flash-Next, replace the single big MLP with many small ones. That design is a <abbr>MoE</abbr>. A small <em>router</em> looks at each token and picks only a few experts to run (for example 10 out of 512). The model can hold far more parameters in total while each token only pays for the few experts it uses. Qwen3.8-27B is <em>dense</em>: every token goes through the full MLP in every layer.` },

    { deep: `
      <h3>SwiGLU, written out</h3>
      <p>For a token vector <b>x</b> ∈ ℝ<sup>5120</sup> (after <abbr>RMSNorm</abbr>), with weight matrices <i>W</i><sub>g</sub>, <i>W</i><sub>u</sub> ∈ ℝ<sup>17408×5120</sup> and <i>W</i><sub>d</sub> ∈ ℝ<sup>5120×17408</sup>:</p>
      <math display="block"><mrow><mtext>MLP</mtext><mo>(</mo><mi mathvariant="bold">x</mi><mo>)</mo><mo>=</mo><msub><mi>W</mi><mi>d</mi></msub><mspace width="0.2em"/><mo>(</mo><mtext>SiLU</mtext><mo>(</mo><msub><mi>W</mi><mi>g</mi></msub><mi mathvariant="bold">x</mi><mo>)</mo><mo>⊙</mo><msub><mi>W</mi><mi>u</mi></msub><mi mathvariant="bold">x</mi><mo>)</mo><mo>,</mo><mspace width="1em"/><mtext>SiLU</mtext><mo>(</mo><mi>z</mi><mo>)</mo><mo>=</mo><mi>z</mi><mo>·</mo><mi>σ</mi><mo>(</mo><mi>z</mi><mo>)</mo><mo>=</mo><mfrac><mi>z</mi><mrow><mn>1</mn><mo>+</mo><msup><mi>e</mi><mrow><mo>−</mo><mi>z</mi></mrow></msup></mrow></mfrac></mrow></math>
      <div class="lx-read">x is one token's 5,120 numbers. Multiply x by W<sub>g</sub> to get 17,408 gate numbers, and pass each through SiLU. Separately multiply x by W<sub>u</sub> to get 17,408 up numbers. Multiply the two lists number by number (that is the ⊙), then multiply the result by W<sub>d</sub> to get back down to 5,120 numbers. The second part defines SiLU: take a number z and multiply it by sigmoid(z), a smooth switch between 0 and 1. Example: SiLU(2) ≈ 2 × 0.88 = 1.76, while SiLU(−2) ≈ −2 × 0.12 = −0.24.</div>
      <p>⊙ means element-wise multiplication. There are no bias terms. The output is added to the residual stream: <b>h</b> ← <b>h</b> + MLP(RMSNorm(<b>h</b>)).</p>

      <h3>A tiny worked example</h3>
      <p>Shrink everything: hidden size 2, expanded size 3. Let <b>x</b> = (1, −1).</p>
      <ul>
        <li>Gate projection gives <b>g</b> = (2.0, −1.0, 0.5). SiLU(<b>g</b>) = (2.0 · σ(2.0), −1.0 · σ(−1.0), 0.5 · σ(0.5)) = (1.76, −0.27, 0.31).</li>
        <li>Up projection gives <b>u</b> = (0.5, 3.0, −2.0).</li>
        <li>Element-wise product: (1.76 · 0.5, −0.27 · 3.0, 0.31 · −2.0) = (0.88, −0.81, −0.62). The second feature had a large value (3.0), but its gate was negative, so only a fraction of it got through, with its sign flipped.</li>
        <li>The down projection (a 2 × 3 matrix) maps these three numbers back to two, which are added to <b>x</b>.</li>
      </ul>

      <h3>Cost per token</h3>
      <p>Three matrix–vector products of 5,120 × 17,408 = 89,128,960 multiply-adds each, so 267,386,880 multiply-adds, or about 0.53 billion floating-point operations, per layer per token. Over 64 layers that is about <strong>34 billion operations</strong> for every token, about two thirds (67%) of the 51 billion operations in the forward pass. The SiLU and the element-wise product add only 17,408 operations each, which is negligible.</p>

      <h3>Why 17,408?</h3>
      <p>Classic transformers widened the MLP 4× (here that would be 20,480). A gated MLP has three matrices instead of two, so a common rule of thumb shrinks the width to 8/3 × hidden size (≈ 13,653 here) to keep the parameter count the same. Qwen3.8 goes somewhat wider: 17,408 = 3.4 × 5,120, an exact multiple of 512, which suits the hardware.</p>` },
  ],
});
})();
