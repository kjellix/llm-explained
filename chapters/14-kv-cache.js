/* Chapter 14 — The KV cache and the DeltaNet state */
(function () {
  "use strict";
  /* ---------------------------------------------------------------- widget: KV calculator */
  LX.widget("kv-calculator", host => {
    const GiB = 2 ** 30, MiB = 2 ** 20, KiB = 1024;
    const WEIGHTS = 18.97e9;                       // Qwen3.8-27B Q4_K_M file
    const STATE = 48 * 48 * 128 * 128 * 4;          // DeltaNet state per sequence, fp32 (144 MiB)
    const REFS = [24, 32, 64, 128, 192, 512];       // GB (decimal), common memory sizes
    if (!document.getElementById("lx-kv-style")) {
      const st = document.createElement("style"); st.id = "lx-kv-style";
      st.textContent = `
        .kv-ctl select{font:500 13px var(--lx-mono);color:var(--lx-text);background:var(--lx-panel);border:1px solid var(--lx-line-2);border-radius:6px;padding:5px 8px}
        .kv-tog{display:flex;align-items:center;gap:10px;margin:12px 0;font-size:14px;color:var(--lx-text-2)}
        .kv-out{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:16px 0 10px}
        .kv-out div{background:var(--lx-panel);border:1px solid var(--lx-line);border-radius:8px;padding:8px 10px;border-top:3px solid var(--k)}
        .kv-out b{display:block;font:600 16px var(--lx-mono);color:var(--lx-text)}
        .kv-out span{font-size:12px;color:var(--lx-muted)}
        .kv-bar{position:relative;height:34px;border-radius:6px;background:var(--lx-panel);border:1px solid var(--lx-line);overflow:hidden;margin-top:44px}
        .kv-seg{position:absolute;top:0;bottom:0}
        .kv-ref{position:absolute;top:-24px;bottom:-1px;border-left:1px dashed var(--lx-muted);font:500 11px var(--lx-mono);color:var(--lx-muted);padding-left:3px;white-space:nowrap}
        .kv-ref.end{padding-left:0;transform:translateX(-100%);border-left:0;border-right:1px dashed var(--lx-muted);padding-right:3px}
        .kv-ref.end.over{border-right-color:var(--lx-logit)}
        .kv-ref.over{border-left-color:var(--lx-logit);color:var(--lx-logit)}
        .kv-note{margin-top:10px;font-size:14px;color:var(--lx-text-2)}
        @media (max-width:760px){.kv-out{grid-template-columns:repeat(2,minmax(0,1fr))}.lx-range{grid-template-columns:96px 1fr 70px}}`;
      document.head.appendChild(st);
    }
    host.innerHTML = `
      <label class="lx-range"><span>Context length</span><input type="range" min="10" max="18" step="0.01" value="15" data-k="ctx"><output></output></label>
      <label class="lx-range"><span>Conversations at once</span><input type="range" min="1" max="64" step="1" value="1" data-k="seq"><output></output></label>
      <label class="lx-range kv-ctl" style="grid-template-columns:auto 1fr"><span>Cache precision</span><select data-k="prec"><option value="2">bf16 (2 bytes)</option><option value="1">8-bit (1 byte)</option></select></label>
      <label class="kv-tog"><input type="checkbox" data-k="naive"> Compare: all 64 layers full attention, 24 key/value heads (no GQA, no DeltaNet)</label>
      <div class="kv-out"></div>
      <div class="kv-bar"></div>
      <div class="kv-note"></div>`;
    const $ = k => host.querySelector(`[data-k="${k}"]`);
    const fmt = b => b === 0 ? "none" : b >= GiB ? (b / GiB).toFixed(b >= 100 * GiB ? 0 : 2) + " GiB" : b >= MiB ? (b / MiB).toFixed(b < 10 * MiB ? 1 : 0) + " MiB" : (b / KiB).toFixed(0) + " KiB";
    function update() {
      const ctx = Math.round(2 ** +$("ctx").value), seq = +$("seq").value, bytes = +$("prec").value, naive = $("naive").checked;
      $("ctx").nextElementSibling.textContent = ctx >= 1024 ? Math.round(ctx / 1024) + "k" : ctx;
      $("seq").nextElementSibling.textContent = seq;
      const perTok = naive ? 2 * 24 * 256 * 64 * bytes : 2 * 4 * 256 * 16 * bytes;
      const kv = perTok * ctx * seq, state = naive ? 0 : STATE * seq, total = WEIGHTS + kv + state;
      host.querySelector(".kv-out").innerHTML = `
        <div style="--k:var(--lx-cache)"><b>${fmt(kv)}</b><span>KV cache (${fmt(perTok)} per token)</span></div>
        <div style="--k:var(--lx-delta)"><b>${fmt(state)}</b><span>DeltaNet state${naive ? " (none in this design)" : " (144 MiB each)"}</span></div>
        <div style="--k:var(--lx-norm)"><b>${fmt(WEIGHTS)}</b><span>weights, Q4 (≈ 19 GB)</span></div>
        <div style="--k:var(--lx-text)"><b>${fmt(total)}</b><span>total ≈ ${(total / 1e9).toFixed(total > 1e12 ? 0 : 1)} GB</span></div>`;
      const fitRef = REFS.find(r => r * 1e9 >= total);
      const scale = Math.max(total * 1.08, (fitRef || REFS[REFS.length - 1]) * 1e9 * 1.04);
      const pct = b => (b / scale * 100).toFixed(3) + "%";
      const bar = host.querySelector(".kv-bar");
      bar.style.overflow = "visible";
      bar.innerHTML =
        `<div class="kv-seg" style="left:0;width:${pct(WEIGHTS)};background:color-mix(in srgb,var(--lx-norm) 55%,var(--lx-bg))"></div>` +
        `<div class="kv-seg" style="left:${pct(WEIGHTS)};width:${pct(state)};background:color-mix(in srgb,var(--lx-delta) 70%,var(--lx-bg))"></div>` +
        `<div class="kv-seg" style="left:${pct(WEIGHTS + state)};width:${pct(kv)};background:color-mix(in srgb,var(--lx-cache) 75%,var(--lx-bg))"></div>` +
        REFS.filter(r => r * 1e9 <= scale).map((r, i, arr) => { const x = r * 1e9 / scale, prev = i ? arr[i - 1] * 1e9 / scale : -1; const lift = (i % 2 === 1 && x - prev < .3) ? "top:-42px;" : "";
          return `<div class="kv-ref${total > r * 1e9 ? " over" : ""}${x > .85 ? " end" : ""}" style="${lift}left:${pct(r * 1e9)}">${r} GB</div>`; }).join("");
      host.querySelector(".kv-note").innerHTML = fitRef
        ? `Fits in a machine with <b>${fitRef} GB</b> of memory (before the operating system and other programs take their share).`
        : `Needs <b>more than 512 GB</b>: more than any single desktop machine.`;
    }
    host.querySelectorAll("input,select").forEach(i => i.addEventListener("input", update));
    host.querySelector("select").addEventListener("change", update);
    update();
  });

  const { el, attr, mix, col, clamp } = LX;

  /* ---- real numbers, computed once ---------------------------------- */
  const ATT_LAYERS = 16, DN_LAYERS = 48, KV_HEADS = 4, HEAD = 256, BF16 = 2;
  const KV_LAYER = KV_HEADS * HEAD * 2 * BF16;            // 4,096 B per token per attention layer
  const KV_TOKEN = KV_LAYER * ATT_LAYERS;                 // 65,536 B per token
  const KV_ALL64 = KV_LAYER * 64;                         // 262,144 B (all layers attention, GQA)
  const KV_MHA = 64 * 2 * 24 * HEAD * BF16;               // 1,572,864 B (no GQA)
  const DN_STATE = DN_LAYERS * 48 * 128 * 128 * 4;        // 150,994,944 B = 144 MiB
  const MAXCTX = 262144;
  const KiB = 1024, MiB = 1024 ** 2, GiB = 1024 ** 3;
  const fmtB = b => b >= GiB ? (b / GiB).toFixed(b / GiB < 10 ? 2 : 1).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1") + " GiB"
    : b >= MiB ? (b / MiB).toFixed(b / MiB < 10 ? 1 : 0).replace(/\.0$/, "") + " MiB"
    : Math.round(b / KiB) + " KiB";
  const fmtN = n => Math.round(n).toLocaleString("en-US");
  const bump = (x, w = 1) => clamp(1 - Math.abs(x) / w);

  /* ================================================================ kv-grow */
  function buildGrow(ctx) {
    const D = LX.draw, svg = ctx.svg;
    D.backdrop(svg);
    const title = D.label(svg, 800, 70, "what is kept between steps", { anchor: "middle", size: 15, color: "text-2" });

    /* left: 16 attention layers with orange shelves */
    const L = el("g", {}, svg);
    D.label(L, 80, 128, "16 attention layers · KV cache", { color: "attn" });
    const RX = 80, RW = 92, RH = 24, RG = 9.5, Y0 = 158, SX = 192, SW = 548;
    const rows = [];
    for (let i = 0; i < ATT_LAYERS; i++) {
      const y = Y0 + (ATT_LAYERS - 1 - i) * (RH + RG);
      const slab = D.block(L, { x: RX, y, w: RW, h: RH, kind: "attn", strong: true });
      D.text(L, RX + RW / 2, y + 16.5, "attn " + (i + 1), { mono: true, size: 12.5, anchor: "middle", color: "text" });
      el("rect", { x: SX, y: y + 2, width: SW, height: RH - 4, rx: 3, fill: "none", stroke: col("line-2"), "stroke-dasharray": "3 4" }, L);
      const tiles = [];
      for (let k = 0; k < 12; k++) {
        const tg = el("g", { opacity: 0 }, L);
        el("rect", { x: SX + 4 + k * 45, y: y + 4, width: 19, height: RH - 8, rx: 2, fill: col("cache") }, tg);
        el("rect", { x: SX + 25 + k * 45, y: y + 4, width: 19, height: RH - 8, rx: 2, fill: mix("cache", "text", .35) }, tg);
        tiles.push(tg);
      }
      const bar = el("rect", { x: SX + 2, y: y + 4, width: 0, height: RH - 8, rx: 2, fill: col("cache"), opacity: 0 }, L);
      rows.push({ y, slab, tiles, bar });
    }
    // K / V legend on the top row
    const kvLab = el("g", { opacity: 0 }, L);
    const ty = rows[ATT_LAYERS - 1].y;
    D.text(kvLab, SX + 13.5, ty - 6, "K", { mono: true, size: 14, anchor: "middle", color: "cache", weight: 600 });
    D.text(kvLab, SX + 34.5, ty - 6, "V", { mono: true, size: 14, anchor: "middle", color: "cache", weight: 600 });
    // context ticks for the continuous phase
    const ticks = el("g", { opacity: 0 }, L);
    const baseY = rows[0].y + RH + 18;
    [[4096, "4k"], [32768, "32k"], [131072, "128k"], [262144, "262k"]].forEach(([n, lab]) => {
      const x = SX + 2 + (SW - 4) * n / MAXCTX;
      el("line", { x1: x, y1: rows[ATT_LAYERS - 1].y, x2: x, y2: baseY - 12, stroke: col("dim"), "stroke-dasharray": "2 4" }, ticks);
      D.text(ticks, x, baseY + 4, lab, { mono: true, size: 13, anchor: "middle", color: "muted" });
    });
    // travelling token (the newest one)
    const dot = el("circle", { r: 7, cx: RX + RW / 2, cy: 0, fill: col("token"), filter: "url(#lx-glow)", opacity: 0 }, L);
    // left meter
    const mL = el("g", {}, svg);
    el("rect", { x: 80, y: 760, width: 660, height: 92, rx: 8, fill: col("panel"), stroke: col("cache"), "stroke-width": 1.5 }, mL);
    D.label(mL, 100, 788, "KV cache · grows with every token", { color: "cache" });
    const mLv = D.text(mL, 100, 832, "0 KiB", { mono: true, size: 34, weight: 600, color: "text" });
    const mLn = D.text(mL, 720, 832, "0 tokens", { mono: true, size: 18, color: "muted", anchor: "end" });

    /* size callout */
    const call = el("g", { opacity: 0 }, svg);
    el("rect", { x: 330, y: 330, width: 420, height: 62, rx: 6, fill: col("bg-2"), stroke: col("line-2") }, call);
    D.text(call, 346, 354, `${KV_HEADS} heads × ${HEAD} × 2 (K, V) × ${BF16} B = ${fmtN(KV_LAYER)} B = ${KV_LAYER / KiB} KiB`, { mono: true, size: 13.5, color: "text" });
    D.text(call, 346, 378, `× ${ATT_LAYERS} layers = ${fmtN(KV_TOKEN)} B = ${KV_TOKEN / KiB} KiB per token`, { mono: true, size: 13.5, color: "cache" });

    /* right: 48 DeltaNet layers, fixed grids */
    const R = el("g", {}, svg);
    D.label(R, 860, 128, "48 DeltaNet layers · fixed state", { color: "delta" });
    const GX = 860, GY = 158, C = 5, CS = 11, CG = 1.5, SQ = C * (CS + CG), COLS = 8, GAPX = 80 - SQ + 4, GAPY = 98 - SQ;
    const R0 = LX.rng(1414);
    const squares = [];
    for (let i = 0; i < DN_LAYERS; i++) {
      const cx = GX + (i % COLS) * (SQ + GAPX), cy = GY + Math.floor(i / COLS) * (SQ + GAPY);
      el("rect", { x: cx - 4, y: cy - 4, width: SQ + 6, height: SQ + 6, rx: 4, fill: "none", stroke: col("delta"), "stroke-width": 1.2 }, R);
      const cells = [];
      for (let r = 0; r < C; r++) for (let c = 0; c < C; c++) {
        cells.push({ n: el("rect", { x: cx + c * (CS + CG), y: cy + r * (CS + CG), width: CS, height: CS, rx: 1.5, fill: col("zero") }, R), ph: R0() * 6.283, f: .6 + R0() * 1.4 });
      }
      squares.push({ cells });
    }
    D.text(R, GX, GY + 6 * (SQ + GAPY) + 2, "each square: one layer's memory (48 heads × 128 × 128, shown as 5 × 5)", { size: 14, color: "muted" });
    const mR = el("g", {}, svg);
    el("rect", { x: 860, y: 760, width: 660, height: 92, rx: 8, fill: col("panel"), stroke: col("delta"), "stroke-width": 1.5 }, mR);
    D.label(mR, 880, 788, "DeltaNet state · never grows", { color: "delta" });
    const mRv = D.text(mR, 880, 832, fmtB(DN_STATE), { mono: true, size: 34, weight: 600, color: "text" });
    const mRs = D.text(mR, 1500, 832, `48 × 48 × 128 × 128 × 4 B`, { mono: true, size: 16, color: "muted", anchor: "end" });
    const divider = el("line", { x1: 800, y1: 120, x2: 800, y2: 740, stroke: col("line-2"), "stroke-dasharray": "4 6" }, svg);

    /* token count over time */
    function tokens(t) {
      if (t < ctx.cue("kv").start) return 0;
      if (t < ctx.cue("grow").start) {
        // discrete: 1 token in kv, up to 3 in size
        return 1 + Math.floor(ctx.p(t, "size", .3, 1, LX.ease.linear) * 2.999);
      }
      const g = ctx.p(t, "grow", .02, .92, LX.ease.inOut);
      return Math.round(Math.exp(Math.log(3) + g * (Math.log(MAXCTX) - Math.log(3))));
    }

    return t => {
      const a = ctx.p(t, "why", 0, .35);
      [title, L, mL].forEach(g => D.fade(g, a));
      D.fade(R, ctx.p(t, "why", .1, .45)); D.fade(mR, ctx.p(t, "why", .1, .45)); D.fade(divider, a);
      const n = tokens(t);
      // discrete tiles vs continuous bar
      const cont = ctx.p(t, "grow", .05, .3);
      rows.forEach((r, i) => {
        r.tiles.forEach((tg, k) => {
          let o = 0;
          if (k === 0) o = ctx.p(t, "kv", .25 + i * .03, .4 + i * .03);
          else if (k < n && n <= 12) o = 1;
          else if (n > 12 && k < 12) o = 1;
          tg.setAttribute("opacity", o * (1 - cont));
        });
        const w = (SW - 4) * Math.min(1, n / MAXCTX);
        attr(r.bar, { width: Math.max(cont > 0 ? 2 : 0, w), opacity: cont });
        r.slab.pulse(bump((t - ctx.cue("kv").start) / ctx.cue("kv").dur * 6 - 1.2 - i * .18, .5) * (t < ctx.cue("size").start ? 1 : 0));
      });
      D.fade(kvLab, ctx.p(t, "kv", .5, .65) * (1 - cont));
      D.fade(ticks, cont);
      // travelling dot in the kv cue
      const dp = ctx.p(t, "kv", .05, .7, LX.ease.inOut);
      if (dp > 0 && dp < 1) attr(dot, { cy: rows[0].y + RH / 2 - dp * (rows[0].y - rows[ATT_LAYERS - 1].y), opacity: 1 });
      else dot.setAttribute("opacity", 0);
      D.fade(call, ctx.p(t, "size", 0, .2) * (1 - ctx.p(t, "grow", 0, .15)));
      mLv.textContent = n === 0 ? "0 KiB" : fmtB(n * KV_TOKEN);
      mLn.textContent = fmtN(n) + (n === 1 ? " token" : " tokens");
      // DeltaNet grids shimmer per token step (state cue onwards, and while tokens stream)
      const live = ctx.p(t, "state", 0, .2);
      const step = Math.floor(Math.log2(n + 1) * 3);
      squares.forEach((sq, i) => sq.cells.forEach((c, j) => {
        const v = live > 0 ? Math.sin(c.ph + step * c.f + i * .37) * (.35 + .5 * live) : 0;
        c.n.setAttribute("fill", LX.valueColor(v));
      }));
      // fixed: emphasise both meters
      const fx = ctx.p(t, "fixed", 0, .3);
      mRv.setAttribute("fill", fx > 0 ? mix("text", "delta", fx * .6) : col("text"));
      mRs.setAttribute("opacity", .6 + .4 * fx);
    };
  }

  /* ======================================================= kv-memory-chart */
  function buildChart(ctx) {
    const D = LX.draw, svg = ctx.svg;
    D.backdrop(svg);
    // main chart (linear, 0..400 GiB)
    const X0 = 170, X1 = 1060, Y0 = 760, Y1 = 150, YMAX = 400;
    const xs = n => X0 + (X1 - X0) * n / MAXCTX;
    const ys = g => Y0 - (Y0 - Y1) * g / YMAX;
    const ax = el("g", {}, svg);
    el("line", { x1: X0, y1: Y0, x2: X1 + 10, y2: Y0, stroke: col("text-2"), "stroke-width": 1.5 }, ax);
    el("line", { x1: X0, y1: Y0, x2: X0, y2: Y1 - 10, stroke: col("text-2"), "stroke-width": 1.5 }, ax);
    [0, 50000, 100000, 150000, 200000, 250000].forEach(n => {
      el("line", { x1: xs(n), y1: Y0, x2: xs(n), y2: Y0 + 6, stroke: col("text-2") }, ax);
      D.text(ax, xs(n), Y0 + 28, n === 0 ? "0" : n / 1000 + "k", { mono: true, size: 14, anchor: "middle", color: "muted" });
    });
    el("line", { x1: xs(MAXCTX), y1: Y0 - 4, x2: xs(MAXCTX), y2: Y0 + 10, stroke: col("cache"), "stroke-width": 2 }, ax);
    D.text(ax, xs(MAXCTX), Y0 + 46, "262k max", { mono: true, size: 13, anchor: "middle", color: "cache" });
    [0, 100, 200, 300, 400].forEach(g => {
      el("line", { x1: X0 - 6, y1: ys(g), x2: X1, y2: ys(g), stroke: g ? col("grid-2") : "none" }, ax);
      D.text(ax, X0 - 12, ys(g) + 5, g + "", { mono: true, size: 14, anchor: "end", color: "muted" });
    });
    D.text(ax, (X0 + X1) / 2, Y0 + 62, "context length (tokens)", { size: 16, anchor: "middle", color: "text-2" });
    D.text(ax, X0 - 12, Y1 - 28, "memory for the conversation (GiB)", { size: 16, color: "text-2" });
    D.label(ax, 80, 70, "memory against context length · bf16", { size: 15 });

    function line(bytesPerTok, colorName, constant = 0, scaleX = xs, scaleY = ys, parent = svg, maxG = YMAX) {
      const pts = [];
      for (let k = 0; k <= 64; k++) {
        const n = MAXCTX * k / 64, g = Math.min(maxG, (n * bytesPerTok + constant) / GiB);
        pts.push(`${scaleX(n).toFixed(1)},${scaleY(g).toFixed(1)}`);
      }
      const p = el("polyline", { points: pts.join(" "), fill: "none", stroke: col(colorName), "stroke-width": 3, "stroke-linejoin": "round" }, parent);
      const len = p.getTotalLength();
      attr(p, { "stroke-dasharray": `${len} ${len}`, "stroke-dashoffset": len });
      return { p, draw: q => p.setAttribute("stroke-dashoffset", len * (1 - q)) };
    }
    const gAt = b => MAXCTX * b / GiB;
    const lNaive = line(KV_MHA, "logit"), lGqa = line(KV_ALL64, "attn"), lQwen = line(KV_TOKEN, "cache"), lDelta = line(0, "delta", DN_STATE);
    const lab = (x, y, a, b, c) => { const g = el("g", { opacity: 0 }, svg); D.text(g, x, y, a, { size: 17, weight: 600, color: c }); D.text(g, x, y + 22, b, { mono: true, size: 14, color: "muted" }); return g; };
    const tNaive = lab(xs(MAXCTX) + 14, ys(gAt(KV_MHA)) + 4, `${fmtB(MAXCTX * KV_MHA)}`, `64 layers · 24 KV heads · ${fmtB(KV_MHA)}/token`, "logit");
    const tGqa = lab(xs(MAXCTX) + 14, ys(gAt(KV_ALL64)) - 4, `${fmtB(MAXCTX * KV_ALL64)}`, `64 layers · 4 KV heads · ${fmtB(KV_ALL64)}/token`, "attn");
    const gqaTag = el("g", { opacity: 0 }, svg);
    el("rect", { x: xs(180000) - 46, y: ys(200) - 20, width: 92, height: 30, rx: 15, fill: col("bg-2"), stroke: col("attn") }, gqaTag);
    D.text(gqaTag, xs(180000), ys(200) + 1, "GQA ÷ 6", { mono: true, size: 14, anchor: "middle", color: "attn" });
    // inset: 0..20 GiB for the bottom lines
    const IX0 = 290, IX1 = 640, IY0 = 430, IY1 = 200, IMAX = 20;
    const ixs = n => IX0 + (IX1 - IX0) * n / MAXCTX, iys = g => IY0 - (IY0 - IY1) * g / IMAX;
    const inset = el("g", { opacity: 0 }, svg);
    el("rect", { x: IX0 - 50, y: IY1 - 52, width: IX1 - IX0 + 70, height: IY0 - IY1 + 90, rx: 8, fill: col("bg-2"), stroke: col("line-2") }, inset);
    D.label(inset, IX0 - 34, IY1 - 26, "zoom · 0 – 20 GiB", { size: 13 });
    el("line", { x1: IX0, y1: IY0, x2: IX1, y2: IY0, stroke: col("text-2") }, inset);
    el("line", { x1: IX0, y1: IY0, x2: IX0, y2: IY1, stroke: col("text-2") }, inset);
    [0, 10, 20].forEach(g => { D.text(inset, IX0 - 8, iys(g) + 5, g + "", { mono: true, size: 13, anchor: "end", color: "muted" }); if (g) el("line", { x1: IX0, y1: iys(g), x2: IX1, y2: iys(g), stroke: col("grid-2") }, inset); });
    [[0, "0"], [131072, "131k"], [262144, "262k"]].forEach(([n, l]) => D.text(inset, ixs(n), IY0 + 20, l, { mono: true, size: 13, anchor: "middle", color: "muted" }));
    // weights reference band (~19 GB at Q4 = 17.7 GiB)
    const wG = 18.97e9 / GiB;
    el("line", { x1: IX0, y1: iys(wG), x2: IX1, y2: iys(wG), stroke: col("norm"), "stroke-dasharray": "6 5" }, inset);
    D.text(inset, IX0 + 6, iys(wG) - 7, `for scale: model weights at Q4 ≈ ${wG.toFixed(1)} GiB`, { size: 13, color: "norm" });
    const iQwen = line(KV_TOKEN, "cache", 0, ixs, iys, inset, IMAX), iDelta = line(0, "delta", DN_STATE, ixs, iys, inset, IMAX);
    const zoomBox = el("g", { opacity: 0 }, svg);
    el("rect", { x: X0, y: ys(20), width: X1 - X0, height: Y0 - ys(20), fill: "none", stroke: col("muted"), "stroke-dasharray": "3 4" }, zoomBox);
    el("path", { d: `M${X0 + 30} ${ys(20)} L${IX0 - 50 + 20} ${IY0 + 38}`, stroke: col("muted"), "stroke-dasharray": "3 4", fill: "none" }, zoomBox);
    const tQwen = el("g", { opacity: 0 }, svg);
    D.text(tQwen, IX0 + 10, iys(15), `Qwen3.8 · ${fmtB(MAXCTX * KV_TOKEN)} at 262k`, { size: 16, weight: 600, color: "cache" });
    D.text(tQwen, IX0 + 10, iys(15) + 19, `16 layers · ${fmtB(KV_TOKEN)}/token · ÷ 4`, { mono: true, size: 13, color: "muted" });
    const tDelta = el("g", { opacity: 0 }, svg);
    D.text(tDelta, IX1 - 4, iys(DN_STATE / GiB) - 10, `DeltaNet state · ${fmtB(DN_STATE)} · constant`, { size: 15, weight: 600, color: "delta", anchor: "end" });
    const tDeltaMain = el("g", { opacity: 0 }, svg);
    D.text(tDeltaMain, X1 - 6, Y0 - 44, "DeltaNet state: flat, too small to see at this scale", { size: 14, color: "delta", anchor: "end" });
    const tag4 = el("g", { opacity: 0 }, svg);
    D.text(tag4, xs(200000), ys(gAt(KV_TOKEN) * 200000 / MAXCTX * 0 + 200000 * KV_TOKEN / GiB) - 12, "÷ 4", { mono: true, size: 15, color: "cache", anchor: "middle" });

    return t => {
      D.fade(ax, ctx.p(t, "axes", 0, .4));
      lNaive.draw(ctx.p(t, "naive", .05, .7, LX.ease.inOut)); D.fade(tNaive, ctx.p(t, "naive", .6, .85));
      lGqa.draw(ctx.p(t, "gqa", .05, .65, LX.ease.inOut)); D.fade(tGqa, ctx.p(t, "gqa", .55, .8)); D.fade(gqaTag, ctx.p(t, "gqa", .6, .85));
      lQwen.draw(ctx.p(t, "qwen", .05, .5, LX.ease.inOut)); D.fade(tag4, 0);
      D.fade(zoomBox, ctx.p(t, "qwen", .45, .6) * .8);
      D.fade(inset, ctx.p(t, "qwen", .5, .7)); iQwen.draw(ctx.p(t, "qwen", .6, .95, LX.ease.inOut)); D.fade(tQwen, ctx.p(t, "qwen", .85, 1));
      lDelta.draw(ctx.p(t, "delta", .05, .5)); iDelta.draw(ctx.p(t, "delta", .1, .6, LX.ease.inOut));
      D.fade(tDelta, ctx.p(t, "delta", .5, .7)); D.fade(tDeltaMain, ctx.p(t, "delta", .4, .6));
    };
  }

LX.chapter({
  id: "kv-cache", num: 14, title: "The KV cache and the DeltaNet state", toc: "KV cache",
  kicker: "The model's short-term memory",
  lede: "Writing one token at a time only works because the model keeps notes about everything it has already read. In Qwen3.8 those notes come in two very different forms: a cache that grows, and a state that never does.",
  body: [
    { prose: `
      <p>Chapter 13 showed that during decode only the newest token passes through the layers. For that to work, everything later tokens need from earlier tokens must be kept somewhere. That "somewhere" is the model's short-term memory for this one conversation. It lives in fast memory next to the weights, it is built during prefill, and it grows or updates with every token written.</p>

      <h3>What the attention layers keep: keys and values</h3>
      <p>In a full-attention layer (Chapter 7), every token produces a query, a key and a value. A new token's <em>query</em> is only needed once, at the moment it looks back. Its <em>key</em> and <em>value</em> are needed by every token that comes after it. So each attention layer stores the key and value of every token so far. That store is the <abbr>KV</abbr> cache.</p>
      <p>Thanks to <abbr>GQA</abbr>, Qwen3.8's 24 query heads share just 4 key/value heads, so only 4 keys and 4 values of 256 numbers each are stored per token per layer:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Factor</th><th class="num">Value</th></tr>
        <tr><td>KV heads per layer</td><td class="num">4</td></tr>
        <tr><td>Numbers per head</td><td class="num">256</td></tr>
        <tr><td>Key and value</td><td class="num">× 2</td></tr>
        <tr><td>Bytes per number (<abbr>bf16</abbr>)</td><td class="num">× 2</td></tr>
        <tr><td><strong>Per token, per attention layer</strong></td><td class="num">4,096 bytes = 4 <abbr>KiB</abbr></td></tr>
        <tr><td>Full-attention layers</td><td class="num">× 16</td></tr>
        <tr class="sum"><td>Per token, whole model</td><td class="num">65,536 bytes = 64 KiB</td></tr>
      </table></div>
      <p>That sounds small until you multiply it by the context length:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Context length (tokens)</th><th class="num">KV cache (bf16)</th></tr>
        <tr><td>4,096</td><td class="num">0.25 <abbr>GiB</abbr></td></tr>
        <tr><td>32,768</td><td class="num">2 GiB</td></tr>
        <tr><td>131,072</td><td class="num">8 GiB</td></tr>
        <tr><td>262,144 (maximum)</td><td class="num">16 GiB</td></tr>
      </table></div>` },

    { scene: {
      id: "kv-grow", build: buildGrow, title: "A cache that grows, a state that doesn't",
      visual: "Left half: the 16 attention layers as violet slabs, each with a dashed orange shelf. The newest token (an amber dot) climbs the slabs and leaves a K and a V tile on every shelf; then tokens stream in and the tiles merge into bars that stretch towards a 262k mark. An orange meter counts tokens and cache size (computed: 64 KiB per token). Right half: 48 blue squares, one per DeltaNet layer, each a 5 × 5 stand-in for its memory grid; once tokens flow the cells change colour every step but the squares never grow. The blue meter stays at 144 MiB (48 × 48 × 128 × 128 × 4 B).",
      cues: [
        { id: "why",   say: "During decode, only the newest token goes through the model. So everything later tokens need from earlier ones has to be kept. That is the model's short-term memory for this conversation.", vis: "Both halves fade in, empty: 16 attention slabs with shelves, 48 DeltaNet squares, two meters. Title: 'what is kept between steps'." },
        { id: "kv",    say: "In each of the sixteen attention layers, every token leaves behind its key and its value. Later tokens will need them to look back. They are stored in the K V cache, short for key value cache.", vis: "An amber dot climbs the 16 attention slabs, each lighting up; a K tile and a V tile land on every shelf. Meter: 64 KiB · 1 token." },
        { id: "size",  say: "With grouped-query attention, that is four keys and four values of two hundred and fifty-six numbers each, per layer. Sixty-four kilobytes per token for the whole model.", vis: "Callout: 4 heads × 256 × 2 (K, V) × 2 B = 4,096 B = 4 KiB per layer; × 16 layers = 65,536 B = 64 KiB per token. Two more tokens add tiles; meter 192 KiB · 3 tokens." },
        { id: "grow",  say: "And it grows with every token. Thirty-two thousand tokens of conversation fill two gigabytes. The maximum context of two hundred and sixty-two thousand tokens needs sixteen.", vis: "Tiles merge into bars that stretch past the 4k, 32k and 128k marks to 262k; meter counts up: 0.25 GiB at 4k, 2 GiB at 32k, 16 GiB at 262,144 tokens." },
        { id: "state", say: "The forty-eight DeltaNet layers keep something different: a fixed-size memory, a grid of numbers for each head. Each new token updates the grid, but the grid never gets bigger.", vis: "Right half: the 48 squares fill with colour that changes every step, but each square keeps its size." },
        { id: "fixed", say: "Together these states take one hundred and forty-four megabytes, whether the conversation is ten tokens long or two hundred thousand.", vis: "Final frame: left meter 16 GiB at 262,144 tokens, right meter still 144 MiB, highlighted." },
      ],
    } },

    { prose: `
      <h3>What the DeltaNet layers keep: a fixed-size state</h3>
      <p>A Gated DeltaNet layer (Chapter 8) does not store anything per token. Instead it keeps a <strong>memory matrix</strong> for each of its 48 value heads, a 128 × 128 grid of numbers. Each new token writes a little into this grid and reads from it. The grids are kept in 32-bit precision, because they are updated thousands of times and rounding errors would pile up:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Factor</th><th class="num">Value</th></tr>
        <tr><td>Value heads per layer</td><td class="num">48</td></tr>
        <tr><td>State per head</td><td class="num">128 × 128 = 16,384 numbers</td></tr>
        <tr><td>Bytes per number (<abbr>fp32</abbr>)</td><td class="num">× 4</td></tr>
        <tr><td><strong>Per layer</strong></td><td class="num">3 <abbr>MiB</abbr></td></tr>
        <tr><td>DeltaNet layers</td><td class="num">× 48</td></tr>
        <tr class="sum"><td>Whole model, any context length</td><td class="num">144 MiB</td></tr>
      </table></div>
      <p>There is also a tiny extra: each DeltaNet layer runs a short convolution over its last 4 inputs, so it remembers the previous 3 inputs of its 10,240-wide query/key/value projection. That is under 3 MiB for all 48 layers, and also constant.</p>

      <h3>Why the hybrid design pays off</h3>
      <p>Imagine the same model with all 64 layers as full attention (same 4 KV heads). The cache would be 4× larger: 256 KiB per token, 64 GiB at the maximum context. Drop <abbr>GQA</abbr> as well, with 24 key/value heads like the query heads, and it grows 6× more again. Qwen3.8 gets its long context cheaply because only 1 layer in 4 has a growing cache.</p>
      <p>The trade-off is that a fixed-size memory cannot hold everything perfectly. DeltaNet layers remember a compressed summary. The 16 attention layers in between can still look back at any exact earlier token when precise recall is needed.</p>` },

    { scene: {
      id: "kv-memory-chart", build: buildChart, title: "Memory against context length",
      visual: "A linear line chart: x = context length (0 → 262k tokens, max marked), y = memory 0 → 400 GiB. Lines drawn one after another, all computed from bytes per token: (1) hypothetical 64 attention layers without GQA, 1.5 MiB/token → 384 GiB; (2) 64 layers with GQA, 256 KiB/token → 64 GiB, tag 'GQA ÷ 6'; (3) Qwen3.8's real cache, 64 KiB/token → 16 GiB; (4) the DeltaNet state, flat at 144 MiB. A dashed box marks the 0–20 GiB strip, magnified in an inset (upper left) that also shows the model weights at Q4 (≈ 17.7 GiB) for scale.",
      cues: [
        { id: "axes",  say: "Here is the memory needed for the conversation itself, not the model, as the context grows.", vis: "Axes draw: context length 0 to 262k tokens, memory 0 to 400 GiB." },
        { id: "naive", say: "If every one of the sixty-four layers were full attention, with a separate key and value for each of the twenty-four heads, the cache would need one and a half megabytes per token. At the full context, three hundred and eighty-four gigabytes.", vis: "Steep line to 384 GiB at 262k: '64 layers · 24 KV heads · 1.5 MiB/token'." },
        { id: "gqa",   say: "Sharing keys and values between groups of six heads, grouped-query attention, cuts that by six.", vis: "Second line to 64 GiB at 262k: '64 layers · 4 KV heads · 256 KiB/token'. Label 'GQA ÷6'." },
        { id: "qwen",  say: "Qwen 3.8 keeps a growing cache in only sixteen of its layers. Sixteen gigabytes at the full context, a quarter of the line above.", vis: "Third line (orange) to 16 GiB along the bottom; the 0–20 GiB strip is boxed and magnified in an inset: 'Qwen3.8 · 16 GiB at 262k · 16 layers · 64 KiB/token · ÷ 4', with the Q4 model weights (≈ 17.7 GiB) dashed for scale." },
        { id: "delta", say: "And the forty-eight DeltaNet layers add a flat one hundred and forty-four megabytes, no matter how long the text gets.", vis: "Flat blue line at 144 MiB in the inset: 'DeltaNet state · 144 MiB · constant'; on the main chart: 'flat, too small to see at this scale'." },
      ],
    } },

    { widget: {
      id: "kv-calculator", title: "Context memory calculator",
      sub: "Drag the sliders to see how much memory the conversation needs next to the model itself. Reference lines mark common memory sizes.",
    } },

    { prose: `
      <h3>Making the cache smaller: quantization</h3>
      <p>Just like the weights, the cache can be stored with fewer bits. An 8-bit KV cache halves the memory (32 KiB per token) with almost no quality loss. A 4-bit cache quarters it, but the loss becomes measurable on long, precise tasks. The cache is read at every decode step, so a smaller cache also makes long-context decoding faster.</p>

      <h3>Reusing the cache: prompt caching</h3>
      <p>The cache depends only on the tokens that produced it. If a new request starts with exactly the same tokens as an earlier one, such as the same system prompt or the same conversation so far, the server can <strong>reuse</strong> the saved cache and DeltaNet states for that prefix. Then it only needs to prefill the new tokens. This is why the second message in a long chat often starts answering much faster than the first, and why many services charge less for "cached" input tokens. Change one token early on, and everything after it must be recomputed, because every later key and value depended on it.</p>
      <p>Keeping a cache costs memory, not time. A saved 20,000-token prefix for Qwen3.8 is 1.22 <abbr>GiB</abbr> of keys and values. Reloading it is a matter of reading that gigabyte, against about 1.2 million billion operations to compute it again (<a href="#prefill-decode">Chapter 13</a>). Servers therefore keep caches in fast memory as long as they can, and some spill them to SSD.</p>
      <p class="c-muted">For DeltaNet layers, reuse is less flexible. The KV cache of an attention layer can be cut at any token, because every position has its own keys and values. A DeltaNet state is a single summary of everything up to one exact position, and it cannot be rewound. A server must therefore save <em>snapshots</em> of all 48 states (144 <abbr>MiB</abbr> each time) at useful points, such as the end of the system prompt and the end of each turn. If the text changes after a snapshot, prefill restarts from the last snapshot before the change.</p>` },

    { deep: `
      <h3>KV cache size</h3>
      <p>For a model with <i>L</i><sub>attn</sub> full-attention layers, <i>H</i><sub>kv</sub> key/value heads of dimension <i>d</i><sub>h</sub>, <i>b</i> bytes per number and context length <i>N</i>:</p>
      <math display="block"><mrow><msub><mi>M</mi><mtext>KV</mtext></msub><mo>=</mo><mn>2</mn><mo>·</mo><msub><mi>L</mi><mtext>attn</mtext></msub><mo>·</mo><msub><mi>H</mi><mtext>kv</mtext></msub><mo>·</mo><msub><mi>d</mi><mi>h</mi></msub><mo>·</mo><mi>b</mi><mo>·</mo><mi>N</mi></mrow></math>
      <div class="lx-read">Multiply together: 2 (one key and one value), the number of full-attention layers, the number of key/value heads, the size of each head, the bytes per number, and the number of tokens of context N. M<sub>KV</sub> is the total cache memory. For Qwen3.8: 2 × 16 × 4 × 256 × 2 bytes = 65,536 bytes (64 KiB) per token, so 1,000 tokens need 64 MiB.</div>
      <p>Qwen3.8-27B: 2 · 16 · 4 · 256 · 2 B = 65,536 B per token. At <i>N</i> = 262,144 that is 2<sup>16</sup> · 2<sup>18</sup> = 2<sup>34</sup> B = 16 GiB. Serving many users multiplies this by the number of active conversations, which is why cache memory, not weight memory, usually limits how many users one server can handle.</p>
      <h3>DeltaNet state size</h3>
      <math display="block"><mrow><msub><mi>M</mi><mtext>state</mtext></msub><mo>=</mo><msub><mi>L</mi><mtext>delta</mtext></msub><mo>·</mo><msub><mi>H</mi><mi>v</mi></msub><mo>·</mo><msub><mi>d</mi><mi>k</mi></msub><mo>·</mo><msub><mi>d</mi><mi>v</mi></msub><mo>·</mo><mn>4</mn><mtext> B</mtext><mo>=</mo><mn>48</mn><mo>·</mo><mn>48</mn><mo>·</mo><mn>128</mn><mo>·</mo><mn>128</mn><mo>·</mo><mn>4</mn><mo>=</mo><mn>150,994,944</mn><mtext> B</mtext><mo>=</mo><mn>144</mn><mtext> MiB</mtext></mrow></math>
      <div class="lx-read">Multiply the number of DeltaNet layers (48) by the number of value heads per layer (48), by the size of each head's memory matrix (128 × 128 numbers), by 4 bytes per number. M<sub>state</sub> is the total recurrent memory: 150,994,944 bytes, exactly 144 MiB. There is no N anywhere in the formula, so it stays the same however long the conversation gets.</div>
      <p>Plus the convolution state: 48 layers · 3 previous inputs · 10,240 channels (2,048 query + 2,048 key + 6,144 value). That is about 1.4 M numbers, under 3 MiB in bf16. Both are independent of <i>N</i>.</p>
      <h3>Cost of reading the cache per decode step</h3>
      <p>At each step, every attention layer reads the full K and V for all <i>N</i> earlier tokens. Bytes read per step from the cache = <i>M</i><sub>KV</sub>(<i>N</i>). At 32,768 tokens that is 2 GiB per token, on top of about 19 GB of Q4 weights. That is roughly a 10 % slowdown compared with an empty context. At 131,072 tokens it is 8 GiB, roughly 45 % more bytes per step. A model with all 64 layers as attention would read four times as much.</p>
      <h3>Why GQA shrinks the cache but not the quality (much)</h3>
      <p>With 24 query heads and 4 KV heads, each KV head serves a group of 6 query heads. The queries keep their full diversity, since they are computed fresh per token and never cached, while the cached keys and values are shared. Training adapts the model to that sharing. The cache shrinks by 24 / 4 = 6×.</p>` },
  ],
});
})();
