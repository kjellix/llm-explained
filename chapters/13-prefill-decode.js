/* Chapter 13 — Prefill, then decode: the generation loop */
(function () {
  "use strict";
  const D = LX.draw, el = LX.el, col = LX.col, mix = LX.mix, clamp = LX.clamp, E = LX.ease, lerp = LX.lerp;
  const bump = (x, w = 1) => clamp(1 - Math.abs(x) / w);
  const int = n => Math.round(n).toLocaleString("en-US");

  /* Shared model arithmetic (Qwen3.8-27B) */
  const P = 27.78e9;                                // parameters
  const FLOP_TOK = 2 * P;                           // operations per token, weights
  const ATT_PAIR = 16 * 24 * 256 * 2 * 2;           // 16 attention layers · 24 heads · 256 dims · (QK + AV) · 2 FLOP
  /** Prefill operations for tokens [a, b) given everything before a is already cached. */
  const prefillFlop = (a, b) => (b - a) * FLOP_TOK + ATT_PAIR * (b * b - a * a) / 2;
  const EFF = 13.6e12;                              // M2 Ultra at ~50% of 27.2 TFLOPS
  const W_BYTES = 18.97e9;                          // Q4 weights
  const KV_TOKEN = 65536;                           // bytes per token, 16 layers
  const DN_STATE = 144 * 2 ** 20;                   // DeltaNet state, 48 layers

  /** Palette cache: n+1 steps from bg to a concept colour. */
  function ramp(name, n = 24) { return Array.from({ length: n + 1 }, (_, i) => mix("bg", name, i / n)); }
  /** setAttribute only when the value changes (keeps big grids cheap). */
  function setter(node) { let last; return v => { if (v !== last) { node.setAttribute("fill", v); last = v; } }; }
  function setOp(node) { let last; return v => { const s = v.toFixed(3); if (s !== last) { node.setAttribute("opacity", s); last = s; } }; }

  /* Layer-stack geometry shared by prefill-wave and decode-loop: 64 thin rows, layer 1 at the bottom. */
  const L = 64, TOPY = 268, RH = 7, CH = 5.5;
  const rowY = r => TOPY + (L - 1 - r) * RH;
  const isAttn = r => r % 4 === 3;
  const attnRow = k => 4 * k + 3;

  function stackLegend(svg, x, y) {
    const g = el("g", {}, svg);
    el("rect", { x, y: y - 10, width: 12, height: 8, rx: 1.5, fill: mix("bg", "delta", .55) }, g);
    D.text(g, x + 18, y - 2, "Gated DeltaNet × 48", { mono: true, size: 13, color: "delta" });
    el("rect", { x: x + 200, y: y - 10, width: 12, height: 8, rx: 1.5, fill: mix("bg", "attn", .7) }, g);
    D.text(g, x + 218, y - 2, "Gated Attention × 16 (every 4th)", { mono: true, size: 13, color: "attn" });
    return g;
  }

  /* ======================================================= scene: prefill-wave */
  function buildWave(ctx) {
    const { svg } = ctx;
    D.backdrop(svg);
    const TOK = ["In", " France", " the", " biggest", " city", " and", " the", " capital", " is", " the", " city", " of"];
    const N = TOK.length, X0 = 150, PITCH = 76, CW = 66;
    const colX = i => X0 + i * PITCH;
    const right = colX(N - 1) + CW;

    D.label(svg, 80, 70, "Prefill · the whole prompt at once");
    const legend = stackLegend(svg, 80, 244);

    /* stack: 64 rows × 12 columns */
    const stack = el("g", {}, svg);
    const pal = { attn: ramp("attn"), delta: ramp("delta") };
    const cells = [];
    for (let r = 0; r < L; r++) {
      const kind = isAttn(r) ? "attn" : "delta", row = [];
      for (let i = 0; i < N; i++) {
        const c = el("rect", { x: colX(i), y: rowY(r), width: CW, height: CH, rx: 1, fill: pal[kind][2] }, stack);
        row.push(setter(c));
      }
      cells.push({ kind, row });
    }
    D.text(stack, 136, rowY(0) + 6, "L1", { mono: true, size: 13, color: "muted", anchor: "end" });
    D.text(stack, 136, rowY(63) + 6, "L64", { mono: true, size: 13, color: "muted", anchor: "end" });
    D.text(stack, 136, rowY(32) + 6, "⋮", { mono: true, size: 14, color: "dim", anchor: "end" });
    const mm = D.text(svg, right, 244, "all 12 columns together · matrix × matrix", { mono: true, size: 13, color: "embed", anchor: "end" });

    /* wave front */
    const front = el("rect", { x: X0 - 8, y: 0, width: right - X0 + 16, height: 3, rx: 1.5, fill: col("embed"), filter: "url(#lx-glow)", opacity: 0 }, svg);

    /* prompt chips + tensor bracket */
    const chips = TOK.map((tk, i) => D.tokenChip(svg, { x: colX(i), y: 744, w: CW, h: 40, text: tk, size: 13 }));
    const br = D.bracket(svg, { x1: X0, y1: 800, x2: right, y2: 800, side: "bottom", label: "12 tokens × 5,120 numbers = one tensor [12, 5120]", color: "embed" });

    /* KV cache shelf: one row per attention layer, aligned with that layer in the stack */
    const SX = 1170, TP = 24, TW = 20;
    const shelfLab = D.label(svg, SX, 252, "KV cache · 16 attention layers");
    const shelf = [];
    for (let k = 0; k < 16; k++) {
      const y = rowY(attnRow(k)) + CH / 2 - 7, tiles = [];
      for (let i = 0; i < N; i++) {
        el("rect", { x: SX + i * TP, y, width: TW, height: 14, rx: 2, fill: "none", stroke: col("line-2"), "stroke-width": 1 }, svg);
        const tile = el("rect", { x: SX + i * TP, y, width: TW, height: 14, rx: 2, fill: col("cache"), opacity: 0 }, svg);
        tiles.push(setOp(tile));
      }
      const fly = el("rect", { x: right, y, width: TW, height: 14, rx: 2, fill: col("cache"), opacity: 0, filter: "url(#lx-glow)" }, svg);
      shelf.push({ tiles, fly, y });
    }
    D.text(svg, SX + N * TP + 4, rowY(attnRow(0)) + 6, "L4", { mono: true, size: 13, color: "muted" });
    D.text(svg, SX + N * TP + 4, rowY(attnRow(15)) + 6, "L64", { mono: true, size: 13, color: "muted" });

    /* DeltaNet state: 48 fixed squares */
    const stLab = D.label(svg, SX, 744, "DeltaNet state · 48 layers · fixed size");
    const dpal = ramp("delta");
    const squares = [];
    let dn = 0;
    for (let r = 0; r < L; r++) if (!isAttn(r)) {
      const q = el("rect", { x: SX + (dn % 24) * 12, y: 756 + Math.floor(dn / 24) * 13, width: 9, height: 9, rx: 1.5, fill: dpal[3] }, svg);
      squares.push({ r, set: setter(q) }); dn++;
    }

    /* top: time to first token, next-token bars */
    const ttLab = D.label(svg, 520, 112, "Time to first token");
    el("rect", { x: 520, y: 124, width: 280, height: 8, rx: 4, fill: col("line") }, svg);
    const ttFill = el("rect", { x: 520, y: 124, width: 0, height: 8, rx: 4, fill: col("embed") }, svg);
    const first = D.tokenChip(svg, { x: 822, y: 108, w: 92, h: 40, text: " Paris", color: "logit", size: 16 });
    const firstLab = D.text(svg, 868, 170, "first answer token", { mono: true, size: 13, color: "logit", anchor: "middle" });

    const barLab = D.label(svg, SX, 92, "Next token · from the last column");
    const barG = el("g", { opacity: 0 }, svg);
    const bars = D.bars(barG, { x: SX, y: 118, w: 288, row: 44, items: [[" Paris", .62], [" Lyon", .07], [" Marseille", .04]] });
    const pick = el("rect", { x: SX - 8, y: 96, width: 304, height: 40, rx: 6, fill: "none", stroke: col("logit"), "stroke-width": 2, opacity: 0 }, svg);
    const lastHi = el("rect", { x: colX(N - 1) - 4, y: TOPY - 4, width: CW + 8, height: rowY(0) - TOPY + CH + 8, rx: 4, fill: "none", stroke: col("logit"), "stroke-width": 2, opacity: 0 }, svg);
    const toBars = D.arrow(svg, { d: `M${colX(N - 1) + CW / 2} ${TOPY - 8} V132 H${SX - 14}`, color: "logit" });

    return t => {
      /* in */
      chips.forEach((c, i) => c.show(ctx.p(t, "in", .05 + i * .04, .35 + i * .04)));
      br.show(ctx.p(t, "in", .6, .85));
      const stackIn = ctx.p(t, "in", .55, 1);
      stack.setAttribute("opacity", stackIn); legend.setAttribute("opacity", stackIn);

      /* wave front F in rows: first third during "wave", the rest during "save" */
      const F = 70 * (0.35 * ctx.p(t, "wave", .12, 1, E.linear) + 0.65 * ctx.p(t, "save", 0, .85, E.linear)) - 1;
      mm.setAttribute("opacity", ctx.p(t, "wave", .1, .3) * (1 - ctx.p(t, "last", 0, .2) * .6));
      const fy = rowY(clamp(F, 0, 63)) - 1;
      front.setAttribute("y", fy);
      front.setAttribute("opacity", F > -0.5 && F < 64.5 ? 1 : 0);
      for (let r = 0; r < L; r++) {
        const { kind, row } = cells[r];
        const passed = F > r + .5 ? 1 : 0, b = bump(F - r - .5, 2.5);
        const base = kind === "attn" ? .26 : .08;
        const lvl = Math.round(24 * clamp(base + passed * .2 + b * .55));
        for (let i = 0; i < N; i++) row[i](pal[kind][lvl]);
      }
      /* top of the last column during "last" */
      const lastP = ctx.p(t, "last", 0, .25);
      if (lastP > 0) for (let i = 0; i < N; i++) {
        const top = cells[63].row[i];
        top(i === N - 1 ? pal.attn[24] : pal.attn[Math.round(24 * (.29 - .2 * lastP))]);
      }
      lastHi.setAttribute("opacity", lastP * (1 - ctx.p(t, "ttft", .5, 1) * .6));

      /* KV tiles fly sideways as the front passes each attention layer */
      shelfLab.setAttribute("opacity", .45 + .55 * ctx.p(t, "save", 0, .15));
      shelf.forEach((s, k) => {
        const q = clamp((F - attnRow(k) - .5) / 3);
        s.fly.setAttribute("x", lerp(right + 4, SX, E.inOut(q)));
        s.fly.setAttribute("opacity", q > 0 && q < 1 ? 1 : 0);
        s.tiles.forEach((set, i) => set(clamp(q * 1.6 - i / N * .6)));
      });
      /* DeltaNet squares brighten as their layer is passed */
      stLab.setAttribute("opacity", .45 + .55 * ctx.p(t, "save", .1, .25));
      squares.forEach(s => {
        const passed = F > s.r + .5 ? 1 : 0, b = bump(F - s.r - .5, 2);
        s.set(dpal[Math.round(24 * clamp(.12 + passed * .4 + b * .45))]);
      });

      /* last: only the rightmost column feeds the bars */
      toBars.draw(ctx.p(t, "last", .15, .45));
      barLab.setAttribute("opacity", ctx.p(t, "last", .3, .5));
      barG.setAttribute("opacity", ctx.p(t, "last", .3, .45));
      bars.grow(ctx.p(t, "last", .4, .85));
      pick.setAttribute("opacity", ctx.p(t, "last", .85, 1));

      /* time to first token */
      const w0 = ctx.cue("wave").start, w1 = ctx.cue("last").end;
      ttLab.setAttribute("opacity", ctx.p(t, "wave", 0, .2) * (.6 + .4 * ctx.p(t, "ttft", 0, .2)));
      ttFill.setAttribute("width", 280 * clamp((t - w0) / (w1 - w0)));
      ttFill.setAttribute("fill", ctx.p(t, "ttft", 0, .3) > .5 ? col("logit") : col("embed"));
      first.show(ctx.p(t, "ttft", .2, .5));
      first.glow(ctx.p(t, "ttft", .2, .5) > .5 && ctx.p(t, "ttft", .5, .9) < 1);
      firstLab.setAttribute("opacity", ctx.p(t, "ttft", .35, .6));
    };
  }

  /* ======================================================== scene: decode-loop */
  function buildDecode(ctx) {
    const { svg } = ctx;
    D.backdrop(svg);
    D.label(svg, 80, 70, "Decode · one token per step");
    stackLegend(svg, 760, 780).setAttribute("opacity", .9);

    const CX = 600, CWD = 60;
    const pal = { attn: ramp("attn"), delta: ramp("delta") };
    const colCells = [];
    for (let r = 0; r < L; r++) {
      const kind = isAttn(r) ? "attn" : "delta";
      const c = el("rect", { x: CX, y: rowY(r), width: CWD, height: CH, rx: 1, fill: pal[kind][3] }, svg);
      colCells.push({ kind, set: setter(c) });
    }
    D.text(svg, CX - 12, rowY(0) + 6, "L1", { mono: true, size: 13, color: "muted", anchor: "end" });
    D.text(svg, CX - 12, rowY(63) + 6, "L64", { mono: true, size: 13, color: "muted", anchor: "end" });
    const dot = el("circle", { cx: CX + CWD / 2, cy: 0, r: 7, fill: col("embed"), filter: "url(#lx-glow)", opacity: 0 }, svg);

    /* KV shelf: 12 prompt tiles + 4 new per row */
    const SX = 760, TP = 26, TW = 22, NP = 12, NNEW = 4;
    D.label(svg, SX, 256, "KV cache · 16 attention layers");
    const rows = [];
    for (let k = 0; k < 16; k++) {
      const y = rowY(attnRow(k)) + CH / 2 - 7, tiles = [];
      for (let i = 0; i < NP; i++) el("rect", { x: SX + i * TP, y, width: TW, height: 14, rx: 2, fill: mix("bg", "cache", .42) }, svg);
      for (let j = 0; j < NNEW; j++) {
        const x = SX + (NP + j) * TP;
        el("rect", { x, y, width: TW, height: 14, rx: 2, fill: "none", stroke: col("line"), "stroke-width": 1, "stroke-dasharray": "3 3" }, svg);
        tiles.push({ node: el("rect", { x, y, width: TW, height: 14, rx: 2, fill: col("cache"), opacity: 0 }, svg), x });
      }
      const fan = el("path", { d: "", stroke: col("cache"), "stroke-width": 1, fill: "none", opacity: 0 }, svg);
      rows.push({ y: y + 7, tiles, fan });
    }
    D.text(svg, SX, 728, "prompt (from prefill)", { mono: true, size: 13, color: "muted" });
    D.text(svg, SX + NP * TP, 728, "new: one per step", { mono: true, size: 13, color: "cache" });

    /* answer so far */
    D.label(svg, 80, 112, "Answer so far");
    D.text(svg, 80, 150, "In France the biggest city", { size: 22, color: "dim" });
    D.text(svg, 80, 182, "and the capital is the city of", { size: 22, color: "dim" });
    const ans = D.text(svg, 80, 222, "", { size: 24, color: "token", weight: 500 });
    const OUTS = [",", " which", " has", " about"], INS = [" Paris", ",", " which", " has"];
    const words = [" Paris", ...OUTS].map((w, i) => { const s = el("tspan", {}, ans); s.textContent = (i === 0 ? "" : "") + w; return s; });

    /* counters + bandwidth gauge */
    D.label(svg, 80, 330, "Step");
    const stepT = D.text(svg, 80, 380, "1", { mono: true, size: 44, color: "text", weight: 500 });
    D.label(svg, 80, 450, "Weights read this step");
    el("rect", { x: 80, y: 466, width: 400, height: 12, rx: 6, fill: col("line") }, svg);
    const gauge = el("rect", { x: 80, y: 466, width: 0, height: 12, rx: 6, fill: col("embed") }, svg);
    D.text(svg, 80, 504, "≈ 19 GB per token (Q4), every step", { mono: true, size: 14, color: "text-2" });
    const speed = D.text(svg, 80, 560, "memory-bound: ≈ 25–40 tokens/s on a desktop machine", { mono: true, size: 14, color: "embed" });

    /* next-token bars, one set per step */
    D.label(svg, SX, 92, "Next token");
    const BARS = [[[",", .41], [" is", .22], [".", .12]], [[" which", .35], [" the", .18], [" a", .09]], [[" has", .44], [" is", .21], [" lies", .08]], [[" about", .30], [" more", .20], [" around", .15]]];
    const barSets = BARS.map(items => { const g = el("g", { opacity: 0 }, svg); return { g, b: D.bars(g, { x: SX, y: 120, w: 300, row: 38, items }) }; });
    const pick = el("rect", { x: SX - 8, y: 96, width: 316, height: 40, rx: 6, fill: "none", stroke: col("logit"), "stroke-width": 2, opacity: 0 }, svg);

    /* input chip (one per step) and the token flying back */
    const inChips = [...INS, " about"].map(tk => D.tokenChip(svg, { x: CX - 25, y: 760, w: 110, h: 44, text: tk, size: 18 }));
    D.text(svg, CX + 30, 830, "[1, 5120]", { mono: true, size: 14, color: "embed", anchor: "middle" });
    const back = el("path", { d: `M${SX - 10} 130 C 470 130, 430 790, ${CX - 30} 782`, fill: "none" }, svg);
    const backL = back.getTotalLength();
    const flyers = OUTS.map(tk => D.tokenChip(svg, { x: 0, y: 0, w: 96, h: 40, text: tk, color: "logit", size: 17 }));

    /* step schedule: step 0 spread over four cues, steps 1–3 inside "speed" */
    function phase(t, s) {
      if (s === 0) return {
        enter: ctx.p(t, "one", .1, .6), climb: ctx.p(t, "look", .05, .95, E.linear),
        add: ctx.p(t, "add", .05, .9, E.linear), bars: ctx.p(t, "pick", 0, .4), sel: ctx.p(t, "pick", .4, .55), back: ctx.p(t, "pick", .55, .92, E.inOut),
      };
      const u = ctx.p(t, "speed", (s - 1) / 3, s / 3, E.linear);
      const climb = clamp((u - .08) / .45);
      return { enter: clamp(u / .1), climb, add: climb, bars: clamp((u - .55) / .14), sel: clamp((u - .68) / .07), back: E.inOut(clamp((u - .75) / .2)) };
    }
    const curStep = t => t < ctx.cue("speed").start ? 0 : Math.min(3, 1 + Math.floor(3 * ctx.p(t, "speed", 0, 1, E.linear)));

    return t => {
      const s = curStep(t), ph = phase(t, s);
      stepT.textContent = String(s + 1);
      /* input chip */
      inChips.forEach((c, i) => {
        if (i === 4) return c.show(s === 3 && ph.back >= 1 ? 1 : 0);
        if (i !== s) return c.show(0);
        c.show(ph.enter * (1 - ph.back), 20);
      });
      /* climbing pulse; row highlight */
      const pr = ph.climb * 66 - 1, climbing = ph.climb > 0 && ph.climb < 1;
      dot.setAttribute("cy", rowY(clamp(pr, 0, 63)) + CH / 2);
      dot.setAttribute("opacity", climbing ? 1 : 0);
      colCells.forEach((c, r) => c.set(pal[c.kind][Math.round(24 * clamp((c.kind === "attn" ? .3 : .1) + (climbing ? bump(pr - r, 2.5) * .6 : 0) + (ph.climb >= 1 && ph.back < 1 ? .1 : 0)))]));
      gauge.setAttribute("width", 400 * ph.climb);
      gauge.setAttribute("opacity", ph.back >= 1 ? .35 : 1);

      /* new tiles: steps before s complete; step s per row */
      rows.forEach((row, k) => {
        row.tiles.forEach((tile, j) => {
          let op = 0;
          if (j < s) op = 1;
          else if (j === s) op = s === 0 ? clamp(ph.add * 17 - k) : (pr > attnRow(k) + .5 ? 1 : 0);
          tile.node.setAttribute("opacity", op);
        });
        /* look-back fan: from the column to every stored tile in this row */
        const near = climbing ? bump(pr - attnRow(k), 3) : 0;
        if (near > 0) {
          const n = NP + s; let d = "";
          for (let i = 0; i < n; i++) {
            const x0 = CX + CWD, xe = (i < NP ? SX + i * TP : row.tiles[i - NP].x) + TW / 2;
            d += `M${x0} ${row.y} Q${(x0 + xe) / 2} ${row.y - 16 - (xe - x0) * .09} ${xe} ${row.y - 7}`;
          }
          row.fan.setAttribute("d", d);
        }
        row.fan.setAttribute("opacity", near * .8);
      });

      /* bars + pick + fly back */
      barSets.forEach((bs, i) => {
        const on = i === s ? ph.bars * (1 - ph.back * .8) : 0;
        bs.g.setAttribute("opacity", on);
        if (i === s) bs.b.grow(ph.bars);
      });
      pick.setAttribute("opacity", ph.sel * (1 - ph.back));
      flyers.forEach((f, i) => {
        if (i !== s || ph.back <= 0 || ph.back >= 1) return f.g.setAttribute("opacity", 0);
        const pt = back.getPointAtLength(backL * ph.back);
        f.g.setAttribute("transform", `translate(${pt.x - 48} ${pt.y - 20})`);
        f.g.setAttribute("opacity", 1); f.glow(true);
      });
      /* answer grows when a token has been fed back */
      words.forEach((w, i) => {
        const shown = i === 0 || i - 1 < s || (i - 1 === s && ph.back >= .98);
        w.setAttribute("opacity", shown ? 1 : 0);
      });
      speed.setAttribute("opacity", .35 + .65 * ctx.p(t, "speed", 0, .2));
    };
  }

  /* =================================================== scene: cache-vs-nocache */
  function buildCache(ctx) {
    const { svg } = ctx;
    D.backdrop(svg);
    const PR = 1000, NG = 1000, NB = 40;                 // prompt, generated tokens, bars
    const noTotal = i => PR * i + i * (i + 1) / 2;        // token-passes after i steps, no cache
    const withTotal = PR + NG;                            // prefill once + one pass per new token
    const ratio = noTotal(NG) / withTotal;                // 1,500,500 / 2,000 ≈ 750

    /* chart frames */
    function frame(x0, title, yTicks, yLab, xLab) {
      const g = el("g", {}, svg);
      D.label(g, x0, 196, title);
      el("path", { d: `M${x0} 230 V700 H${x0 + 630}`, stroke: col("line-2"), "stroke-width": 1.5, fill: "none" }, g);
      yTicks.forEach(([v, y]) => { el("line", { x1: x0 - 6, y1: y, x2: x0 + 630, y2: y, stroke: col("grid-2"), "stroke-width": 1 }, g); D.text(g, x0 - 10, y + 5, v, { mono: true, size: 13, color: "muted", anchor: "end" }); });
      D.text(g, x0, 222, yLab, { mono: true, size: 13, color: "text-2" });
      D.text(g, x0 + 630, 728, xLab, { mono: true, size: 13, color: "muted", anchor: "end" });
      return g;
    }
    const LX0 = 130, RX0 = 880, H = 470, BW = 630 / NB;
    const left = frame(LX0, "Without a cache · work per new token", [["0", 700], ["1,000", 700 - H / 2], ["2,000", 230]], "token-passes per step", "new token 1 → 1,000 (prompt: 1,000 tokens)");
    const yL = v => 700 - v / 2000 * H;
    const lbars = [];
    for (let j = 0; j < NB; j++) {
      const i = (j + 1) * NG / NB, x = LX0 + j * BW + 2;
      const p = el("rect", { x, y: yL(PR), width: BW - 4, height: 700 - yL(PR), fill: mix("bg", "norm", .45), opacity: 0 }, svg);
      const g = el("rect", { x, y: yL(PR + i), width: BW - 4, height: yL(PR) - yL(PR + i), fill: mix("bg", "token", .75), opacity: 0 }, svg);
      lbars.push([p, g]);
    }
    const lkey = el("g", { opacity: 0 }, svg);
    el("rect", { x: LX0 + 12, y: 248, width: 12, height: 10, fill: mix("bg", "norm", .45) }, lkey); D.text(lkey, LX0 + 30, 258, "prompt, recomputed every step", { mono: true, size: 13, color: "norm" });
    el("rect", { x: LX0 + 12, y: 270, width: 12, height: 10, fill: mix("bg", "token", .75) }, lkey); D.text(lkey, LX0 + 30, 280, "everything already written, recomputed", { mono: true, size: 13, color: "token" });
    const lTot = D.text(svg, LX0, 780, "", { mono: true, size: 16, color: "text" });

    /* right chart: time per step, 1 = reading all weights once */
    const right = frame(RX0, "With a cache · time per new token", [["0", 700], ["0.5", 700 - H / 3], ["1.0", 700 - 2 * H / 3], ["1.5", 230]], "relative time per step (1 = read all weights once)", "context length 2,500 → 100,000 tokens");
    const yR = v => 700 - v / 1.5 * H;
    const dnRel = 2 * DN_STATE / W_BYTES;                 // read + write the 48 DeltaNet states
    const rbars = [];
    for (let j = 0; j < NB; j++) {
      const c = (j + 1) * 100000 / NB, kvRel = c * KV_TOKEN / W_BYTES, x = RX0 + j * BW + 2;
      const w = el("rect", { x, y: yR(1), width: BW - 4, height: 700 - yR(1), fill: mix("bg", "norm", .3), opacity: 0 }, svg);
      const d = el("rect", { x, y: yR(1 + dnRel), width: BW - 4, height: yR(1) - yR(1 + dnRel), fill: col("delta"), opacity: 0 }, svg);
      const k = el("rect", { x, y: yR(1 + dnRel), width: BW - 4, height: 0, fill: col("cache"), opacity: 0 }, svg);
      rbars.push({ w, d, k, kvRel });
    }
    const rk1 = D.text(svg, RX0 + 12, 452, "read all weights ≈ constant", { mono: true, size: 13, color: "norm", opacity: 0 });
    const rk2 = D.text(svg, RX0 + 12, 258, "attention reads the KV cache · grows linearly", { mono: true, size: 13, color: "cache", opacity: 0 });
    const rk3 = D.text(svg, RX0 + 12, 280, "DeltaNet state · constant (thin blue band)", { mono: true, size: 13, color: "delta", opacity: 0 });
    const last = rbars[NB - 1];
    const rNote = D.text(svg, RX0 + 630, 262, `at 100,000 tokens: ×${(1 + dnRel + last.kvRel).toFixed(2)}`, { mono: true, size: 14, color: "cache", anchor: "end", opacity: 0 });
    const rTot = D.text(svg, RX0, 780, "", { mono: true, size: 16, color: "text" });
    const ratioT = D.text(svg, 800, 850, `≈ ${Math.round(ratio)}× more work without the cache (prompt 1,000 · answer 1,000)`, { size: 22, weight: 600, color: "cache", anchor: "middle", opacity: 0 });

    return t => {
      left.setAttribute("opacity", ctx.p(t, "q", .2, .6));
      const pl = ctx.p(t, "no", .03, .75, E.linear);
      lbars.forEach(([p, g], j) => { const q = clamp(pl * NB - j); p.setAttribute("opacity", q); g.setAttribute("opacity", q); });
      lkey.setAttribute("opacity", ctx.p(t, "no", .1, .3));
      const iDone = Math.round(pl * NG);
      lTot.textContent = iDone ? `total so far: ${int(noTotal(iDone))} token-passes` : "";
      lTot.setAttribute("opacity", ctx.p(t, "no", .05, .15));

      right.setAttribute("opacity", ctx.p(t, "yes", 0, .25));
      const pr = ctx.p(t, "yes", .1, .7, E.linear);
      const sl = ctx.p(t, "slope", .1, .8, E.linear);
      rbars.forEach((b, j) => {
        const q = clamp(pr * NB - j), s = clamp(sl * NB - j);
        b.w.setAttribute("opacity", q);
        b.d.setAttribute("opacity", s);
        const h = yR(1 + dnRel) - yR(1 + dnRel + b.kvRel * s);
        b.k.setAttribute("y", yR(1 + dnRel) - h); b.k.setAttribute("height", h); b.k.setAttribute("opacity", s > 0 ? 1 : 0);
      });
      rk1.setAttribute("opacity", ctx.p(t, "yes", .4, .6));
      rk2.setAttribute("opacity", ctx.p(t, "slope", .15, .35));
      rk3.setAttribute("opacity", ctx.p(t, "slope", .4, .6));
      rNote.setAttribute("opacity", ctx.p(t, "slope", .8, 1));
      rTot.textContent = `total: ${int(PR)} prefill + ${int(NG)} steps = ${int(withTotal)} token-passes`;
      rTot.setAttribute("opacity", ctx.p(t, "yes", .6, .8));
      ratioT.setAttribute("opacity", ctx.p(t, "yes", .75, 1));
    };
  }

  /* ====================================================== scene: prefix-cache */
  function buildPrefix(ctx) {
    const { svg } = ctx;
    D.backdrop(svg);
    const TOTAL = 20500, X0 = 80, W = 1440, xt = n => X0 + n / TOTAL * W;
    const SEG = [["system prompt", 0, 6000, "norm"], ["tool definitions", 6000, 15000, "attn"], ["history", 15000, 19500, "embed"], ["new message", 19500, 20000, "token"]];
    const CHUNK = 2048, CALL1 = 20000, NEXT = [20000, 20500], STAMP = 300;

    D.label(svg, 80, 100, "One request = one long text");
    const segG = SEG.map(([name, a, b, c], i) => {
      const g = el("g", { opacity: 0 }, svg);
      el("rect", { x: xt(a) + 1, y: 128, width: xt(b) - xt(a) - 2, height: 36, rx: 3, fill: mix("bg", c, .32), stroke: col(c), "stroke-width": 1.5 }, g);
      if (i < 3) {
        D.text(g, xt(a) + 10, 192, name, { size: 15, color: c, weight: 500 });
        D.text(g, xt(a) + 10, 212, `${int(b - a)} tokens`, { mono: true, size: 13, color: "muted" });
      } else {
        el("path", { d: `M${xt(a) + 18} 166 V178`, stroke: col(c), "stroke-width": 1 }, g);
        D.text(g, xt(b), 192, `${name} · ${int(b - a)}`, { size: 15, color: c, weight: 500, anchor: "end" });
      }
      return g;
    });
    const nextG = el("g", { opacity: 0 }, svg);
    el("rect", { x: xt(NEXT[0]) + 1, y: 128, width: xt(NEXT[1]) - xt(NEXT[0]) - 2, height: 36, rx: 3, fill: "none", stroke: col("cache"), "stroke-width": 1.5, "stroke-dasharray": "4 3" }, nextG);
    const nextFill = el("rect", { x: xt(NEXT[0]) + 1, y: 128, width: xt(NEXT[1]) - xt(NEXT[0]) - 2, height: 36, rx: 3, fill: col("cache"), opacity: 0 }, svg);
    D.text(nextG, xt(NEXT[1]), 230, "next tool result · 500", { size: 14, color: "cache", anchor: "end" });
    const totalT = D.text(svg, 1520, 100, "20,000 tokens", { mono: true, size: 15, color: "text", anchor: "end", opacity: 0 });
    const chunkHi = el("rect", { x: 0, y: 122, width: 0, height: 48, rx: 5, fill: "none", stroke: col("embed"), "stroke-width": 2, filter: "url(#lx-glow)", opacity: 0 }, svg);
    const cachedHi = el("rect", { x: X0 - 4, y: 122, width: xt(CALL1) - X0 + 4, height: 48, rx: 6, fill: "none", stroke: col("cache"), "stroke-width": 2, opacity: 0 }, svg);
    const cachedT = D.text(svg, X0, 250, "cached · reloaded, not recomputed", { mono: true, size: 14, color: "cache", opacity: 0 });

    /* KV grid: 16 attention layers × 41 blocks of 500 tokens */
    const NC = 41, CWp = W / NC, GY = 300, RP = 17;
    const gLab = D.label(svg, 80, 284, "KV cache · 16 attention layers × blocks of 500 tokens");
    const cpal = ramp("cache");
    const grid = [];
    for (let k = 0; k < 16; k++) for (let j = 0; j < NC; j++) {
      const y = GY + (15 - k) * RP;
      el("rect", { x: X0 + j * CWp + 2, y, width: CWp - 4, height: 12, rx: 2, fill: "none", stroke: col("line"), "stroke-width": 1 }, svg);
      const c = el("rect", { x: X0 + j * CWp + 2, y, width: CWp - 4, height: 12, rx: 2, fill: cpal[0], opacity: 0 }, svg);
      grid.push({ k, j, set: setter(c), op: setOp(c) });
    }
    const layerT = D.text(svg, 1520, 284, "", { mono: true, size: 13, color: "embed", anchor: "end" });

    /* DeltaNet squares */
    const dLab = D.label(svg, 80, 612, "DeltaNet state · 48 layers · 144 MiB at any length");
    const dpal = ramp("delta");
    const sq = Array.from({ length: 48 }, (_, j) => setter(el("rect", { x: X0 + j * 30, y: 624, width: 22, height: 22, rx: 3, fill: dpal[3] }, svg)));

    /* red invalidation */
    const stamp = el("rect", { x: xt(STAMP) - 3, y: 124, width: 7, height: 44, rx: 2, fill: col("logit"), opacity: 0, filter: "url(#lx-glow)" }, svg);
    const stampT = D.text(svg, xt(STAMP) + 12, 118, "timestamp changed", { mono: true, size: 13, color: "logit", opacity: 0 });
    const sweep = el("line", { x1: 0, y1: 118, x2: 0, y2: 652, stroke: col("logit"), "stroke-width": 3, filter: "url(#lx-glow)", opacity: 0 }, svg);
    const redTint = el("rect", { x: 0, y: 128, width: 0, height: 36, fill: col("logit"), opacity: 0 }, svg);

    /* timer + notes */
    D.label(svg, 80, 702, "Prefill time");
    const timer = D.text(svg, 80, 768, "0.0 s", { mono: true, size: 56, weight: 500, color: "text" });
    const timerSub = D.text(svg, 80, 806, "", { mono: true, size: 14, color: "muted" });
    const notes = {
      slow: D.text(svg, 820, 750, "≈ 230 tokens/s prefill  ·  ≈ 25 tokens/s decode", { mono: true, size: 18, color: "embed", opacity: 0 }),
      slow2: D.text(svg, 820, 780, "each weight read once, used for 2,048 tokens", { mono: true, size: 14, color: "muted", opacity: 0 }),
      reuse: D.text(svg, 820, 750, "", { mono: true, size: 18, color: "cache", opacity: 0 }),
      brk: D.text(svg, 820, 750, "", { mono: true, size: 18, color: "logit", opacity: 0 }),
      rule: D.text(svg, 820, 760, "stable first, changing last", { size: 30, weight: 600, color: "text", opacity: 0 }),
    };

    /* arithmetic for the timer */
    const t1 = prefillFlop(0, CALL1) / EFF;                                   // ≈ 87.5 s
    const reload = (CALL1 * KV_TOKEN + DN_STATE) / 5e9;                        // ≈ 1.5 GB at ~5 GB/s (SSD)
    const t2p = prefillFlop(NEXT[0], NEXT[1]) / EFF;
    const t2 = reload + t2p;                                                   // ≈ 2.6 s
    const t3 = prefillFlop(STAMP, TOTAL) / EFF;                                // ≈ 91 s
    const newPos = 20450;                                                      // timestamp moved to the end
    const t4 = (newPos * KV_TOKEN + DN_STATE) / 5e9 + prefillFlop(newPos, TOTAL) / EFF;
    notes.reuse.textContent = `reload ${((CALL1 * KV_TOKEN + DN_STATE) / 1e9).toFixed(1)} GB ≈ ${reload.toFixed(1)} s  ·  prefill 500 new ≈ ${t2p.toFixed(1)} s`;
    notes.brk.textContent = `token ${STAMP} changed → recompute ${int(TOTAL - STAMP)} tokens`;
    const fmtS = s => s.toFixed(1) + " s";
    const colChunk = j => Math.floor((j * 500 + 250) / CHUNK);

    return t => {
      /* anatomy */
      segG.forEach((g, i) => g.setAttribute("opacity", ctx.p(t, "anatomy", .05 + i * .12, .3 + i * .12)));
      totalT.setAttribute("opacity", ctx.p(t, "anatomy", .65, .85));
      totalT.textContent = t >= ctx.cue("reuse").start + ctx.cue("reuse").dur * .35 ? "20,500 tokens" : "20,000 tokens";
      nextG.setAttribute("opacity", ctx.p(t, "reuse", 0, .2) * (1 - ctx.p(t, "rule", 0, .1) * 0));

      /* call 1 fill: 10 chunks of 2,048 tokens across "fill" and "slow" */
      const fillP = .55 * ctx.p(t, "fill", .1, 1, E.linear) + .45 * ctx.p(t, "slow", 0, .55, E.linear);
      const nCh = Math.ceil(CALL1 / CHUNK), c = fillP * nCh, ci = Math.min(nCh - 1, Math.floor(c)), frac = fillP >= 1 ? 1 : c - ci;
      const tokDone = Math.min(CALL1, ci * CHUNK + frac * Math.min(CHUNK, CALL1 - ci * CHUNK));
      const filling = fillP > 0 && fillP < 1;
      chunkHi.setAttribute("x", xt(ci * CHUNK) - 3); chunkHi.setAttribute("width", xt(Math.min(CALL1, (ci + 1) * CHUNK)) - xt(ci * CHUNK) + 6);
      chunkHi.setAttribute("opacity", filling ? 1 : 0);
      layerT.textContent = filling ? `chunk ${ci + 1}/${nCh} · layer ${Math.max(1, Math.round(frac * 64))}/64` : "";
      gLab.setAttribute("opacity", .5 + .5 * ctx.p(t, "fill", 0, .2));
      dLab.setAttribute("opacity", .5 + .5 * ctx.p(t, "fill", .2, .4));

      /* call 2 (reuse): only the last block fills */
      const r2 = ctx.p(t, "reuse", .35, .8, E.linear);
      /* break: sweep from the timestamp to the end, then recompute */
      const sw = ctx.p(t, "break", .25, .7, E.inOut), re = ctx.p(t, "break", .7, 1, E.linear);
      const swX = lerp(xt(STAMP), xt(TOTAL), sw);
      /* rule: the timestamp moves to the end; everything before it is cached again */
      const mv = ctx.p(t, "rule", .1, .6, E.inOut);
      const stampPos = lerp(STAMP, newPos, mv);

      grid.forEach(g => {
        const { k, j } = g;
        let on = 0;
        if (j < 40) {
          const ch = colChunk(j);
          if (ch < ci || fillP >= 1) on = 1;
          else if (ch === ci) on = frac * 64 > attnRow(k) + .5 ? 1 : 0;
        } else on = r2 * 17 - k > 0 ? 1 : 0;
        /* invalidation from the changed token */
        const colStart = j * 500;
        if (sw > 0 && mv <= 0) {
          if (X0 + (j + .5) * CWp < swX && colStart + 500 > STAMP) on = 0;
          if (re > 0 && colStart + 500 > STAMP && (j + .5) / NC < re) on = 1;
        }
        if (mv > 0) on = j === NC - 1 ? (ctx.p(t, "rule", .6, .9) * 17 - k > 0 ? 1 : .25) : 1;
        g.op(on);
        g.set(cpal[Math.round(24 * (on >= 1 ? .85 : .5))]);
      });

      /* DeltaNet squares: brighten as chunks are folded in */
      sq.forEach((set, j) => {
        const lit = fillP >= 1 ? 1 : clamp(fillP * 1.05);
        const flash = filling ? bump(frac * 48 - j, 3) : 0;
        set(dpal[Math.round(24 * clamp(.12 + lit * .45 + flash * .4))]);
      });

      /* cached prefix + next tool result */
      cachedHi.setAttribute("opacity", ctx.p(t, "reuse", .05, .25) * (1 - ctx.p(t, "break", .2, .4)));
      cachedT.setAttribute("opacity", ctx.p(t, "reuse", .1, .3) * (1 - ctx.p(t, "break", .2, .4)));
      nextFill.setAttribute("opacity", r2 * .85);

      /* red sweep */
      stamp.setAttribute("x", xt(stampPos) - 3);
      stamp.setAttribute("opacity", ctx.p(t, "break", 0, .15));
      stampT.setAttribute("x", Math.min(xt(stampPos) + 12, 1340));
      stampT.setAttribute("opacity", ctx.p(t, "break", .05, .2) * (1 - ctx.p(t, "rule", .6, .8) * .5));
      sweep.setAttribute("x1", swX); sweep.setAttribute("x2", swX);
      sweep.setAttribute("opacity", sw > 0 && sw < 1 ? 1 : 0);
      const tintA = mv > 0 ? xt(stampPos) : xt(STAMP);
      redTint.setAttribute("x", tintA);
      redTint.setAttribute("width", Math.max(0, (mv > 0 ? xt(TOTAL) : swX) - tintA));
      redTint.setAttribute("opacity", sw > 0 ? .28 * (1 - re * .6) : 0);

      /* timer */
      let tv = 0, sub = "";
      if (t < ctx.cue("reuse").start) { tv = prefillFlop(0, tokDone) / EFF; sub = `${int(tokDone)} of 20,000 tokens · 1.19 × 10¹⁵ operations · M2 Ultra`; }
      else if (t < ctx.cue("break").start) { tv = t2 * ctx.p(t, "reuse", .2, .8, E.linear); sub = "second call: reload the prefix, prefill only the new part"; }
      else if (t < ctx.cue("rule").start) { tv = t3 * re; sub = `third call: everything after token ${STAMP} is recomputed`; }
      else { tv = t4 * ctx.p(t, "rule", .55, .9, E.linear); sub = "timestamp moved to the end: almost all of it reloads"; }
      timer.textContent = fmtS(tv);
      timer.setAttribute("fill", col(t >= ctx.cue("break").start && t < ctx.cue("rule").start ? "logit" : (t >= ctx.cue("reuse").start ? "cache" : "text")));
      timerSub.textContent = sub;
      timerSub.setAttribute("opacity", ctx.p(t, "fill", .05, .2));

      notes.slow.setAttribute("opacity", ctx.p(t, "slow", .5, .7) * (1 - ctx.p(t, "reuse", 0, .1)));
      notes.slow2.setAttribute("opacity", ctx.p(t, "slow", .6, .8) * (1 - ctx.p(t, "reuse", 0, .1)));
      notes.reuse.setAttribute("opacity", ctx.p(t, "reuse", .3, .5) * (1 - ctx.p(t, "break", 0, .1)));
      notes.brk.setAttribute("opacity", ctx.p(t, "break", .3, .5) * (1 - ctx.p(t, "rule", 0, .1)));
      notes.rule.setAttribute("opacity", ctx.p(t, "rule", .6, .85));
    };
  }

LX.chapter({
  id: "prefill-decode", num: 13, title: "Prefill, then decode: the generation loop", toc: "Prefill & decode",
  kicker: "Two very different phases",
  lede: "A model answers in two phases. First it reads your whole prompt at once (prefill). Then it writes one token at a time (decode). They stress the hardware in completely different ways.",
  body: [
    { prose: `
      <p>So far we have followed one forward pass: tokens in, one probability list out. A real answer needs hundreds of passes. How they are organised explains almost everything you notice when using a model: the pause before the first word, the steady speed after it, and why long conversations get slower.</p>
      <h3>Phase 1: prefill, reading the prompt</h3>
      <p>Your prompt is already known, so there is nothing to wait for. All its tokens go into the model <strong>together</strong>, as one tensor of shape <code>[T, 5120]</code>, where <code>T</code> is the prompt length. Every layer processes all <code>T</code> tokens in one go: a matrix times a matrix instead of a vector times a matrix.</p>
      <p>Prefill does three things:</p>
      <ol>
        <li>It runs every prompt token through all 64 layers.</li>
        <li>It <strong>saves its work</strong> as it goes. The 16 attention layers store each token's keys and values in the <span class="c-cache">KV cache</span>, and the 48 DeltaNet layers update their fixed-size <span class="c-cache">memory state</span>.</li>
        <li>From the <strong>last</strong> position only, it produces the probabilities for the first token of the answer.</li>
      </ol>
      <p>The predictions at the other positions are not needed during inference; they are only used during training. Their keys, values and memory updates, however, are kept: that is the cache.</p>` },

    { scene: {
      id: "prefill-wave", title: "Prefill: the whole prompt at once",
      build: buildWave,
      visual: "Twelve prompt chips (“In France the biggest city and the capital is the city of”) along the bottom. Above them all 64 layers as thin rows (every 4th violet = attention, the rest blue = DeltaNet), one column of cells per token. A glowing front rises through all 12 columns at once, layer by layer. Each time it passes an attention layer, an orange tile flies sideways and that layer's row in the KV-cache shelf (16 rows × 12 tokens, aligned with the layers) fills; each DeltaNet layer it passes lights one of 48 fixed state squares. At the top only the rightmost column feeds the next-token bars; a time-to-first-token bar fills from the first layer to the first answer token.",
      cues: [
        { id: "in",    say: "Prefill comes first. The whole prompt is already known, so every token goes into the model at the same time, as one tensor with a row for each token.", vis: "12 prompt chips slide in; a bracket labels them one tensor [12, 5120]; the 64-row stack fades in above." },
        { id: "wave",  say: "Each layer processes all the tokens together. The computer is multiplying whole matrices, which is exactly the kind of work it is fastest at.", vis: "A glowing front rises through the first layers across all 12 columns at once; label 'all 12 columns together · matrix × matrix'; the time-to-first-token bar starts filling." },
        { id: "save",  say: "As the wave passes, the model saves its work. The attention layers store every token's keys and values in the key-value cache. The DeltaNet layers fold the prompt into their fixed-size memory.", vis: "The front continues to L64. At L4, L8 … L64 an orange tile flies sideways and that row of the 'KV cache · 16 attention layers' shelf fills with 12 tiles; each DeltaNet layer passed lights one of 48 fixed squares ('DeltaNet state · fixed size')." },
        { id: "last",  say: "At the top, only the last position matters. Its vector becomes the probabilities for the first word of the answer.", vis: "The rightmost column is outlined; an arrow leads from its top to the bars: ·Paris 62% · ·Lyon 7% · ·Marseille 4% (illustrative); ·Paris is picked." },
        { id: "ttft",  say: "The time this takes is the pause you notice before the answer starts. It is called the time to first token.", vis: "The time-to-first-token bar turns pink and completes as the first answer token ·Paris appears beside it." },
      ],
    } },

    { prose: `
      <h3>Phase 2: decode, writing one token at a time</h3>
      <p>Now the model writes. The next token cannot be computed until the previous one has been chosen, so this phase is strictly <strong>one token at a time</strong>. Each step:</p>
      <ol>
        <li>Takes the single newest token, a tensor of shape <code>[1, 5120]</code>.</li>
        <li>Runs it through all 64 layers. In the attention layers, its query looks back at all the stored keys and values. In the DeltaNet layers, it reads and updates the memory state. Its own key and value are appended to the cache.</li>
        <li>Produces probabilities, samples one token (Chapter 12), and feeds it back in.</li>
      </ol>
      <p>Each step does very little arithmetic, a vector times each weight matrix, but it must still <strong>read every weight from memory</strong>. On most hardware that makes decode limited by memory bandwidth, not by compute.</p>` },

    { scene: {
      id: "decode-loop", title: "Decode: one token, round and round",
      build: buildDecode,
      visual: "The same 64 thin layers, now a single column. On the right the KV-cache shelf: 16 rows (one per attention layer, aligned with it) holding the 12 prompt tiles from prefill, plus dashed slots for new ones. The newest token enters at the bottom and a glowing dot climbs the column; near each attention layer, thin orange lines fan out to every stored tile in that row; one new tile is added per row per step. At the top, bars pick the next token, which flies back down to the input. On the left: the answer growing (Paris, which has about), a step counter and a gauge for the 19 GB of weights read every step.",
      cues: [
        { id: "one",   say: "Now the model writes. Only the newest token goes into the model, a single row of five thousand one hundred and twenty numbers.", vis: "The chip ·Paris (picked by prefill) drops in at the bottom; label [1, 5120]; step counter 1." },
        { id: "look",  say: "It climbs through all sixty-four layers. In each attention layer, it looks back at the keys and values saved for every earlier token, without recomputing any of them.", vis: "A dot climbs the column; at each attention layer, orange lines fan out to all 12 stored tiles of that row; the weights-read gauge fills." },
        { id: "add",   say: "Its own key and value are added to the cache, so the next token can look back at it too.", vis: "One new bright orange tile appears at the end of every shelf row, bottom to top." },
        { id: "pick",  say: "At the top, one token is sampled and fed straight back in. Then the next step begins.", vis: "Bars appear (, 41% · ·is 22% · . 12%, illustrative); the comma is picked, flies back down to the input, and the answer grows to “Paris,”." },
        { id: "speed", say: "Each step does little arithmetic, but it still has to read all the model's weights from memory. That is why writing speed is set by memory bandwidth, typically tens of tokens per second on a desktop machine.", vis: "Three faster steps (·which, ·has, ·about): each refills the 19 GB gauge, adds a tile per row and grows the answer; label 'memory-bound: ≈ 25–40 tokens/s on a desktop machine'." },
      ],
    } },

    { prose: `
      <h3>Prefill versus decode at a glance</h3>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th></th><th>Prefill</th><th>Decode</th></tr>
        <tr><td>Input per step</td><td><code>[T, 5120]</code>, all prompt tokens</td><td><code>[1, 5120]</code>, the newest token</td></tr>
        <tr><td>Main operation</td><td>Matrix × matrix</td><td>Vector × matrix</td></tr>
        <tr><td>Limited by</td><td>Compute (how fast the chip multiplies)</td><td>Memory bandwidth (how fast weights are read)</td></tr>
        <tr><td>Typical speed</td><td>Hundreds to thousands of tokens/s</td><td>Tens of tokens/s on a single machine</td></tr>
        <tr><td>What you notice</td><td>Time to first token</td><td>Tokens per second while it writes</td></tr>
        <tr><td>Cache</td><td>Written for all prompt tokens</td><td>Read in full, grows by one token per step</td></tr>
      </table></div>` },

    { html: `<div class="lx-note" style="border-left:3px solid var(--lx-cache)">
      <b>The cache is what keeps writing fast.</b><br><br>
      <b>Without a cache, everything would be recomputed.</b> To get token number 501, the model would have to run the prompt <em>plus</em> all 500 tokens it had already written through all 64 layers again, recomputing everything it worked out a moment ago. Each step would be longer than the last, and the total work would grow with the <em>square</em> of the length. Writing would get slower and slower.<br><br>
      <b>With a cache, which every real system uses, only the <em>one</em> newest token travels through the layers.</b> Everything earlier tokens produced that later tokens need has been saved: keys and values in the 16 attention layers, and a fixed-size memory state in the 48 DeltaNet layers.<br><br>
      <b>But each step does still get a little slower.</b> In each of the 16 full-attention layers, the new token compares itself with <em>every</em> stored key and reads every stored value. The longer the text, the more there is to read. That cost grows in a straight line with length, not with its square. The 48 DeltaNet layers cost exactly the same at token 10 as at token 100,000. This is one of the main reasons Qwen3.8 uses three DeltaNet layers for every attention layer.
    </div>` },

    { scene: {
      id: "cache-vs-nocache", title: "What the cache saves",
      build: buildCache,
      visual: "Two bar charts, all values computed. Left, without a cache, with a 1,000-token prompt: work per new token in token-passes for new tokens 1 → 1,000. Each bar stacks the recomputed prompt (grey-blue, constant 1,000) and everything written so far (amber, growing), so bars rise from 1,001 to 2,000; a running total counts up to 1,500,500. Right, with a cache: relative time per step against context length 2,500 → 100,000 (1 = reading all weights once): a constant grey part, a thin constant blue DeltaNet band (≈ 1.6%), and an orange KV-reading slice growing to ×1.36 at 100,000 tokens. Totals below: 1,500,500 vs 2,000 token-passes, ≈ 750× more work without the cache.",
      cues: [
        { id: "q",     say: "Without a cache, the whole text would go through the model again for every new token. Here is what that would cost.", vis: "The left chart frame appears: token-passes per step against new token number." },
        { id: "no",    say: "To write token number five hundred and one, the model would rerun the prompt and all five hundred earlier tokens through every layer. Each step costs more than the last, and the total grows with the square of the length.", vis: "Left bars draw left to right: grey prompt block + growing amber block; the running total counts up to 1,500,500 token-passes." },
        { id: "yes",   say: "With the cache, only the newest token goes through the layers. The work per step stays almost flat.", vis: "Right chart draws flat grey bars ('read all weights ≈ constant'); total 1,000 prefill + 1,000 steps = 2,000; banner '≈ 750× more work without the cache'." },
        { id: "slope", say: "Almost, but not quite. In the sixteen attention layers, the new token still reads every stored key and value, so each step gets a little slower as the text grows. The forty-eight DeltaNet layers cost the same no matter how long the text is.", vis: "A thin constant blue band (DeltaNet state) and an orange slice growing with context (attention reads the KV cache) appear on every bar; note 'at 100,000 tokens: ×1.36'." },
      ],
    } },

    { prose: `
      <h3>How prefill fills the cache</h3>
      <p>Prefill works through the model <strong>layer by layer</strong>. Layer 2 cannot start until layer 1 has produced its output, because that output is layer 2's input. Inside each layer, however, all the prompt's tokens are processed together:</p>
      <ul>
        <li>In each of the 16 <strong>attention layers</strong>, the keys and values of every prompt token are computed in one large matrix multiplication and written straight into that layer's slice of the <abbr>KV</abbr> cache. When prefill has passed layer 64, the cache holds 64 <abbr>KiB</abbr> for every prompt token.</li>
        <li>In each of the 48 <strong>DeltaNet layers</strong>, the prompt is folded into the memory matrix chunk by chunk (64 tokens at a time). What remains at the end is one finished state per layer, the same size whatever the prompt length.</li>
      </ul>
      <p>Long prompts are usually fed in <strong>chunks</strong> of a few thousand tokens. Each chunk runs through all 64 layers, adds its keys and values to the cache, and then the next chunk follows. Chunking keeps the temporary memory small and lets a server slip other users' decode steps in between.</p>

      <h3>Slow in total, fast per token</h3>
      <p>Prefill can take a long time, because the work grows with every token: each one costs the same work as a written token, roughly 2 × 27.8 billion ≈ 55 billion operations by the usual rule of thumb (the exact count for the text path is 51.2 billion, <a href="#recap">Chapter 18</a>), plus attention to everything before it. A 20,000-token prompt is about 1.2 million billion operations. That is pure arithmetic, so prefill runs at the chip's <em>compute</em> limit.</p>
      <p>Per token, prefill is still far faster than writing. In decode, every weight read from memory serves a single token. In prefill, every weight read serves the whole chunk, thousands of tokens at once, so the chip never waits for memory. On a Mac this is roughly 230 tokens per second for prefill against 25 for writing. On a data-centre <abbr>GPU</abbr> it is thousands against a couple of hundred.</p>

      <h3>The system prompt is part of every request</h3>
      <p>A model has no memory between requests. What looks like one conversation is, to the model, a new and longer text each time: the <strong>system prompt</strong>, the <strong>tool definitions</strong>, the whole <strong>history</strong>, and finally the new message (see the chat template below). An agent adds every tool result to that history, and calls the model again and again in a loop. In agent setups, the system prompt and tool definitions alone are often 5,000 to 30,000 tokens.</p>
      <p>All of that must be in the cache before the first new token can be written. Without reuse, it would be prefilled again on every call. Rough prefill times for a 20,000-token context with Qwen3.8-27B, assuming about half of each chip's peak compute:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Chip</th><th class="num">Prefill speed</th><th class="num">20,000 tokens</th></tr>
        <tr><td>Apple M2 / M3 Ultra</td><td class="num">≈ 230 tok/s</td><td class="num">≈ 85–90 s</td></tr>
        <tr><td>Apple M5 Max</td><td class="num">≈ 590 tok/s</td><td class="num">≈ 34 s</td></tr>
        <tr><td>NVIDIA RTX 4090</td><td class="num">≈ 1,400 tok/s</td><td class="num">≈ 14 s</td></tr>
        <tr><td>NVIDIA H100</td><td class="num">≈ 8,300 tok/s</td><td class="num">≈ 2.4 s</td></tr>
      </table></div>
      <p class="c-muted">Estimates from the operation count (2 × 27.78 billion per token, plus 16 attention layers over the growing context) at 50% of peak. Attention adds about 7% at 20,000 tokens and about 15% at 50,000.</p>

      <h3>Loading a cache is far cheaper than computing it</h3>
      <p>The cache for those 20,000 tokens is 1.22 <abbr>GiB</abbr> of keys and values plus 144 <abbr>MiB</abbr> of DeltaNet state. Reading those 1.5 GB from memory takes a fraction of a second, and even from a fast SSD only about a third of a second. Computing it took 85–90 seconds on the Mac. Recomputing costs about a million billion operations; reloading costs reading a gigabyte. That is why servers keep caches for the start of a conversation, and why <strong>prompt caching</strong> (<a href="#kv-cache">Chapter 14</a>) is one of the most important speed-ups for agents.</p>
      <p>The catch is that a cache is only valid for an <em>exact</em> run of tokens from the very start. If token 300 changes, everything after token 300 must be prefilled again. A timestamp near the top of a system prompt, a tool list in a different order, or an edited early message invalidates almost the whole cache. Stable content belongs first, changing content last.</p>` },

    { scene: {
      id: "prefix-cache", title: "Prefill, cache and reuse in an agent loop",
      build: buildPrefix,
      visual: "A request drawn as one long bar of tokens, split into coloured segments: system prompt (grey-blue), tool definitions (violet), history (teal), new message (amber), with token counts. To the right, a grid of 16 attention-layer rows × positions represents the KV cache, plus 48 small DeltaNet state squares. A chunk of the bar travels up through 64 layers and fills its columns in the grid layer by layer; a timer counts prefill seconds. On the second call, the matching prefix lights up as 'cached', only the new tail fills, and the timer barely moves. Finally a timestamp near the top changes: a red line sweeps from that point to the end, invalidating everything after it.",
      cues: [
        { id: "anatomy", say: "Every request to a chat model is one long text: the system prompt, the tool definitions, the conversation so far, and the new message. Here that is twenty thousand tokens.", vis: "Token bar with segments: system 6,000 · tools 9,000 · history 4,500 · new 500." },
        { id: "fill",    say: "Prefill reads it chunk by chunk. Each chunk climbs through all sixty-four layers. In every attention layer its keys and values are written into the cache, and every DeltaNet layer folds it into its memory.", vis: "A glowing outline marks the current 2,048-token chunk on the bar; its columns in the 16-row KV grid fill bottom to top ('chunk 3/10 · layer 40/64'); the 48 DeltaNet squares brighten; the timer runs." },
        { id: "slow",    say: "That is about one point two million billion operations. On a Mac it takes well over a minute before the first word can appear. Per token it is still ten times faster than writing, because each weight is used for the whole chunk at once.", vis: "The last chunks fill; timer reaches 87.5 s (1.19 × 10¹⁵ operations on an M2 Ultra at 13.6 TFLOPS effective); note: ≈ 230 tokens/s prefill · ≈ 25 tokens/s decode." },
        { id: "reuse",   say: "On the next call, the start of the text is identical. The server reloads the saved cache, about one and a half gigabytes, in a fraction of a second, and only prefills what is new.", vis: "The 20,000-token prefix is outlined 'cached · reloaded, not recomputed'; a dashed slot for the next tool result (500 tokens) fills orange, and only its column of the grid fills; timer 2.6 s (reload 1.5 GB ≈ 0.3 s from SSD + prefill 500 ≈ 2.3 s)." },
        { id: "break",   say: "But the cache only matches an exact run of tokens from the very beginning. Change one token near the top, such as a timestamp, and everything after it must be computed again.", vis: "A timestamp at token 300 turns pink; a pink line sweeps from it to the end and empties the grid behind it; then everything after token 300 refills while the timer climbs to ≈ 87 s (20,200 tokens recomputed)." },
        { id: "rule",    say: "So put what never changes first, and what changes last. For agents, that one habit can save minutes on every call.", vis: "The timestamp slides from the top of the text to the very end; the grid stays filled except the last block, which is recomputed; timer ≈ 0.5 s; caption 'stable first, changing last'." },
      ],
    } },

    { prose: `
      <h3>When does it stop?</h3>
      <p>The loop continues until one of these happens:</p>
      <ul>
        <li>The model samples a special <strong>stop token</strong>, such as <abbr>EOS</abbr> or the chat template's end-of-turn marker. The model learned during training to produce it when an answer is complete.</li>
        <li>A <strong>maximum length</strong> set by you or the server is reached.</li>
        <li>A <strong>stop string</strong> you asked for appears in the output.</li>
      </ul>

      <h3>The chat template: conversation as one long text</h3>
      <p>The model never sees "messages". A chat is flattened into one token sequence with special marker tokens: start of a system turn, start of a user turn, start of an assistant turn, end of turn. Your question becomes part of one long text, the template adds the "assistant starts here" marker, and the model simply continues that text. When it emits the end-of-turn token, the answer is done. For the next question, the whole conversation is the prompt, and prefill runs again. A server that kept the cache from the previous turn only needs to prefill the new part (Chapter 14).</p>` },

    { deep: `
      <h3>How much work, how many bytes?</h3>
      <p>A forward pass costs about 2 operations per parameter per token. For Qwen3.8-27B:</p>
      <math display="block"><mrow><mtext>FLOP per token</mtext><mo>≈</mo><mn>2</mn><mo>×</mo><mn>27.8</mn><mo>×</mo><msup><mn>10</mn><mn>9</mn></msup><mo>≈</mo><mn>55</mn><mo>×</mo><msup><mn>10</mn><mn>9</mn></msup></mrow></math>
      <div class="lx-read">Each of the model's 27.8 billion parameters takes part in one multiply and one add for every token, so the work per token is about 2 × 27.8 billion, roughly 55 billion operations. That is for one token passing through the weights once; attention over earlier tokens comes on top.</div>
      <p>This rule of thumb counts every parameter. An ordinary text token skips the embedding multiplication (it is a lookup), the vision encoder and the multi-token prediction head, so the exact count is 51.2 billion (<a href="#recap">Chapter 18</a>). The estimates in this chapter use the rounder figure.</p>
      <p>On top of that comes attention over the context: in each of the 16 full-attention layers, 24 query heads each do a 256-wide dot product with every stored key and a weighted sum over every stored value, about 2 × 2 × 24 × 256 × 16 ≈ 0.4 million operations per token of context. At 32,000 tokens of context, that adds about 12.6 billion operations. Real, but smaller than the weights.</p>
      <h3>Decode is bandwidth-bound</h3>
      <p>In decode, each weight is read once per token and used for just one multiply-add. Quantized with Q4_K_M, which averages about 5.5 bits per weight because some tensors are kept at higher precision, the weights are about 19 GB. A rough upper bound on decode speed is therefore</p>
      <math display="block"><mrow><mtext>tokens/s</mtext><mo>≲</mo><mfrac><mtext>memory bandwidth</mtext><mtext>bytes of weights read per token</mtext></mfrac><mo>=</mo><mfrac><mrow><mn>800</mn><mtext> GB/s</mtext></mrow><mrow><mn>19</mn><mtext> GB</mtext></mrow></mfrac><mo>≈</mo><mn>42</mn></mrow></math>
      <div class="lx-read">To write one token, the chip must read all the weights from memory once. So the best possible speed is how many bytes memory can deliver per second, divided by how many bytes must be read per token. With 800 GB/s and 19 GB of weights: 800 / 19 ≈ 42 tokens per second at most. The ≲ sign means “at most about”; real systems land below it.</div>
      <p>Real systems reach perhaps 60–80 % of that, minus the time spent reading the KV cache. Halving the bytes (a smaller quantization) nearly doubles decode speed. A faster <abbr>GPU</abbr> core barely helps.</p>
      <h3>Arithmetic intensity</h3>
      <p><em>Arithmetic intensity</em> is operations per byte read. A vector × matrix product with 19 GB of weights for 27.8 billion parameters does about 2 operations per 0.68 bytes, roughly 2.9 FLOP/byte. Chips can do between about 25 (Apple M1–M4) and 300 (data-centre GPUs) operations for every byte their memory delivers (<a href="#hardware">Chapter 17</a>), so in decode they mostly sit waiting. In prefill, each weight is reused for all <code>T</code> tokens of a chunk, so intensity rises by a factor of about <code>T</code>, and the chip's arithmetic becomes the bottleneck instead. That is why prefill runs many times faster per token: about ten times on a Mac, and tens of times on a data-centre GPU.</p>
      <h3>Why batching helps decode</h3>
      <p>A server answering 8 users at once can stack their 8 newest tokens into a <code>[8, 5120]</code> tensor. The weights are read once and used 8 times, so total throughput rises almost 8× while each user's speed falls only slightly. Speculative decoding (Chapter 15) uses the same trick within a single answer.</p>
      <h3>Total cost with and without cache</h3>
      <p>Generating <i>N</i> tokens after a prompt of length <i>P</i>, counting only the "process a token through the weights" part:</p>
      <math display="block"><mrow><mtext>no cache: </mtext><munderover><mo>∑</mo><mrow><mi>n</mi><mo>=</mo><mn>1</mn></mrow><mi>N</mi></munderover><mo>(</mo><mi>P</mi><mo>+</mo><mi>n</mi><mo>)</mo><mo>≈</mo><mi>P</mi><mi>N</mi><mo>+</mo><mfrac><msup><mi>N</mi><mn>2</mn></msup><mn>2</mn></mfrac><mspace width="2em"/><mtext>with cache: </mtext><mi>P</mi><mo>+</mo><mi>N</mi></mrow></math>
      <div class="lx-read">Without a cache, writing token number n means running the whole prompt (P tokens) plus the n tokens written so far through the model again. Add that up for every n from 1 to N: the total is about P times N plus N squared over 2, which grows very fast. With a cache, each token goes through the model only once: P for the prompt plus N for the answer. Example: P = N = 1,000 gives about 1,500,000 token passes without cache, versus 2,000 with it.</div>
      <p>For P = 1,000 and N = 1,000, that is 1.5 million token-passes against 2,000, a factor of 750.</p>` },
  ],
});
})();
