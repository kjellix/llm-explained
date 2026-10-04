/* Chapter 18 — Recap: one token's complete journey */
LX.chapter({
  id: "recap", num: 18, title: "One token's complete journey", toc: "Recap: the full journey",
  kicker: "Everything, in order",
  lede: "We now have all the pieces. Let's follow a single new token from text to text one last time, with every real number along the way.",
  body: [
    { prose: `
      <p>This chapter puts the whole course into one sequence. The scene below is the finale: the same journey as Chapter 1, but now every box has a name, a shape and a size you know.</p>` },

    { scene: {
      id: "full-journey", title: "Text in, token out, and around again",
      visual: "One continuous camera journey across three floors laid out left to right (tokenize + embed · 64 layers · score + sample), with the journey strip at the bottom showing the current stage. The prompt 'The cat sat on the' types in and is tokenized into amber chips with their real IDs; amber pointers run to rows 760, 7,993, 7,338, 383 and 279 of the [248,320 × 5,120] embedding table, and the highlighted rows fly down into five vectors ([T, 5120]). The camera follows the tensor into the 64-layer stack (3 DeltaNet : 1 attention), zooms into the layer anatomy (residual stream, RMSNorm → mixer → ⊕ → RMSNorm → SwiGLU MLP → ⊕, with light pulses on the stream and both branches), then into a DeltaNet card (shimmering memory grid) and an attention card (computed causal softmax heatmap, KV cache cells). Pulling back, a light pulse climbs L1 → L64 while a counter runs to 51,243,909,120 operations (computed from the weight shapes). On the third floor: final RMSNorm, the lm_head matrix, 300 bars standing for 248,320 logits, which morph into probabilities, sharpen as temperature goes 1.00 → 0.60, lose their tail to top-p 0.9, and ·mat (5344) is picked. Zoomed far out, ·mat arcs back to the input; overview panels show the KV cache gaining a column, the 48 DeltaNet states updating at fixed size, and the text growing; with T = 1 a single token runs the whole path again and adds the full stop.",
      cues: [
        { id: "text",    say: "It starts with text. The tokenizer splits it into tokens using byte-pair encoding, and each token becomes an ID, one of two hundred and forty-eight thousand three hundred and twenty.", vis: "Zoomed in: 'The cat sat on the' types in; chips ·The ·cat ·sat ·on ·the appear with IDs 760 · 7993 · 7338 · 383 · 279." },
        { id: "embed",   say: "Each ID selects one row of the embedding table. Now every token is a vector of five thousand one hundred and twenty numbers, and the whole prompt is a tensor of shape T by five thousand one hundred and twenty.", vis: "Camera eases back: pointers run to the real rows of the [248,320 × 5,120] table; rows glow and their cells fly into five vectors; bracket [T, 5120] · T = 5." },
        { id: "layer",   say: "The tensor enters the first of sixty-four layers. Every layer does the same two moves: normalise, mix information between tokens, and add the result back. Then normalise again, think with the feed-forward block, and add again.", vis: "The [5, 5120] tensor flows into the 64-layer stack; the camera zooms into one layer: residual stream, RMSNorm → token mixer → ⊕ → RMSNorm → SwiGLU MLP (5,120 → 17,408 → 5,120) → ⊕, with pulses on stream and branches." },
        { id: "mixers",  say: "In three layers out of four, the mixer is Gated DeltaNet, which keeps a fixed-size memory. In every fourth, it is gated full attention, which looks back at every earlier token through the key-value cache.", vis: "Camera pans to two cards linked to L1 and L4: Gated DeltaNet (shimmering 8×8 memory grid, 128 × 128 per head, 3 MiB per layer) and gated attention (computed causal heatmap, KV cache cells, 64 KiB per token)." },
        { id: "climb",   say: "Up through all sixty-four layers, each one adds its correction to the residual stream. About twenty-six billion parameters take part, about fifty-one billion operations for this one token.", vis: "Camera pulls back to the stack; a light pulse climbs L1 → L64; counter runs to 51,243,909,120 operations for this one token." },
        { id: "logits",  say: "At the top, a final normalisation, then the output head: one matrix that turns the last vector into two hundred and forty-eight thousand three hundred and twenty scores, called logits.", vis: "Third floor: Final RMSNorm → lm_head [5,120 → 248,320] → 300 bars standing for 248,320 logits, peaks ·mat ·floor ·couch ·bed ·roof." },
        { id: "sample",  say: "Temperature sharpens or flattens the scores, softmax turns them into probabilities, top p keeps only the likely ones, and one token is drawn. This time, mat.", vis: "Bars morph into probabilities; temperature readout 1.00 → 0.60 sharpens them; top-p 0.9 dims the tail; the ·mat bar glows and its chip (5344) pops up." },
        { id: "append",  say: "The new token is added to the text. Its keys and values are stored in the cache of each attention layer, and every DeltaNet layer updates its memory.", vis: "Camera zooms far out: ·mat arcs back to the input text; overview panels: KV cache gains a ·mat column, 48 DeltaNet states shimmer at fixed size, text reads 'The cat sat on the mat'." },
        { id: "repeat",  say: "And then it all happens again, but now only for the one new token, because everything about the earlier tokens is already saved.", vis: "'T = 1': a single dot runs the whole path (input → 64 layers → score) faster; a '.' column joins the KV cache and the text gains a full stop." },
        { id: "end",     say: "That is all a large language model does: predict one token, add it, and repeat. Everything it writes, it writes this way.", vis: "Overview stays: 'The cat sat on the mat.', 'predict · add · repeat', and the journey strip cycles through all six stages." },
      ],
      build(ctx) {
        const D = LX.draw, el = LX.el, col = LX.col, mix = LX.mix, clamp = LX.clamp, E = LX.ease;
        const svg = ctx.svg, ups = [];
        D.backdrop(svg);
        const R = LX.rng(1818);
        const P = (c, a, b, e) => ctx.p(ctx._t, c, a, b, e);
        const fmt = n => n.toLocaleString("en-US");

        /* ---------- helpers ------------------------------------------------ */
        // many value cells as one path per colour level (keeps the node count low)
        function cellPaths(parent, cells, size, levels = 9) {
          const b = Array.from({ length: levels }, () => []);
          cells.forEach(c => { const k = Math.round((clamp(c.v, -1, 1) + 1) / 2 * (levels - 1)); b[k].push(`M${c.x} ${c.y}h${size}v${size}h-${size}z`); });
          const g = el("g", {}, parent);
          b.forEach((d, k) => d.length && el("path", { d: d.join(""), fill: LX.valueColor(k / (levels - 1) * 2 - 1) }, g));
          return g;
        }
        const plus = (parent, x, y, color = "embed") => {
          const g = el("g", {}, parent);
          el("circle", { cx: x, cy: y, r: 13, fill: col("bg"), stroke: col(color), "stroke-width": 2 }, g);
          el("path", { d: `M${x - 7} ${y}H${x + 7}M${x} ${y - 7}V${y + 7}`, stroke: col(color), "stroke-width": 2 }, g);
          return g;
        };
        const fade = (e, p) => e.setAttribute("opacity", p);

        /* ---------- the world: three floors laid out left to right ---------- */
        const world = el("g", {}, svg);

        /* Floor A · tokenize + embed (x 0 – 1600) */
        const fA = el("g", {}, world);
        D.label(fA, 120, 72, "1 · Tokenize    2 · Embed", { size: 15 });
        const FULL = "The cat sat on the";
        const inp = D.text(fA, 120, 148, "", { size: 46, weight: 650 });
        const base = el("tspan", {}, inp), added = el("tspan", { fill: col("logit") }, inp);
        const TOK = [["The", 760], [" cat", 7993], [" sat", 7338], [" on", 383], [" the", 279]];
        const CW = 128, CG = 20, CX0 = 120, CY = 196;
        const chips = TOK.map(([w, id], i) => D.tokenChip(fA, { x: CX0 + i * (CW + CG), y: CY, w: CW, h: 56, text: w, id, size: 24 }));
        // embedding table: 28 rows × 20 columns shown, real row numbers on the edge
        const TX = 1010, TY = 132, CS = 18, CSTEP = 22, RSTEP = 20, NR = 28, NC = 20;
        const ROWS = { 0: "0", 3: "279", 6: "383", 10: "760", 16: "7,338", 19: "7,993", 27: "248,319" };
        const rowOf = { 279: 3, 383: 6, 760: 10, 7338: 16, 7993: 19 };
        const vals = Array.from({ length: NR }, () => Array.from({ length: NC }, () => (R() * 2 - 1) * (.3 + R() * .7)));
        const cells = [];
        vals.forEach((row, r) => row.forEach((v, c) => cells.push({ x: TX + c * CSTEP, y: TY + r * RSTEP, v })));
        const table = el("g", {}, fA);
        cellPaths(table, cells, CS);
        Object.entries(ROWS).forEach(([r, lab]) => D.text(table, TX - 10, TY + r * RSTEP + 14, lab, { mono: true, size: 14, color: "muted", anchor: "end" }));
        D.label(table, TX, TY - 30, "embedding table · [248,320 × 5,120]", { size: 14 });
        D.text(table, TX + NC * CSTEP + 12, TY + NR * RSTEP / 2, "248,320 rows", { mono: true, size: 14, color: "muted" });
        D.text(table, TX, TY + NR * RSTEP + 22, "5,120 columns (20 shown)", { mono: true, size: 14, color: "muted" });
        // pointers chip → row, row highlight, and the copied vectors
        const NV = 12, VS = 20, VSTEP = 25, VY = 336;
        const lookups = TOK.map(([, id], i) => {
          const r = rowOf[id], ry = TY + r * RSTEP, cx = chips[i].cx;
          const ptr = D.arrow(fA, { d: `M${cx} ${CY - 2} V${104 - i * 8} H${975 - i * 7} V${ry + 9} H${TX - 4}`, color: "token", width: 1.6 });
          const hl = el("rect", { x: TX - 3, y: ry - 3, width: NC * CSTEP + 2, height: CS + 6, rx: 3, fill: "none", stroke: col("token"), "stroke-width": 2, opacity: 0 }, fA);
          const vcells = vals[r].slice(0, NV).map((v, j) => {
            const x = cx - VS / 2, y = VY + j * VSTEP;
            const rc = el("rect", { x, y, width: VS, height: VS, rx: 3, fill: LX.valueColor(v), opacity: 0 }, fA);
            return { rc, dx: TX + j * CSTEP - x, dy: ry - y };
          });
          return { ptr, hl, vcells };
        });
        const tBr = D.bracket(fA, { x1: CX0, y1: VY + NV * VSTEP + 14, x2: CX0 + 5 * (CW + CG) - CG, y2: VY + NV * VSTEP + 14, side: "bottom", label: "[T, 5120] · T = 5 tokens", color: "embed" });

        /* Floor B · 64 layers (x 1600 – 3600) */
        const SX = 2420, SW = 360, slabY = i => 714 - i * 10;
        const enter = D.arrow(world, { d: `M1480 420 C 1900 420, 2120 717, ${SX - 14} 717`, color: "embed", width: 2 });
        D.text(world, 1720, 470, "[5, 5120]", { mono: true, size: 16, color: "embed" });
        const stackG = el("g", {}, world);
        const slabs = [];
        for (let i = 0; i < 64; i++) {
          const attn = i % 4 === 3;
          slabs.push({ r: el("rect", { x: SX, y: slabY(i), width: SW, height: 7, rx: 1.5, fill: mix("bg", attn ? "attn" : "delta", attn ? .6 : .35) }, stackG), attn });
        }
        D.text(stackG, SX - 12, slabY(0) + 8, "L1", { mono: true, size: 16, color: "muted", anchor: "end" });
        D.text(stackG, SX - 12, slabY(63) + 8, "L64", { mono: true, size: 16, color: "muted", anchor: "end" });
        D.label(stackG, SX - 40, 50, "64 layers · 48 Gated DeltaNet · 16 gated attention", { size: 15 });
        const climbPulse = el("rect", { x: SX - 6, y: 0, width: SW + 12, height: 12, rx: 4, fill: col("embed"), opacity: 0, filter: "url(#lx-glow)" }, world);

        // right panel: one layer, drawn like Chapter 6
        const PR = el("g", {}, world);
        el("rect", { x: 2860, y: 70, width: 680, height: 660, rx: 12, fill: col("bg-2"), stroke: col("line-2"), "stroke-dasharray": "6 6" }, PR);
        D.label(PR, 2884, 100, "one layer · all 64 share this shape", { size: 14 });
        const RSX = 2950;
        const stream = el("path", { d: `M${RSX} 712 V128`, stroke: col("embed"), "stroke-width": 4, fill: "none" }, PR);
        el("path", { d: `M${RSX - 9} 140 L${RSX} 124 L${RSX + 9} 140`, stroke: col("embed"), "stroke-width": 3, fill: "none" }, PR);
        D.text(PR, RSX - 14, 700, "residual stream", { mono: true, size: 14, color: "embed", anchor: "end" });
        const b1 = el("path", { d: `M${RSX} 668 H3130 V632 M3130 586 V560 M3130 494 V470 H${RSX + 14}`, stroke: col("muted"), "stroke-width": 2, fill: "none" }, PR);
        const b2 = el("path", { d: `M${RSX} 418 H3130 V392 M3130 346 V326 M3130 250 V216 H${RSX + 14}`, stroke: col("muted"), "stroke-width": 2, fill: "none" }, PR);
        const nrm1 = D.block(PR, { x: 3040, y: 586, w: 180, h: 46, kind: "norm", label: "RMSNorm", size: 16 });
        const mixr = D.block(PR, { x: 3010, y: 494, w: 240, h: 66, kind: "delta", label: "Token mixer", sub: "DeltaNet ×48 · attention ×16", size: 17 });
        const nrm2 = D.block(PR, { x: 3040, y: 346, w: 180, h: 46, kind: "norm", label: "RMSNorm", size: 16 });
        const mlpB = D.block(PR, { x: 3010, y: 250, w: 240, h: 76, kind: "mlp", label: "SwiGLU MLP", sub: "5,120 → 17,408 → 5,120", size: 17 });
        plus(PR, RSX, 470); plus(PR, RSX, 216);
        D.text(PR, 3270, 534, "mix between tokens", { size: 16, color: "text-2" });
        D.text(PR, 3270, 294, "think per token", { size: 16, color: "text-2" });
        D.text(PR, 3270, 316, "267.4 M parameters", { mono: true, size: 14, color: "muted" });
        const trMain = D.traveller(PR, stream, { color: "embed", r: 7 });
        const trB1 = D.traveller(PR, el("path", { d: `M${RSX} 668 H3130 V470 H${RSX}`, fill: "none" }, PR), { color: "delta", r: 6 });
        const trB2 = D.traveller(PR, el("path", { d: `M${RSX} 418 H3130 V216 H${RSX}`, fill: "none" }, PR), { color: "mlp", r: 6 });

        // left panel: the two mixers
        const PL = el("g", {}, world);
        el("rect", { x: 1660, y: 80, width: 700, height: 300, rx: 12, fill: col("bg-2"), stroke: col("delta"), "stroke-width": 1.5 }, PL);
        D.text(PL, 1690, 122, "Gated DeltaNet · 48 layers", { size: 22, weight: 600, color: "delta" });
        const memCells = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
          memCells.push(el("rect", { x: 1694 + c * 26, y: 146 + r * 26, width: 22, height: 22, rx: 3, fill: col("zero") }, PL));
        D.text(PL, 1930, 180, "a fixed-size memory per head", { size: 18, color: "text-2" });
        D.text(PL, 1930, 214, "128 × 128 numbers · 48 heads", { mono: true, size: 15, color: "muted" });
        D.text(PL, 1930, 240, "3 MiB per layer", { mono: true, size: 15, color: "muted" });
        D.text(PL, 1930, 280, "same size at any length", { size: 18, color: "cache" });
        el("rect", { x: 1660, y: 420, width: 700, height: 300, rx: 12, fill: col("bg-2"), stroke: col("attn"), "stroke-width": 1.5 }, PL);
        D.text(PL, 1690, 462, "Gated attention · 16 layers", { size: 22, weight: 600, color: "attn" });
        // causal softmax heatmap from tiny 2-D vectors, computed here
        const q2 = [[1, 0], [.4, 1], [1, .9], [.2, .6], [1.2, .5]];
        const HX = 1760, HY = 512, HC = 34;
        const heat = [];
        ["The", "cat", "sat", "on", "the"].forEach((w, j) => {
          D.text(PL, HX + j * (HC + 4) + HC / 2, HY - 8, w, { mono: true, size: 13, color: "muted", anchor: "middle" });
          D.text(PL, HX - 8, HY + j * (HC + 4) + 22, w, { mono: true, size: 13, color: "muted", anchor: "end" });
        });
        q2.forEach((qi, r) => {
          const sc = q2.map((kj, j) => j <= r ? (qi[0] * kj[0] + qi[1] * kj[1]) / Math.SQRT2 : -Infinity);
          const m = Math.max(...sc), ex = sc.map(v => Math.exp(v - m)), z = ex.reduce((a, b) => a + b, 0);
          ex.forEach((e, j) => heat.push({ r, rc: el("rect", { x: HX + j * (HC + 4), y: HY + r * (HC + 4), width: HC, height: HC, rx: 4,
            fill: j <= r ? mix("panel", "attn", .12 + .88 * e / z) : col("panel"), stroke: col("line"), opacity: 0 }, PL) }));
        });
        D.text(PL, 2000, 540, "every earlier token, exactly", { size: 18, color: "text-2" });
        D.text(PL, 2000, 572, "keys and values come from the", { size: 16, color: "muted" });
        D.text(PL, 2000, 594, "KV cache · 64 KiB per token", { mono: true, size: 15, color: "cache" });
        const kvMini = [];
        for (let c = 0; c < 6; c++) for (let r = 0; r < 4; r++)
          kvMini.push({ c, rc: el("rect", { x: 2004 + c * 30, y: 620 + r * 18, width: 26, height: 14, rx: 2, fill: mix("bg", "cache", .55), opacity: 0 }, PL) });
        // zoom connectors from the stack to the panels
        const conn = el("g", { opacity: 0 }, world);
        el("path", { d: `M${SX + SW} ${slabY(9) + 3} L2860 400`, stroke: col("muted"), "stroke-dasharray": "5 6", fill: "none", "stroke-width": 1.5 }, conn);
        const connL = el("g", { opacity: 0 }, world);
        el("path", { d: `M${SX} ${slabY(0) + 3} L2360 230`, stroke: col("delta"), "stroke-dasharray": "5 6", fill: "none", "stroke-width": 1.5 }, connL);
        el("path", { d: `M${SX} ${slabY(3) + 3} L2360 570`, stroke: col("attn"), "stroke-dasharray": "5 6", fill: "none", "stroke-width": 1.5 }, connL);
        // the operation count, computed from the weight shapes
        const H = 5120, I = 17408, V = 248320;
        const MAC = 64 * 3 * H * I + 48 * (H * 10240 + H * 6144 + 2 * H * 48 + 6144 * H) + 16 * (H * 12288 + 2 * H * 1024 + 6144 * H) + V * H;
        const OPS = 2 * MAC;
        const opsG = el("g", { opacity: 0 }, world);
        const opsT = D.text(opsG, 2860, 330, "0", { size: 54, weight: 650, color: "embed" });
        D.text(opsG, 2860, 374, "operations for this one token", { size: 24, color: "text-2" });
        D.text(opsG, 2860, 412, "about 26 billion parameters take part", { size: 20, color: "muted" });

        /* Floor C · score + sample (x 3600 – 5200) */
        D.label(world, 3700, 72, "3 · Score    4 · Sample", { size: 15 });
        const toTop = D.arrow(world, { d: `M2600 76 C 2600 -30, 3420 -30, 3684 330`, color: "embed", width: 2 });
        const fnorm = D.block(world, { x: 3690, y: 330, w: 170, h: 60, kind: "norm", label: "Final RMSNorm", size: 16 });
        const a1 = D.arrow(world, { x1: 3864, y1: 360, x2: 3916, y2: 360, color: "muted" });
        const lmG = el("g", {}, world);
        const lmCells = [];
        for (let r = 0; r < 18; r++) for (let c = 0; c < 15; c++) lmCells.push({ x: 3922 + c * 24, y: 150 + r * 23, v: (R() * 2 - 1) * .8 });
        cellPaths(lmG, lmCells, 20);
        el("rect", { x: 3918, y: 146, width: 364, height: 418, rx: 6, fill: "none", stroke: col("logit"), "stroke-width": 2 }, lmG);
        D.text(lmG, 4100, 132, "lm_head · [5,120 → 248,320]", { mono: true, size: 16, color: "logit", anchor: "middle" });
        const a2 = D.arrow(world, { x1: 4288, y1: 360, x2: 4372, y2: 360, color: "muted" });
        // 300 bars standing for 248,320 logits; five named peaks (ch. 11 numbers)
        const NB = 300, BX0 = 4392, BW = 740 / NB, BASE = 610;
        const z = Array.from({ length: NB }, () => -1.6 - R() * 2.6);
        const PEAK = [[46, " mat", 4.1], [95, " floor", 3.3], [150, " couch", 2.6], [205, " bed", 1.9], [262, " roof", 0.5]];
        PEAK.forEach(([i, , v]) => (z[i] = v));
        const soft = T => { const m = Math.max(...z) / T, ex = z.map(v => Math.exp(v / T - m)), s = ex.reduce((a, b) => a + b, 0); return ex.map(e => e / s); };
        const keptP = el("path", { fill: col("logit") }, world);
        const cutP = el("path", { fill: col("logit") }, world);
        el("path", { d: `M${BX0 - 6} ${BASE + .5} H${BX0 + 746}`, stroke: col("line-2"), "stroke-width": 1 }, world);
        const peakLab = PEAK.map(([, w]) => D.tokenText(world, 0, 0, w, { size: 17, anchor: "middle", color: "text-2" }));
        const barCap = D.text(world, BX0, BASE + 34, "248,320 logits · 300 drawn · order illustrative", { mono: true, size: 14, color: "muted" });
        const dial = D.text(world, 4520, 120, "", { mono: true, size: 22, color: "text" });
        const topp = D.text(world, 4520, 154, "", { mono: true, size: 18, color: "muted" });
        const pickHL = el("rect", { x: BX0 + 46 * BW - 4, y: 0, width: BW + 8, height: 0, rx: 2, fill: "none", stroke: col("logit"), "stroke-width": 2.5, filter: "url(#lx-glow)", opacity: 0 }, world);
        const pickChip = D.tokenChip(world, { x: BX0 + 46 * BW - 60, y: 180, w: 120, h: 52, text: " mat", id: 5344, color: "logit", size: 24 });
        // loop arc back to the input
        const arc = el("path", { d: `M${BX0 + 46 * BW} 200 C 4200 -170, 1300 -170, 880 120`, fill: "none" }, world);
        const ARCL = arc.getTotalLength();
        const flyChip = D.tokenChip(world, { x: 0, y: 0, w: 120, h: 52, text: " mat", color: "logit", size: 24 });
        const repPath = el("path", { d: `M880 150 C 1500 150, 2120 717, ${SX + SW / 2} 717 L${SX + SW / 2} 80 C 2600 -30, 3420 -30, 3700 360 L4300 360`, fill: "none" }, world);
        const repDot = D.traveller(world, repPath, { color: "logit", r: 14 });
        // overview labels: only readable when the camera is far out
        const ovL = el("g", { opacity: 0 }, world);
        [["Tokenize · Embed", 800], ["64 layers", 2600], ["Score · Sample", 4400]].forEach(([s, x]) =>
          D.text(ovL, x, 872, s, { size: 66, weight: 650, anchor: "middle", color: "text" }));
        const tOne = D.text(world, 1250, 300, "T = 1", { size: 72, weight: 700, color: "logit", opacity: 0 });

        /* ---------- screen-space overview panels (append / repeat / end) ---- */
        const ov = el("g", { opacity: 0 }, svg);
        const panel = (x, w, title, sub, kind) => {
          el("rect", { x, y: 360, width: w, height: 410, rx: 12, fill: col("bg-2"), stroke: col(kind), "stroke-width": 1.5 }, ov);
          D.text(ov, x + 22, 398, title, { size: 21, weight: 600, color: kind });
          D.text(ov, x + 22, 752, sub, { mono: true, size: 14, color: "muted" });
        };
        panel(80, 470, "KV cache · 16 attention layers", "+64 KiB for every new token", "cache");
        panel(580, 420, "DeltaNet state · 48 layers", "fixed: 144 MiB at any length", "delta");
        panel(1030, 490, "The text so far", "", "token");
        const kvCols = [];
        for (let c = 0; c < 7; c++) {
          const g = el("g", { opacity: c < 5 ? 1 : 0 }, ov);
          for (let r = 0; r < 16; r++) el("rect", { x: 104 + c * 56, y: 420 + r * 19, width: 50, height: 15, rx: 2, fill: mix("bg", "cache", c < 5 ? .45 : .8) }, g);
          D.text(g, 129 + c * 56, 732, ["The", "cat", "sat", "on", "the", "mat", "."][c], { mono: true, size: 14, color: c < 5 ? "muted" : "logit", anchor: "middle" });
          kvCols.push(g);
        }
        const stSq = [];
        for (let i = 0; i < 48; i++) stSq.push(el("rect", { x: 610 + (i % 8) * 46, y: 430 + Math.floor(i / 8) * 46, width: 38, height: 38, rx: 4, fill: mix("bg", "delta", .4) }, ov));
        const txtO = D.text(ov, 1056, 470, "", { size: 34, weight: 600 });
        const tBase = el("tspan", {}, txtO); tBase.textContent = "The cat sat on the";
        const tNew = el("tspan", { fill: col("logit") }, txtO);
        const tStep = D.text(ov, 1056, 530, "", { size: 20, color: "text-2" });
        const tEnd = D.text(ov, 1056, 600, "predict · add · repeat", { size: 30, weight: 650, color: "embed", opacity: 0 });

        const strip = D.journey(svg, { x: 160, y: 818, w: 1280 });

        /* ---------- camera ------------------------------------------------- */
        const VIEW = { A0: [480, 140, 1.45], A: [800, 390, 1], A2: [880, 395, 1], B: [2600, 400, .8], PR: [3200, 400, 1.15], PL: [2010, 400, 1.15],
          C: [4400, 390, 1], C2: [4450, 380, 1.02], OV: [2600, 1150, .3] };
        const KF = [["text", 0, "A0"], ["embed", .12, "A2"], ["layer", .14, "B"], ["layer", .5, "PR"], ["mixers", .1, "PL"],
          ["climb", .1, "B"], ["logits", .14, "C"], ["sample", .12, "C2"], ["append", .2, "OV"]]
          .map(([c, f, v]) => ({ t: ctx.cue(c).start + ctx.cue(c).dur * f, v: VIEW[v] }));
        const TRAVEL = 1.8;
        function camera(t) {
          let i = 0;
          while (i + 1 < KF.length && KF[i + 1].t <= t) i++;
          let [cx, cy, s] = KF[i].v;
          const nx = KF[i + 1];
          if (nx && t > nx.t - TRAVEL) {
            const p = E.inOut(clamp((t - (nx.t - TRAVEL)) / TRAVEL));
            cx += (nx.v[0] - cx) * p; cy += (nx.v[1] - cy) * p; s = s * Math.pow(nx.v[2] / s, p);
          }
          world.setAttribute("transform", `translate(800 390) scale(${s.toFixed(5)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`);
          return s;
        }

        /* ---------- update ------------------------------------------------- */
        return t => {
          ctx._t = t;
          const s = camera(t);

          // floor A steps back while the camera is elsewhere, and returns for the overview
          fade(fA, 1 - .65 * P("layer", .05, .2) * (1 - P("append", .12, .3)));
          // A · tokenize
          D.type(base, FULL, P("text", 0, .35, E.linear));
          chips.forEach((c, i) => { c.show(P("text", .35 + i * .06, .6 + i * .06)); c.idShow(P("text", .7 + i * .04, .9 + i * .04)); c.glow(ctx.active(t, "text") && P("text", .7, 1) > 0); });
          // A · embed
          fade(table, P("embed", 0, .2));
          lookups.forEach((L, i) => {
            const a = .14 + i * .07;
            L.ptr.draw(P("embed", a, a + .14));
            fade(L.hl, P("embed", a + .1, a + .16) * (1 - P("layer", 0, .1)));
            L.vcells.forEach((v, j) => {
              const q = P("embed", a + .14 + j * .008, a + .3 + j * .008, E.inOut);
              v.rc.setAttribute("opacity", q > 0 ? 1 : 0);
              v.rc.setAttribute("transform", `translate(${(v.dx * (1 - q)).toFixed(1)} ${(v.dy * (1 - q)).toFixed(1)})`);
            });
          });
          tBr.show(P("embed", .82, .95));

          // B · layers
          enter.draw(P("layer", 0, .2));
          slabs.forEach((sl, i) => fade(sl.r, P("layer", .04 + i * .002, .2 + i * .002)));
          fade(conn, P("layer", .38, .48) * (1 - P("mixers", 0, .1)));
          const pr = P("layer", .42, .6) * (1 - .82 * P("climb", 0, .15));
          fade(PR, pr);
          const loopT = (t - ctx.cue("layer").start) / 3.2;
          const inLayer = t >= ctx.cue("layer").start + ctx.cue("layer").dur * .6 && t < ctx.cue("climb").start;
          trMain.at(inLayer ? loopT % 1 : 0); trB1.at(inLayer ? (loopT + .15) % 1 : 0); trB2.at(inLayer ? (loopT + .55) % 1 : 0);
          [nrm1, mixr, nrm2, mlpB].forEach((b, k) => b.pulse(inLayer ? clamp(1 - Math.abs(((loopT % 1) * 4) - k - .5) / 1.1) : 0));
          const pl = P("mixers", 0, .3) * (1 - .82 * P("climb", 0, .15));
          fade(PL, pl);
          fade(connL, P("mixers", .05, .25) * (1 - P("climb", 0, .1)));
          const shimmer = .25 + .75 * Math.max(P("mixers", .2, .5) * (1 - P("climb", 0, .1)), 0);
          memCells.forEach((m, k) => m.setAttribute("fill", LX.valueColor(Math.sin(k * 1.37 + t * 1.6 * shimmer) * .8 * shimmer)));
          heat.forEach(h => fade(h.rc, P("mixers", .3 + h.r * .07, .45 + h.r * .07)));
          kvMini.forEach(k => fade(k.rc, P("mixers", .6 + k.c * .04, .7 + k.c * .04)));
          // climb: the light pulse rises through all 64 layers, ops counter runs
          const cp = P("climb", .12, .85, E.inOut);
          const climbOn = cp > 0 && cp < 1;
          climbPulse.setAttribute("y", slabY(Math.min(63, cp * 63)) - 3); fade(climbPulse, climbOn ? .85 : 0);
          slabs.forEach((sl, i) => { const hit = climbOn ? clamp(1 - Math.abs(cp * 63 - i) / 3) : 0; sl.r.setAttribute("fill", mix("bg", sl.attn ? "attn" : "delta", (sl.attn ? .6 : .35) + hit * .4)); });
          fade(opsG, P("climb", .15, .3) * (1 - P("logits", 0, .1)));
          opsT.textContent = fmt(Math.round(OPS * P("climb", .18, .8, E.out)));

          // C · score
          toTop.draw(P("logits", 0, .2));
          fnorm.show(P("logits", .15, .3)); fnorm.pulse(ctx.active(t, "logits") ? P("logits", .2, .35) * (1 - P("logits", .35, .5)) : 0);
          a1.draw(P("logits", .3, .38));
          fade(lmG, P("logits", .32, .48));
          a2.draw(P("logits", .48, .54));
          const grow = P("logits", .52, .92);
          // sample: logits → probabilities, temperature 1.0 → 0.6, top-p 0.9 trims the tail
          const toP = P("sample", 0, .25, E.inOut);
          const T = 1 - .4 * P("sample", .28, .55, E.inOut);
          const probs = soft(T);
          const order = probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]);
          let cum = 0; const keep = new Set();
          for (const [p, i] of order) { if (cum < .9) { keep.add(i); cum += p; } }
          const trim = P("sample", .58, .75);
          let dk = "", dc = "";
          const hgt = z.map((v, i) => { const hl = (v + 5) * 45 * grow, hp = probs[i] * 520; return hl + (hp - hl) * toP; });
          hgt.forEach((h, i) => { const r = `M${(BX0 + i * BW).toFixed(1)} ${BASE}h${(BW * .72).toFixed(2)}v${(-h).toFixed(1)}h${(-BW * .72).toFixed(2)}z`; (keep.has(i) || trim === 0 ? (dk += r) : (dc += r)); });
          keptP.setAttribute("d", dk); cutP.setAttribute("d", dc); fade(cutP, 1 - .85 * trim);
          PEAK.forEach(([i], k) => { peakLab[k].setAttribute("x", BX0 + i * BW); peakLab[k].setAttribute("y", BASE - hgt[i] - 10); fade(peakLab[k], grow * (k > 0 ? 1 - .8 * trim : 1) * (1 - P("append", 0, .2))); });
          fade(barCap, grow * (1 - P("append", 0, .2)));
          fade(dial, P("sample", .25, .32)); dial.textContent = `temperature T = ${T.toFixed(2)}`;
          fade(topp, P("sample", .58, .66)); topp.textContent = "top-p 0.9 · the unlikely tail is cut";
          const pk = P("sample", .76, .9);
          pickHL.setAttribute("y", BASE - hgt[46] - 4); pickHL.setAttribute("height", hgt[46] + 8); fade(pickHL, pk);
          pickChip.show(pk * (1 - P("append", .1, .15)), 10); pickChip.idShow(pk * (1 - P("append", .1, .15))); pickChip.glow(pk > .5);

          // append: ·mat flies back to the input; caches grow; text grows
          const fp = P("append", .15, .55, E.inOut);
          if (fp > 0 && fp < 1) { const pt = arc.getPointAtLength(ARCL * fp); flyChip.g.setAttribute("transform", `translate(${pt.x - 60} ${pt.y - 26})`); fade(flyChip.g, 1); flyChip.glow(true); }
          else fade(flyChip.g, 0);
          const appended = P("append", .55, .56) > 0;
          const dot = P("repeat", .84, .85) > 0;
          added.textContent = (appended ? " mat" : "") + (dot ? "." : "");
          fade(ov, P("append", .12, .4));
          fade(ovL, P("append", .12, .4));
          fade(kvCols[5], P("append", .55, .7)); fade(kvCols[6], P("repeat", .85, .95));
          const upd = Math.max(P("append", .6, .7) * (1 - P("append", .9, 1)), P("repeat", .86, .92) * (1 - P("repeat", .96, 1)));
          stSq.forEach((q, k) => q.setAttribute("fill", mix("bg", "delta", .4 + .45 * upd * (.5 + .5 * Math.sin(k * 2.1 + t * 7)))));
          tNew.textContent = (appended ? " mat" : "") + (dot ? "." : "");
          tStep.textContent = dot ? "two new tokens, one step each" : appended ? "one new token: ·mat" : "";
          // repeat: T = 1, one token through the whole stack
          fade(tOne, P("repeat", .02, .12) * (1 - P("end", 0, .1)));
          const rp = P("repeat", .12, .8, E.inOut);
          repDot.at(rp);
          if (rp > 0 && rp < 1) {
            const len = repPath.getTotalLength(), y = repPath.getPointAtLength(len * rp).y, inStack = Math.abs(repPath.getPointAtLength(len * rp).x - (SX + SW / 2)) < 2;
            slabs.forEach((sl, i) => { if (inStack) { const hit = clamp(1 - Math.abs(slabY(i) - y) / 30); sl.r.setAttribute("fill", mix("bg", sl.attn ? "attn" : "delta", (sl.attn ? .6 : .35) + hit * .45)); } });
          }
          fade(tEnd, P("end", .3, .55));

          // journey strip
          const stage = t < ctx.cue("embed").start ? "tokenize" : t < ctx.cue("layer").start ? "embed" : t < ctx.cue("logits").start ? "layers"
            : t < ctx.cue("sample").start ? "score" : t < ctx.cue("append").start ? "sample" : t < ctx.cue("end").start ? "repeat"
            : LX.STAGES[Math.floor((t - ctx.cue("end").start) / 0.9) % 6].key;
          strip.set(stage, (t % 1.6) / 1.6);
        };
      },
    } },

    { prose: `
      <h3>The journey, step by step</h3>
      <ol>
        <li><strong class="c-token">Tokenize.</strong> <abbr>BPE</abbr> splits text into tokens; each gets an <abbr>ID</abbr> between 0 and 248,319. <a href="#tokens">Ch. 4</a></li>
        <li><strong class="c-embed">Embed.</strong> Look up one row of the <code>[248320, 5120]</code> table per token. The prompt becomes a <code>[T, 5120]</code> tensor. <a href="#embeddings">Ch. 5</a></li>
        <li><strong class="c-delta">Layers 1–64.</strong> Each layer: <abbr>RMSNorm</abbr> → token mixer → add → RMSNorm → <abbr>SwiGLU</abbr> <abbr>MLP</abbr> → add. <a href="#layer">Ch. 6</a>, <a href="#mlp">Ch. 9</a></li>
        <li><strong class="c-delta">Mixer, 48 layers:</strong> Gated DeltaNet with a fixed 128 × 128 memory per head. <strong class="c-attn">16 layers:</strong> gated full attention with <abbr>GQA</abbr> and the <abbr>KV</abbr> cache. <a href="#attention">Ch. 7</a>, <a href="#deltanet">Ch. 8</a></li>
        <li><strong class="c-logit">Score.</strong> Final RMSNorm, then the <code>[5120, 248320]</code> output head gives 248,320 logits. <a href="#output">Ch. 11</a></li>
        <li><strong class="c-logit">Sample.</strong> Temperature, softmax, top-k / top-p, draw one token. <a href="#sampling">Ch. 12</a></li>
        <li><strong class="c-cache">Repeat.</strong> Append the token, update the caches, run again with <code>T = 1</code>. <a href="#prefill-decode">Ch. 13</a>, <a href="#kv-cache">Ch. 14</a></li>
      </ol>` },

    { html: `<div class="lx-prose"><h3>Cheat sheet: Qwen3.8-27B in numbers</h3></div>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>What</th><th class="num">Number</th><th>Where it shows up</th></tr>
        <tr><td>Vocabulary</td><td class="num">248,320 tokens</td><td>Token IDs, embedding rows, logits</td></tr>
        <tr><td>Hidden size</td><td class="num">5,120</td><td>Length of every token's vector</td></tr>
        <tr><td>Layers</td><td class="num">64</td><td>48 Gated DeltaNet + 16 gated attention (3 : 1)</td></tr>
        <tr><td>Attention heads</td><td class="num">24 Q / 4 KV × 256</td><td>Grouped-query attention; 6 query heads share each key/value head</td></tr>
        <tr><td>Rotary positions</td><td class="num">64 of 256 dims</td><td>Partial RoPE (25%), in three parts (time, height, width)</td></tr>
        <tr><td>DeltaNet heads</td><td class="num">16 QK / 48 V × 128</td><td>Each value head keeps a 128 × 128 memory</td></tr>
        <tr><td>MLP size</td><td class="num">5,120 → 17,408 → 5,120</td><td>SwiGLU feed-forward in every layer</td></tr>
        <tr><td>Parameters per layer</td><td class="num">383.3 M / 372.3 M</td><td>DeltaNet layer / attention layer</td></tr>
        <tr><td>Embedding + output head</td><td class="num">1.27 B + 1.27 B</td><td>Not shared with each other</td></tr>
        <tr><td>Vision encoder / MTP head</td><td class="num">460.7 M / 424.7 M</td><td>Images to tokens / drafting ahead</td></tr>
        <tr class="sum"><td>Total parameters</td><td class="num">27.78 B</td><td>55.6 GB in bf16; about 17–19 GB at 4-bit</td></tr>
        <tr><td>Work per token</td><td class="num">≈ 51 billion ops</td><td>Counted exactly from the weight shapes (rule of thumb 2 × parameters: 55.6 billion), plus attention over the context</td></tr>
        <tr><td>KV cache</td><td class="num">64 KiB / token</td><td>Only the 16 attention layers; 2 GiB at 32k tokens</td></tr>
        <tr><td>DeltaNet state</td><td class="num">144 MiB</td><td>Fixed, no matter how long the text gets</td></tr>
        <tr><td>Context length</td><td class="num">262,144 tokens</td><td>Maximum the model can see at once</td></tr>
      </table></div>` },

    { html: `<div class="lx-prose"><h3>One token, by the numbers</h3>
      <p>Everything in this course happens for <em>every single token</em> the model writes. Counted exactly from the weight shapes, one token of Qwen3.8-27B costs:</p></div>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Part</th><th class="num">Operations per token</th><th class="num">Share</th><th>Where it goes</th></tr>
        <tr><td><span class="c-mlp">MLPs</span> (64 layers)</td><td class="num">34.2 billion</td><td class="num">67%</td><td>Three matrices of 5,120 × 17,408 per layer</td></tr>
        <tr><td><span class="c-delta">DeltaNet projections</span> (48 layers)</td><td class="num">11.1 billion</td><td class="num">22%</td><td>Making q, k, v, gates and output</td></tr>
        <tr><td><span class="c-attn">Attention projections</span> (16 layers)</td><td class="num">3.4 billion</td><td class="num">7%</td><td>Making queries, keys, values, gate and output</td></tr>
        <tr><td><span class="c-logit">Output scores</span> (<code>lm_head</code>)</td><td class="num">2.5 billion</td><td class="num">5%</td><td>One score for each of 248,320 tokens</td></tr>
        <tr class="sum"><td>All weight multiplications</td><td class="num">51.2 billion</td><td class="num">100%</td><td>The fixed cost of one token</td></tr>
        <tr><td><span class="c-delta">DeltaNet memory updates</span></td><td class="num">0.3 billion</td><td class="num"></td><td>Same at every length</td></tr>
        <tr><td><span class="c-attn">Attention over the context</span></td><td class="num">0.4 million × context</td><td class="num"></td><td>1.6 billion at 4k tokens · 12.9 billion at 32k · 51.5 billion at 128k</td></tr>
      </table></div>
      <div class="lx-prose">
      <p>And the data that must be moved for that one token:</p>
      <ul>
        <li><strong>All the weights:</strong> about 19 GB at 4-bit, read from memory once per token.</li>
        <li><strong>The KV cache:</strong> 64 KiB for every token of context, so 256 MiB at 4k tokens and 2 GiB at 32k.</li>
        <li><strong>The DeltaNet states:</strong> 144 MiB, read and written back.</li>
      </ul>
      <p>To put that in proportion:</p>
      <ul>
        <li>A person doing one multiplication per second, without breaks, would need about <strong>1,600 years</strong> to compute a single token.</li>
        <li>A 1,000-token answer is about <strong>51 trillion</strong> operations, and reads the weights a thousand times over: about <strong>19 terabytes</strong> of memory traffic.</li>
        <li>At 128,000 tokens of context, attending to the context costs as much as the entire rest of the model, even though only 16 of the 64 layers use attention. This is why the other 48 use DeltaNet.</li>
      </ul>
      <p class="c-muted">The rule of thumb "2 × parameters" gives 55.6 billion. The exact count above is lower because the embedding lookup, the vision encoder and the multi-token-prediction layer are not used for an ordinary text token.</p></div>` },

    { deep: `
      <h3>The whole forward pass in six lines</h3>
      <p>For token IDs <i>x</i><sub>1..T</sub>, with <i>E</i> the embedding table and <i>W</i><sub>out</sub> the output head:</p>
      <math display="block"><mtable columnalign="left">
        <mtr><mtd><msup><mi>H</mi><mrow><mo>(</mo><mn>0</mn><mo>)</mo></mrow></msup><mo>=</mo><mi>E</mi><mo>[</mo><msub><mi>x</mi><mrow><mn>1</mn><mo>..</mo><mi>T</mi></mrow></msub><mo>]</mo></mtd></mtr>
        <mtr><mtd><msup><mi>A</mi><mrow><mo>(</mo><mi>ℓ</mi><mo>)</mo></mrow></msup><mo>=</mo><msup><mi>H</mi><mrow><mo>(</mo><mi>ℓ</mi><mo>−</mo><mn>1</mn><mo>)</mo></mrow></msup><mo>+</mo><msub><mtext>Mix</mtext><mi>ℓ</mi></msub><mo>(</mo><mtext>RMSNorm</mtext><mo>(</mo><msup><mi>H</mi><mrow><mo>(</mo><mi>ℓ</mi><mo>−</mo><mn>1</mn><mo>)</mo></mrow></msup><mo>)</mo><mo>)</mo></mtd></mtr>
        <mtr><mtd><msup><mi>H</mi><mrow><mo>(</mo><mi>ℓ</mi><mo>)</mo></mrow></msup><mo>=</mo><msup><mi>A</mi><mrow><mo>(</mo><mi>ℓ</mi><mo>)</mo></mrow></msup><mo>+</mo><msub><mtext>MLP</mtext><mi>ℓ</mi></msub><mo>(</mo><mtext>RMSNorm</mtext><mo>(</mo><msup><mi>A</mi><mrow><mo>(</mo><mi>ℓ</mi><mo>)</mo></mrow></msup><mo>)</mo><mo>)</mo><mo>,</mo><mspace width="1em"/><mi>ℓ</mi><mo>=</mo><mn>1</mn><mo>..</mo><mn>64</mn></mtd></mtr>
        <mtr><mtd><mi mathvariant="bold">z</mi><mo>=</mo><mtext>RMSNorm</mtext><mo>(</mo><msubsup><mi>H</mi><mi>T</mi><mrow><mo>(</mo><mn>64</mn><mo>)</mo></mrow></msubsup><mo>)</mo><mspace width="0.2em"/><msub><mi>W</mi><mtext>out</mtext></msub></mtd></mtr>
        <mtr><mtd><mi mathvariant="bold">p</mi><mo>=</mo><mtext>softmax</mtext><mo>(</mo><mi mathvariant="bold">z</mi><mo>/</mo><mi>τ</mi><mo>)</mo></mtd></mtr>
        <mtr><mtd><msub><mi>x</mi><mrow><mi>T</mi><mo>+</mo><mn>1</mn></mrow></msub><mo>∼</mo><mtext>top-p</mtext><mo>(</mo><mi mathvariant="bold">p</mi><mo>)</mo></mtd></mtr>
      </mtable></math>
      <div class="lx-read">Line 1: look up the embedding row for each of the T token IDs; that stack of vectors is H<sup>(0)</sup>. Lines 2 and 3, repeated for every layer ℓ from 1 to 64: normalise and run the token mixer, add the result to the stream (A); then normalise, run the MLP, and add that too (H). Line 4: take the last token's row of the final stream, normalise it, and multiply by the output matrix to get one score z per vocabulary token. Line 5: divide by the temperature τ and apply softmax to get probabilities p. Line 6: pick the next token x<sub>T+1</sub> at random from p, after top-p has cut away the unlikely tail.</div>
      <p>Mix<sub>ℓ</sub> is Gated DeltaNet when ℓ is not a multiple of 4, and gated full attention when it is (layers 4, 8, …, 64). Only the last row of <i>H</i><sup>(64)</sup> is needed to choose the next token. During decoding, <i>T</i> = 1 and the earlier tokens are represented by the KV cache and the DeltaNet states.</p>` },

    { prose: `
      <h3>Where to go next</h3>
      <ul>
        <li><strong>Revisit the hard parts.</strong> Switch to <em>Deeper</em> mode and reread <a href="#attention">attention</a> and <a href="#deltanet">Gated DeltaNet</a>. They are the heart of the model.</li>
        <li><strong>Read a config file.</strong> Open any model's <code>config.json</code>. With this course, nearly every line in it should now make sense.</li>
        <li><strong>Watch it run.</strong> Run a model locally with token probabilities turned on, and watch temperature and top-p change the choices in real time.</li>
        <li><strong>Look up a term.</strong> The <a href="#glossary">glossary</a> spells out every abbreviation used on this page.</li>
      </ul>` },
  ],
});
