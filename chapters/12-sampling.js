/* Chapter 12 — Choosing the next token (temperature & sampling) */
(function () {
  "use strict";
  const D = LX.draw, E = LX.ease, clamp = LX.clamp, lerp = LX.lerp;
  const softmax = xs => { const m = Math.max(...xs), e = xs.map(x => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0); return e.map(x => x / s); };
  const fmtPct = (v, d = 1) => (v * 100).toFixed(d) + "%";

  /* The chapter's running example: seven tokens and their logits. Every
     probability shown in the scenes and the widget is computed from these. */
  const TOK = [" mat", " floor", " couch", " bed", " sofa", " roof", " moon"];
  const Z = [5.0, 4.2, 3.6, 3.2, 3.0, 2.5, 1.0];
  const softT = T => softmax(Z.map(z => z / T));
  const cumsum = ps => ps.reduce((a, v) => (a.push((a.length ? a[a.length - 1] : 0) + v), a), []);
  /** keep the shortest prefix (tokens are sorted) whose sum reaches p */
  const nucleus = (ps, p) => { let s = 0; for (let i = 0; i < ps.length; i++) { s += ps[i]; if (s >= p - 1e-12) return i + 1; } return ps.length; };
  /** shade of the logit colour per rank, so neighbouring strip segments are distinguishable */
  const shade = i => LX.mix("logit", "bg", Math.min(.6, i * .085));

  /* ======================================================== sampling-die */
  function buildDie(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    const P = softT(1), C = cumsum(P);
    D.label(svg, 80, 70, "Next token after “The cat sat on the” · T = 1");

    /* rows: token, bar track, percentage — later reused as the tally */
    const RX = 120, BX = 270, BW = 380, BH = 22, RY = i => 140 + i * 58;
    const rows = TOK.map((tk, i) => {
      const lab = D.tokenText(svg, RX, RY(i) + 18, tk, { size: 20, anchor: "start", color: i === 0 ? "text" : "text-2" });
      const track = LX.el("rect", { x: BX, y: RY(i), width: BW, height: BH, rx: 3, fill: LX.col("line") }, svg);
      const pct = D.text(svg, BX + BW + 16, RY(i) + 18, fmtPct(P[i]), { mono: true, size: 16, color: i === 0 ? "logit" : "muted" });
      return { lab, track, pct };
    });

    /* greedy: frame + argmax tag + three identical picks */
    const gFrame = LX.el("rect", { x: RX - 14, y: RY(0) - 12, width: BX + BW + 96 - RX, height: BH + 24, rx: 8, fill: "none", stroke: LX.col("logit"), "stroke-width": 2, filter: "url(#lx-glow)" }, svg);
    const gTag = D.text(svg, BX + BW + 100, RY(0) + 18, "← argmax", { mono: true, size: 16, color: "logit", weight: 500 });
    const pickLab = D.label(svg, 900, 150, "Greedy · three picks in a row");
    const picks = [0, 1, 2].map(k => D.tokenChip(svg, { x: 900 + k * 150, y: 172, w: 128, h: 50, text: " mat", color: "logit", size: 20 }));

    /* the strip: segments 0 → 1, widths = probabilities */
    const SX = 120, SW = 1360, SY = 690, SH = 46;
    const bars = TOK.map((_, i) => LX.el("rect", { rx: 3, fill: shade(i) }, svg));
    const segLab = TOK.map((tk, i) => {
      const w = SW * P[i];
      if (w < 70) return null;
      return D.tokenText(svg, SX + SW * (C[i] - P[i]) + w / 2, SY - 14, tk, { size: 17, color: "text-2" });
    });
    const axis = LX.el("g", {}, svg);
    D.text(axis, SX, SY + SH + 26, "0", { mono: true, size: 15, color: "muted", anchor: "middle" });
    D.text(axis, SX + SW / 2, SY + SH + 26, "0.5", { mono: true, size: 15, color: "muted", anchor: "middle" });
    D.text(axis, SX + SW, SY + SH + 26, "1", { mono: true, size: 15, color: "muted", anchor: "middle" });
    [0, .5, 1].forEach(f => LX.el("line", { x1: SX + SW * f, y1: SY + SH, x2: SX + SW * f, y2: SY + SH + 8, stroke: LX.col("muted") }, axis));
    const stripLab = D.label(axis, SX, SY - 52, "All probabilities laid end to end · one line from 0 to 1");

    /* 20 seeded draws (seed chosen so 20 draws look typical: 10/4/2/2/1/1/0) */
    const R = LX.rng(124); R();
    const draws = Array.from({ length: 20 }, () => { const u = R(); return { u, i: C.findIndex(c => u < c) }; });
    const N = draws.length, F0 = .06, STEP = .82 / N, LAND = .7;
    const ticks = draws.map(d => LX.el("line", { x1: SX + SW * d.u, y1: SY - 6, x2: SX + SW * d.u, y2: SY + SH + 6, stroke: LX.col("text"), "stroke-width": 2, opacity: 0 }, svg));
    const marker = LX.el("g", { opacity: 0 }, svg);
    LX.el("line", { x1: 0, y1: -70, x2: 0, y2: 0, stroke: LX.col("text"), "stroke-width": 2 }, marker);
    LX.el("path", { d: "M-9 -16 L9 -16 L0 0 Z", fill: LX.col("text") }, marker);
    const uText = D.text(svg, 0, 0, "", { mono: true, size: 15, color: "text" });
    const tallyLab = D.label(svg, BX, 122, "Tally of 20 random picks");
    const final = TOK.map((_, i) => draws.filter(d => d.i === i).length);
    const dots = TOK.map((_, i) => Array.from({ length: final[i] }, (_, j) => LX.el("circle", { cx: BX + 12 + j * 26, cy: RY(i) + BH / 2, r: 8, fill: shade(i), opacity: 0 }, svg)));
    const counts = TOK.map((_, i) => D.text(svg, BX + 12 + Math.max(final[i], 1) * 26 + 6, RY(i) + 18, "", { mono: true, size: 16, color: "text-2" }));

    /* why: greedy loops, sampling varies */
    const why = LX.el("g", {}, svg);
    const box = (y, h, color) => LX.el("rect", { x: 870, y, width: 620, height: h, rx: 10, fill: LX.mix("bg", color, .08), stroke: LX.col(color), "stroke-width": 1.5 }, why);
    box(130, 196, "muted"); box(352, 150, "logit");
    D.label(why, 892, 164, "Greedy · always the top token");
    ["The cat sat on the mat.", "The cat sat on the mat.", "The cat sat on the mat."].forEach((l, k) =>
      D.text(why, 892, 204 + k * 36, l + (k ? "   ↻ again" : ""), { size: 20, color: k ? "muted" : "text" }));
    D.label(why, 892, 386, "Sampled · T = 1", { color: "logit" });
    ["The cat sat on the mat, then wandered", "to the window and watched the rain."].forEach((l, k) =>
      D.text(why, 892, 426 + k * 36, l, { size: 20, color: "text" }));

    ups.push(t => {
      // greedy
      const g = ctx.p(t, "greedy", .05, .3);
      const gOut = 1 - ctx.p(t, "strip", 0, .15);
      D.fade(gFrame, g * gOut); D.fade(gTag, g * gOut);
      D.fade(pickLab, ctx.p(t, "greedy", .35, .5) * gOut);
      picks.forEach((c, k) => { c.show(ctx.p(t, "greedy", .45 + k * .15, .6 + k * .15) * gOut); c.glow(true); });

      // rows → strip morph
      bars.forEach((b, i) => {
        const m = ctx.p(t, "strip", .1 + i * .05, .5 + i * .05, E.inOut);
        const x0 = BX, y0 = RY(i), w0 = BW * P[i] / P[0], h0 = BH;
        const x1 = SX + SW * (C[i] - P[i]), y1 = SY, w1 = SW * P[i], h1 = SH;
        LX.attr(b, { x: lerp(x0, x1, m), y: lerp(y0, y1, m), width: Math.max(0, lerp(w0, w1, m) - (m > .5 ? 1.5 : 0)), height: lerp(h0, h1, m) });
        rows[i].track.setAttribute("opacity", 1 - m);
        rows[i].pct.setAttribute("opacity", 1 - m);
        if (segLab[i]) D.fade(segLab[i], ctx.p(t, "strip", .6 + i * .04, .8 + i * .04));
      });
      D.fade(axis, ctx.p(t, "strip", .55, .75));

      // roll
      const q = ctx.p(t, "roll", 0, 1, E.linear);
      const k = Math.min(N - 1, Math.max(0, Math.floor((q - F0) / STEP)));
      const local = clamp((q - F0 - k * STEP) / (STEP * LAND));
      const live = q >= F0 && q < F0 + N * STEP;
      const d = draws[k];
      LX.attr(marker, { transform: `translate(${SX + SW * d.u} ${lerp(SY - 110, SY - 4, E.in(local))})`, opacity: live ? 1 : 0 });
      const my = lerp(SY - 110, SY - 4, E.in(local));
      uText.textContent = live ? "u = " + d.u.toFixed(3) : "";
      LX.attr(uText, { x: SX + SW * d.u + 16, y: my - 44 });
      const landed = j => q >= F0 + j * STEP + STEP * LAND;
      ticks.forEach((tk, j) => tk.setAttribute("opacity", landed(j) ? (j === k && local >= 1 && live ? 1 : .55) : 0));
      bars.forEach((b, i) => b.setAttribute("filter", live && local >= 1 && d.i === i ? "url(#lx-glow)" : "none"));
      D.fade(tallyLab, ctx.p(t, "roll", 0, .06));
      TOK.forEach((_, i) => {
        let n = 0; draws.forEach((dd, j) => { if (dd.i === i && landed(j)) n++; });
        dots[i].forEach((c, j) => c.setAttribute("opacity", j < n ? 1 : 0));
        counts[i].textContent = q > 0 ? n + "×" : "";
        counts[i].setAttribute("x", BX + 12 + Math.max(n, 0) * 26 + (n ? 4 : -4));
      });

      // why
      D.fade(why, ctx.p(t, "why", .05, .35));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ========================================================= temperature */
  function buildTemp(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    const nBack = svg.childNodes.length;   // everything drawn after the backdrop is grouped below
    D.label(svg, 80, 70, "Temperature · probabilities = softmax(logit ÷ T)");
    const X = i => 250 + i * 170, BWd = 96, BASE = 690, HMAX = 400;
    LX.el("line", { x1: 170, y1: BASE, x2: 1350, y2: BASE, stroke: LX.col("line-2"), "stroke-width": 1.5 }, svg);
    const bars = TOK.map((tk, i) => {
      const r = LX.el("rect", { x: X(i) - BWd / 2, width: BWd, rx: 4, fill: shade(i) }, svg);
      const pct = D.text(svg, X(i), 0, "", { mono: true, size: 17, anchor: "middle", color: i === 0 ? "logit" : "text-2" });
      D.tokenText(svg, X(i), BASE + 32, tk, { size: 20 });
      const div = D.text(svg, X(i), BASE + 66, "", { mono: true, size: 15, anchor: "middle", color: "muted" });
      const res = D.text(svg, X(i), BASE + 90, "", { mono: true, size: 15, anchor: "middle", color: "text-2" });
      const rank = LX.el("g", { opacity: 0 }, svg);
      LX.el("circle", { cx: X(i), cy: 236, r: 17, fill: "none", stroke: LX.col("muted"), "stroke-width": 1.5 }, rank);
      D.text(rank, X(i), 242, String(i + 1), { mono: true, size: 16, anchor: "middle", color: "text" });
      return { r, pct, div, res, rank };
    });
    const rankLab = D.label(svg, 80, 242, "rank", { opacity: 0 });

    /* dial */
    const DX = 1400, DY = 200, DR = 72;
    const Tmin = .2, Tmax = 1.5, ang = T => Math.PI * (1 - (Math.log(T) - Math.log(Tmin)) / (Math.log(Tmax) - Math.log(Tmin)));
    const pt = (a, r) => [DX + r * Math.cos(a), DY - r * Math.sin(a)];
    LX.el("path", { d: `M${pt(Math.PI, DR).join(" ")} A ${DR} ${DR} 0 0 1 ${pt(0, DR).join(" ")}`, fill: "none", stroke: LX.col("line-2"), "stroke-width": 6, "stroke-linecap": "round" }, svg);
    [.2, .7, 1, 1.5].forEach(v => {
      const a = ang(v), [x1, y1] = pt(a, DR - 10), [x2, y2] = pt(a, DR + 4), [lx, ly] = pt(a, DR + 24);
      LX.el("line", { x1, y1, x2, y2, stroke: LX.col("muted"), "stroke-width": 2 }, svg);
      D.text(svg, lx, ly + 5, String(v), { mono: true, size: 14, anchor: "middle", color: "muted" });
    });
    const needle = LX.el("line", { x1: DX, y1: DY, stroke: LX.col("logit"), "stroke-width": 3, "stroke-linecap": "round" }, svg);
    LX.el("circle", { cx: DX, cy: DY, r: 6, fill: LX.col("logit") }, svg);
    const tVal = D.text(svg, DX, DY + 44, "", { mono: true, size: 22, anchor: "middle", color: "text", weight: 500 });
    D.label(svg, DX, DY - DR - 34, "Temperature", { anchor: "middle" });
    const note = D.text(svg, 760, 150, "", { size: 20, anchor: "middle", color: "text-2" });

    /* temperature as a function of time (log-space sweeps) */
    const lg = Math.log;
    const Tof = t => {
      let L = 0;
      if (t >= ctx.cue("cold").start) L = lerp(0, lg(.2), ctx.p(t, "cold", .1, .55, E.inOut));
      if (t >= ctx.cue("hot").start) L = lerp(lg(.2), lg(1.5), ctx.p(t, "hot", .1, .6, E.inOut));
      if (t >= ctx.cue("order").start) {
        const a = ctx.p(t, "order", .05, .45, E.inOut), b = ctx.p(t, "order", .5, .9, E.inOut);
        L = b > 0 ? lerp(lg(.45), 0, b) : lerp(lg(1.5), lg(.45), a);
      }
      return Math.exp(L);
    };

    /* group the bars, dial and note so they can step back for the "runs" cue */
    const main = LX.el("g", {});
    while (svg.childNodes.length > nBack) main.appendChild(svg.childNodes[nBack]);
    svg.appendChild(main);

    /* ---- runs: the same five dice rolls, read at T = 1.0 and at T = 0.2 ----
       u values come from a seeded generator; picks are inverse-CDF lookups,
       so the narration ("mat, couch, mat, floor, mat" / all mat) is computed, not typed. */
    const RR = LX.rng(1); RR();
    const U = Array.from({ length: 5 }, () => RR());
    const pickOf = (P, u) => { let c = 0; for (let i = 0; i < P.length; i++) { c += P[i]; if (u < c) return i; } return P.length - 1; };
    const COLS = [{ T: 1.0, x: 110 }, { T: 0.2, x: 850 }].map(c => ({ ...c, P: softT(c.T) }));
    COLS.forEach(c => { c.picks = U.map(u => pickOf(c.P, u)); });
    const said = { "1": ["mat", "couch", "mat", "floor", "mat"], "0.2": ["mat", "mat", "mat", "mat", "mat"] };
    COLS.forEach(c => {
      const got = c.picks.map(i => TOK[i].trim());
      if (got.join() !== said[String(c.T)].join()) console.warn("temperature/runs: narration does not match computed picks", c.T, got);
    });
    const runsG = LX.el("g", { opacity: 0 }, svg);
    D.label(runsG, 110, 92, "Five runs of the same text · the same five dice rolls", { size: 15 });
    const SW = 640, SY = 190;
    COLS.forEach((c, ci) => {
      const g = LX.el("g", {}, runsG); c.g = g;
      D.text(g, c.x, 150, "T = " + c.T.toFixed(1), { mono: true, size: 26, weight: 600, color: ci === 0 ? "logit" : "text" });
      // probability strip: each token a segment as wide as its probability
      let acc = 0;
      c.P.forEach((p, i) => {
        const w = p * SW;
        LX.el("rect", { x: c.x + acc * SW, y: SY, width: Math.max(0, w - 1), height: 26, rx: 3, fill: shade(i) }, g);
        if (w > 58) D.tokenText(g, c.x + acc * SW + w / 2, SY + 50, TOK[i], { size: 16, color: "text-2" });
        acc += p;
      });
      // markers and rows
      c.marks = U.map((u, r) => {
        const m = LX.el("g", { opacity: 0 }, g);
        LX.el("path", { d: "M-8 -14 L8 -14 L0 0 Z", fill: LX.col("text") }, m);
        D.text(m, 0, -20, String(r + 1), { mono: true, size: 13, anchor: "middle", color: "muted" });
        return { m, x: c.x + u * SW };
      });
      c.rows = c.picks.map((ip, r) => {
        const y = 300 + r * 104;
        const row = LX.el("g", { opacity: 0 }, g);
        D.text(row, c.x, y + 34, String(r + 1), { mono: true, size: 16, color: "dim" });
        D.text(row, c.x + 30, y + 34, "The cat sat on the", { mono: true, size: 24, color: "text-2" });
        const top = ip === 0;
        const chip = D.tokenChip(row, { x: c.x + 330, y: y + 4, w: 130, h: 46, text: TOK[ip], color: top ? "token" : "logit", size: 22 });
        if (!top) chip.box.setAttribute("stroke-width", 3);
        D.text(row, c.x + 478, y + 35, fmtPct(c.P[ip]), { mono: true, size: 17, color: top ? "muted" : "logit" });
        return row;
      });
    });
    const runsNote = D.text(runsG, 800, 852, "Same model, same dice. Only the temperature changed how the rolls are read.", { size: 20, anchor: "middle", color: "text-2", opacity: 0 });
    ups.push(t => {
      const on = ctx.p(t, "runs", 0, .06);
      main.setAttribute("opacity", 1 - on);
      runsG.setAttribute("opacity", on);
      COLS.forEach((c, ci) => {
        const a0 = ci === 0 ? .06 : .56, step = ci === 0 ? .085 : .06;
        c.rows.forEach((row, r) => {
          const p = ctx.p(t, "runs", a0 + r * step, a0 + r * step + step * .8);
          const mk = c.marks[r];
          const drop = ctx.p(t, "runs", a0 + r * step, a0 + r * step + step * .5, E.in);
          mk.m.setAttribute("transform", `translate(${mk.x} ${lerp(SY - 70, SY - 2, drop)})`);
          mk.m.setAttribute("opacity", Math.min(1, drop * 3));
          row.setAttribute("opacity", ctx.p(t, "runs", a0 + r * step + step * .45, a0 + r * step + step * .9));
        });
      });
      D.fade(runsNote, ctx.p(t, "runs", .9, .98));
    });

    ups.push(t => {
      const T = Tof(t), P = softT(T);
      const [nx, ny] = pt(ang(clamp(T, Tmin, Tmax)), DR - 14);
      LX.attr(needle, { x2: nx, y2: ny });
      tVal.textContent = "T = " + T.toFixed(2);
      const show = ctx.p(t, "start", 0, .4);
      const how = ctx.p(t, "how", .2, .5);
      bars.forEach((b, i) => {
        const h = HMAX * P[i] * show;
        LX.attr(b.r, { y: BASE - h, height: h });
        b.pct.textContent = fmtPct(P[i]);
        LX.attr(b.pct, { y: BASE - h - 12, opacity: show });
        b.div.textContent = Z[i].toFixed(1) + " ÷ " + T.toFixed(2);
        b.res.textContent = "= " + (Z[i] / T).toFixed(2);
        D.fade(b.div, how); D.fade(b.res, how);
        b.r.setAttribute("filter", i === 0 && ctx.active(t, "cold") && ctx.p(t, "cold", .4, .6) > 0 ? "url(#lx-glow)" : "none");
        D.fade(b.rank, ctx.p(t, "order", 0, .1));
      });
      D.fade(rankLab, ctx.p(t, "order", 0, .1));
      let n = "";
      if (ctx.active(t, "cold") && ctx.p(t, "cold", .55, .65) > 0) n = "gaps × 5 · focused, predictable";
      if (ctx.active(t, "hot") && ctx.p(t, "hot", .6, .7) > 0) n = "gaps shrink · surprising, eventually incoherent";
      if (t >= ctx.cue("order").start) n = "the order never changes";
      note.textContent = n;
    });
    return t => ups.forEach(u => u(t));
  }

  /* =============================================================== top-p */
  function buildTopP(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    const P = softT(1), C = cumsum(P), TOPP = .9, K = nucleus(P, TOPP);
    const kept = P.slice(0, K), S = kept.reduce((a, b) => a + b, 0), Pn = P.map((p, i) => (i < K ? p / S : 0));
    D.label(svg, 80, 70, "Top-p (nucleus sampling) · p = 0.9");
    const X = i => 170 + i * 90, BWd = 60, BASE = 660, HMAX = 680;
    LX.el("line", { x1: 120, y1: BASE, x2: 780, y2: BASE, stroke: LX.col("line-2"), "stroke-width": 1.5 }, svg);
    const bars = TOK.map((tk, i) => {
      const g = LX.el("g", {}, svg);
      const r = LX.el("rect", { x: X(i) - BWd / 2, width: BWd, rx: 3, fill: shade(i) }, g);
      const ring = LX.el("rect", { x: X(i) - BWd / 2 - 5, width: BWd + 10, rx: 5, fill: "none", stroke: LX.col("logit"), "stroke-width": 2, opacity: 0 }, g);
      const pct = D.text(g, X(i), 0, "", { mono: true, size: 15, anchor: "middle", color: i === 0 ? "logit" : "text-2" });
      const lab = D.tokenText(g, X(i), BASE + 30, tk, { size: 16 });
      return { g, r, ring, pct, lab };
    });

    /* the long tail (illustrative) */
    const tail = LX.el("g", {}, svg);
    for (let k = 0; k < 52; k++) {
      const h = 3 + 34 * Math.exp(-k / 11);
      LX.el("rect", { x: 820 + k * 12.5, y: BASE - h, width: 8, height: h, rx: 1, fill: LX.mix("bg", "logit", .35) }, tail);
    }
    D.text(tail, 820, BASE + 30, "… and about 248,000 more tokens, each tiny (illustrative)", { size: 16, color: "muted" });
    D.text(tail, 820, BASE - 70, "together they can still hold a real share", { size: 18, color: "text-2" });

    /* cumulative gauge */
    const gauge = LX.el("g", {}, svg);
    const GX = 960, GW = 90, GT = 200, GH = 450, gy = f => GT + GH * (1 - f);
    LX.el("rect", { x: GX, y: GT, width: GW, height: GH, rx: 4, fill: "none", stroke: LX.col("line-2"), "stroke-width": 1.5 }, gauge);
    [0, .5, 1].forEach(f => D.text(gauge, GX - 12, gy(f) + 5, Math.round(f * 100) + "%", { mono: true, size: 14, anchor: "end", color: "muted" }));
    D.label(gauge, GX, GT - 24, "Running total");
    const segs = TOK.map((_, i) => LX.el("rect", { x: GX + 3, width: GW - 6, fill: shade(i), opacity: 0 }, gauge));
    const thr = LX.el("line", { x1: GX - 30, x2: GX + GW + 150, y1: gy(TOPP), y2: gy(TOPP), stroke: LX.col("text"), "stroke-width": 2, "stroke-dasharray": "8 6" }, gauge);
    D.text(gauge, GX + GW + 150, gy(TOPP) - 10, "p = 0.9", { mono: true, size: 15, anchor: "end", color: "text" });
    const total = D.text(gauge, 1200, 320, "", { mono: true, size: 40, color: "logit", weight: 500 });
    const steps = TOK.slice(0, K).map((tk, i) => D.text(gauge, 1200, 380 + i * 32, `+ ${tk.trim()}  ${fmtPct(P[i])}  → ${fmtPct(C[i])}`, { mono: true, size: 16, color: "text-2", opacity: 0 }));
    const passed = D.text(gauge, 1200, 380 + K * 32 + 14, `passed 90% at ·${TOK[K - 1].trim()} · ${K} tokens kept`, { size: 18, color: "text", weight: 500, opacity: 0 });
    const rescale = D.text(gauge, 1200, 380 + K * 32 + 50, `kept ${fmtPct(S)} → divide by ${S.toFixed(3)} → 100%`, { mono: true, size: 16, color: "logit", opacity: 0 });

    /* adapt: two small distributions with their nucleus */
    const mini = (y, logits, title) => {
      const g = LX.el("g", { opacity: 0 }, svg), ps = softmax(logits), n = nucleus(ps, TOPP), mx = Math.max(...ps);
      D.label(g, 860, y, title + ` · nucleus = ${n} token${n === 1 ? "" : "s"}`);
      ps.forEach((p, i) => {
        const h = 150 * p / mx;
        LX.el("rect", { x: 860 + i * 38, y: y + 180 - h, width: 30, height: Math.max(1.5, h), rx: 2, fill: i < n ? LX.col("logit") : LX.col("line-2") }, g);
      });
      LX.el("line", { x1: 850, y1: y + 180, x2: 1480, y2: y + 180, stroke: LX.col("line-2") }, g);
      return { g, n };
    };
    const conf = mini(150, [9, 5.5, 5, 4.6, 4.3, 4, 3.6, 3.3, 3, 2.7, 2.4, 2.1, 1.8, 1.5, 1.2, .9], "Confident");
    const flat = mini(440, Array.from({ length: 16 }, (_, k) => 3 - .07 * k), "Unsure");

    ups.push(t => {
      const show = ctx.p(t, "tail", 0, .3);
      const cut = ctx.p(t, "cut", .15, .6, E.inOut);
      bars.forEach((b, i) => {
        const p = lerp(P[i], i < K ? Pn[i] : P[i], cut), h = HMAX * p * show;
        LX.attr(b.r, { y: BASE - h, height: h });
        LX.attr(b.ring, { y: BASE - h - 5, height: h + 10 });
        b.pct.textContent = fmtPct(i < K ? p : P[i]);
        LX.attr(b.pct, { y: BASE - h - 12, opacity: show });
        const step = ctx.p(t, "sum", .12 + i * .14, .2 + i * .14);
        b.ring.setAttribute("opacity", i < K ? step * (1 - ctx.p(t, "cut", 0, .15)) : 0);
        if (i >= K) LX.attr(b.g, { opacity: 1 - .82 * ctx.p(t, "cut", 0, .3), transform: `translate(0 ${40 * ctx.p(t, "cut", 0, .35, E.in)})` });
      });
      D.fade(tail, ctx.p(t, "tail", .3, .6) * (1 - ctx.p(t, "sum", 0, .1)));

      // gauge
      const gIn = ctx.p(t, "sum", .05, .15) * (1 - ctx.p(t, "adapt", 0, .15));
      D.fade(gauge, gIn);
      let shown = 0;
      segs.forEach((s, i) => {
        const on = i < K ? ctx.p(t, "sum", .12 + i * .14, .2 + i * .14) : 0;
        if (on > 0) shown = i + 1;
        const below = i === 0 ? 0 : lerp(C[i - 1], C[i - 1] / S, cut), size = lerp(P[i], Pn[i], cut);
        LX.attr(s, { y: gy(below + size * on), height: GH * size * on, opacity: on });
      });
      steps.forEach((s, i) => D.fade(s, ctx.p(t, "sum", .12 + i * .14, .2 + i * .14)));
      total.textContent = cut > 0 ? fmtPct(lerp(C[K - 1], 1, cut)) : shown ? fmtPct(C[shown - 1]) : "0.0%";
      const cross = ctx.p(t, "sum", .12 + (K - 1) * .14 + .08, .9);
      D.fade(passed, cross);
      thr.setAttribute("filter", cross > 0 && cross < 1 ? "url(#lx-glow)" : "none");
      D.fade(rescale, ctx.p(t, "cut", .5, .7));

      // adapt
      D.fade(conf.g, ctx.p(t, "adapt", .15, .4));
      D.fade(flat.g, ctx.p(t, "adapt", .45, .7));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ========================================================= sampler-lab */
  LX.widget("sampler-lab", el => {
    const st = { T: 1, k: 7, p: 1, m: 0 }, tally = TOK.map(() => 0);
    const slider = (key, label, min, max, step, val) =>
      `<div class="lx-range" style="grid-template-columns:minmax(86px,130px) 1fr 52px"><span>${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${val}"><output></output></div>`;
    el.innerHTML = slider("T", "Temperature", .05, 2, .05, 1) + slider("k", "Top-k", 1, 7, 1, 7)
      + slider("p", "Top-p", .1, 1, .01, 1) + slider("m", "Min-p", 0, .5, .01, 0)
      + `<div class="sl-rows" style="margin:18px 0 10px"></div>
         <p class="sl-pipe mono" style="font-size:12.5px;color:var(--lx-muted);margin:0 0 12px"></p>
         <button type="button" class="lx-speed sl-go">Sample ×20</button>
         <button type="button" class="lx-speed sl-reset" style="margin-left:8px">Reset tally</button>`;
    const rows = el.querySelector(".sl-rows");
    rows.innerHTML = TOK.map((tk, i) => `
      <div class="sl-row" style="display:grid;grid-template-columns:72px 1fr 60px 44px;gap:10px;align-items:center;margin:6px 0;font-size:14px">
        <code>${tk.replace(" ", "·")}</code>
        <div style="height:14px;border-radius:3px;background:var(--lx-line);overflow:hidden"><div class="f" style="height:100%;width:0;background:var(--lx-logit);transition:width .25s var(--lx-ease)"></div></div>
        <span class="v mono" style="text-align:right;color:var(--lx-text)"></span>
        <span class="n mono" style="text-align:right;color:var(--lx-muted)"></span>
      </div>`).join("");
    let final = [];
    function compute() {
      let p = softT(st.T), keep = TOK.map((_, i) => i < st.k);
      const renorm = () => { const s = p.reduce((a, v, i) => a + (keep[i] ? v : 0), 0); p = p.map((v, i) => (keep[i] ? v / s : 0)); };
      renorm();
      if (st.p < 1) { const n = nucleus(p, st.p); keep = keep.map((k, i) => k && i < n); }   // top-p = 1 means off, as in real samplers
      renorm();
      const mx = Math.max(...p); keep = keep.map((k, i) => k && p[i] >= st.m * mx); renorm();
      return p;
    }
    function render() {
      el.querySelectorAll("input").forEach(inp => {
        const k = inp.dataset.k; inp.nextElementSibling.textContent = k === "k" ? st[k] : Number(st[k]).toFixed(2);
      });
      final = compute();
      rows.querySelectorAll(".sl-row").forEach((r, i) => {
        const on = final[i] > 0;
        r.style.opacity = on ? 1 : .35;
        r.querySelector(".f").style.width = (final[i] * 100) + "%";
        r.querySelector(".v").textContent = on ? fmtPct(final[i]) : "cut";
        r.querySelector(".n").textContent = tally[i] ? tally[i] + "×" : "";
      });
      el.querySelector(".sl-pipe").textContent =
        `logit ÷ ${st.T.toFixed(2)} → softmax → top-k ${st.k} → top-p ${st.p.toFixed(2)} → min-p ${st.m.toFixed(2)} → renormalise · ${final.filter(v => v > 0).length} of 7 tokens kept`;
    }
    el.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => { st[inp.dataset.k] = Number(inp.value); render(); }));
    el.querySelector(".sl-go").onclick = () => {
      for (let j = 0; j < 20; j++) {
        let u = Math.random(), s = 0;
        for (let i = 0; i < final.length; i++) { s += final[i]; if (u < s || i === final.length - 1) { if (final[i] > 0) tally[i]++; else tally[final.findIndex(v => v > 0)]++; break; } }
      }
      render();
    };
    el.querySelector(".sl-reset").onclick = () => { tally.fill(0); render(); };
    render();
  });

  LX.chapter({
    id: "sampling", num: 12, title: "Choosing the next token", toc: "Temperature & sampling",
    kicker: "From probabilities to one decision",
    lede: "The model hands us a probability for every one of its 248,320 tokens. Something still has to pick one. How that choice is made changes the character of the text.",
    body: [
      { prose: `
        <p>At the end of Chapter 11 the model has produced a list of scores called <strong>logits</strong>, one per vocabulary token, and softmax has turned them into probabilities. The model's job ends there. Picking the actual token is done by a small, separate piece of code called the <strong>sampler</strong>, and you control it with settings such as temperature, top-k and top-p.</p>
        <p>We use one running example throughout this chapter. After <em>"The cat sat on the"</em>, the seven most likely tokens have these logits:</p>
        <div class="lx-table-wrap"><table class="lx-table">
          <tr><th>Token</th><th class="num">Logit</th><th class="num">Probability (T = 1)</th></tr>
          <tr><td><code>·mat</code></td><td class="num">5.0</td><td class="num">47.7 %</td></tr>
          <tr><td><code>·floor</code></td><td class="num">4.2</td><td class="num">21.4 %</td></tr>
          <tr><td><code>·couch</code></td><td class="num">3.6</td><td class="num">11.8 %</td></tr>
          <tr><td><code>·bed</code></td><td class="num">3.2</td><td class="num">7.9 %</td></tr>
          <tr><td><code>·sofa</code></td><td class="num">3.0</td><td class="num">6.5 %</td></tr>
          <tr><td><code>·roof</code></td><td class="num">2.5</td><td class="num">3.9 %</td></tr>
          <tr><td><code>·moon</code></td><td class="num">1.0</td><td class="num">0.9 %</td></tr>
        </table></div>
        <p class="c-muted">These values are illustrative. A real model spreads a little probability over all 248,320 tokens. For clarity we only look at the top seven here and treat them as the whole list.</p>

        <h3>Greedy: always take the top one</h3>
        <p>The simplest rule is to always pick the most likely token. This is called <strong>greedy decoding</strong> (or <em>argmax</em>). It is predictable, and it is good for short factual answers. Over long texts, though, it tends to get stuck in loops and dull phrasing, because the single most likely word is rarely the most natural <em>sequence</em> of words.</p>

        <h3>Sampling: roll a weighted die</h3>
        <p>Instead, we can <strong>sample</strong>. Imagine a die whose sides are the tokens, each side as large as its probability. <code>·mat</code> comes up about half the time, <code>·floor</code> about one time in five, and <code>·moon</code> almost never. This keeps the text varied while still following the model's judgement.</p>` },

      { scene: {
        id: "sampling-die", title: "Greedy versus sampling", build: buildDie,
        visual: "Seven horizontal probability bars (computed from the chapter's logits at T = 1). The bars then glide down and join end to end into one strip from 0 to 1, each segment as wide as its probability. A marker drops at 20 seeded random points u on the strip; each landing leaves a tick and adds a dot to that token's tally row. Finally two text boxes compare a greedy loop with a sampled sentence.",
        cues: [
          { id: "greedy", say: "The simplest choice is to always take the most likely token. This is called greedy decoding. Here it would pick mat, every single time.", vis: "A glowing frame around the ·mat row with an '← argmax' tag; three ·mat chips appear one after another: greedy picks the same token every time." },
          { id: "strip",  say: "Sampling works differently. Lay the probabilities end to end on a line from zero to one. Each token gets a slice as wide as its probability.", vis: "Each bar glides down and stretches into its segment of one strip, 0 on the left, 1 on the right (47.7 %, 21.4 %, 11.8 %, …); axis ticks 0 · 0.5 · 1." },
          { id: "roll",   say: "Now pick a random point on the line. Wherever it lands, that token is chosen. Mat wins about half the time, floor about one time in five, and moon almost never.", vis: "A marker drops 20 times at seeded positions (u shown beside it); each landing leaves a tick and adds a dot: final tally mat 10, floor 4, couch 2, bed 2, sofa 1, roof 1, moon 0." },
          { id: "why",    say: "This small amount of randomness keeps longer texts natural, and stops the model repeating the same safe phrase over and over.", vis: "Two boxes on the right: greedy text repeating 'The cat sat on the mat.' (↻ again), and a varied sampled continuation." },
        ],
      } },

      { prose: `
        <h3>Temperature: sharpen or flatten</h3>
        <p><strong>Temperature</strong> (<code>T</code>) is the main dial. Before softmax, every logit is divided by <code>T</code>:</p>
        <ul>
          <li><strong>T &lt; 1</strong> makes the differences between logits larger. The favourite becomes even more likely, and the text becomes more focused and predictable.</li>
          <li><strong>T = 1</strong> leaves the model's probabilities exactly as they are.</li>
          <li><strong>T &gt; 1</strong> shrinks the differences. Unlikely tokens get a real chance, and the text becomes more surprising and eventually incoherent.</li>
          <li><strong>T → 0</strong> means only the top token is left. That is the same as greedy decoding, which is why many tools treat temperature 0 as "greedy".</li>
        </ul>
        <div class="lx-table-wrap"><table class="lx-table">
          <tr><th>Token</th><th class="num">T = 0.2</th><th class="num">T = 0.7</th><th class="num">T = 1.0</th><th class="num">T = 1.5</th></tr>
          <tr><td><code>·mat</code></td><td class="num">98.1 %</td><td class="num">61.7 %</td><td class="num">47.7 %</td><td class="num">35.7 %</td></tr>
          <tr><td><code>·floor</code></td><td class="num">1.8 %</td><td class="num">19.7 %</td><td class="num">21.4 %</td><td class="num">20.9 %</td></tr>
          <tr><td><code>·couch</code></td><td class="num">0.1 %</td><td class="num">8.4 %</td><td class="num">11.8 %</td><td class="num">14.0 %</td></tr>
          <tr><td><code>·bed</code></td><td class="num">0.0 %</td><td class="num">4.7 %</td><td class="num">7.9 %</td><td class="num">10.7 %</td></tr>
          <tr><td><code>·sofa</code></td><td class="num">0.0 %</td><td class="num">3.5 %</td><td class="num">6.5 %</td><td class="num">9.4 %</td></tr>
          <tr><td><code>·roof</code></td><td class="num">0.0 %</td><td class="num">1.7 %</td><td class="num">3.9 %</td><td class="num">6.7 %</td></tr>
          <tr><td><code>·moon</code></td><td class="num">0.0 %</td><td class="num">0.2 %</td><td class="num">0.9 %</td><td class="num">2.5 %</td></tr>
        </table></div>
        <p>Temperature never changes the <em>order</em> of the tokens. <code>·mat</code> is always the favourite. It only changes how much the favourite dominates.</p>
        <p>Being the favourite does not mean being chosen. At T = 1, <code>·mat</code> has 47.7 %, so more than half of all runs pick something else: five runs of the same prompt can give mat, couch, mat, floor and mat. At T = 0.2 the same dice rolls land on <code>·mat</code> almost every time. This is why the same question can get different answers, and why a low temperature makes a model more repeatable.</p>` },

      { scene: {
        id: "temperature", title: "Temperature reshapes the distribution", build: buildTemp,
        visual: "Seven vertical probability bars over token labels, recomputed every frame as softmax(logit ÷ T). A temperature dial at the top right (log scale 0.2–1.5) sweeps; the bars morph smoothly with it. Under each bar the live division is shown (e.g. 5.0 ÷ 0.20 = 25.00). Finally five seeded dice rolls are read at T = 1.0 and at T = 0.2, showing that sampling can pick a token other than the favourite.",
        cues: [
          { id: "start", say: "Here are the model's probabilities at temperature one, exactly as the model produced them.", vis: "Bars at T = 1: 47.7, 21.4, 11.8, 7.9, 6.5, 3.9, 0.9 %." },
          { id: "how",   say: "Temperature works on the logits, before softmax. Every logit is divided by the temperature.", vis: "Under each bar: logit ÷ T and the result appear, e.g. 5.0 ÷ 1.00 = 5.00." },
          { id: "cold",  say: "Turn the temperature down to zero point two, and the gaps between the scores grow five times larger. Mat now takes ninety-eight percent. The text becomes focused and predictable.", vis: "Dial sweeps to 0.2; ·mat bar shoots to 98.1 %; others collapse to almost zero." },
          { id: "hot",   say: "Turn it up to one and a half, and the gaps shrink. Mat falls to about a third, and even moon gets a small chance. The text becomes more surprising, and at very high temperatures it falls apart.", vis: "Dial sweeps to 1.5; bars flatten: 35.7, 20.9, 14.0, 10.7, 9.4, 6.7, 2.5 %." },
          { id: "order", say: "Notice that the order never changes. Temperature only decides how much the favourite dominates.", vis: "Rank badges 1–7 appear above the bars and stay fixed while the dial sweeps 1.5 → 0.45 → 1.0." },
          { id: "runs",  say: "Here is what that means in practice. The same text, run five times at temperature one, gave mat, couch, mat, floor and mat. With the very same five rolls of the dice at temperature zero point two, all five runs gave mat. The model did not change. Only the temperature changed how the dice were read.", vis: "Bars step back. Two columns, T = 1.0 and T = 0.2, each with a probability strip; five seeded dice rolls (the same u values in both columns) drop onto the strips. T = 1.0 completes 'The cat sat on the …' with mat, couch (11.8 %, pink outline), mat, floor (21.4 %, pink outline), mat; T = 0.2 gives mat five times." },
        ],
      } },

      { prose: `
        <h3>Cutting off the tail: top-k, top-p and min-p</h3>
        <p>Even at a sensible temperature, the 248,000 unlikely tokens together hold a surprising amount of probability. Picking one of them now and then can derail a sentence. So samplers usually <strong>throw away the tail</strong> first, then rescale what is left so it adds up to 100 %, then sample.</p>
        <ul>
          <li><strong>Top-k</strong> keeps only the <code>k</code> most likely tokens. With k = 3 we keep mat, floor and couch, which become 59.0 %, 26.5 % and 14.5 %.</li>
          <li><strong>Top-p</strong> (also called <em>nucleus sampling</em>) keeps the smallest set of top tokens whose probabilities add up to at least <code>p</code>. With p = 0.9: mat 47.7, + floor = 69.1, + couch = 80.9, + bed = 88.8, + sofa = 95.2 %. Five tokens are kept. The set grows when the model is unsure and shrinks when it is confident, which is why top-p usually works better than a fixed k.</li>
          <li><strong>Min-p</strong> keeps every token whose probability is at least a fraction of the favourite's. With min-p = 0.1 the cut-off is 10 % of 47.7 % = 4.77 %. Mat, floor, couch, bed and sofa stay, and roof and moon go.</li>
        </ul>

        <h3>Penalties against repetition</h3>
        <p>Some samplers also lower the logits of tokens that have already appeared. A <strong>repetition penalty</strong> divides or subtracts from the logit of every token already in the text. A <strong>presence penalty</strong> subtracts a fixed amount once a token has appeared at all. A <strong>frequency penalty</strong> subtracts more each time it appears. Used gently, they reduce loops. Too much, and the model avoids words it genuinely needs, such as names and code keywords.</p>

        <h3>Randomness and seeds</h3>
        <p>The "random" point in sampling comes from a pseudo-random number generator. Give it the same <strong>seed</strong>, the same prompt and the same settings, and you get the same answer. In practice, results can still differ slightly between runs and machines. The <abbr>GPU</abbr> adds numbers up in different orders when work is split differently, and tiny rounding differences can flip a close choice.</p>

        <h3>Typical settings</h3>
        <div class="lx-table-wrap"><table class="lx-table">
          <tr><th>Use</th><th class="num">Temperature</th><th>Other</th></tr>
          <tr><td>Facts, extraction, classification</td><td class="num">0 – 0.3</td><td>Greedy or near-greedy</td></tr>
          <tr><td>Code</td><td class="num">0.2 – 0.6</td><td>top-p 0.9 – 0.95</td></tr>
          <tr><td>General chat</td><td class="num">0.6 – 1.0</td><td>top-p 0.8 – 0.95, top-k 20 – 40</td></tr>
          <tr><td>Brainstorming, fiction</td><td class="num">0.9 – 1.2</td><td>min-p 0.05 – 0.1 keeps it sane</td></tr>
        </table></div>
        <p class="c-muted">Model publishers often recommend settings for their model. Thinking-style models in particular are usually tuned for a specific temperature and top-p, and greedy decoding can make their reasoning loop.</p>` },

      { widget: {
        id: "sampler-lab", title: "Sampler lab: temperature, top-k, top-p, min-p",
        sub: "The same seven logits as above. Steps: logit ÷ T → softmax → top-k → top-p → min-p, renormalising after each cut. Cut tokens are greyed out.",
        plan: "Uses the fixed seven-token logit list above. Sliders: temperature 0.05–2.0, top-k 1–7, top-p 0.1–1.0, min-p 0–0.5. Shows bars for the final probabilities after each step (÷T → softmax → cut → renormalise). Cut tokens are greyed out. A 'Sample ×20' button drops seeded markers and keeps a tally. Live numbers under each bar.",
      } },

      { scene: {
        id: "top-p", title: "Top-p keeps the nucleus", build: buildTopP,
        visual: "The seven bars sorted high to low, with a faint illustrative tail of tiny bars beside them. Then a stacked running-total gauge with a dashed threshold at 90 % fills token by token, with a log of the sums. Tokens inside the nucleus get a ring; roof and moon fade and drop; the survivors and the gauge stretch as they are renormalised to 100 %. Finally two small distributions show the nucleus size adapting.",
        cues: [
          { id: "tail",  say: "Even unlikely tokens add up. Across a vocabulary of nearly a quarter of a million tokens, the long tail can hold a real share of the probability. One unlucky pick from it can derail a sentence.", vis: "Beside the seven bars, a long faint tail of tiny bars appears, labelled '… and about 248,000 more tokens, each tiny (illustrative)'." },
          { id: "sum",   say: "Top-p, also called nucleus sampling, adds up the probabilities from the top. Mat, then floor, then couch, then bed, then sofa, until the total passes ninety percent.", vis: "Each token is ringed and stacked into the gauge; the log reads 47.7 → 69.1 → 80.9 → 88.8 → 95.2 %. The dashed 90 % line glows as ·sofa crosses it: 5 tokens kept." },
          { id: "cut",   say: "Everything after that is removed, and the survivors are scaled up so they add to one hundred percent again. Then we sample, only among the tokens that make sense.", vis: "·roof and ·moon fade and drop; the five survivors stretch to 50.1, 22.5, 12.4, 8.3, 6.8 %; the gauge fills to 100 % (kept 95.2 % ÷ 0.952)." },
          { id: "adapt", say: "When the model is confident, the nucleus might be a single token. When it is unsure, it widens automatically. That is why top-p is the most common cut-off.", vis: "Two small charts on the right: a confident distribution (nucleus = 1 token) and a flat one (nucleus = 14 of 16 tokens), nucleus bars in pink." },
        ],
      } },

      { deep: `
        <h3>Softmax with temperature</h3>
        <p>Given logits <i>z</i><sub><i>i</i></sub> and temperature <i>T</i> &gt; 0:</p>
        <math display="block"><mrow><msub><mi>p</mi><mi>i</mi></msub><mo>=</mo><mfrac><mrow><msup><mi>e</mi><mrow><msub><mi>z</mi><mi>i</mi></msub><mo>/</mo><mi>T</mi></mrow></msup></mrow><mrow><munder><mo>∑</mo><mi>j</mi></munder><msup><mi>e</mi><mrow><msub><mi>z</mi><mi>j</mi></msub><mo>/</mo><mi>T</mi></mrow></msup></mrow></mfrac></mrow></math>
        <div class="lx-read">Exactly the softmax from Chapter 11, but every logit z is first divided by the temperature T. Divide each score by T, raise e to that power, and divide by the total over all tokens. T below 1 stretches the gaps between scores, so the favourite gets even more of the probability; T above 1 shrinks the gaps and flattens the distribution. Example from the text: a logit gap of 0.8 gives a ratio of about 2.2 at T = 1, but about 55 at T = 0.2.</div>
        <p>The ratio between two tokens is <i>p</i><sub><i>i</i></sub> / <i>p</i><sub><i>j</i></sub> = e<sup>(<i>z</i><sub><i>i</i></sub> − <i>z</i><sub><i>j</i></sub>) / <i>T</i></sup>. For mat versus floor the logit gap is 0.8. At T = 1 the ratio is e<sup>0.8</sup> ≈ 2.23 (47.7 / 21.4). At T = 0.2 it becomes e<sup>4</sup> ≈ 54.6 (98.1 / 1.8). As T → 0 the ratio goes to infinity and all mass lands on the argmax. As T → ∞ all ratios go to 1 and the distribution becomes uniform.</p>
        <h3>Truncation and renormalisation</h3>
        <p>Each cut-off defines a kept set <i>S</i>. The final distribution is</p>
        <math display="block"><mrow><msub><mover><mi>p</mi><mo>~</mo></mover><mi>i</mi></msub><mo>=</mo><mfrac><msub><mi>p</mi><mi>i</mi></msub><mrow><munder><mo>∑</mo><mrow><mi>j</mi><mo>∈</mo><mi>S</mi></mrow></munder><msub><mi>p</mi><mi>j</mi></msub></mrow></mfrac><mspace width="0.6em"/><mtext>for </mtext><mi>i</mi><mo>∈</mo><mi>S</mi><mo>,</mo><mspace width="0.6em"/><mn>0</mn><mtext> otherwise</mtext></mrow></math>
        <div class="lx-read">S is the set of tokens that survive the cut-off (top-k, top-p or min-p). For each token in S, take its probability and divide by the sum of the probabilities of all tokens in S. Tokens outside S get probability 0. This rescales the survivors so they add up to 1 again. Example: if only <code>·mat</code> 0.48 and <code>·floor</code> 0.21 survive, they become 0.48 / 0.69 ≈ 0.70 and 0.21 / 0.69 ≈ 0.30.</div>
        <ul>
          <li>Top-k: <i>S</i> = the <i>k</i> largest <i>p</i><sub><i>i</i></sub>.</li>
          <li>Top-p: sort descending. <i>S</i> = the shortest prefix with cumulative sum ≥ <i>p</i>.</li>
          <li>Min-p: <i>S</i> = { <i>i</i> : <i>p</i><sub><i>i</i></sub> ≥ min_p · max<sub><i>j</i></sub> <i>p</i><sub><i>j</i></sub> }.</li>
        </ul>
        <p>Order matters, and implementations differ. A common pipeline is: penalties → temperature → top-k → top-p → min-p → sample. Some engines apply temperature last. With aggressive settings the result can differ noticeably between engines even for "the same" parameters.</p>
        <h3>Drawing the sample</h3>
        <p>Draw <i>u</i> uniformly from [0, 1). Walk the kept tokens, adding their probabilities, and stop at the first token where the running sum exceeds <i>u</i>. This is the strip-and-marker picture from the scene above. With <i>u</i> = 0.62 and p = 0.9 truncation, the cumulative sums are 0.501, 0.726, … so <code>·floor</code> is chosen.</p>
        <h3>Penalties</h3>
        <p>One common form of repetition penalty, for a factor <i>r</i> &gt; 1 and every token already seen: <i>z</i> ← <i>z</i> / <i>r</i> if <i>z</i> &gt; 0, else <i>z</i> · <i>r</i>. The additive form subtracts per appearance: <i>z</i> ← <i>z</i> − α<sub>presence</sub> · [seen] − α<sub>frequency</sub> · count.</p>` },
    ],
  });
})();
