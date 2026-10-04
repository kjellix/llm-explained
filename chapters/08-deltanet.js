/* Chapter 08 — Linear attention and Gated DeltaNet */
(function () {
  "use strict";
  const D = LX.draw, E = LX.ease, clamp = LX.clamp, lerp = LX.lerp;
  /** sub-progress of x inside [a, b] */
  const seg = (x, a, b) => clamp((x - a) / (b - a));
  const bump = x => Math.sin(Math.PI * clamp(x));
  const fmt = (v, d = 2) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(d).replace("-", "−");

  /* ------------------------------------------------------------ small linear algebra */
  const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
  /** outer product v kᵀ: rows follow v, columns follow k */
  const outer = (v, k) => v.map(vi => k.map(kj => vi * kj));
  const addM = (A, B) => A.map((r, i) => r.map((x, j) => x + B[i][j]));
  const scaleM = (A, s) => A.map(r => r.map(x => x * s));
  const lerpM = (A, B, t) => A.map((r, i) => r.map((x, j) => x + (B[i][j] - x) * t));
  const matvec = (S, x) => S.map(r => r.reduce((s, a, j) => s + a * x[j], 0));
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const lerpV = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  const norm = v => Math.hypot(...v);
  const unit = v => { const n = norm(v); return v.map(x => x / n); };
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const maxAbsM = Ms => Math.max(1e-9, ...Ms.flat(2).map(Math.abs));
  /** Gram–Schmidt: turn a list of vectors into orthonormal ones */
  function orthonormal(vs) {
    const out = [];
    vs.forEach(v => { let w = v.slice(); out.forEach(u => { const d = dot(w, u); w = w.map((x, i) => x - d * u[i]); }); out.push(unit(w)); });
    return out;
  }
  /** one gated delta-rule step: decay, then write the error */
  function deltaStep(S, k, v, alpha = 1, beta = 1) {
    const Sd = scaleM(S, alpha);
    const err = sub(v, matvec(Sd, k));
    return addM(Sd, outer(err.map(e => e * beta), k));
  }
  /** apply a sequence of [progress, target] transitions on top of a start value */
  const chain = (start, steps, lerpFn) => steps.reduce((m, [p, target]) => (p > 0 ? lerpFn(m, target, p) : m), start);

  /** square heat-map grid; set(M, scale) colours cells; optional numbers */
  function heatGrid(parent, { x, y, rows, cols, cell, gap = 4, numbers = false, size = 22 }) {
    const g = LX.el("g", {}, parent), cells = [], texts = [];
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      cells.push(LX.el("rect", { x: x + j * (cell + gap), y: y + i * (cell + gap), width: cell, height: cell, rx: Math.min(8, cell / 6), fill: LX.col("zero"), stroke: LX.col("line-2"), "stroke-width": 1 }, g));
      if (numbers) texts.push(D.text(g, x + j * (cell + gap) + cell / 2, y + i * (cell + gap) + cell / 2 + size * .35, "", { mono: true, size, anchor: "middle", weight: 500 }));
    }
    const W = cols * (cell + gap) - gap, H = rows * (cell + gap) - gap;
    const frame = LX.el("rect", { x: x - 8, y: y - 8, width: W + 16, height: H + 16, rx: 10, fill: "none", stroke: LX.col("delta"), "stroke-width": 1.5 }, g);
    return {
      g, frame, W, H, x, y, cell, gap,
      set(M, scale = 1) {
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
          const v = M[i][j], k = i * cols + j;
          cells[k].setAttribute("fill", LX.valueColor(clamp(v / scale, -1, 1)));
          if (numbers) texts[k].textContent = fmt(v);
        }
      },
      glow(q) { frame.setAttribute("stroke-width", 1.5 + q * 2); frame.setAttribute("filter", q > .15 ? "url(#lx-glow)" : "none"); },
    };
  }

  /* ======================================================== scene: delta-memory */
  function buildMemory(ctx) {
    const { svg } = ctx; D.backdrop(svg);
    const R = LX.rng(23), N = 8, CELL = 40, GAP = 4, P = CELL + GAP;
    const rnd = () => Array.from({ length: N }, () => R() * 2 - 1);

    // three tokens with orthonormal keys, so a matching query recalls its value exactly
    const WORDS = [" door", " lamp", " key"];
    const keys = orthonormal([rnd(), rnd(), rnd()]);
    const vals = [rnd(), rnd(), rnd()].map(v => v.map(x => x * .9));
    const S = [zeros(N, N)];
    vals.forEach((v, i) => S.push(addM(S[i], outer(v, keys[i]))));
    const q = keys[0];
    const o = matvec(S[3], q);                       // = vals[0], computed
    const sS = maxAbsM([S[3]]), sK = maxAbsM([keys]), sV = maxAbsM([vals, [o]]);

    /* left: full attention keeps a growing list */
    const left = LX.el("g", {}, svg);
    D.label(left, 80, 120, "Full attention · keeps a list");
    D.text(left, 80, 150, "every key and value, forever", { size: 15, color: "text-2" });
    D.text(left, 132, 196, "keys", { mono: true, size: 14, color: "muted" });
    D.text(left, 300, 196, "values", { mono: true, size: 14, color: "muted" });
    const rows = [];
    for (let r = 0; r < 14; r++) {
      const g = LX.el("g", {}, left), y = 212 + r * 30;
      for (let c = 0; c < 6; c++) {
        LX.el("rect", { x: 132 + c * 22, y, width: 18, height: 18, rx: 3, fill: LX.valueColor(R() * 2 - 1) }, g);
        LX.el("rect", { x: 300 + c * 22, y, width: 18, height: 18, rx: 3, fill: LX.valueColor(R() * 2 - 1) }, g);
      }
      D.text(g, 112, y + 14, String(r + 1), { mono: true, size: 14, color: "dim", anchor: "end" });
      rows.push(g);
    }
    const more = D.text(left, 132, 660, "", { mono: true, size: 15, color: "cache" });
    const kvSize = D.text(left, 80, 740, "", { mono: true, size: 17, color: "cache" });
    D.text(left, 80, 766, "KV cache, one attention layer", { size: 14, color: "muted" });

    /* right: linear attention keeps one fixed grid */
    const x0 = 1010, y0 = 300;
    const right = LX.el("g", {}, svg);
    D.label(right, 760, 120, "Linear attention · one fixed memory S");
    D.text(right, 760, 150, "every token writes into the same grid", { size: 15, color: "text-2" });
    const grid = heatGrid(right, { x: x0, y: y0, rows: N, cols: N, cell: CELL, gap: GAP });
    const counter = D.text(svg, 1520, 120, "", { mono: true, size: 16, color: "token", anchor: "end" });
    const badge = D.block(right, { x: x0 - 8, y: y0 + grid.H + 48, w: grid.W + 16, h: 46, kind: "delta", label: "128 × 128 per head (8 × 8 shown)", size: 15 });
    const stateMiB = 48 * 128 * 128 * 4 / 2 ** 20;
    const stateTxt = D.text(right, x0 + grid.W / 2, y0 + grid.H + 124, `${stateMiB} MiB per layer · for any length`, { mono: true, size: 15, color: "muted", anchor: "middle" });

    // value column (left of grid), key / query row (above grid), read-out column (right of grid)
    const vVec = D.vector(right, { x: x0 - 40, y: y0, values: vals[0].map(x => x / sV), cell: CELL, gap: GAP });
    const kVec = D.vector(right, { x: x0, y: y0 - 40, values: keys[0].map(x => x / sK), cell: CELL, gap: GAP, dir: "h" });
    const qVec = D.vector(right, { x: x0, y: y0 - 40, values: q.map(x => x / sK), cell: CELL, gap: GAP, dir: "h" });
    const oVec = D.vector(right, { x: x0 + grid.W + 46, y: y0, values: o.map(x => x / sV), cell: CELL, gap: GAP });
    const vLab = D.text(right, x0 - 66, y0 + 14, "v", { mono: true, size: 18, color: "text", anchor: "end" });
    const kLab = D.text(right, x0 - 16, y0 - 34, "kᵀ", { mono: true, size: 18, color: "text", anchor: "end" });
    const qLab = D.text(right, x0 - 16, y0 - 34, "qᵀ", { mono: true, size: 18, color: "attn", anchor: "end" });
    const oLab = D.text(right, x0 + grid.W + 46, y0 - 22, "read-out", { mono: true, size: 14, color: "embed", anchor: "middle" });
    const match = D.text(right, x0 + grid.W + 66, y0 + grid.H + 30, "read-out = v of ‘door’ ✓", { mono: true, size: 14, color: "embed", anchor: "end" });
    const chips = WORDS.map(w => D.tokenChip(right, { x: 770, y: y0 + 130, w: 130, h: 52, text: w, size: 22 }));
    const writeF = D.text(right, 835, y0 + 230, "S ← S + v kᵀ", { mono: true, size: 18, color: "delta", anchor: "middle" });
    const readF = D.text(right, 835, y0 + 230, "o = S q", { mono: true, size: 18, color: "attn", anchor: "middle" });
    const qNote = D.text(right, 835, y0 + 260, "query = key of ‘door’", { size: 14, color: "muted", anchor: "middle" });
    const sweep = LX.el("rect", { x: x0 - 6, y: y0 - 2, width: grid.W + 12, height: CELL + 4, rx: 6, fill: "none", stroke: LX.col("attn"), "stroke-width": 2, opacity: 0 }, right);

    const kib = n => { const b = n * 4096; return b >= 2 ** 20 ? (b / 2 ** 20).toFixed(1) + " MiB" : (b / 1024).toFixed(0) + " KiB"; };

    return t => {
      // token count: grows during "idea", jumps to 100,000 during "size"
      const pIdea = ctx.p(t, "idea", .1, .85, E.linear), pSize = ctx.p(t, "size", .2, .8, E.in);
      const n = pSize > 0 ? Math.round(lerp(12, 100000, pSize)) : Math.max(1, Math.round(lerp(1, 12, pIdea)));
      counter.textContent = `tokens seen: ${n.toLocaleString("en-US")}`;
      const shown = pSize > 0 ? 14 : Math.min(14, n);
      rows.forEach((g, r) => D.fade(g, r < shown ? 1 : 0));
      more.textContent = n > 14 ? `⋮  + ${(n - 14).toLocaleString("en-US")} more rows` : "";
      kvSize.textContent = kib(n);
      D.fade(left, 1 - .7 * ctx.p(t, "write", 0, .12) + .7 * ctx.p(t, "size", 0, .15));
      D.fade(counter, ctx.p(t, "idea", 0, .1));

      // writes: three tokens, each adds its outer product
      let M = S[0], wi = -1;
      [0, 1, 2].forEach(i => {
        const a = .06 + i * .31, b = a + .28;
        const w = ctx.p(t, "write", a, b, E.linear);
        if (w > 0 && w < 1) wi = i;
        chips[i].show(seg(w, 0, .15) * (1 - seg(w, .85, 1)), 10);
        M = lerpM(M, S[i + 1], E.inOut(seg(w, .45, .9)));
      });
      const active = wi >= 0 ? wi : 0;
      if (wi >= 0) { vVec.setValues(vals[wi].map(x => x / sV)); kVec.setValues(keys[wi].map(x => x / sK)); }
      grid.set(M, sS);
      const pw = ctx.p(t, "write", .02, .08), pr = ctx.p(t, "read", 0, .2);
      const inWrite = t < ctx.cue("read").start;
      kVec.g.setAttribute("opacity", inWrite ? pw * (wi >= 0 ? 1 : .35) : 1 - pr);
      D.fade(kLab, inWrite ? pw : 1 - pr);
      vVec.g.setAttribute("opacity", inWrite ? pw * (wi >= 0 ? 1 : .35) : .25 + .75 * ctx.p(t, "read", .75, .9));
      if (!inWrite) vVec.setValues(vals[0].map(x => x / sV));
      D.fade(vLab, inWrite ? pw : 1);
      D.fade(writeF, pw * (1 - pr));
      grid.glow(wi >= 0 ? bump(seg(ctx.p(t, "write", .06 + active * .31, .34 + active * .31, E.linear), .45, .9)) : 0);

      // read: the query sweeps the rows, the read-out fills
      qVec.g.setAttribute("opacity", pr * (1 - ctx.p(t, "size", 0, .15) * .6));
      D.fade(qLab, pr); D.fade(readF, pr); D.fade(qNote, pr);
      const sw = ctx.p(t, "read", .25, .7, E.linear);
      D.fade(sweep, sw > 0 && sw < 1 ? 1 : 0);
      sweep.setAttribute("y", y0 - 2 + Math.min(N - 1, Math.floor(sw * N)) * P);
      oVec.cells.forEach((c, i) => c.setAttribute("opacity", sw * N > i ? 1 : 0));
      D.fade(oLab, ctx.p(t, "read", .25, .35));
      D.fade(match, ctx.p(t, "read", .75, .9));

      // size: the badge pulses, the grid stays put
      badge.pulse(bump(ctx.p(t, "size", .2, 1, E.linear)) * .8);
      D.fade(stateTxt, ctx.p(t, "size", .1, .3));
      badge.show(ctx.p(t, "idea", .2, .5), 0);
    };
  }

  /* ====================================================== scene: delta-vs-plain */
  function buildPlainDelta(ctx) {
    const { svg } = ctx; D.backdrop(svg);
    const root = LX.el("g", { transform: "translate(0 40)" }, svg);
    // demo 1: same key, new value. demo 2: two similar keys (the chapter's worked example)
    const OPEN = [1, 0], CLOSED = [0, 1];
    const door = [1, 0];
    const k1 = [1, 0], k2 = [.6, .8];
    const Z = zeros(2, 2);
    const plain1 = outer(OPEN, door), plain2 = addM(plain1, outer(CLOSED, door));
    const delta1 = deltaStep(Z, door, OPEN), delta2 = deltaStep(delta1, door, CLOSED);
    const predicted = matvec(delta1, door), dErr = sub(CLOSED, predicted);
    const plainS = addM(outer(OPEN, k1), outer(CLOSED, k2));
    const deltaS = deltaStep(deltaStep(Z, k1, OPEN), k2, CLOSED);
    const r = {
      p1: matvec(plain1, door), p2: matvec(plain2, door), d1: matvec(delta1, door), d2: matvec(delta2, door),
      pk2: matvec(plainS, k2), dk2: matvec(deltaS, k2), dk1: matvec(deltaS, k1),
    };
    const vec = v => `(${fmt(v[0])}, ${fmt(v[1])})`;

    function panel(px, title, color) {
      const g = LX.el("g", {}, root);
      D.label(g, px, 112, title, { color });
      const grid = heatGrid(g, { x: px + 150, y: 196, rows: 2, cols: 2, cell: 104, gap: 6, numbers: true });
      D.text(g, px + 130, 196 + 60, "open", { mono: true, size: 15, color: "embed", anchor: "end" });
      D.text(g, px + 130, 196 + 170, "closed", { mono: true, size: 15, color: "cache", anchor: "end" });
      D.text(g, px + 202, 176, "key axis 1", { mono: true, size: 14, color: "muted", anchor: "middle" });
      D.text(g, px + 312, 176, "key axis 2", { mono: true, size: 14, color: "muted", anchor: "middle" });
      const readLab = D.text(g, px, 500, "", { mono: true, size: 16, color: "text" });
      const bars = [["open", "embed"], ["closed", "cache"]].map(([nm, c], i) => {
        const y = 526 + i * 44;
        D.text(g, px + 90, y + 18, nm, { mono: true, size: 15, color: c, anchor: "end" });
        LX.el("rect", { x: px + 104, y: y + 4, width: 240, height: 18, rx: 3, fill: LX.col("line") }, g);
        const bar = LX.el("rect", { x: px + 104, y: y + 4, width: 0, height: 18, rx: 3, fill: LX.col(c) }, g);
        const num = D.text(g, px + 356, y + 19, "", { mono: true, size: 16, color: "text" });
        return { bar, num };
      });
      const verdict = D.text(g, px, 650, "", { size: 21, weight: 600, color: "text" });
      const log = [0, 1, 2, 3].map(i => D.text(g, px + 400, 214 + i * 34, "", { mono: true, size: 15, color: "text-2" }));
      return {
        g, grid, readLab, verdict, log,
        setRead(v) { v.forEach((x, i) => { bars[i].bar.setAttribute("width", 240 * clamp(x, 0, 1.2)); bars[i].num.textContent = fmt(x); }); },
      };
    }
    const L = panel(80, "Plain linear attention · only adds", "muted");
    const Rp = panel(840, "Delta rule · writes the difference", "delta");
    LX.el("line", { x1: 800, y1: 96, x2: 800, y2: 700, stroke: LX.col("line-2"), "stroke-dasharray": "4 6" }, root);
    const bigDelta = D.text(root, 1500, 128, "Δ", { size: 64, weight: 700, color: "delta", anchor: "end" });
    const foot = D.text(root, 840, 700, `the price: k₁ now reads ${vec(r.dk1)} instead of (1.00, 0.00)`, { mono: true, size: 14, color: "muted" });
    const errArrow = D.arrow(root, { d: "M1150 540 C 1210 470, 1240 420, 1240 330", color: "delta", width: 2 });

    return t => {
      const pSet = ctx.p(t, "setup", 0, .4);
      L.g.setAttribute("opacity", pSet); Rp.g.setAttribute("opacity", pSet);
      const p1 = ctx.p(t, "first", .1, .5, E.inOut), p1r = ctx.p(t, "first", .55, .85);
      const p2 = ctx.p(t, "second", .25, .6, E.inOut), p2r = ctx.p(t, "second", .65, .9);
      const pdRead = ctx.p(t, "delta", .1, .35), pdErr = ctx.p(t, "delta", .4, .6), pdW = ctx.p(t, "delta", .65, .95, E.inOut);
      const pRes = ctx.p(t, "result", .05, .4);
      const pSim = ctx.p(t, "similar", .05, .35, E.inOut), pSimR = ctx.p(t, "similar", .45, .75);

      // memories
      L.grid.set(chain(Z, [[p1, plain1], [p2, plain2], [pSim, plainS]], lerpM));
      Rp.grid.set(chain(Z, [[p1, delta1], [pdW, delta2], [pSim, deltaS]], lerpM));
      L.grid.glow(bump(p1) + bump(p2) + bump(pSim)); Rp.grid.glow(bump(p1) + bump(pdW) + bump(pSim));

      // reads
      const sim = pSim > 0;
      L.readLab.textContent = sim ? "read k₂ (similar to k₁):" : "read ‘door’:";
      Rp.readLab.textContent = L.readLab.textContent;
      L.setRead(chain([0, 0], [[p1r, r.p1], [p2r, r.p2], [pSimR, r.pk2]], lerpV));
      Rp.setRead(chain([0, 0], [[p1r, r.d1], [pRes, r.d2], [pSimR, r.dk2]], lerpV));
      [L, Rp].forEach(P => D.fade(P.readLab, p1r));

      // logs
      const logs = (P, lines) => P.log.forEach((tx, i) => { tx.textContent = lines[i] ? lines[i][0] : ""; tx.setAttribute("opacity", lines[i] ? lines[i][1] : 0); tx.setAttribute("fill", LX.col(lines[i] && lines[i][2] || "text-2")); });
      if (!sim) {
        logs(L, [["1 · write door → open", p1], ["2 · write door → closed", p2]]);
        logs(Rp, [["1 · write door → open", p1], [`2 · read door → ${vec(predicted)}`, pdRead, "embed"],
          ["   Δ = closed − read", pdErr, "delta"], [`   write only Δ = ${vec(dErr)}`, pdW, "delta"]]);
      } else {
        const f = ctx.p(t, "similar", 0, .1);
        logs(L, [["k₁ = (1, 0)   → open", f], [`k₂ = ${vec(k2)} → closed`, f], [`leak: ${fmt(r.pk2[0])} of open`, pSimR, "cache"]]);
        logs(Rp, [["k₁ = (1, 0)   → open", f], [`k₂ = ${vec(k2)} → closed`, f], [`read k₂ = ${vec(r.dk2)}`, pSimR, "delta"]]);
      }
      errArrow.draw(sim ? 0 : pdErr * (1 - pRes));

      // verdicts
      L.verdict.textContent = sim ? "leaks part of the other value" : p2r > 0 ? "a mix of open and closed" : p1r > 0 ? "open ✓" : "";
      Rp.verdict.textContent = sim ? "the newest pair is exact" : pRes > 0 ? "exactly closed ✓" : p1r > 0 ? "open ✓" : "";
      L.verdict.setAttribute("fill", LX.col(p2r > 0 || sim ? "cache" : "text"));
      Rp.verdict.setAttribute("fill", LX.col(pRes > 0 || sim ? "delta" : "text"));
      D.fade(L.verdict, sim ? pSimR : Math.max(p1r, p2r));
      D.fade(Rp.verdict, sim ? pSimR : pRes > 0 ? pRes : p1r * (1 - pdRead));
      D.fade(bigDelta, ctx.p(t, "result", .4, .7));
      D.fade(foot, ctx.p(t, "similar", .8, .95));
    };
  }

  /* ========================================================= scene: delta-gates */
  function buildGates(ctx) {
    const { svg } = ctx; D.backdrop(svg);
    const R = LX.rng(5), N = 8;
    const rnd = () => Array.from({ length: N }, () => R() * 2 - 1);
    // token stream with the α (forget) and β (write) each token sets — illustrative values
    const TOK = [
      { w: "The", a: .99, b: .35, cue: "keep", f: [.04, .2] }, { w: " lab", a: .99, b: .5, cue: "keep", f: [.22, .38] },
      { w: " built", a: .98, b: .45, cue: "keep", f: [.4, .56] }, { w: " a", a: .99, b: .08, cue: "keep", f: [.58, .74] },
      { w: " robot", a: .99, b: .6, cue: "keep", f: [.76, .92] },
      { w: " ¶", a: .6, b: .05, cue: "forget", f: [.12, .85] },
      { w: " Ada", a: .98, b: .9, cue: "write", f: [.04, .46] }, { w: " just", a: .99, b: .05, cue: "write", f: [.54, .94] },
    ];
    // a few earlier writes so the memory is not empty, then the real sequence
    let S = zeros(N, N);
    for (let i = 0; i < 4; i++) S = deltaStep(S, unit(rnd()), rnd().map(x => x * .8), .99, .6);
    const states = [S];
    TOK.forEach((tk, i) => {
      const k = unit(rnd()), v = rnd().map(x => x * (tk.w === " Ada" ? 1.6 : .9));
      states.push(deltaStep(states[i], k, v, tk.a, tk.b));
    });
    const sc = maxAbsM(states) * .8;
    const energy = states.map(M => Math.hypot(...M.flat()));
    const eMax = Math.max(...energy);

    // token row
    const cw = 112, gap = 12, x0 = 800 - (TOK.length * (cw + gap) - gap) / 2;
    const chips = TOK.map((tk, i) => D.tokenChip(svg, { x: x0 + i * (cw + gap), y: 96, w: cw, h: 50, text: tk.w, size: 21 }));
    const marker = LX.el("path", { d: "M0 0 L-9 -12 L9 -12 Z", fill: LX.col("token") }, svg);

    // dials
    function dial(cx, cy, r, sym, sub, color) {
      const g = LX.el("g", {}, svg);
      const arc = a => `M${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(Math.PI + a * Math.PI)} ${cy + r * Math.sin(Math.PI + a * Math.PI)}`;
      LX.el("path", { d: arc(.9999), stroke: LX.col("line-2"), "stroke-width": 12, fill: "none", "stroke-linecap": "round" }, g);
      const val = LX.el("path", { d: arc(.01), stroke: LX.col(color), "stroke-width": 12, fill: "none", "stroke-linecap": "round" }, g);
      const needle = LX.el("line", { x1: cx, y1: cy, x2: cx - r + 18, y2: cy, stroke: LX.col("text"), "stroke-width": 3, "stroke-linecap": "round" }, g);
      LX.el("circle", { cx, cy, r: 6, fill: LX.col("text") }, g);
      D.text(g, cx - r, cy + 26, "0", { mono: true, size: 14, color: "dim", anchor: "middle" });
      D.text(g, cx + r, cy + 26, "1", { mono: true, size: 14, color: "dim", anchor: "middle" });
      D.text(g, cx, cy - r - 36, sym, { size: 22, weight: 600, color, anchor: "middle" });
      D.text(g, cx, cy - r - 14, sub, { size: 14, color: "muted", anchor: "middle" });
      const num = D.text(g, cx, cy + 52, "", { mono: true, size: 24, weight: 500, color, anchor: "middle" });
      return {
        g, set(v) {
          val.setAttribute("d", arc(Math.max(.005, Math.min(.9999, v))));
          const a = Math.PI + v * Math.PI;
          needle.setAttribute("x2", cx + (r - 18) * Math.cos(a)); needle.setAttribute("y2", cy + (r - 18) * Math.sin(a));
          num.textContent = v.toFixed(2);
        },
      };
    }
    const dA = dial(300, 400, 120, "α · forget gate", "how much old memory survives", "delta");
    const dB = dial(300, 700, 120, "β · write gate", "how strongly this token writes", "token");

    const grid = heatGrid(svg, { x: 640, y: 250, rows: N, cols: N, cell: 46, gap: 4 });
    D.label(svg, 640, 222, "memory S (one head, 8 × 8 of 128 × 128)");
    // memory content bar
    const bx = 1110, by = 250, bh = grid.H;
    D.label(svg, bx, 222, "content ‖S‖");
    LX.el("rect", { x: bx, y: by, width: 34, height: bh, rx: 4, fill: LX.col("line") }, svg);
    const ebar = LX.el("rect", { x: bx, y: by + bh, width: 34, height: 0, rx: 4, fill: LX.col("delta") }, svg);
    const formula = D.text(svg, 640, 720, "S ← α · S  +  β · (v − α·S·k) · kᵀ", { mono: true, size: 20, color: "text-2" });
    const note = D.text(svg, 640, 756, "", { size: 16, color: "muted" });

    return t => {
      const pTwo = ctx.p(t, "two", 0, .35);
      chips.forEach(c => c.show(pTwo, 8));
      dA.g.setAttribute("opacity", ctx.p(t, "two", .2, .5)); dB.g.setAttribute("opacity", ctx.p(t, "two", .35, .65));
      D.fade(formula, ctx.p(t, "two", .5, .8));

      // which token is being processed?
      let M = states[0], a = .99, b = .35, cur = -1, wq = 0;
      TOK.forEach((tk, i) => {
        const w = ctx.p(t, tk.cue, tk.f[0], tk.f[1], E.linear);
        if (w > 0 && w < 1) cur = i;
        a = lerp(a, tk.a, E.inOut(seg(w, 0, .3))); b = lerp(b, tk.b, E.inOut(seg(w, 0, .3)));
        M = lerpM(M, states[i + 1], E.inOut(seg(w, .3, .9)));
        if (w > 0 && w < 1) wq = bump(seg(w, .3, .9)) * tk.b;
      });
      dA.set(a); dB.set(b);
      grid.set(M, sc);
      grid.glow(wq);
      const e = Math.hypot(...M.flat()) / eMax;
      ebar.setAttribute("y", by + bh * (1 - e)); ebar.setAttribute("height", bh * e);
      chips.forEach((c, i) => { c.glow(i === cur); c.box.setAttribute("opacity", cur < 0 || i === cur ? 1 : .55); });
      if (cur >= 0) { const c = chips[cur]; marker.setAttribute("transform", `translate(${c.cx} 90)`); marker.setAttribute("opacity", 1); }
      else marker.setAttribute("opacity", 0);
      const tk = cur >= 0 ? TOK[cur] : null;
      note.textContent = !tk ? "" : tk.w === " ¶" ? "topic change: α drops, everything fades evenly"
        : tk.w === " Ada" ? "important name: β high, a strong new pattern"
        : tk.w === " just" ? "filler word: β low, memory barely changes"
        : tk.w === " a" ? "small word: β low" : "same topic: α ≈ 1, memory kept";
    };
  }

  /* ======================================================= scene: deltanet-flow */
  function buildFlow(ctx) {
    const { svg } = ctx; D.backdrop(svg);
    const R = LX.rng(31);
    const SX = 150;                                         // residual stream x
    const params = 5120 * 10240 + 5120 * 6144 + 2 * 5120 * 48 + 10240 * 4 + 48 + 48 + 128 + 6144 * 5120;
    const stateMiB = 48 * 128 * 128 * 4 / 2 ** 20;
    const A = o => D.arrow(svg, { color: "delta", width: 2, ...o });

    // residual stream
    const stream = D.arrow(svg, { d: `M${SX} 880 V30`, color: "embed", width: 3 });
    D.text(svg, SX - 14, 860, "residual stream", { mono: true, size: 14, color: "embed", anchor: "end" });
    const inLab = D.text(svg, SX + 20, 790, "token vector [5120]", { mono: true, size: 14, color: "embed" });

    // input bus and the three input projections
    const bus = A({ d: `M${SX} 820 H1180`, head: false });
    const riseQ = A({ d: "M430 820 V726" }), riseG = A({ d: "M760 820 V726" }), riseZ = A({ d: "M1180 820 V726" });
    const bQKV = D.block(svg, { x: 300, y: 664, w: 260, h: 60, kind: "delta", label: "in_proj_qkv", sub: "5120 → 10240", size: 16 });
    const bAB = D.block(svg, { x: 640, y: 664, w: 240, h: 60, kind: "delta", label: "in_proj_a · in_proj_b", sub: "5120 → 48, twice", size: 15 });
    const bZ = D.block(svg, { x: 1060, y: 664, w: 240, h: 60, kind: "delta", label: "in_proj_z", sub: "5120 → 6144", size: 16 });

    // q, k, v branch
    const a1 = A({ d: "M430 664 V614" });
    const bConv = D.block(svg, { x: 300, y: 560, w: 260, h: 52, kind: "delta", label: "conv1d (window 4) + SiLU", size: 14 });
    const a2 = A({ d: "M430 560 V518" });
    const bL2 = D.block(svg, { x: 300, y: 466, w: 260, h: 50, kind: "norm", label: "L2-norm q, k · q × 1/√128", size: 14 });
    const headNote = LX.el("g", {}, svg);
    D.text(headNote, 418, 430, "16 query/key heads", { mono: true, size: 14, color: "muted", anchor: "end" });
    D.text(headNote, 418, 450, "→ 48 value heads (3 each)", { mono: true, size: 14, color: "muted", anchor: "end" });
    const a3 = A({ d: "M430 466 V420 H560 V412" });

    // gates
    const a4 = A({ d: "M720 664 V600" }), a5 = A({ d: "M800 664 V600" });
    const gate = (cx, sym) => {
      const g = LX.el("g", {}, svg);
      LX.el("circle", { cx, cy: 572, r: 27, fill: LX.mix("bg", "delta", .15), stroke: LX.col("delta"), "stroke-width": 1.5 }, g);
      D.text(g, cx, 580, sym, { size: 22, weight: 600, color: "text", anchor: "middle" });
      return g;
    };
    const gA = gate(720, "α"), gB = gate(800, "β");
    const gLab = D.text(svg, 850, 578, "per head", { mono: true, size: 14, color: "muted" });
    const a6 = A({ d: "M760 545 V412" });

    // memory stack: 48 small state matrices
    const MX = 470, MY = 300, cellsPer = 3, tiny = 7, pitch = 28;
    const mem = [];
    for (let h = 0; h < 48; h++) {
      const col = h % 12, row = Math.floor(h / 12), gx = MX + col * pitch, gy = MY + row * pitch;
      const cs = [];
      for (let i = 0; i < cellsPer; i++) for (let j = 0; j < cellsPer; j++)
        cs.push({ el: LX.el("rect", { x: gx + j * tiny, y: gy + i * tiny, width: tiny - 1, height: tiny - 1, fill: LX.col("zero") }, svg), a: R(), b: R() });
      mem.push(cs);
    }
    const memFrame = LX.el("rect", { x: MX - 10, y: MY - 10, width: 12 * pitch + 14, height: 4 * pitch + 14, rx: 8, fill: "none", stroke: LX.col("cache"), "stroke-width": 1.5 }, svg);
    const memLab = D.text(svg, MX + 12 * pitch + 20, MY + 30, "48 memories, 128 × 128 each", { mono: true, size: 15, color: "cache" });
    const memLab2 = D.text(svg, MX + 12 * pitch + 20, MY + 54, `the layer's whole state: ${stateMiB} MiB`, { mono: true, size: 14, color: "muted" });
    const memLab3 = D.text(svg, MX + 12 * pitch + 20, MY + 78, "fade · write the error · read", { mono: true, size: 14, color: "muted" });

    // output path
    const a7 = A({ d: `M${MX + 168} ${MY - 10} V258` });
    const outShape = D.text(svg, MX + 180, 276, "[6144]", { mono: true, size: 14, color: "muted" });
    const bGate = D.block(svg, { x: 470, y: 200, w: 460, h: 56, kind: "delta", label: "RMSNorm per head  ×  SiLU(z)", size: 16 });
    const aZ = A({ d: "M1180 664 V228 H932" });
    const a8 = A({ d: "M700 200 V156" });
    const bOut = D.block(svg, { x: 520, y: 100, w: 360, h: 54, kind: "delta", label: "out_proj", sub: "6144 → 5120", size: 16 });
    const a9 = A({ d: `M520 127 H${SX + 18}`, color: "embed" });
    const plusG = LX.el("g", {}, svg);
    const plusC = LX.el("circle", { cx: SX, cy: 127, r: 14, fill: LX.col("bg"), stroke: LX.col("embed"), "stroke-width": 2 }, plusG);
    LX.el("path", { d: `M${SX - 7} 127 H${SX + 7} M${SX} 120 V134`, stroke: LX.col("embed"), "stroke-width": 2, "stroke-linecap": "round" }, plusG);
    const total = D.text(svg, 1520, 60, `${(params / 1e6).toFixed(1)} M parameters · state ${stateMiB} MiB`, { mono: true, size: 15, color: "muted", anchor: "end" });

    // light pulses
    const tIn = D.traveller(svg, bus.path, { color: "embed" });
    const pathQ = LX.el("path", { d: "M430 820 V420 H560 V412", fill: "none" }, svg);
    const pathG = LX.el("path", { d: "M760 820 V412", fill: "none" }, svg);
    const pathOut = LX.el("path", { d: `M${MX + 168} ${MY - 10} V256`, fill: "none" }, svg);
    const tQ = D.traveller(svg, pathQ, { color: "delta" }), tG = D.traveller(svg, pathG, { color: "delta" });
    const tO = D.traveller(svg, pathOut, { color: "delta" });
    const tO2 = D.traveller(svg, a9.path, { color: "embed" });
    const tZ = D.traveller(svg, aZ.path, { color: "delta" });

    return t => {
      // in
      stream.draw(ctx.p(t, "in", 0, .3));
      D.fade(inLab, ctx.p(t, "in", .3, .5));
      bus.draw(ctx.p(t, "in", .4, .8));
      tIn.at(ctx.p(t, "in", .4, .95, E.linear));
      [riseQ, riseG, riseZ].forEach(a => a.draw(ctx.p(t, "in", .7, 1)));
      [bQKV, bAB, bZ].forEach((b, i) => b.show(ctx.p(t, "in", .75 + i * .05, 1), 8));

      // qkv
      const pq = ctx.p(t, "qkv", 0, 1, E.linear);
      a1.draw(seg(pq, .1, .25)); bConv.show(seg(pq, .15, .35), 8); a2.draw(seg(pq, .35, .5)); bL2.show(seg(pq, .45, .6), 8);
      a3.draw(seg(pq, .6, .75)); D.fade(headNote, seg(pq, .65, .85));
      tQ.at(seg(pq, 0, .8));
      bQKV.pulse(bump(seg(pq, 0, .3))); bConv.pulse(bump(seg(pq, .2, .5))); bL2.pulse(bump(seg(pq, .45, .75)));

      // gates
      const pg = ctx.p(t, "gates", 0, 1, E.linear);
      a4.draw(seg(pg, .1, .3)); a5.draw(seg(pg, .1, .3));
      D.fade(gA, seg(pg, .25, .45)); D.fade(gB, seg(pg, .3, .5)); D.fade(gLab, seg(pg, .4, .6));
      a6.draw(seg(pg, .5, .75)); tG.at(seg(pg, .05, .85)); bAB.pulse(bump(seg(pg, 0, .35)));

      // memory
      const pm = ctx.p(t, "mem", 0, 1, E.linear);
      const appear = ctx.p(t, "qkv", .7, 1);
      mem.forEach((cs, h) => {
        const wave = seg(pm, h / 48 * .6, h / 48 * .6 + .3);
        cs.forEach(c => {
          const v = appear * lerp(c.a, c.b, E.inOut(wave));
          c.el.setAttribute("fill", LX.mix("zero", "cache", .25 + .75 * v));
          c.el.setAttribute("opacity", appear);
        });
      });
      memFrame.setAttribute("opacity", appear);
      memFrame.setAttribute("filter", pm > 0 && pm < 1 ? "url(#lx-glow)" : "none");
      D.fade(memLab, ctx.p(t, "mem", .1, .3)); D.fade(memLab2, ctx.p(t, "mem", .3, .5)); D.fade(memLab3, ctx.p(t, "mem", .5, .7));

      // out
      const po = ctx.p(t, "out", 0, 1, E.linear);
      a7.draw(seg(po, 0, .15)); D.fade(outShape, seg(po, .1, .2));
      bGate.show(seg(po, .1, .3), 8); aZ.draw(seg(po, .15, .4)); tZ.at(seg(po, .15, .45));
      a8.draw(seg(po, .4, .5)); bOut.show(seg(po, .45, .6), 8); a9.draw(seg(po, .6, .8));
      tO.at(seg(po, .0, .15)); tO2.at(seg(po, .6, .82));
      bGate.pulse(bump(seg(po, .3, .55))); bOut.pulse(bump(seg(po, .55, .75)));
      const pp = bump(seg(po, .8, 1));
      plusG.setAttribute("opacity", seg(po, .6, .8));
      plusC.setAttribute("fill", LX.mix("bg", "embed", pp * .6)); plusC.setAttribute("filter", pp > .15 ? "url(#lx-glow)" : "none");
      D.fade(total, seg(po, .85, 1));
    };
  }


  /* ================================================== widget: assoc-memory */
  // A 2-D toy memory written by hand: plain linear attention vs the (gated) delta rule.
  LX.widget("assoc-memory", host => {
    const VALS = { open: [1, 0], closed: [0, 1] };
    let ang = 0, val = "open", beta = 1, alpha = 1;
    let Sp = [[0, 0], [0, 0]], Sd = [[0, 0], [0, 0]], log = [], readK = null;
    host.innerHTML = `
      <div class="am-top">
        <svg class="am-dial" viewBox="-60 -60 120 70" aria-label="Key direction"></svg>
        <div class="am-ctl">
          <div class="lx-range"><span>Key direction</span><input class="am-ang" type="range" min="0" max="180" step="1" value="0"><output></output></div>
          <div class="am-vals"><span>Value</span>${Object.keys(VALS).map(v => `<button data-v="${v}" aria-pressed="${v === val}">${v} (${VALS[v].join(", ")})</button>`).join("")}</div>
          <div class="lx-range"><span>β write strength</span><input class="am-beta" type="range" min="0" max="1" step="0.05" value="1"><output>1.00</output></div>
          <div class="lx-range"><span>α keep (forget gate)</span><input class="am-alpha" type="range" min="0.5" max="1" step="0.01" value="1"><output>1.00</output></div>
          <div class="am-btns">
            <button class="am-write">Write</button><button class="am-read">Read with this key</button><button class="am-reset">Reset</button>
          </div>
          <div class="am-btns am-presets"><span>Presets</span>
            <button data-p="worked">Worked example</button><button data-p="same">Overwrite the same key</button><button data-p="full">Fill until full</button>
          </div>
        </div>
      </div>
      <div class="am-mems"></div>
      <p class="am-log"></p>
      <p class="am-toy">Toy example with 2 numbers per key and value. In Qwen3.8 each memory is 128 × 128, and the keys and values come from the token.</p>`;
    const $ = q => host.querySelector(q);
    const css = document.createElement("style");
    css.textContent = `
      .am-top{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
      .am-dial{width:150px;flex:none}
      .am-ctl{flex:1;min-width:260px}
      .am-vals,.am-btns{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0;font-size:14px;color:var(--lx-text-2)}
      .am-vals span,.am-btns span{min-width:60px}
      .am-vals button,.am-btns button{font:500 13px var(--lx-sans);color:var(--lx-text-2);background:var(--lx-panel);border:1px solid var(--lx-line-2);border-radius:8px;padding:7px 11px;cursor:pointer}
      .am-vals button[aria-pressed=true]{color:var(--lx-text);border-color:var(--lx-embed)}
      .am-write{border-color:var(--lx-delta)!important;color:var(--lx-text)!important}
      .am-presets button{font-size:12.5px!important;padding:5px 9px!important}
      .am-mems{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-top:10px}
      .am-mem{background:var(--lx-panel);border:1px solid var(--lx-line);border-radius:12px;padding:12px 14px}
      .am-mem h5{margin:0 0 8px;font:600 12.5px var(--lx-mono);letter-spacing:.02em}
      .am-S{display:grid;grid-template-columns:62px 64px 64px;gap:4px;font:500 13px var(--lx-mono);color:var(--lx-text-2);align-items:center}
      .am-S .c{height:38px;border-radius:5px;display:grid;place-items:center;color:var(--lx-text)}
      .am-S .hd{font-size:10.5px;color:var(--lx-muted);text-align:center}
      .am-rd{margin-top:10px;font:500 12.5px var(--lx-mono);color:var(--lx-text-2)}
      .am-rd .bar{display:grid;grid-template-columns:62px 1fr 56px;gap:8px;align-items:center;margin:3px 0}
      .am-rd i{display:block;height:10px;border-radius:2px}
      .am-err{margin-top:6px;font:600 12.5px var(--lx-mono)}
      .am-log,.am-toy{font-size:13.5px;color:var(--lx-muted);margin:8px 0}`;
    host.appendChild(css);
    const key = a => [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)];
    const mv = (S, k) => [S[0][0] * k[0] + S[0][1] * k[1], S[1][0] * k[0] + S[1][1] * k[1]];
    const f = x => (Math.abs(x) < .005 ? "0.00" : (x < 0 ? "−" : "") + Math.abs(x).toFixed(2));
    function write(a, v, b = beta, al = alpha) {
      const k = key(a), V = VALS[v];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) Sp[i][j] += V[i] * k[j];          // plain: S += v kᵀ
      Sd = Sd.map(r => r.map(x => x * al));                                                    // gate: S ← α S
      const pred = mv(Sd, k);                                                                   // what memory recalls now
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) Sd[i][j] += b * (V[i] - pred[i]) * k[j];  // delta: write only the error
      log.push({ a, v });
    }
    function target(a) {   // latest value written with (almost) this key
      for (let i = log.length - 1; i >= 0; i--) if (Math.abs(log[i].a - a) < 1) return VALS[log[i].v];
      return null;
    }
    function dial() {
      const svg = $(".am-dial"), k = key(ang);
      let h = `<path d="M-50 0 A50 50 0 0 1 50 0" fill="none" stroke="${LX.col("line-2")}" stroke-width="1.5"/><line x1="-55" y1="0" x2="55" y2="0" stroke="${LX.col("line")}"/>`;
      log.forEach(e => { const q = key(e.a); h += `<line x1="0" y1="0" x2="${q[0] * 46}" y2="${-q[1] * 46}" stroke="${LX.col(e.v === "open" ? "embed" : "cache")}" stroke-width="2" opacity=".55"/>`; });
      h += `<line x1="0" y1="0" x2="${k[0] * 50}" y2="${-k[1] * 50}" stroke="${LX.col("delta")}" stroke-width="3.5" stroke-linecap="round"/><circle r="3" fill="${LX.col("text")}"/>`;
      svg.innerHTML = h;
      $(".am-ang").nextElementSibling.textContent = (Number.isInteger(ang) ? ang : ang.toFixed(1)) + "°";
    }
    function memPanel(title, color, S) {
      const cells = (r, lab, col) => `<span>${lab}</span>` + S[r].map(x => `<div class="c" style="background:${LX.mix("panel", x < 0 ? "neg" : col, Math.min(1, .15 + Math.abs(x) * .6))}">${f(x)}</div>`).join("");
      let h = `<div class="am-mem"><h5 style="color:${LX.col(color)}">${title}</h5>
        <div class="am-S"><span></span><span class="hd">key axis 1</span><span class="hd">key axis 2</span>${cells(0, "open", "embed")}${cells(1, "closed", "cache")}</div>`;
      if (readK != null) {
        const r = mv(S, key(readK)), tg = target(readK);
        const mx = Math.max(1, ...r.map(Math.abs));
        h += `<div class="am-rd">read at ${Number.isInteger(readK) ? readK : readK.toFixed(1)}° →${["open", "closed"].map((n, i) => `<div class="bar"><span>${n}</span><i style="width:${Math.abs(r[i]) / mx * 100}%;background:${LX.col(i ? "cache" : "embed")}"></i><span>${f(r[i])}</span></div>`).join("")}`;
        if (tg) { const e = Math.hypot(r[0] - tg[0], r[1] - tg[1]); h += `<div class="am-err" style="color:${LX.col(e < .05 ? "mlp" : "logit")}">error vs. last value stored with this key: ${e.toFixed(2)}</div>`; }
        else h += `<div class="am-err" style="color:var(--lx-muted)">nothing was stored with exactly this key</div>`;
        h += `</div>`;
      }
      return h + `</div>`;
    }
    function render() {
      dial();
      $(".am-mems").innerHTML = memPanel("Plain linear attention · S += v kᵀ", "attn", Sp) + memPanel(`Gated delta rule · β = ${beta.toFixed(2)}, α = ${alpha.toFixed(2)}`, "delta", Sd);
      $(".am-log").textContent = log.length ? "Written: " + log.map(e => `${Number.isInteger(e.a) ? e.a : e.a.toFixed(1)}° → ${e.v}`).join(" · ") : "Nothing written yet. Pick a key direction and a value, then press Write.";
    }
    const setSlider = (sel, v) => { const el = $(sel); el.value = v; el.nextElementSibling.textContent = (+v).toFixed(2); };
    function reset() { Sp = [[0, 0], [0, 0]]; Sd = [[0, 0], [0, 0]]; log = []; readK = null; }
    $(".am-ang").oninput = e => { ang = +e.target.value; dial(); };
    host.querySelectorAll(".am-vals button").forEach(b => (b.onclick = () => { val = b.dataset.v; host.querySelectorAll(".am-vals button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); }));
    $(".am-beta").oninput = e => { beta = +e.target.value; e.target.nextElementSibling.textContent = beta.toFixed(2); render(); };
    $(".am-alpha").oninput = e => { alpha = +e.target.value; e.target.nextElementSibling.textContent = alpha.toFixed(2); render(); };
    $(".am-write").onclick = () => { write(ang, val); readK = ang; render(); };
    $(".am-read").onclick = () => { readK = ang; render(); };
    $(".am-reset").onclick = () => { reset(); render(); };
    host.querySelectorAll(".am-presets button").forEach(b => (b.onclick = () => {
      reset(); beta = 1; alpha = 1; setSlider(".am-beta", 1); setSlider(".am-alpha", 1);
      const k2 = Math.atan2(0.8, 0.6) * 180 / Math.PI;                      // exactly (0.6, 0.8), ≈ 53.1°
      if (b.dataset.p === "worked") { write(0, "open"); write(k2, "closed"); readK = k2; }
      if (b.dataset.p === "same") { write(0, "open"); write(0, "closed"); readK = 0; }
      if (b.dataset.p === "full") { [0, 45, 90, 135].forEach((a, i) => write(a, i % 2 ? "closed" : "open")); readK = 0; }
      ang = readK; $(".am-ang").value = ang; render();
    }));
    render();
  });

  LX.chapter({
  id: "deltanet", num: 8, title: "Linear attention and Gated DeltaNet", toc: "Gated DeltaNet",
  kicker: "A memory that stays the same size",
  lede: "Full attention keeps every earlier token and looks at all of them, every time. Gated DeltaNet keeps a single fixed-size memory instead, and writes into it carefully. Three out of four layers in Qwen3.8 work this way.",
  body: [
    { prose: `
      <p>The previous chapter ended with a problem. Full attention gets more expensive the longer the text gets. Each new token compares itself with every earlier token, and the keys and values of all those tokens have to be stored. At 100,000 tokens of context, that is a lot of looking back.</p>
      <p>Here is a different idea. Instead of keeping a list of everything, keep a <strong>summary</strong>: one memory of fixed size that every token writes into and reads from. That is <strong>linear attention</strong>. Gated DeltaNet is a carefully improved version of it, and 48 of Qwen3.8's 64 layers use it.</p>` },

    { scene: {
      id: "delta-memory", build: buildMemory, title: "A memory matrix: write with a key, read with a query",
      visual: "Left: full attention as a growing list of cached key and value rows, with the KV-cache size of one attention layer. Right: one memory matrix S (8 × 8 shown of 128 × 128) with a value column on its left, a key row above it and a read-out column on its right. Three tokens write their outer products v kᵀ into S (computed with orthonormal 8-number keys); then the query for ‘door’ sweeps the rows and the read-out equals the value stored with ‘door’. A token counter runs to 100,000 while S keeps its size.",
      cues: [
        { id: "idea",  say: "Full attention keeps a list of every earlier token. Linear attention keeps something else: one square grid of numbers, a memory, that never grows.", vis: "Left: key/value rows appear one per token (counter to 12; KV cache 48 KiB). Right: an empty fixed 8 × 8 grid with the badge “128 × 128 per head”." },
        { id: "write", say: "Each token writes into this memory. It multiplies its value by its key, which produces a whole grid of numbers called an outer product, and adds that grid to the memory.", vis: "Left dims. Tokens ·door, ·lamp, ·key appear in turn; each brings a value column v and a key row kᵀ, and S gains their rank-one pattern (grid glows). Formula: S ← S + v kᵀ." },
        { id: "read",  say: "To read, a later token multiplies the memory by its query. If the query points in the same direction as a key that was written before, out comes the value that was stored with it.", vis: "The key row is replaced by the query qᵀ = key of ‘door’; a highlight sweeps S row by row while the read-out column fills; it matches the ‘door’ value shown again on the left: “read-out = v of ‘door’ ✓”. Formula: o = S q." },
        { id: "size",  say: "In Qwen 3.8 each memory is one hundred and twenty-eight by one hundred and twenty-eight numbers per head. Whether the text has ten tokens or a hundred thousand, the memory stays exactly that size.", vis: "Counter runs to 100,000; the list on the left says “+ 99,986 more rows” and 390.6 MiB; the badge pulses and “3 MiB per layer · for any length” appears under S." },
      ],
    } },

    { prose: `
      <h3>Writing and reading a memory matrix</h3>
      <p>The memory is a matrix <i>S</i>. Every token brings a <strong>key</strong> <b>k</b> and a <strong>value</strong> <b>v</b>, just as in attention:</p>
      <ul>
        <li><strong>Write:</strong> add the <em>outer product</em> <b>v</b><b>k</b><sup>T</sup> to <i>S</i>. That is a whole matrix built from the two vectors, and it stores the association "key → value".</li>
        <li><strong>Read:</strong> multiply <i>S</i> by a query <b>q</b>. If <b>q</b> is close to a key that was written earlier, the result is close to that key's value.</li>
      </ul>
      <p>Reading costs the same no matter how many tokens came before, because there is nothing to look back over. This is one reason for the name <em>linear</em> attention: without the softmax, the total work grows only linearly with the length of the text.</p>

      <h3>The catch: plain writing only piles up</h3>
      <p>The simplest version just keeps adding: <i>S</i> ← <i>S</i> + <b>v</b><b>k</b><sup>T</sup>. Every new association is laid on top of the old ones, and nothing is ever corrected or removed. Two problems follow:</p>
      <ul>
        <li><strong>Interference.</strong> Keys are never perfectly different from one another. A query for one key also picks up a bit of every similar key's value, and the memory becomes a blur.</li>
        <li><strong>No updating.</strong> If the text first says "the door is open" and later "the door is now closed", plain writing stores both. Reading returns a mix of open and closed.</li>
      </ul>` },

    { scene: {
      id: "delta-vs-plain", build: buildPlainDelta, title: "Plain writing vs the delta rule",
      visual: "Split screen with a 2 × 2 memory on each side: rows are the value directions open (teal) and closed (orange), columns the two key axes, every cell labelled with its number. Below each memory, the read-out as two bars (open, closed) with values; on the right of each memory a short log of what was written. All numbers are computed live from the delta rule. Demo 1: the same key ‘door’ gets open, then closed. Demo 2: the chapter’s worked example with similar keys k₁ = (1, 0), k₂ = (0.6, 0.8).",
      cues: [
        { id: "setup",   say: "Let us compare two ways of writing. On the left, plain linear attention, which only ever adds. On the right, the delta rule, used by Gated DeltaNet.", vis: "Two empty 2 × 2 memories (all 0.00) with titles “Plain linear attention · only adds” and “Delta rule · writes the difference”." },
        { id: "first",   say: "First the text says: the door is open. Both memories store door goes with open. Reading door gives open on both sides.", vis: "Both: cell (open, axis 1) becomes 1.00; log “1 · write door → open”; read ‘door’: open 1.00, closed 0.00; “open ✓”." },
        { id: "second",  say: "Later the text says: the door is now closed. The plain memory simply adds the new fact on top of the old one. Ask it about the door, and it answers with a mix of open and closed.", vis: "Left: cell (closed, axis 1) also becomes 1.00; read: open 1.00 and closed 1.00; verdict “a mix of open and closed”." },
        { id: "delta",   say: "The delta rule does something smarter. Before writing, it first reads what the memory already says about the door: open. It compares that with the new value, closed. And it writes only the difference.", vis: "Right: log “2 · read door → (1.00, 0.00)”, “Δ = closed − read”, “write only Δ = (−1.00, 1.00)”; an arrow links the read to Δ; the memory changes to open 0.00 / closed 1.00." },
        { id: "result",  say: "Now reading the door gives exactly closed. The old fact was not piled on, it was corrected. Delta is simply the mathematical word for difference, and that is where the name DeltaNet comes from.", vis: "Right read: open 0.00, closed 1.00, “exactly closed ✓”; a large Δ appears top right." },
        { id: "similar", say: "The same correction helps with keys that merely look alike. The plain memory leaks part of one value into the other. The delta rule notices the leak when it reads first, and writes a correction that cancels it.", vis: "Both memories switch to demo 2. Left: [[1.00, 0.00], [0.60, 0.80]], read k₂ = (0.60, 1.00), “leak: 0.60 of open”. Right: [[0.64, −0.48], [0.60, 0.80]], read k₂ = (0.00, 1.00), “the newest pair is exact”; footnote: k₁ now reads (0.64, 0.60)." },
      ],
    } },

    { prose: `
      <h3>The delta rule: write only the error</h3>
      <p>The delta rule turns every write into a small correction:</p>
      <ol>
        <li><strong>Predict.</strong> Read what the memory currently returns for this key: <i>S</i><b>k</b>.</li>
        <li><strong>Compare.</strong> The error is <b>v</b> − <i>S</i><b>k</b>, the difference between what should be stored and what is stored.</li>
        <li><strong>Correct.</strong> Write just that error: <i>S</i> ← <i>S</i> + β (<b>v</b> − <i>S</i><b>k</b>) <b>k</b><sup>T</sup>.</li>
      </ol>
      <p>β (beta) is a <strong>write strength</strong> between 0 and 1, chosen by the token itself. With β = 1 the old value is fully replaced; with β near 0 the token barely touches the memory. If the memory already holds the right value, the error is zero and nothing changes, so the memory does not fill up with repeats.</p>` },

    { html: `<div class="lx-prose"><h3>Classic attention, plain linear attention, and the delta rule</h3>
      <p>This is the clearest way to see how the three relate. All three use queries, keys and values. They differ in what they keep from the past and how they write into it.</p></div>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th></th><th>Full (softmax) attention</th><th>Plain linear attention</th><th>Gated DeltaNet</th></tr>
        <tr><td><strong>What it keeps</strong></td><td>Every earlier key and value (KV cache)</td><td>One fixed matrix <i>S</i> per head</td><td>One fixed matrix <i>S</i> per head</td></tr>
        <tr><td><strong>How it writes</strong></td><td>Appends the new key and value</td><td>Adds <b>v</b><b>k</b><sup>T</sup>, never corrects</td><td>Fades the old memory, then writes the error β(<b>v</b> − <i>S</i><b>k</b>)<b>k</b><sup>T</sup></td></tr>
        <tr><td><strong>How it reads</strong></td><td>Compares the query with all keys, softmax, blend</td><td><i>S</i><b>q</b></td><td><i>S</i><b>q</b></td></tr>
        <tr><td><strong>Memory per layer</strong></td><td>Grows with every token</td><td>Constant</td><td>Constant (3 <abbr>MiB</abbr> per layer in Qwen3.8)</td></tr>
        <tr><td><strong>Cost per new token</strong></td><td>Grows with context length</td><td>Constant</td><td>Constant</td></tr>
        <tr><td><strong>Exact recall of old details</strong></td><td>Yes</td><td>Poor; blurs quickly</td><td>Good, but lossy over very long texts</td></tr>
      </table></div>` },

    { prose: `
      <h3>The gates: forgetting and writing</h3>
      <p>"Gated" adds one more control: a <strong>forget gate</strong> α (alpha), also between 0 and 1. Before each write, the whole memory is multiplied by α. When α is close to 1, the memory keeps almost everything. When α is lower, old content fades, which is useful when the topic changes. Both gates are computed fresh for every token, from that token's own vector:</p>
      <ul>
        <li><strong>α, forget</strong>: "how much of the old memory should survive me?"</li>
        <li><strong>β, write</strong>: "how strongly should I write my own fact?"</li>
      </ul>
      <p>Every token gets its own α and β in each of the 48 value heads, so different heads can remember on different time scales.</p>` },

    { scene: {
      id: "delta-gates", build: buildGates, title: "Forget gate α and write gate β",
      visual: "A row of tokens at the top (The · lab · built · a · robot · ¶ · Ada · just) with a marker on the one being processed. Left: two gauge dials, α (forget, blue) and β (write, amber), set by that token. Centre: one 8 × 8 memory (of 128 × 128), updated live with S ← α·S + β·(v − α·S·k)·kᵀ. Right: a bar showing how much the memory holds (‖S‖). Gate values are illustrative; the memory is computed.",
      cues: [
        { id: "two",    say: "Gated DeltaNet adds two dials, set fresh by every token. Alpha decides how much of the old memory survives. Beta decides how strongly the new token writes.", vis: "Token row, both dials and the update formula fade in; the memory already holds a few earlier writes." },
        { id: "keep",   say: "While the text stays on one topic, alpha sits close to one. The memory keeps nearly everything.", vis: "The lab built a robot: α stays at 0.98–0.99; β varies (0.08 for ·a, up to 0.60); the memory keeps its content and the bar rises." },
        { id: "forget", say: "At a change of topic, alpha can drop. The whole memory fades a little, making room for what comes next.", vis: "Token ¶ (paragraph break): α dips to 0.60, β 0.05; the whole grid dims evenly and the bar drops. Note: “topic change: α drops, everything fades evenly”." },
        { id: "write",  say: "An important word, like a name, can set beta high and write its fact firmly. A filler word sets beta low and leaves the memory almost untouched.", vis: "·Ada: β = 0.90, a strong new pattern, the grid glows and the bar jumps. ·just: β = 0.05, the memory barely changes." },
      ],
    } },

    { prose: `
      <h3>Inside one Gated DeltaNet layer</h3>
      <p>The full layer wraps the memory in a few practical steps. In order:</p>
      <ol>
        <li><strong>Project.</strong> One matrix produces queries, keys and values from the token's vector: <strong>16 query/key heads</strong> of 128 numbers and <strong>48 value heads</strong> of 128 numbers. Each query/key head is shared by 3 neighbouring value heads (value heads 0–2 use query/key head 0, heads 3–5 use head 1, and so on), similar to grouped-query attention.</li>
        <li><strong>Short convolution.</strong> Before anything else, each query, key and value channel is mixed with the same channel of the previous 3 tokens (a causal convolution with a window of 4). This gives the layer a cheap, exact view of its immediate neighbours. A <abbr>SiLU</abbr> activation follows.</li>
        <li><strong>Normalise.</strong> Queries and keys are scaled to length 1 (<abbr>L2</abbr> normalisation). This keeps the delta rule stable: a key of length 1 makes a β = 1 write an exact replacement.</li>
        <li><strong>Gates.</strong> Two small projections give β (write strength) and α (forget) for each of the 48 value heads.</li>
        <li><strong>Memory update and read.</strong> Each value head updates its 128 × 128 memory with the gated delta rule and reads it with its query.</li>
        <li><strong>Output gate.</strong> Each head's output is normalised with <abbr>RMSNorm</abbr> and multiplied by <abbr>SiLU</abbr>(<b>z</b>), where <b>z</b> comes from yet another projection. The 48 heads are joined (48 × 128 = 6,144 numbers) and projected back to 5,120.</li>
      </ol>` },

    { scene: {
      id: "deltanet-flow", build: buildFlow, title: "Data flow through one Gated DeltaNet layer",
      visual: "A vertical flow diagram in DeltaNet blue beside the teal residual stream. At the bottom the token vector [5120] feeds three projections: in_proj_qkv (5120 → 10240) → conv1d (window 4) + SiLU → L2-norm q, k · q × 1/√128; in_proj_a · in_proj_b (5120 → 48, twice) → α and β per head; in_proj_z (5120 → 6144). The branches meet at 48 small memory matrices (orange, the recurrent state). Their [6144] output goes through RMSNorm per head × SiLU(z) and out_proj (6144 → 5120) and is added to the stream at ⊕. Light pulses follow each branch.",
      cues: [
        { id: "in",    say: "Here is one complete Gated DeltaNet layer. The token's vector of five thousand one hundred and twenty numbers comes in at the bottom.", vis: "The residual stream draws upward; a pulse runs along the input bus; the three input projections appear." },
        { id: "qkv",   say: "One projection makes the queries, keys and values. A short convolution lets each of them peek at the three tokens just before it. Then the queries and keys are scaled to length one.", vis: "The q/k/v branch lights up block by block: conv1d (window 4) + SiLU, then L2-norm; note: 16 query/key heads → 48 value heads (3 each). The 48 memories appear." },
        { id: "gates", say: "Two small projections set the gates, alpha and beta, for each of the forty-eight heads.", vis: "in_proj_a · in_proj_b pulse; α and β circles (“per head”) appear and feed the memories." },
        { id: "mem",   say: "Each head updates its memory with the gated delta rule, then reads it with its query. These forty-eight memories are the layer's entire state, carried from token to token.", vis: "A wave of updates runs through the 48 memory tiles (frame glows); labels: “48 memories, 128 × 128 each”, “the layer’s whole state: 3 MiB”, “fade · write the error · read”." },
        { id: "out",   say: "The outputs are normalised, multiplied by a third gate, joined together, and projected back to five thousand one hundred and twenty numbers, ready to be added to the residual stream.", vis: "[6144] → RMSNorm per head × SiLU(z) (z arrives from in_proj_z) → out_proj (6144 → 5120) → ⊕ into the stream; label “115.9 M parameters · state 3 MiB”." },
      ],
    } },

    { html: `<div class="lx-prose"><h3>The Gated DeltaNet part in numbers</h3></div>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Weights</th><th>Shape</th><th class="num">Parameters</th><th>Produces</th></tr>
        <tr><td><code>in_proj_qkv</code></td><td class="num">5120 → 10240</td><td class="num">52.4 M</td><td>16 queries + 16 keys + 48 values, × 128 each</td></tr>
        <tr><td><code>in_proj_z</code></td><td class="num">5120 → 6144</td><td class="num">31.5 M</td><td>Output gate for 48 heads × 128</td></tr>
        <tr><td><code>in_proj_a</code>, <code>in_proj_b</code></td><td class="num">5120 → 48, twice</td><td class="num">0.5 M</td><td>Forget gate α and write strength β per head</td></tr>
        <tr><td><code>conv1d</code></td><td class="num">10240 × 4</td><td class="num">41 k</td><td>Short causal convolution, window 4</td></tr>
        <tr><td><code>A_log</code>, <code>dt_bias</code>, <code>norm</code></td><td class="num">48, 48, 128</td><td class="num">224</td><td>Gate constants and output RMSNorm weights</td></tr>
        <tr><td><code>out_proj</code></td><td class="num">6144 → 5120</td><td class="num">31.5 M</td><td>Back to the hidden size</td></tr>
        <tr class="sum"><td>DeltaNet part of one layer</td><td></td><td class="num">115.9 M</td><td>× 48 layers = 5.56 billion</td></tr>
      </table></div>` },

    { widget: {
      id: "assoc-memory", title: "Toy associative memory: plain vs delta",
      sub: "Choose a key direction and a value, then press Write. The plain memory only adds; the delta rule first reads what it already stores and writes only the difference. Try the presets, then change β and α.",
    } },

    { prose: `
      <h3>The case for a 3 : 1 hybrid</h3>
      <p>A fixed-size memory is a summary, and summaries lose detail. Gated DeltaNet is good at keeping track of <em>what is going on</em>: the topic, the recent facts, the structure of the text. But it cannot promise to return the exact wording of a sentence from 50,000 tokens ago. Full attention can, because it keeps every key and value.</p>
      <p>So Qwen3.8 mixes the two. In every group of four layers, three are Gated DeltaNet and the fourth is full attention:</p>
      <ul>
        <li>The <strong>48 DeltaNet layers</strong> do most of the token mixing at a constant cost per token, with a constant memory of 144 <abbr>MiB</abbr> in total.</li>
        <li>The <strong>16 full-attention layers</strong> provide exact look-up whenever it is needed, such as copying a name, quoting code, or finding a detail in a long document.</li>
      </ul>
      <p>The result is a model that handles 262,144 tokens of context with a KV cache only a quarter the size of an all-attention model with the same attention layout.</p>

      <h3>Reading a prompt vs writing</h3>
      <p>When writing, one token at a time, DeltaNet is a simple loop: fade, correct, read. It needs a few small matrix operations per head and never looks back. When reading a whole prompt at once, doing that loop token by token would waste the <abbr>GPU</abbr>. Instead the prompt is cut into <strong>chunks</strong>. Inside a chunk, all tokens are processed together with matrix multiplications, and only the memory is passed from one chunk to the next. Both ways give the same result.</p>` },

    { deep: `
      <h3>The gated delta rule</h3>
      <p>For one value head at token <i>t</i>, with key <b>k</b><sub><i>t</i></sub> and query <b>q</b><sub><i>t</i></sub> (length 128, L2-normalised), value <b>v</b><sub><i>t</i></sub> (length 128), forget gate α<sub><i>t</i></sub> ∈ (0, 1) and write strength β<sub><i>t</i></sub> ∈ (0, 1):</p>
      <math display="block"><mrow><msub><mi>S</mi><mi>t</mi></msub><mo>=</mo><msub><mi>α</mi><mi>t</mi></msub><msub><mi>S</mi><mrow><mi>t</mi><mo>−</mo><mn>1</mn></mrow></msub><mrow><mo>(</mo><mi>I</mi><mo>−</mo><msub><mi>β</mi><mi>t</mi></msub><msub><mi mathvariant="bold">k</mi><mi>t</mi></msub><msubsup><mi mathvariant="bold">k</mi><mi>t</mi><mi>T</mi></msubsup><mo>)</mo></mrow><mo>+</mo><msub><mi>β</mi><mi>t</mi></msub><msub><mi mathvariant="bold">v</mi><mi>t</mi></msub><msubsup><mi mathvariant="bold">k</mi><mi>t</mi><mi>T</mi></msubsup><mo>,</mo><mspace width="1.5em"/><msub><mi mathvariant="bold">o</mi><mi>t</mi></msub><mo>=</mo><msub><mi>S</mi><mi>t</mi></msub><msub><mi mathvariant="bold">q</mi><mi>t</mi></msub></mrow></math>
      <div class="lx-read">S<sub>t</sub> is one head's memory matrix (128 × 128) after token t. Right part first: multiply the old memory S<sub>t−1</sub> by the forget gate α<sub>t</sub> to fade it, and the bracket with (I − β<sub>t</sub> k<sub>t</sub> k<sub>t</sub><sup>T</sup>) partly erases whatever was stored under the key k<sub>t</sub>. Then add the new value v<sub>t</sub> stored under that key, with write strength β<sub>t</sub>. Last part: to read, multiply the memory by the query q<sub>t</sub>; the output o<sub>t</sub> is a 128-number vector.</div>
      <p>Written as "fade, then correct", with <i>S</i>′ = α<sub><i>t</i></sub> <i>S</i><sub><i>t</i>−1</sub>, it is the same update:</p>
      <math display="block"><mrow><msub><mi>S</mi><mi>t</mi></msub><mo>=</mo><msup><mi>S</mi><mo>′</mo></msup><mo>+</mo><msub><mi>β</mi><mi>t</mi></msub><mrow><mo>(</mo><msub><mi mathvariant="bold">v</mi><mi>t</mi></msub><mo>−</mo><msup><mi>S</mi><mo>′</mo></msup><msub><mi mathvariant="bold">k</mi><mi>t</mi></msub><mo>)</mo></mrow><msubsup><mi mathvariant="bold">k</mi><mi>t</mi><mi>T</mi></msubsup></mrow></math>
      <div class="lx-read">S′ is the memory after fading. Ask it what it currently remembers for key k<sub>t</sub> (that is S′ times k<sub>t</sub>), and subtract that from the value you actually want to store, v<sub>t</sub>. The difference is the error, the “delta”. Multiply the error by the write strength β<sub>t</sub> and write it into the memory under key k<sub>t</sub>. Example from the text: memory predicted (0.6, 0), target (0, 1), so with β = 1 the correction written is (−0.6, 1).</div>
      <p>Special cases make the relationships clear:</p>
      <ul>
        <li>α = 1 and the error term replaced by plain <b>v</b><sub><i>t</i></sub>: <i>S</i><sub><i>t</i></sub> = <i>S</i><sub><i>t</i>−1</sub> + <b>v</b><sub><i>t</i></sub><b>k</b><sub><i>t</i></sub><sup>T</sup>, plain linear attention.</li>
        <li>α = 1: the (ungated) delta rule.</li>
        <li>β = 1 and |<b>k</b>| = 1: then <i>S</i><sub><i>t</i></sub><b>k</b><sub><i>t</i></sub> = <b>v</b><sub><i>t</i></sub> exactly. The association is overwritten.</li>
      </ul>

      <h3>A worked example in two dimensions</h3>
      <p>Keys <b>k</b><sub>1</sub> = (1, 0) and <b>k</b><sub>2</sub> = (0.6, 0.8), both of length 1 but not perpendicular. Values <b>v</b><sub>1</sub> = (1, 0), <b>v</b><sub>2</sub> = (0, 1). Start from <i>S</i> = 0, α = β = 1.</p>
      <ul>
        <li><strong>Plain:</strong> <i>S</i> = <b>v</b><sub>1</sub><b>k</b><sub>1</sub><sup>T</sup> + <b>v</b><sub>2</sub><b>k</b><sub>2</sub><sup>T</sup> = [[1, 0], [0.6, 0.8]]. Reading <b>k</b><sub>2</sub> gives (0.6, 1.0) instead of (0, 1): a leak of 0.6 from <b>v</b><sub>1</sub>.</li>
        <li><strong>Delta:</strong> after the first write, <i>S</i> = [[1, 0], [0, 0]]. For the second write, the memory predicts <i>S</i><b>k</b><sub>2</sub> = (0.6, 0), so the error is (−0.6, 1). Writing it gives <i>S</i> = [[0.64, −0.48], [0.6, 0.8]], and reading <b>k</b><sub>2</sub> now gives exactly (0, 1).</li>
      </ul>
      <p>The price shows too: reading <b>k</b><sub>1</sub> now gives (0.64, 0.6). With overlapping keys, a 2-D memory cannot hold both pairs perfectly, and the delta rule favours the newest. With 128-dimensional keys there is far more room, but the memory is still finite. That is the "lossy" in lossy memory.</p>
      <p>The animation “Plain writing vs the delta rule” above computes exactly these matrices, and the toy memory above lets you repeat the calculation by hand, including with smaller β or a forget gate α below 1.</p>

      <h3>How α and β are computed</h3>
      <p>For each of the 48 value heads, with <b>x</b> the token's normalised hidden state:</p>
      <math display="block"><mrow><msub><mi>β</mi><mi>t</mi></msub><mo>=</mo><mi>σ</mi><mo>(</mo><msub><mi>W</mi><mi>b</mi></msub><mi mathvariant="bold">x</mi><mo>)</mo><mo>,</mo><mspace width="1.5em"/><msub><mi>α</mi><mi>t</mi></msub><mo>=</mo><mi>exp</mi><mrow><mo>(</mo><mo>−</mo><msup><mi>e</mi><msub><mi>A</mi><mi>log</mi></msub></msup><mo>·</mo><mtext>softplus</mtext><mo>(</mo><msub><mi>W</mi><mi>a</mi></msub><mi mathvariant="bold">x</mi><mo>+</mo><msub><mi>b</mi><mrow><mi>d</mi><mi>t</mi></mrow></msub><mo>)</mo><mo>)</mo></mrow></mrow></math>
      <div class="lx-read">x is the token's normalised hidden state. Write strength: multiply x by a small learned matrix W<sub>b</sub> to get one number per head, and squash it with the sigmoid σ into a value between 0 and 1. Forget gate: multiply x by W<sub>a</sub>, add the learned bias b<sub>dt</sub>, pass it through softplus (which makes it zero or positive), multiply by the head's learned speed e<sup>A_log</sup>, put a minus sign in front and take exp. Because the exponent is never positive, α<sub>t</sub> always lands between 0 and 1: near 1 means “keep almost everything”.</div>
      <p>Before the update, <b>q</b> and <b>k</b> are scaled to length 1 (L2 normalisation), and <b>q</b> is additionally multiplied by 1/√128 ≈ 0.088, the same kind of scaling that full attention uses.</p>
      <p>Here softplus(<i>u</i>) = ln(1 + <i>e</i><sup><i>u</i></sup>) ≥ 0. <code>A_log</code> sets each head's typical forgetting speed; <code>dt_bias</code> shifts it. The names come from <abbr>SSM</abbr> research such as Mamba, where the same structure is a discretised time step "Δt". Gated DeltaNet can be read as a state space model whose state is a matrix.</p>

      <h3>State size</h3>
      <p>One value head holds a 128 × 128 matrix, kept in <abbr>fp32</abbr> (4 bytes) for accuracy: 64 <abbr>KiB</abbr>. One layer has 48 heads: 48 × 64 KiB = <strong>3 MiB</strong>. 48 layers: <strong>144 MiB</strong>. That figure is the same at 10 tokens and at 262,144 tokens. The short convolution also keeps the last 3 inputs per channel, which is tiny by comparison.</p>

      <h3>The chunked form, in one paragraph</h3>
      <p>Unrolling the recurrence over a chunk of <i>C</i> tokens (64 in the reference implementations) expresses every output in the chunk as (memory from the previous chunk) × (query) plus a <i>C</i> × <i>C</i> masked interaction among the chunk's own tokens, much like a small attention matrix. That interaction can be computed with dense matrix multiplications. Only the memory at the chunk boundary is carried forward. Prefill cost therefore grows linearly with prompt length, not quadratically, and still uses the <abbr>GPU</abbr> efficiently.</p>` },
  ],
});
})();
