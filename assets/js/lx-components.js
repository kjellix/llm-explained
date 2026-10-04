/* ==========================================================================
   LX components — the reusable visual vocabulary (Blueprint style).

   Every component draws into an SVG parent and returns a small object with
   setters that take progress values (0..1). Components never animate on
   their own; scenes call the setters from update(t).

   Concept colour names: token, embed, attn, delta, mlp, norm, logit, cache,
   vision, mtp (see lx-theme.css).
   ========================================================================== */
(function () {
  "use strict";
  const { el, attr, mix, col, clamp } = LX;
  const D = (LX.draw = {});
  const MONO = "JetBrains Mono, ui-monospace, monospace";
  const SANS = "Inter, ui-sans-serif, system-ui, sans-serif";
  D.MONO = MONO; D.SANS = SANS;

  /* ------------------------------------------------------------ background */
  /** Blueprint grid + shared defs (glow filter, arrowheads). Call first. */
  D.backdrop = function (svg, { grid = true } = {}) {
    const defs = el("defs", {}, svg);
    const f = el("filter", { id: "lx-glow", x: "-200%", y: "-200%", width: "500%", height: "500%" }, defs);
    el("feGaussianBlur", { stdDeviation: 6, result: "b" }, f);
    const m = el("feMerge", {}, f); el("feMergeNode", { in: "b" }, m); el("feMergeNode", { in: "SourceGraphic" }, m);
    el("rect", { width: LX.W, height: LX.H, fill: col("bg") }, svg);
    if (grid) {
      const g = el("g", { "shape-rendering": "crispEdges" }, svg);
      for (let x = 0; x <= LX.W; x += 40) el("line", { x1: x, y1: 0, x2: x, y2: LX.H, stroke: x % 200 ? col("grid") : col("grid-2") }, g);
      for (let y = 0; y <= LX.H; y += 40) el("line", { x1: 0, y1: y, x2: LX.W, y2: y, stroke: y % 200 ? col("grid") : col("grid-2") }, g);
    }
    return defs;
  };

  /* ------------------------------------------------------------------ text */
  /** Generic text. o: {size, color, weight, anchor, mono, ls, parent, opacity} */
  D.text = function (parent, x, y, str, o = {}) {
    const t = el("text", {
      x, y, fill: col(o.color || "text"), "font-family": o.mono ? MONO : SANS,
      "font-size": o.size || 20, "font-weight": o.weight || 400, "text-anchor": o.anchor || "start",
      "letter-spacing": o.ls || 0, opacity: o.opacity ?? 1,
    }, parent);
    t.textContent = str;
    return t;
  };
  /** Small uppercase monospaced section label. */
  D.label = (parent, x, y, str, o = {}) =>
    D.text(parent, x, y, str.toUpperCase(), { mono: true, size: 13, color: "muted", ls: 2, ...o });

  /** Token text where a leading space is shown as a dim middle dot. */
  D.tokenText = function (parent, x, y, tok, o = {}) {
    const t = D.text(parent, x, y, "", { mono: true, size: 24, anchor: "middle", ...o });
    const m = tok.match(/^(\s*)(.*)$/s);
    if (m[1]) { const s = el("tspan", { fill: col("dim") }, t); s.textContent = "·".repeat(m[1].length); }
    const w = el("tspan", {}, t); w.textContent = m[2].replace(/\n/g, "↵");
    return t;
  };

  /* ---------------------------------------------------------------- chips */
  /** A token chip with optional id beneath. Returns {g, show(p), idShow(p), glow(on)} */
  D.tokenChip = function (parent, { x, y, w = 118, h = 56, text, id, color = "token", size = 24 }) {
    const g = el("g", {}, parent);
    const box = el("rect", { x, y, width: w, height: h, rx: 6, fill: mix("bg", color, .1), stroke: col(color), "stroke-width": 1.5 }, g);
    D.tokenText(g, x + w / 2, y + h / 2 + size * .36, text, { size });
    let idt = null;
    if (id != null) idt = D.text(parent, x + w / 2, y + h + 30, String(id), { mono: true, size: 17, anchor: "middle", color });
    return {
      g, box, idt, cx: x + w / 2, bottom: y + h,
      show(p, dy = 14) { attr(g, { opacity: p, transform: `translate(0 ${(1 - p) * dy})` }); },
      idShow(p) { idt && idt.setAttribute("opacity", p); },
      glow(on) { box.setAttribute("filter", on ? "url(#lx-glow)" : "none"); },
    };
  };

  /* --------------------------------------------------------------- vectors */
  /** A column (or row) of value cells. values in [-1,1]. Returns {g, cells, reveal(p), setValues(v)} */
  D.vector = function (parent, { x, y, values, cell = 22, gap = 4.5, dir = "v", outline = true }) {
    const g = el("g", {}, parent), cells = [];
    values.forEach((v, i) => {
      const cx = dir === "v" ? x - cell / 2 : x + i * (cell + gap);
      const cy = dir === "v" ? y + i * (cell + gap) : y - cell / 2;
      cells.push(el("rect", { x: cx, y: cy, width: cell, height: cell, rx: 3, fill: LX.valueColor(v), stroke: outline ? col("line-2") : "none", "stroke-width": 1 }, g));
    });
    const len = values.length * (cell + gap) - gap;
    return {
      g, cells, length: len,
      reveal(p, stagger = .6) {          // cells appear one by one
        cells.forEach((c, i) => c.setAttribute("opacity", clamp((p * (1 + stagger) - i / cells.length * stagger) / 1)));
      },
      setValues(vs) { vs.forEach((v, i) => cells[i] && cells[i].setAttribute("fill", LX.valueColor(v))); },
    };
  };

  /** Matrix of value cells. values[r][c] in [-1,1]. */
  D.matrix = function (parent, { x, y, values, cell = 18, gap = 3 }) {
    const g = el("g", {}, parent), cells = [];
    values.forEach((row, r) => row.forEach((v, c) => {
      cells.push(el("rect", { x: x + c * (cell + gap), y: y + r * (cell + gap), width: cell, height: cell, rx: 2, fill: LX.valueColor(v) }, g));
    }));
    return { g, cells, w: values[0].length * (cell + gap) - gap, h: values.length * (cell + gap) - gap };
  };

  /* ---------------------------------------------------------------- blocks */
  /** A labelled box for a model component. kind = concept colour name. */
  D.block = function (parent, { x, y, w, h, kind = "embed", label, sub, strong = false, size = 15 }) {
    const g = el("g", {}, parent);
    const r = el("rect", { x, y, width: w, height: h, rx: 6, fill: mix("bg", kind, strong ? .3 : .1), stroke: col(kind), "stroke-width": strong ? 2 : 1.5 }, g);
    let lt = null, st = null;
    if (label) lt = D.text(g, x + w / 2, y + h / 2 + (sub ? -4 : size * .35), label, { mono: true, size, anchor: "middle", weight: 500, color: strong ? "text" : kind });
    if (sub) st = D.text(g, x + w / 2, y + h / 2 + 16, sub, { mono: true, size: 12, anchor: "middle", color: "muted" });
    const base = strong ? .3 : .1;
    return {
      g, r, x, y, w, h, cx: x + w / 2, cy: y + h / 2,
      show(p, dy = 10) { attr(g, { opacity: p, transform: `translate(0 ${(1 - p) * dy})` }); },
      /** light pulse: 0 = resting, 1 = fully lit */
      pulse(q) { r.setAttribute("fill", mix("bg", kind, base + q * .5)); r.setAttribute("filter", q > .15 ? "url(#lx-glow)" : "none"); },
    };
  };

  /* ---------------------------------------------------------------- arrows */
  /** Path arrow that draws itself. d is an SVG path (or give x1,y1,x2,y2). */
  D.arrow = function (parent, { x1, y1, x2, y2, d, color = "muted", width = 2, head = true }) {
    const g = el("g", {}, parent);
    const path = el("path", { d: d || `M${x1} ${y1} L${x2} ${y2}`, stroke: col(color), "stroke-width": width, fill: "none", "stroke-linecap": "round" }, g);
    const L = path.getTotalLength ? path.getTotalLength() : Math.hypot(x2 - x1, y2 - y1);
    path.setAttribute("stroke-dasharray", `${L} ${L}`);
    let hd = null;
    if (head) {
      const end = path.getPointAtLength(L), pre = path.getPointAtLength(Math.max(0, L - 2));
      const a = Math.atan2(end.y - pre.y, end.x - pre.x) * 180 / Math.PI;
      hd = el("path", { d: "M-10 -7 L0 0 L-10 7", stroke: col(color), "stroke-width": width, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round", transform: `translate(${end.x} ${end.y}) rotate(${a})` }, g);
    }
    return {
      g, path,
      draw(p) { path.setAttribute("stroke-dashoffset", L * (1 - p)); hd && hd.setAttribute("opacity", p > .97 ? 1 : 0); },
    };
  };

  /** A dot travelling along a path (the "light pulse"). */
  D.traveller = function (parent, path, { color = "embed", r = 6 } = {}) {
    const c = el("circle", { r, fill: col(color), filter: "url(#lx-glow)", opacity: 0 }, parent);
    const L = path.getTotalLength();
    return { c, at(p) { if (p <= 0 || p >= 1) return c.setAttribute("opacity", 0); const pt = path.getPointAtLength(L * p); attr(c, { cx: pt.x, cy: pt.y, opacity: 1 }); } };
  };

  /* ------------------------------------------------------------------ bars */
  /** Horizontal probability bars. items: [[label, value]], values 0..1. */
  D.bars = function (parent, { x, y, w = 250, row = 70, items, color = "logit", max, percent = true }) {
    const mx = max ?? Math.max(...items.map(i => i[1]));
    const rows = items.map(([lab, v], i) => {
      const yy = y + i * row;
      const t = D.tokenText(parent, x, yy, lab, { size: 19, anchor: "start", color: i === 0 ? "text" : "text-2" });
      const bg = el("rect", { x, y: yy + 12, width: w, height: 14, rx: 2, fill: col("line") }, parent);
      const bar = el("rect", { x, y: yy + 12, width: 0, height: 14, rx: 2, fill: col(color), opacity: i === 0 ? 1 : .55 }, parent);
      const pct = D.text(parent, x + w, yy, "", { mono: true, size: 15, anchor: "end", color: i === 0 ? color : "muted" });
      return { t, bg, bar, pct, v };
    });
    return {
      rows,
      grow(p, stagger = .25) {
        rows.forEach((r, i) => {
          const q = clamp(p * (1 + stagger) - i / rows.length * stagger);
          r.t.setAttribute("opacity", q); r.pct.setAttribute("opacity", q); r.bg.setAttribute("opacity", Math.min(1, q * 1.5));
          r.bar.setAttribute("width", w * (r.v / mx) * q);
          r.pct.textContent = percent ? (r.v * 100 * q).toFixed(r.v < .01 ? 1 : 0) + "%" : (r.v * q).toFixed(2);
        });
      },
      setValues(vs, newMax) {
        const m2 = newMax ?? Math.max(...vs);
        rows.forEach((r, i) => { r.v = vs[i]; r.bar.setAttribute("width", w * (vs[i] / m2)); r.pct.textContent = percent ? (vs[i] * 100).toFixed(vs[i] < .01 ? 1 : 0) + "%" : vs[i].toFixed(2); });
      },
    };
  };

  /* ------------------------------------------------------------- brackets */
  /** A bracket/brace with a label, e.g. to annotate a tensor dimension. side: "bottom"|"right"|"left"|"top" */
  D.bracket = function (parent, { x1, y1, x2, y2, side = "bottom", label, color = "muted", tick = 8 }) {
    const g = el("g", {}, parent);
    const d = side === "bottom" || side === "top"
      ? `M${x1} ${y1 - (side === "bottom" ? tick : -tick)} L${x1} ${y1} L${x2} ${y2} L${x2} ${y2 - (side === "bottom" ? tick : -tick)}`
      : `M${x1 - (side === "right" ? tick : -tick)} ${y1} L${x1} ${y1} L${x2} ${y2} L${x2 - (side === "right" ? tick : -tick)} ${y2}`;
    el("path", { d, stroke: col(color), "stroke-width": 1.5, fill: "none" }, g);
    if (label) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const pos = { bottom: [mx, my + 24, "middle"], top: [mx, my - 12, "middle"], right: [mx + 14, my + 5, "start"], left: [mx - 14, my + 5, "end"] }[side];
      D.text(g, pos[0], pos[1], label, { mono: true, size: 14, color, anchor: pos[2] });
    }
    return { g, show(p) { g.setAttribute("opacity", p); } };
  };

  /** Fade helper for any element / group. */
  D.fade = (e, p) => e.setAttribute("opacity", p);
  /** Typewriter: reveal p of a string into a text node. */
  D.type = (t, str, p) => { t.textContent = str.slice(0, Math.round(str.length * clamp(p))); };
})();
