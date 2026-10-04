/* Chapter 10 — Qwen3.8-27B, layer by layer */
(function () {
  "use strict";
  /* ---------------------------------------------------------------- widget: layer map */
  LX.widget("layer-map", host => {
    const H = 5120, V = 248320, I = 17408;
    const T = (name, shape) => ({ name, shape, n: shape.reduce((a, b) => a * b, 1) });
    const fmtN0 = n => n.toLocaleString("en-US");
    const mlp = [T("mlp.gate_proj", [I, H]), T("mlp.up_proj", [I, H]), T("mlp.down_proj", [H, I])];
    const deltaT = [
      T("input_layernorm", [H]),
      T("linear_attn.in_proj_qkv", [10240, H]), T("linear_attn.in_proj_z", [6144, H]),
      T("linear_attn.in_proj_a", [48, H]), T("linear_attn.in_proj_b", [48, H]),
      T("linear_attn.conv1d", [10240, 1, 4]), T("linear_attn.A_log", [48]), T("linear_attn.dt_bias", [48]),
      T("linear_attn.norm", [128]), T("linear_attn.out_proj", [H, 6144]),
      T("post_attention_layernorm", [H]), ...mlp];
    const attnT = [
      T("input_layernorm", [H]),
      T("self_attn.q_proj (queries + gate)", [12288, H]), T("self_attn.k_proj", [1024, H]), T("self_attn.v_proj", [1024, H]),
      T("self_attn.q_norm", [256]), T("self_attn.k_norm", [256]), T("self_attn.o_proj", [H, 6144]),
      T("post_attention_layernorm", [H]), ...mlp];
    const TB = (name, shape, bias) => ({ name, shape, bias, n: shape.reduce((a, b) => a * b, 1) + bias });
    const vblock = [TB("norm1", [1152], 1152), TB("attn.qkv", [3456, 1152], 3456), TB("attn.proj", [1152, 1152], 1152),
      TB("norm2", [1152], 1152), TB("mlp.linear_fc1", [4304, 1152], 4304), TB("mlp.linear_fc2", [1152, 4304], 1152)];
    const vblockN = vblock.reduce((a, t) => a + t.n, 0);
    const visionT = [
      TB("patch_embed.proj", [1152, 3, 2, 16, 16], 1152), T("pos_embed (48 × 48 grid)", [2304, 1152]),
      { name: "27 encoder blocks", shape: [27], note: fmtN0(vblockN) + " each", n: 27 * vblockN },
      TB("merger.norm", [1152], 1152), TB("merger.linear_fc1", [4608, 4608], 4608), TB("merger.linear_fc2", [5120, 4608], 5120)];
    const attnN = attnT.reduce((a, t) => a + t.n, 0);
    const mtpT = [T("pre_fc_norm_embedding", [H]), T("pre_fc_norm_hidden", [H]), T("fc", [H, 2 * H]),
      { name: "one gated-attention layer + MLP", shape: null, note: "same as layers 4, 8, …, 64", n: attnN }, T("norm", [H])];
    const sum = ts => ts.reduce((a, t) => a + t.n, 0);
    const parts = [];
    parts.push({ id: "embed", label: "Embedding", kind: "embed", ts: [T("embed_tokens", [V, H])],
      role: "Turns each token ID into a vector of 5,120 numbers by looking up one row." });
    for (let i = 1; i <= 64; i++) {
      const attn = i % 4 === 0;
      parts.push({ id: "L" + i, label: "L" + i, layer: i, kind: attn ? "attn" : "delta", ts: attn ? attnT : deltaT,
        role: attn ? "Gated full attention (24 query heads, 4 key/value heads) followed by a SwiGLU MLP."
                   : "Gated DeltaNet (fixed-size memory per head) followed by a SwiGLU MLP." });
    }
    parts.push({ id: "norm", label: "Final norm", kind: "norm", ts: [T("norm", [H])], role: "One last RMSNorm before the output head." });
    parts.push({ id: "head", label: "Output head", kind: "logit", ts: [T("lm_head", [V, H])], role: "Turns the final vector into one score for each of the 248,320 tokens." });
    parts.push({ id: "vision", label: "Vision encoder", kind: "vision", ts: visionT, role: "A 27-block vision transformer that turns image patches into tokens the language model can read." });
    parts.push({ id: "mtp", label: "MTP head", kind: "mtp", ts: mtpT, role: "Multi-token prediction: drafts the token after next, for speculative decoding." });
    parts.forEach(p => (p.n = sum(p.ts)));
    const TOTAL = parts.reduce((a, p) => a + p.n, 0);
    if (TOTAL !== 27781427952) console.warn("layer-map: total", TOTAL);

    if (!document.getElementById("lx-lm-style")) {
      const st = document.createElement("style"); st.id = "lx-lm-style";
      st.textContent = `
        .lm-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:20px}
        .lm-side{display:flex;flex-direction:column;gap:6px}
        .lm-btn{font:500 12px var(--lx-mono);color:var(--lx-text);border-radius:6px;cursor:pointer;padding:7px 8px;text-align:left;
          border:1px solid var(--k);background:color-mix(in srgb,var(--k) 14%,var(--lx-bg))}
        .lm-btn[aria-pressed="true"]{background:color-mix(in srgb,var(--k) 45%,var(--lx-bg));box-shadow:0 0 0 2px color-mix(in srgb,var(--k) 40%,transparent)}
        .lm-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px}
        .lm-grid .lm-btn{padding:6px 0;text-align:center;font-size:11px}
        .lm-cap{font:600 10.5px var(--lx-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--lx-dim);margin:6px 0 2px}
        .lm-row{display:flex;gap:6px;flex-wrap:wrap}.lm-row .lm-btn{flex:1 1 30%}
        .lm-detail h5{margin:0 0 4px;font:600 17px var(--lx-sans)}
        .lm-detail .role{margin:0 0 12px;font-size:14px;color:var(--lx-text-2)}
        .lm-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}
        .lm-facts div{background:var(--lx-panel);border:1px solid var(--lx-line);border-radius:8px;padding:8px 10px}
        .lm-facts b{display:block;font:600 16px var(--lx-mono);color:var(--lx-text)}
        .lm-facts span{font-size:12px;color:var(--lx-muted)}
        .lm-t{width:100%;border-collapse:collapse;font-size:12.5px}
        .lm-t td{padding:5px 6px;border-bottom:1px solid var(--lx-line);vertical-align:top}
        .lm-t td.n{text-align:right;font-family:var(--lx-mono);white-space:nowrap}
        .lm-t .s{display:block;font:400 11.5px var(--lx-mono);color:var(--lx-muted);margin-top:2px}
        .lm-t .bar{height:4px;border-radius:2px;background:var(--k);margin-top:4px;min-width:1px}
        .lm-t td.name{font-family:var(--lx-mono);overflow-wrap:anywhere}
        @media (max-width:760px){.lm-wrap{grid-template-columns:1fr}}`;
      document.head.appendChild(st);
    }
    const fmtN = n => n.toLocaleString("en-US");
    const fmtB = b => b >= 2 ** 30 ? (b / 2 ** 30).toFixed(2) + " GiB" : b >= 2 ** 20 ? (b / 2 ** 20).toFixed(1) + " MiB" : (b / 1024).toFixed(1) + " KiB";
    const kc = k => `var(--lx-${k})`;
    const btn = p => `<button class="lm-btn" data-id="${p.id}" style="--k:${kc(p.kind)}" aria-pressed="false">${p.label}</button>`;
    const byId = Object.fromEntries(parts.map(p => [p.id, p]));
    const layers = parts.filter(p => p.layer);
    host.innerHTML = `<div class="lm-wrap">
      <div class="lm-side">
        <div class="lm-cap">Into the model</div><div class="lm-row">${btn(byId.embed)}${btn(byId.vision)}</div>
        <div class="lm-cap">64 layers · L1 at the top · every 4th is attention</div>
        <div class="lm-grid">${layers.map(btn).join("")}</div>
        <div class="lm-cap">Out of the model</div><div class="lm-row">${btn(byId.norm)}${btn(byId.head)}${btn(byId.mtp)}</div>
      </div>
      <div class="lm-detail" aria-live="polite"></div></div>`;
    const detail = host.querySelector(".lm-detail");
    function show(id) {
      const p = byId[id];
      host.querySelectorAll(".lm-btn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
      const max = Math.max(...p.ts.map(t => t.n));
      let running = "";
      if (p.layer) {
        const upTo = byId.embed.n + layers.slice(0, p.layer).reduce((a, q) => a + q.n, 0);
        running = `<div><b>${(upTo / 1e9).toFixed(2)} B</b><span>parameters from the embedding up to ${p.label}</span></div>`;
      }
      detail.innerHTML = `<h5 style="color:${kc(p.kind)}">${p.layer ? "Layer " + p.layer + " · " + (p.kind === "attn" ? "Gated Attention" : "Gated DeltaNet") : p.label}</h5>
        <p class="role">${p.role}</p>
        <div class="lm-facts">
          <div><b>${fmtN(p.n)}</b><span>parameters</span></div>
          <div><b>${(p.n / TOTAL * 100).toFixed(p.n / TOTAL < 0.001 ? 4 : 2)} %</b><span>of all ${fmtN(TOTAL)}</span></div>
          <div><b>${fmtB(p.n * 2)}</b><span>in bf16 (2 bytes each)</span></div>
          <div><b>${fmtB(p.n * 5.64 / 8)}</b><span>at ≈ 5.6 bits (Q4_K_M average)</span></div>
          ${running}
        </div>
        <table class="lm-t">${p.ts.map(t => `<tr style="--k:${kc(p.kind)}"><td class="name">${t.name}<span class="s">${t.shape ? (t.name.startsWith("27 ") ? "27 × one block" : "[" + t.shape.join(" × ") + "]") + (t.bias ? " + bias [" + t.bias + "]" : "") : ""}${t.note ? (t.shape ? " · " : "") + t.note : ""}</span><div class="bar" style="width:${Math.max(0.5, t.n / max * 100)}%"></div></td><td class="n">${fmtN(t.n)}</td></tr>`).join("")}
        <tr><td class="name"><b>Total</b></td><td class="n"><b>${fmtN(p.n)}</b></td></tr></table>`;
    }
    host.querySelectorAll(".lm-btn").forEach(b => (b.onclick = () => show(b.dataset.id)));
    show("L4");
  });

  const D = LX.draw, E = LX.ease, clamp = LX.clamp, el = LX.el;
  /** sub-progress of x inside [a, b] */
  const seg = (x, a, b) => clamp((x - a) / (b - a));
  const bump = x => Math.sin(Math.PI * clamp(x));
  const fmtInt = n => n.toLocaleString("en-US");
  const fmtM = n => (n / 1e6).toFixed(1) + " M";
  const fmtB = n => (n / 1e9).toFixed(2) + " B";
  const pct = (n, tot) => (n / tot * 100).toFixed(n / tot < .001 ? 3 : 1) + "%";

  /* ----------------------------------------------------------------------
     Parameter counts, computed from the tensor shapes stored in the
     checkpoint ([out, in]). Nothing below is typed in as a result.
     ---------------------------------------------------------------------- */
  const H = 5120, V = 248320, I = 17408;
  const SHAPES = {
    delta: [["in_proj_qkv", 10240, H], ["in_proj_z", 6144, H], ["in_proj_a", 48, H], ["in_proj_b", 48, H],
            ["conv1d", 10240, 4], ["A_log", 48, 1], ["dt_bias", 48, 1], ["norm", 128, 1], ["out_proj", H, 6144]],
    attn:  [["q_proj", 12288, H], ["k_proj", 1024, H], ["v_proj", 1024, H], ["q_norm", 256, 1], ["k_norm", 256, 1], ["o_proj", H, 6144]],
    mlp:   [["gate_proj", I, H], ["up_proj", I, H], ["down_proj", H, I]],
  };
  const total = list => list.reduce((s, [, a, b]) => s + a * b, 0);
  const P = { delta: total(SHAPES.delta), attn: total(SHAPES.attn), mlp: total(SHAPES.mlp), norms2: 2 * H };
  P.layerDelta = P.delta + P.mlp + P.norms2;          // 383,273,184
  P.layerAttn = P.attn + P.mlp + P.norms2;            // 372,255,232
  P.embed = V * H; P.head = H * V; P.finalNorm = H;
  P.layers = 48 * P.layerDelta + 16 * P.layerAttn;
  P.text = P.embed + P.head + P.layers + P.finalNorm; // 26,895,998,464
  // The two side modules are summed from their own tensors in chapters 15 (MTP)
  // and 16 (vision); here they enter as those totals.
  P.mtp = 424699392;
  P.vision = 460730096;
  P.total = P.text + P.vision + P.mtp;                // 27,781,427,952
  P.resNorms = 64 * P.norms2 + P.finalNorm;           // 129 norm vectors
  if (P.layerDelta !== 383273184 || P.layerAttn !== 372255232 || P.total !== 27781427952)
    console.warn("LX ch09: parameter count mismatch", P);

  /** ⊕ symbol. flash(q) lights it. */
  function plusSign(parent, x, y, color = "embed") {
    const g = el("g", {}, parent);
    const c = el("circle", { cx: x, cy: y, r: 13, fill: LX.col("bg"), stroke: LX.col(color), "stroke-width": 2 }, g);
    el("path", { d: `M${x - 6} ${y} H${x + 6} M${x} ${y - 6} V${y + 6}`, stroke: LX.col(color), "stroke-width": 2, "stroke-linecap": "round" }, g);
    return { g, flash(q) { c.setAttribute("fill", LX.mix("bg", color, q * .6)); c.setAttribute("filter", q > .15 ? "url(#lx-glow)" : "none"); } };
  }
  /** zoom transform of a group around a focal point */
  const zoom = (g, fx, fy, k) => g.setAttribute("transform", `translate(${fx} ${fy}) scale(${k}) translate(${-fx} ${-fy})`);

  /* ============================================================ qwen-zoom */
  function buildZoom(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    const G1 = el("g", {}, svg), G2 = el("g", {}, svg), G3 = el("g", {}, svg);
    const hd1 = D.label(svg, 80, 92, "Qwen3.8-27B · the whole model");
    const hd2 = D.label(svg, 80, 92, "Layers 1–4 · the same two halves in every layer");
    const hd3 = D.label(svg, 80, 92, "Layer 4 · its weight matrices, drawn to scale");

    /* ---------------- level 1: the full column ---------------- */
    const cx = 640, cw = 320, pitch = 9.2, sh = 7;
    const emb = D.block(G1, { x: cx, y: 780, w: cw, h: 54, kind: "embed", label: "Embedding table", sub: "248,320 × 5,120", size: 16 });
    const slabs = [];
    for (let i = 0; i < 64; i++) {
      const attn = i % 4 === 3, y = 771 - (i + 1) * pitch + (pitch - sh);
      const kind = attn ? "attn" : "delta", base = attn ? .42 : .2;
      const r = el("rect", { x: cx, y, width: cw, height: sh, rx: 2, fill: LX.mix("bg", kind, base), stroke: LX.col(kind), "stroke-width": 1 }, G1);
      slabs.push({ r, kind, base, y });
    }
    const topY = slabs[63].y;
    const fnorm = D.block(G1, { x: cx, y: 146, w: cw, h: 26, kind: "norm", label: "Final RMSNorm", size: 13 });
    const head = D.block(G1, { x: cx, y: 70, w: cw, h: 60, kind: "logit", label: "Output head", sub: "5,120 → 248,320", size: 16 });
    const inTxt = D.text(G1, cx + cw / 2, 872, "↑ token IDs in", { mono: true, size: 14, color: "muted", anchor: "middle" });
    const outTxt = D.text(G1, cx + cw / 2, 54, "↑ one score per vocabulary token", { mono: true, size: 14, color: "muted", anchor: "middle" });
    // labels: right side for embedding + layers, left side for the top parts
    const labs = el("g", {}, G1);
    D.text(labs, 1000, 806, "embedding · " + fmtB(P.embed), { mono: true, size: 15, color: "embed" });
    D.text(labs, 1000, 826, "one row per vocabulary token", { mono: true, size: 13, color: "muted" });
    D.bracket(labs, { x1: 980, y1: topY, x2: 980, y2: 771, side: "right", label: "" });
    D.text(labs, 1000, 470, "64 layers · " + fmtB(P.layers), { mono: true, size: 15, color: "text" });
    D.text(labs, 1000, 490, `48 × ${fmtM(P.layerDelta)} + 16 × ${fmtM(P.layerAttn)}`, { mono: true, size: 13, color: "muted" });
    D.text(labs, 600, 96, "output head · " + fmtB(P.head), { mono: true, size: 15, color: "logit", anchor: "end" });
    D.text(labs, 600, 116, "a separate matrix, not the embedding", { mono: true, size: 13, color: "muted", anchor: "end" });
    D.text(labs, 600, 164, "final norm · " + fmtInt(P.finalNorm), { mono: true, size: 13, color: "norm", anchor: "end" });

    // pattern: a small bracket per group of four, plus the 3 + 1 legend
    const brk = [];
    for (let g = 0; g < 16; g++) {
      const yt = slabs[4 * g + 3].y, yb = slabs[4 * g].y + sh;
      brk.push(el("path", { d: `M${cx - 8} ${yb} H${cx - 16} V${yt} H${cx - 8}`, fill: "none", stroke: LX.col("text-2"), "stroke-width": 1.5, opacity: 0 }, G1));
    }
    const pat = el("g", { opacity: 0 }, G1);
    D.text(pat, cx - 26, 748, "3 × Gated DeltaNet", { mono: true, size: 14, color: "delta", anchor: "end" });
    D.text(pat, cx - 26, 768, "1 × Gated Attention", { mono: true, size: 14, color: "attn", anchor: "end" });
    D.text(pat, cx - 26, 486, "× 16", { mono: true, size: 30, weight: 600, color: "text", anchor: "end" });
    D.text(pat, cx - 26, 510, "groups of four", { mono: true, size: 13, color: "muted", anchor: "end" });

    // extras: vision encoder and MTP head as dashed side boxes
    const vis = D.block(G1, { x: 210, y: 790, w: 250, h: 66, kind: "vision", label: "Vision encoder", sub: fmtB(P.vision) + " · images → tokens", size: 16 });
    const mtp = D.block(G1, { x: 1180, y: 150, w: 250, h: 66, kind: "mtp", label: "MTP head", sub: fmtB(P.mtp) + " · drafts ahead", size: 16 });
    [vis, mtp].forEach(b => b.r.setAttribute("stroke-dasharray", "6 5"));
    const visA = D.arrow(G1, { x1: 464, y1: 823, x2: 634, y2: 823, color: "vision" });
    const mtpA = D.arrow(G1, { d: `M${cx + cw + 4} 159 H1090 V183 H1174`, color: "mtp" });
    const visT = D.text(G1, 549, 812, "image tokens", { mono: true, size: 13, color: "vision", anchor: "middle" });

    /* ---------------- level 2: layers 1–4 opened up ---------------- */
    const rowsY = [780, 600, 420, 240];
    const rows = rowsY.map((y, r) => {
      const attn = r === 3, g = el("g", {}, G2), by = y - 60;
      D.text(g, 92, y + 6, `L${r + 1}`, { mono: true, size: 18, weight: 600, color: attn ? "attn" : "delta" });
      el("path", { d: `M140 ${y} H1300`, stroke: LX.col("embed"), "stroke-width": 3, fill: "none" }, g);
      el("path", { d: `M170 ${y} V${by} H190 M320 ${by} H370 M630 ${by} H690 V${y - 14}`, stroke: LX.col("embed"), "stroke-width": 1.8, fill: "none", opacity: .8 }, g);
      el("path", { d: `M720 ${y} V${by} H750 M880 ${by} H930 M1190 ${by} H1250 V${y - 14}`, stroke: LX.col("embed"), "stroke-width": 1.8, fill: "none", opacity: .8 }, g);
      el("circle", { cx: 170, cy: y, r: 4, fill: LX.col("embed") }, g);
      el("circle", { cx: 720, cy: y, r: 4, fill: LX.col("embed") }, g);
      const n1 = D.block(g, { x: 190, y: by - 23, w: 130, h: 46, kind: "norm", label: "RMSNorm", size: 14 });
      const mx = D.block(g, { x: 370, y: by - 34, w: 260, h: 68, kind: attn ? "attn" : "delta", label: attn ? "Gated Attention" : "Gated DeltaNet", sub: fmtM(attn ? P.attn : P.delta), size: 16, strong: attn });
      const p1 = plusSign(g, 690, y);
      const n2 = D.block(g, { x: 750, y: by - 23, w: 130, h: 46, kind: "norm", label: "RMSNorm", size: 14 });
      const ml = D.block(g, { x: 930, y: by - 34, w: 260, h: 68, kind: "mlp", label: "SwiGLU MLP", sub: fmtM(P.mlp), size: 16 });
      const p2 = plusSign(g, 1250, y);
      D.text(g, 1395, y + 6, fmtM(attn ? P.layerAttn : P.layerDelta), { mono: true, size: 15, color: "text-2" });
      if (r < 3) el("path", { d: `M1300 ${y} H1370 V${y - 120} H110 V${y - 180} H140`, stroke: LX.col("embed"), "stroke-opacity": .35, "stroke-width": 1.5, "stroke-dasharray": "4 5", fill: "none" }, g);
      return { g, y, mx, ml, p1, p2, n1, n2 };
    });
    // the route the residual stream takes up through the four layers
    let d = "";
    rowsY.forEach((y, r) => { d += (r ? ` V${y}` : `M140 ${y}`) + ` H1300` + (r < 3 ? ` H1370 V${y - 120} H110 V${y - 180} H140` : ""); });
    const route = el("path", { d, fill: "none" }, G2);
    const pulse = D.traveller(G2, route, { color: "embed", r: 7 });
    const rowLab = D.text(G2, 1395, 172, "per layer", { mono: true, size: 13, color: "muted" });

    /* ---------------- level 3: layer 4's matrices to scale ---------------- */
    const s = 0.022;                                   // px per dimension, same on both axes → area ∝ parameters
    const base = 620;
    const mats = [
      { n: "q_proj", out: 12288, inn: H, x: 90, kind: "attn" }, { n: "k_proj", out: 1024, inn: H, x: 238, kind: "attn" },
      { n: "v_proj", out: 1024, inn: H, x: 386, kind: "attn" }, { n: "o_proj", out: H, inn: 6144, x: 534, kind: "attn" },
      { n: "gate_proj", out: I, inn: H, x: 760, kind: "mlp" }, { n: "up_proj", out: I, inn: H, x: 905, kind: "mlp" },
      { n: "down_proj", out: H, inn: I, x: 1050, kind: "mlp" },
    ].map(m => {
      const w = m.inn * s, h = m.out * s, g = el("g", {}, G3);
      const clipId = "c09-" + m.n;
      const cp = el("clipPath", { id: clipId }, svg.querySelector("defs"));
      const cr = el("rect", { x: m.x, y: base, width: w, height: 0 }, cp);
      const body = el("g", { "clip-path": `url(#${clipId})` }, g);
      const r = el("rect", { x: m.x, y: base - h, width: w, height: h, fill: LX.mix("bg", m.kind, .2), stroke: LX.col(m.kind), "stroke-width": 1.5 }, body);
      let gl = "";
      for (let k = 1024; k < m.inn; k += 1024) gl += `M${m.x + k * s} ${base - h} V${base} `;
      for (let k = 1024; k < m.out; k += 1024) gl += `M${m.x} ${base - k * s} H${m.x + w} `;
      if (gl) el("path", { d: gl, stroke: LX.col(m.kind), "stroke-opacity": .22, "stroke-width": 1, fill: "none" }, body);
      const lab = el("g", { opacity: 0 }, g);
      D.text(lab, m.x, base + 26, m.n, { mono: true, size: 15, color: "text" });
      D.text(lab, m.x, base + 46, `${fmtInt(m.out)} × ${fmtInt(m.inn)}`, { mono: true, size: 13, color: "muted" });
      D.text(lab, m.x, base + 66, fmtM(m.out * m.inn), { mono: true, size: 14, color: m.kind });
      return { ...m, w, h, r, cr, lab };
    });
    const attnLab = el("g", { opacity: 0 }, G3);
    D.text(attnLab, 90, base - 12288 * s - 22, "Gated Attention · " + fmtM(P.attn), { mono: true, size: 16, weight: 500, color: "attn" });
    D.text(attnLab, 90, base + 100, "+ q_norm, k_norm: 256 numbers each, too small to draw", { mono: true, size: 13, color: "dim" });
    const mlpLab = el("g", { opacity: 0 }, G3);
    D.text(mlpLab, 760, base - I * s - 22, "SwiGLU MLP · " + fmtM(P.mlp), { mono: true, size: 16, weight: 500, color: "mlp" });
    const scaleTxt = D.text(G3, 80, 118, `area = parameters · 1 px² ≈ ${fmtInt(Math.round(1 / (s * s)))} weights · grid lines every 1,024`, { size: 15, color: "text-2" });
    // comparison bars for the last cue
    const cmp = el("g", { opacity: 0 }, G3);
    const bs = 2.2 / 1e6;                              // px per parameter
    D.text(cmp, 890, 772, "attention", { mono: true, size: 14, color: "attn", anchor: "end" });
    el("rect", { x: 900, y: 760, width: P.attn * bs, height: 14, rx: 2, fill: LX.col("attn") }, cmp);
    D.text(cmp, 890, 802, "MLP", { mono: true, size: 14, color: "mlp", anchor: "end" });
    el("rect", { x: 900, y: 790, width: P.mlp * bs, height: 14, rx: 2, fill: LX.col("mlp") }, cmp);
    D.text(cmp, 900 + P.mlp * bs, 746, `${(P.mlp / P.attn).toFixed(2)}× the attention block`, { mono: true, size: 15, color: "mlp", anchor: "end" });

    ups.push(t => {
      /* level visibility and camera */
      const pl = ctx.p(t, "layer", 0, .38, E.inOut), pt = ctx.p(t, "tensors", 0, .38, E.inOut);
      zoom(G1, cx + cw / 2, 752, 1 + 7 * pl);
      G1.setAttribute("opacity", 1 - seg(pl, .15, .6));
      const in2 = seg(pl, .4, .9), out2 = seg(pt, .15, .6);
      zoom(G2, 505, 182, (.82 + .18 * in2) * (1 + 4 * pt));
      G2.setAttribute("opacity", in2 * (1 - out2));
      const in3 = seg(pt, .4, .9);
      zoom(G3, 800, 500, .82 + .18 * in3);
      G3.setAttribute("opacity", in3);
      hd1.setAttribute("opacity", 1 - seg(pl, .2, .5));
      hd2.setAttribute("opacity", seg(pl, .6, .9) * (1 - seg(pt, .2, .5)));
      hd3.setAttribute("opacity", seg(pt, .6, .9));

      /* level 1 */
      emb.show(ctx.p(t, "whole", 0, .14));
      const climb = ctx.p(t, "whole", .5, .95, E.inOut) * 70 - 3;
      slabs.forEach((sl, i) => {
        sl.r.setAttribute("opacity", ctx.p(t, "whole", .1 + i * .006, .14 + i * .006, E.linear));
        const flashKind = ctx.p(t, "pattern", .05, .2) * (1 - ctx.p(t, "pattern", .75, .95));
        const lit = clamp(1 - Math.abs(climb - i) / 2.5) + (sl.kind === "attn" ? flashKind * .35 : 0);
        sl.r.setAttribute("fill", LX.mix("bg", sl.kind, sl.base + lit * .5));
      });
      fnorm.show(ctx.p(t, "whole", .6, .72)); head.show(ctx.p(t, "whole", .66, .8));
      D.fade(inTxt, ctx.p(t, "whole", .05, .2)); D.fade(outTxt, ctx.p(t, "whole", .75, .9));
      D.fade(labs, ctx.p(t, "whole", .78, .95));
      brk.forEach((b, g) => b.setAttribute("opacity", ctx.p(t, "pattern", .25 + g * .03, .3 + g * .03)));
      D.fade(pat, ctx.p(t, "pattern", .15, .35));
      vis.show(ctx.p(t, "extras", .1, .3)); mtp.show(ctx.p(t, "extras", .35, .55));
      visA.draw(ctx.p(t, "extras", .25, .4)); D.fade(visT, ctx.p(t, "extras", .3, .45));
      mtpA.draw(ctx.p(t, "extras", .5, .65));

      /* level 2: rows open bottom to top, then data climbs */
      rows.forEach((rw, r) => {
        const q = ctx.p(t, "layer", .2 + r * .07, .32 + r * .07);
        rw.g.setAttribute("opacity", q);
        rw.g.setAttribute("transform", `translate(0 ${(1 - q) * 12})`);
      });
      D.fade(rowLab, ctx.p(t, "layer", .55, .65));
      pulse.at(ctx.p(t, "layer", .6, .95, E.linear));
      const lit4 = bump(ctx.p(t, "layer", .9, 1, E.linear)) + ctx.p(t, "tensors", 0, .1) * (1 - pt);
      rows[3].mx.pulse(lit4);

      /* level 3: matrices grow from their base line */
      mats.forEach((m, i) => {
        const g = m.kind === "attn" ? ctx.p(t, "tensors", .22 + i * .06, .39 + i * .06) : ctx.p(t, "tensors", .5 + (i - 4) * .07, .67 + (i - 4) * .07);
        m.cr.setAttribute("y", base - m.h * g); m.cr.setAttribute("height", m.h * g);
        m.lab.setAttribute("opacity", seg(g, .6, 1));
        if (m.kind === "mlp") {
          const q = bump(ctx.p(t, "mlpbig", .05, .5, E.linear)) + ctx.p(t, "mlpbig", .5, .7) * .4;
          m.r.setAttribute("fill", LX.mix("bg", "mlp", .2 + q * .35));
          m.r.setAttribute("filter", q > .3 ? "url(#lx-glow)" : "none");
        }
      });
      D.fade(attnLab, ctx.p(t, "tensors", .4, .55)); D.fade(mlpLab, ctx.p(t, "tensors", .72, .87));
      D.fade(scaleTxt, ctx.p(t, "tensors", .3, .5));
      D.fade(cmp, ctx.p(t, "mlpbig", .35, .6));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ========================================================= param-census */
  function buildCensus(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    const cats = [
      { k: "mlp",    name: "MLPs (64)",               n: 64 * P.mlp,   col: "mlp",    cue: "mlp" },
      { k: "delta",  name: "DeltaNet mixers (48)",    n: 48 * P.delta, col: "delta",  cue: "mix" },
      { k: "attn",   name: "Attention mixers (16)",   n: 16 * P.attn,  col: "attn",   cue: "mix" },
      { k: "embed",  name: "Embedding table",         n: P.embed,      col: "embed",  cue: "vocab" },
      { k: "head",   name: "Output head",             n: P.head,       col: "logit",  cue: "vocab" },
      { k: "vision", name: "Vision encoder",          n: P.vision,     col: "vision", cue: "vocab" },
      { k: "mtp",    name: "MTP head",                n: P.mtp,        col: "mtp",    cue: "vocab" },
      { k: "norms",  name: "Norms (129 vectors)",     n: P.resNorms,   col: "norm",   cue: "norms" },
    ];
    const SUM = cats.reduce((s, c) => s + c.n, 0);
    if (SUM !== P.total) console.warn("LX ch09: census does not add up", SUM, P.total);
    // order of appearance inside each cue
    const order = {}; cats.forEach(c => { order[c.cue] = order[c.cue] || []; order[c.cue].push(c); });

    D.label(svg, 80, 92, "All parameters of Qwen3.8-27B");
    const big = D.text(svg, 80, 160, fmtInt(P.total), { mono: true, size: 44, weight: 600, color: "text" });
    const bigSub = D.text(svg, 80, 188, "learned numbers · one bar, coloured by job", { mono: true, size: 14, color: "muted" });

    /* the bar */
    const BX = 80, BW = 1440, BY = 230, BH = 64;
    el("rect", { x: BX, y: BY, width: BW, height: BH, rx: 4, fill: LX.col("panel"), stroke: LX.col("line-2"), "stroke-width": 1.5 }, svg);
    let x = BX;
    cats.forEach(c => { c.x0 = x; c.w = c.n / SUM * BW; x += c.w;
      c.seg = el("rect", { x: c.x0, y: BY, width: 0, height: BH, fill: LX.col(c.col) }, svg); });
    const inl = [["mlp", "MLP · "], ["delta", "DeltaNet · "]].map(([k, pre]) => {
      const c = cats.find(z => z.k === k);
      return { c, t: D.text(svg, c.x0 + c.w / 2, BY + BH / 2 + 6, pre + pct(c.n, SUM), { mono: true, size: 17, weight: 600, color: "bg", anchor: "middle", opacity: 0 }) };
    });

    /* grid: one square = 100 M parameters, largest-remainder rounding */
    const NSQ = Math.round(SUM / 1e8);
    const raw = cats.map(c => c.n / SUM * NSQ), cnt = raw.map(Math.floor);
    let left = NSQ - cnt.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - cnt[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { cnt[i]++; left--; } });
    const COLS = 28, CS = 26, GAP = 6, GX = 80, GY = 400;
    const squares = [];
    const sqPos = [];
    cats.forEach((c, ci) => { for (let j = 0; j < cnt[ci]; j++) { squares.push(c); sqPos.push(j); } });
    const sq = squares.map((c, i) => el("rect", {
      x: GX + (i % COLS) * (CS + GAP), y: GY + Math.floor(i / COLS) * (CS + GAP), width: CS, height: CS, rx: 3,
      fill: LX.col("panel"), stroke: LX.col("line-2"), "stroke-width": 1 }, svg));
    D.text(svg, GX, GY - 22, `one square = 100 million parameters · ${NSQ} squares`, { mono: true, size: 14, color: "muted" });

    /* legend */
    const LX0 = 1060, LY = 420;
    const legend = cats.map((c, i) => {
      const g = el("g", { opacity: 0 }, svg), y = LY + i * 40;
      el("rect", { x: LX0, y: y - 14, width: 16, height: 16, rx: 3, fill: LX.col(c.col) }, g);
      D.text(g, LX0 + 28, y, c.name, { size: 16, color: "text" });
      D.text(g, 1520, y, c.k === "norms" ? fmtInt(c.n) : fmtB(c.n), { mono: true, size: 15, color: "text-2", anchor: "end" });
      D.text(g, 1405, y, pct(c.n, SUM), { mono: true, size: 14, color: "muted", anchor: "end" });
      return g;
    });

    /* magnifier for the norms */
    const mag = el("g", { opacity: 0 }, svg);
    const MX = 1420, MY = 140, MR = 54;
    el("line", { x1: MX + MR * .7, y1: MY + MR * .7, x2: BX + BW - 2, y2: BY - 2, stroke: LX.col("norm"), "stroke-width": 1.5, "stroke-dasharray": "3 4" }, mag);
    el("circle", { cx: MX, cy: MY, r: MR, fill: LX.col("bg"), stroke: LX.col("norm"), "stroke-width": 3 }, mag);
    el("rect", { x: MX - MR + 6, y: MY - 16, width: MR * 1.4, height: 32, fill: LX.col("mtp") }, mag);
    el("rect", { x: MX - MR + 6 + MR * 1.4, y: MY - 16, width: 2, height: 32, fill: LX.col("norm") }, mag);
    D.text(mag, MX - MR - 16, MY - 4, `${fmtInt(P.resNorms)} norm weights`, { mono: true, size: 15, color: "norm", anchor: "end" });
    D.text(mag, MX - MR - 16, MY + 16, `${pct(P.resNorms, SUM)} of the model`, { mono: true, size: 13, color: "muted", anchor: "end" });

    ups.push(t => {
      D.fade(big, ctx.p(t, "bar", 0, .3)); D.fade(bigSub, ctx.p(t, "bar", .2, .5));
      cats.forEach(c => {
        const list = order[c.cue], j = list.indexOf(c), n = list.length;
        const q = c.cue === "norms" ? ctx.p(t, "norms", .1, .3) : ctx.p(t, c.cue, .1 + j * .7 / n, .1 + (j + 1) * .7 / n, E.inOut);
        c.q = q;
        c.seg.setAttribute("width", c.w * q);
        legend[cats.indexOf(c)].setAttribute("opacity", seg(q, .3, 1));
      });
      squares.forEach((c, i) => {
        const on = c.q > (sqPos[i] + .5) / cnt[cats.indexOf(c)];
        sq[i].setAttribute("fill", on ? LX.col(c.col) : LX.col("panel"));
        sq[i].setAttribute("stroke", on ? LX.mix(c.col, "bg", .3) : LX.col("line-2"));
      });
      inl.forEach(({ c, t: tx }) => D.fade(tx, seg(c.q, .7, 1)));
      D.fade(mag, ctx.p(t, "norms", .15, .45));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ======================================================= depth-vs-width */
  function buildDepthWidth(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    // per-layer parameters with Qwen3.8's own mix (3 DeltaNet : 1 attention), as a multiple of width²
    const k = (3 * P.layerDelta + P.layerAttn) / 4 / (H * H);
    const textTotal = (L, d) => L * k * d * d + 2 * V * d;
    const shapes = [
      { L: 32, d: 7168, name: "shallow and wide", cx: 250 },
      { L: 64, d: 5120, name: "Qwen3.8-27B", cx: 610, me: true },
      { L: 128, d: 3584, name: "deep and narrow", cx: 970 },
      { L: 32, d: 5120, name: "simply cut to 32 layers", cx: 1340, cut: true },
    ];
    // slab width and slab thickness both ∝ width, so stack area ∝ layers × width² ∝ parameters
    const A = 250 / 7168, C = 500 / (128 * 3584), BASE = 628;
    D.label(svg, 80, 70, "Same parameter budget, different shapes");
    const sub = D.text(svg, 80, 98, "slab width and thickness grow with the hidden size, so each stack's area is proportional to its parameters", { size: 15, color: "muted" });

    shapes.forEach((sh, si) => {
      sh.w = A * sh.d; sh.t = C * sh.d; sh.h = sh.L * sh.t; sh.top = BASE - sh.h;
      sh.total = textTotal(sh.L, sh.d);
      const g = el("g", {}, svg); sh.g = g;
      const x0 = sh.cx - sh.w / 2;
      sh.slabs = [];
      for (let i = 0; i < sh.L; i++) {
        const attn = i % 4 === 3, kind = attn ? "attn" : "delta";
        const y = BASE - (i + 1) * sh.t;
        const r = el("rect", { x: x0, y: y + .4, width: sh.w, height: Math.max(.8, sh.t - .9),
          fill: LX.mix("bg", kind, attn ? .62 : .38), opacity: 0 }, g);
        sh.slabs.push(r);
      }
      if (sh.me) el("rect", { x: x0 - 5, y: sh.top - 5, width: sh.w + 10, height: sh.h + 10, rx: 4, fill: "none",
        stroke: LX.col("embed"), "stroke-width": 1.5, "stroke-dasharray": "4 4" }, g);
      // moving pulse (one glowing slab outline per stack)
      sh.pulse = el("rect", { x: x0 - 3, y: 0, width: sh.w + 6, height: Math.max(3, sh.t), rx: 1.5, fill: LX.col("embed"),
        opacity: 0, filter: "url(#lx-glow)" }, svg);
      // labels under the stack
      const lab = el("g", { opacity: 0 }, svg); sh.lab = lab;
      D.text(lab, sh.cx, BASE + 30, sh.name, { size: 17, weight: 600, anchor: "middle", color: sh.me ? "embed" : (sh.cut ? "text-2" : "text") });
      D.text(lab, sh.cx, BASE + 54, `${sh.L} layers × ${fmtInt(sh.d)}`, { mono: true, size: 15, anchor: "middle", color: "text-2" });
      sh.num = D.text(lab, sh.cx, BASE + 80, "", { mono: true, size: 16, anchor: "middle", color: sh.cut ? "muted" : "text", weight: 500 });
      sh.steps = D.text(svg, sh.cx, BASE + 106, "", { mono: true, size: 14, anchor: "middle", color: "muted", opacity: 0 });
      // quality gauge (no invented score: equal for equal size, dimmed for the cut model)
      const gy = 776, gw = 200, gx = sh.cx - gw / 2;
      const gg = el("g", { opacity: 0 }, svg); sh.gauge = gg;
      el("rect", { x: gx, y: gy, width: gw, height: 10, rx: 5, fill: LX.col("line") }, gg);
      sh.gfill = el("rect", { x: gx, y: gy, width: 0, height: 10, rx: 5, fill: LX.col("embed") }, gg);
      if (sh.cut) { gg.firstChild.setAttribute("fill", "none"); gg.firstChild.setAttribute("stroke", LX.col("line-2")); gg.firstChild.setAttribute("stroke-dasharray", "4 4"); }
      sh.gw = gw;
      if (sh.cut) D.text(gg, sh.cx, gy + 34, "≈ a smaller model", { size: 15, anchor: "middle", color: "muted" });
    });
    const S = shapes;
    // shared caption for the first three gauges
    const qcap = el("g", { opacity: 0 }, svg);
    D.label(qcap, 80, 762, "Next-token quality", { size: 13 });
    D.bracket(qcap, { x1: S[0].cx - 100, y1: 800, x2: S[2].cx + 100, y2: 800, side: "bottom", label: "", color: "muted" });
    D.text(qcap, (S[0].cx + S[2].cx) / 2, 832, "within a few % of each other at equal size (Kaplan et al. 2020)", { size: 15, anchor: "middle", color: "text-2" });
    // side note: Qwen's own smaller models
    const note = el("g", { opacity: 0 }, svg);
    D.text(note, S[3].cx, 300, "Qwen's own smaller models", { size: 15, anchor: "middle", color: "text-2", weight: 600 });
    D.text(note, S[3].cx, 326, "14 B: 40 × 5,120", { mono: true, size: 15, anchor: "middle", color: "muted" });
    D.text(note, S[3].cx, 350, "9 B: 32 × 4,096", { mono: true, size: 15, anchor: "middle", color: "muted" });

    ups.push(t => {
      const first3 = [0, 1, 2];
      // budget: build three stacks bottom-up and count their parameters
      first3.forEach(i => {
        const sh = S[i], p = ctx.p(t, "budget", .05 + i * .1, .55 + i * .1, LX.ease.inOut);
        const n = Math.round(p * sh.L);
        sh.slabs.forEach((r, j) => r.setAttribute("opacity", j < n ? 1 : 0));
        const q = ctx.p(t, "budget", .1 + i * .1, .4 + i * .1);
        sh.lab.setAttribute("opacity", q);
        sh.num.textContent = "≈ " + (sh.total * ctx.p(t, "budget", .3 + i * .1, .75 + i * .1) / 1e9).toFixed(2) + " B";
      });
      // quality: gauges fill to the same level
      const gq = ctx.p(t, "quality", .1, .6);
      first3.forEach(i => { S[i].gauge.setAttribute("opacity", ctx.p(t, "quality", 0, .15)); S[i].gfill.setAttribute("width", S[i].gw * .82 * gq); });
      qcap.setAttribute("opacity", ctx.p(t, "quality", .45, .7));
      // steps: one pulse per stack, the same time per layer, so deeper stacks take longer
      const c = ctx.cue("steps"), t0 = c.start + c.dur * .08, per = (c.dur * .84) / 128;
      first3.forEach(i => {
        const sh = S[i], k2 = (t - t0) / per;              // layers climbed so far
        const on = t >= t0 && k2 < sh.L && t < c.end;
        sh.pulse.setAttribute("opacity", on ? .85 : 0);
        if (on) sh.pulse.setAttribute("y", BASE - (Math.floor(k2) + 1) * sh.t);
        sh.steps.setAttribute("opacity", ctx.p(t, "steps", 0, .08));
        sh.steps.textContent = `${Math.min(sh.L, Math.max(0, Math.floor(k2)))} / ${sh.L} steps`;
        if (t >= c.end) sh.steps.textContent = `${sh.L} steps per token`;
      });
      // cut: the fourth stack, half the area
      const sh = S[3], pc = ctx.p(t, "cut", .05, .4, LX.ease.inOut), nc = Math.round(pc * sh.L);
      sh.slabs.forEach((r, j) => r.setAttribute("opacity", j < nc ? .8 : 0));
      sh.lab.setAttribute("opacity", ctx.p(t, "cut", .1, .35));
      sh.num.textContent = "≈ " + (sh.total * ctx.p(t, "cut", .2, .55) / 1e9).toFixed(2) + " B";
      sh.steps.setAttribute("opacity", ctx.p(t, "cut", .3, .45)); sh.steps.textContent = `${sh.L} steps per token`;
      sh.gauge.setAttribute("opacity", ctx.p(t, "cut", .45, .6));
      sh.gfill.setAttribute("width", 0);   // no score is claimed: just "a smaller model"
      note.setAttribute("opacity", ctx.p(t, "cut", .6, .8));
      sub.setAttribute("opacity", ctx.p(t, "budget", 0, .1));
    });
    return t => ups.forEach(u => u(t));
  }

LX.chapter({
  id: "qwen", num: 10, title: "Qwen3.8-27B, layer by layer", toc: "Qwen3.8-27B layer by layer",
  kicker: "Every tensor, every parameter",
  lede: "We now have all the parts. This chapter puts them together into the complete map of one real model, down to every weight matrix and every one of its 27.78 billion parameters.",
  body: [
    { prose: `
      <p>Qwen3.8-27B is a stack of 64 layers between an input table and an output table. Each layer has the same two halves: a <strong>token mixer</strong> that moves information between tokens, then an <abbr>MLP</abbr> that works on each token alone. Each half is preceded by an <abbr>RMSNorm</abbr> and wrapped in a residual connection (<a href="#layer">Chapter 6</a>).</p>
      <p>Only the token mixer changes from layer to layer. Three layers in a row use <strong class="c-delta">Gated DeltaNet</strong> (<a href="#deltanet">Chapter 8</a>), then one layer uses <strong class="c-attn">Gated Attention</strong> (<a href="#attention">Chapter 7</a>). That group of four repeats 16 times.</p>` },

    { scene: {
      id: "qwen-zoom", title: "From the whole model to a single tensor",
      build: buildZoom,
      visual: "Three zoom levels, one camera move each. Level 1: the full model as a tall column: embedding table at the bottom (teal), 64 thin slabs (blue DeltaNet, violet attention every 4th), final norm and output head (pink) at the top, with the vision encoder and MTP head as dashed side boxes; all parameter counts computed from tensor shapes. Level 2: the camera dives into layers 1–4, which open up as four rows: residual stream, RMSNorm → mixer → ⊕, RMSNorm → MLP → ⊕, joined into one route that a light pulse climbs. Level 3: the camera dives into layer 4's attention mixer, where its weight matrices and the MLP's appear as rectangles drawn to one scale (area = parameters), with shapes and counts.",
      cues: [
        { id: "whole",  say: "Here is the whole model. At the bottom, the embedding table turns token IDs into vectors. At the top, the output head turns the final vector into a score for every token. In between are sixty-four layers.", vis: "Embedding table, then 64 slabs draw bottom to top, a light pulse climbs through them, final norm and output head appear; labels: embedding 1.27 B · 64 layers 24.35 B (48 × 383.3 M + 16 × 372.3 M) · output head 1.27 B." },
        { id: "pattern", say: "Look at the colours. Three blue layers, then one violet. Blue is Gated DeltaNet, violet is Gated Attention. That group of four repeats sixteen times.", vis: "Attention slabs flash; a small bracket appears beside each of the 16 groups of four; legend: 3 × Gated DeltaNet, 1 × Gated Attention, × 16." },
        { id: "extras", say: "Two extra parts sit beside the stack. A vision encoder that turns images into tokens, and a multi-token prediction head that can draft tokens ahead of time. We return to both later.", vis: "Dashed side boxes: Vision encoder 0.46 B with an arrow of image tokens into the embedding level; MTP head 0.42 B fed from the top of the stack." },
        { id: "layer",  say: "Zoom into the first group of four. Every layer has the same two halves. A norm, then a token mixer, then the result is added back. Then another norm, an M L P, the multi-layer perceptron, and another addition.", vis: "Camera dives into L1–L4; four rows open bottom to top, each showing stream → RMSNorm → mixer → ⊕ → RMSNorm → MLP → ⊕ with its parameter count; a pulse climbs the route; L4's attention box glows." },
        { id: "tensors", say: "Zoom once more, into the attention layer. Now we see the actual weight matrices, drawn to scale. The query projection is the largest here. The key and value projections are small, because they only serve four heads.", vis: "Camera dives into L4's attention box. Rectangles grow from a common base line, drawn to one scale: q_proj 12,288 × 5,120, k_proj and v_proj 1,024 × 5,120 (thin slivers), o_proj 5,120 × 6,144, then gate_proj, up_proj, down_proj beside them, visibly larger. Grid lines every 1,024 dimensions." },
        { id: "mlpbig", say: "And notice the MLP next to it. Its three matrices together are more than twice the size of the whole attention block.", vis: "MLP rectangles pulse green; two bars to scale compare attention 104.9 M with MLP 267.4 M: 2.55× the attention block." },
      ],
    } },

    { html: `<div class="lx-prose"><h3>The numbers that define the model</h3></div>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Setting</th><th class="num">Value</th><th>Used in</th></tr>
        <tr><td>Layers</td><td class="num">64</td><td>48 Gated DeltaNet + 16 Gated Attention</td></tr>
        <tr><td>Hidden size</td><td class="num">5,120</td><td>Every vector in the residual stream</td></tr>
        <tr><td>MLP width</td><td class="num">17,408</td><td>All 64 MLPs (SwiGLU)</td></tr>
        <tr><td>Vocabulary</td><td class="num">248,320</td><td>Embedding table and output head</td></tr>
        <tr><td>Attention heads</td><td class="num">24 query · 4 key/value</td><td><abbr>GQA</abbr>, head size 256</td></tr>
        <tr><td>DeltaNet heads</td><td class="num">16 query/key · 48 value</td><td>Head size 128, conv kernel 4</td></tr>
        <tr><td>Position encoding</td><td class="num">25% of head dims</td><td><abbr>mRoPE</abbr> on 64 of 256 dims, attention layers only</td></tr>
        <tr><td>Context</td><td class="num">262,144</td><td>Maximum tokens</td></tr>
        <tr><td>Output head</td><td class="num">not tied</td><td>Separate matrix from the embedding table</td></tr>
      </table></div>` },

    { prose: `
      <h3>Inside one Gated DeltaNet layer</h3>
      <p>These are the actual tensors stored for layer 0 (and 1, 2, 4, 5, 6, …), with their shapes as written in the model file and their exact parameter counts. Shapes are <code>[out, in]</code>.</p>` },

    { html: `<div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Tensor</th><th class="num">Shape</th><th class="num">Parameters</th><th>Role</th></tr>
        <tr><td><code>input_layernorm</code></td><td class="num">[5120]</td><td class="num">5,120</td><td>RMSNorm before the mixer</td></tr>
        <tr><td><code>linear_attn.in_proj_qkv</code></td><td class="num">[10240, 5120]</td><td class="num">52,428,800</td><td>Queries (2,048) + keys (2,048) + values (6,144) in one matrix</td></tr>
        <tr><td><code>linear_attn.in_proj_z</code></td><td class="num">[6144, 5120]</td><td class="num">31,457,280</td><td>Output gate (one per value channel)</td></tr>
        <tr><td><code>linear_attn.in_proj_a</code></td><td class="num">[48, 5120]</td><td class="num">245,760</td><td>Forget-gate input, one per value head</td></tr>
        <tr><td><code>linear_attn.in_proj_b</code></td><td class="num">[48, 5120]</td><td class="num">245,760</td><td>Write strength β, one per value head</td></tr>
        <tr><td><code>linear_attn.conv1d</code></td><td class="num">[10240, 1, 4]</td><td class="num">40,960</td><td>Short convolution over the last 4 tokens</td></tr>
        <tr><td><code>linear_attn.A_log</code></td><td class="num">[48]</td><td class="num">48</td><td>Per-head decay rate</td></tr>
        <tr><td><code>linear_attn.dt_bias</code></td><td class="num">[48]</td><td class="num">48</td><td>Per-head bias for the forget gate</td></tr>
        <tr><td><code>linear_attn.norm</code></td><td class="num">[128]</td><td class="num">128</td><td>Gated RMSNorm on each head's output</td></tr>
        <tr><td><code>linear_attn.out_proj</code></td><td class="num">[5120, 6144]</td><td class="num">31,457,280</td><td>Back to hidden size</td></tr>
        <tr><td><code>post_attention_layernorm</code></td><td class="num">[5120]</td><td class="num">5,120</td><td>RMSNorm before the MLP</td></tr>
        <tr><td><code>mlp.gate_proj</code></td><td class="num">[17408, 5120]</td><td class="num">89,128,960</td><td>SwiGLU gate</td></tr>
        <tr><td><code>mlp.up_proj</code></td><td class="num">[17408, 5120]</td><td class="num">89,128,960</td><td>SwiGLU up</td></tr>
        <tr><td><code>mlp.down_proj</code></td><td class="num">[5120, 17408]</td><td class="num">89,128,960</td><td>SwiGLU down</td></tr>
        <tr class="sum"><td>Token mixer (DeltaNet)</td><td></td><td class="num">115,876,064</td><td>30.2%</td></tr>
        <tr class="sum"><td>Whole layer</td><td></td><td class="num">383,273,184</td><td>≈ 383.3 M</td></tr>
      </table></div>` },

    { prose: `<h3>Inside one Gated Attention layer</h3>
      <p>Layers 3, 7, 11, …, 63 (counting from 0). The query projection is twice as tall as you might expect, because it produces both the 24 queries <em>and</em> a sigmoid output gate of the same size.</p>` },

    { html: `<div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Tensor</th><th class="num">Shape</th><th class="num">Parameters</th><th>Role</th></tr>
        <tr><td><code>input_layernorm</code></td><td class="num">[5120]</td><td class="num">5,120</td><td>RMSNorm before the mixer</td></tr>
        <tr><td><code>self_attn.q_proj</code></td><td class="num">[12288, 5120]</td><td class="num">62,914,560</td><td>24 queries × 256, plus a 24 × 256 output gate</td></tr>
        <tr><td><code>self_attn.k_proj</code></td><td class="num">[1024, 5120]</td><td class="num">5,242,880</td><td>4 key heads × 256</td></tr>
        <tr><td><code>self_attn.v_proj</code></td><td class="num">[1024, 5120]</td><td class="num">5,242,880</td><td>4 value heads × 256</td></tr>
        <tr><td><code>self_attn.q_norm</code></td><td class="num">[256]</td><td class="num">256</td><td>RMSNorm on each query head</td></tr>
        <tr><td><code>self_attn.k_norm</code></td><td class="num">[256]</td><td class="num">256</td><td>RMSNorm on each key head</td></tr>
        <tr><td><code>self_attn.o_proj</code></td><td class="num">[5120, 6144]</td><td class="num">31,457,280</td><td>24 heads × 256 → hidden size</td></tr>
        <tr><td><code>post_attention_layernorm</code></td><td class="num">[5120]</td><td class="num">5,120</td><td>RMSNorm before the MLP</td></tr>
        <tr><td><code>mlp.gate_proj</code> / <code>up_proj</code> / <code>down_proj</code></td><td class="num">as above</td><td class="num">267,386,880</td><td>SwiGLU</td></tr>
        <tr class="sum"><td>Token mixer (attention)</td><td></td><td class="num">104,858,112</td><td>28.2%</td></tr>
        <tr class="sum"><td>Whole layer</td><td></td><td class="num">372,255,232</td><td>≈ 372.3 M</td></tr>
      </table></div>` },

    { prose: `
      <h3>How wide is each part?</h3>
      <p>The residual stream is 5,120 numbers wide, but inside each layer the vector is temporarily made wider or narrower. These are the widths a single token's data passes through:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Where</th><th class="num">Width</th><th>Made of</th></tr>
        <tr><td>Residual stream</td><td class="num">5,120</td><td>The shared vector every layer reads and writes</td></tr>
        <tr><td>Attention: queries / output gate</td><td class="num">6,144 / 6,144</td><td>24 heads × 256</td></tr>
        <tr><td>Attention: keys, values</td><td class="num">1,024 each</td><td>4 heads × 256</td></tr>
        <tr><td>DeltaNet: queries, keys</td><td class="num">2,048 each</td><td>16 heads × 128</td></tr>
        <tr><td>DeltaNet: values / output gate</td><td class="num">6,144 / 6,144</td><td>48 heads × 128</td></tr>
        <tr><td>MLP neurons</td><td class="num">17,408</td><td>The widest point inside a layer</td></tr>
        <tr><td>Output scores (logits)</td><td class="num">248,320</td><td>One per vocabulary token, only at the very end</td></tr>
      </table></div>` },

    { widget: {
      id: "layer-map", title: "Explore all 64 layers",
      sub: "Click any part of the model to see its tensors, exact shapes and parameter counts. All numbers are computed from the tensor shapes in the published checkpoint.",
    } },

    { prose: `
      <h3>Why 64 layers, and not 32</h3>
      <p>The number of layers is a design choice, not a law of nature. The Qwen team has not published why it chose 64, but the trade-offs behind the choice are well understood. For a given budget of parameters, a model can be <strong>deep and narrow</strong> or <strong>shallow and wide</strong>. Each layer's size grows with the square of its width, so the same 24 billion layer parameters can be shaped in several ways:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Shape</th><th class="num">Layers × width</th><th class="num">Parameters (text model)</th><th>Steps per token</th></tr>
        <tr><td>Shallow and wide</td><td class="num">32 × 7,168</td><td class="num">≈ 27.4 B</td><td>32</td></tr>
        <tr><td><strong>Qwen3.8-27B</strong></td><td class="num">64 × 5,120</td><td class="num">26.9 B</td><td>64</td></tr>
        <tr><td>Deep and narrow</td><td class="num">128 × 3,584</td><td class="num">≈ 25.7 B</td><td>128</td></tr>
        <tr><td>Simply cut to 32 layers</td><td class="num">32 × 5,120</td><td class="num">≈ 14.7 B</td><td>32</td></tr>
      </table></div>
      <p class="c-muted">Computed with Qwen3.8's own layer proportions (3 DeltaNet layers to 1 attention layer; one layer ≈ 14.5 × width² parameters), plus the embedding and output tables.</p>
      <p><strong>At the same size, the shape matters surprisingly little.</strong> In the best-known study of how language models scale (Kaplan and colleagues, 2020), the ratio of width to depth could change by a factor of 40 while the quality of next-token prediction changed by only a few percent. A 32-layer model of the same total size would most likely be about as good, not half as good.</p>
      <p><strong>Depth still buys something.</strong> Every layer is one more step of refinement that happens <em>after</em> the previous one, and some problems need many steps in a row. Studies on smaller models find that deeper models handle multi-step reasoning better than wider ones of the same size, although the benefit shrinks as layers are added. The price is speed: layers cannot run at the same time for one token, so each extra layer adds a little delay. Wide layers are easier to spread across a chip's many cores.</p>
      <p><strong>Simply removing half the layers is different.</strong> A 32-layer Qwen3.8 at the same width would have about 14.7 billion parameters, roughly a model of the next size down. The Qwen family shows this pattern: the 32-billion and 27-billion models have 64 layers of width 5,120, the 14-billion model has 40 layers of the same width, and the 9-billion model has 32 layers of width 4,096. Experiments that cut layers out of a trained model (Gromov and colleagues, 2024) found that some large models keep their scores on question-answering tests with up to 40–50% of their layers removed, but maths reasoning gets worse as soon as any layer is taken away.</p>
      <p>There are also practical reasons for the exact number. The 3 : 1 pattern needs a multiple of 4, and every layer count in the Qwen3.5–3.8 hybrid family is one (64, 32, 24). Powers of two also divide evenly when a model is split across several chips. And 64 × 5,120 is exactly the shape of the earlier Qwen3-32B, which suggests the team kept a shape it already knew to train well.</p>` },

    { scene: {
      id: "depth-vs-width", title: "Deep and narrow, or shallow and wide",
      build: buildDepthWidth,
      visual: "Four model shapes drawn side by side to scale, each as a stack of slabs whose width is the hidden size and whose count is the number of layers (3:1 colouring kept). Below each: layers × width and parameter count, computed. A token pulse climbs each stack at the same speed per layer, so the 128-layer stack takes longest. A quality gauge above the first three stays almost level (labelled 'next-token quality: within a few %'), and a 'reasoning steps' counter shows 32 / 64 / 128. The fourth stack ('simply cut to 32 layers') is half as tall and visibly half the area; its parameter counter shows ≈ 14.7 B and a dimmer gauge, with a side note listing Qwen's own smaller models (14B: 40 × 5,120; 9B: 32 × 4,096).",
      cues: [
        { id: "budget", say: "The same budget of parameters can be shaped in different ways. Thirty-two wide layers, sixty-four medium ones like Qwen, or a hundred and twenty-eight narrow ones. All three hold about twenty-seven billion parameters.", vis: "Three stacks build bottom-up, drawn so area ∝ parameters: 32 × 7,168 (≈ 27.43 B) · 64 × 5,120 (26.90 B, Qwen, dashed outline) · 128 × 3,584 (≈ 25.65 B); counters computed from Qwen's per-layer proportions." },
        { id: "quality", say: "At the same size, the shape changes surprisingly little. In large studies of language models, quality differed by only a few percent across a very wide range of shapes.", vis: "Equal next-token-quality gauges under the three stacks with one bracket: 'within a few % of each other at equal size (Kaplan et al. 2020)'. No scores are shown." },
        { id: "steps", say: "Depth still matters for some things. Every layer is one more step of refinement in a row. Deeper models tend to be better at problems that need many steps, but each extra layer also adds a little delay.", vis: "A pulse climbs each stack at the same rate per layer; step counters 32 / 64 / 128; the deep stack finishes last." },
        { id: "cut", say: "Simply cutting Qwen to thirty-two layers would be something else: a model of about fifteen billion parameters, more like its smaller siblings, and weaker at reasoning.", vis: "Fourth stack: 32 × 5,120, about half the area, ≈ 14.72 B; its gauge is an empty dashed track labelled '≈ a smaller model'; side note 'Qwen's own smaller models: 14 B: 40 × 5,120 · 9 B: 32 × 4,096'." },
      ],
    } },

    { prose: `
      <h3>Where the 27.78 billion parameters live</h3>` },

    { html: `<div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Part</th><th class="num">Count</th><th class="num">Parameters</th><th class="num">Share</th></tr>
        <tr><td><span class="c-token">Embedding table</span> [248320, 5120]</td><td class="num">1</td><td class="num">1,271,398,400</td><td class="num">4.6%</td></tr>
        <tr><td><span class="c-delta">Gated DeltaNet layers</span></td><td class="num">48 × 383,273,184</td><td class="num">18,397,112,832</td><td class="num">66.2%</td></tr>
        <tr><td><span class="c-attn">Gated Attention layers</span></td><td class="num">16 × 372,255,232</td><td class="num">5,956,083,712</td><td class="num">21.4%</td></tr>
        <tr><td><span class="c-norm">Final norm</span></td><td class="num">1</td><td class="num">5,120</td><td class="num">0.0%</td></tr>
        <tr><td><span class="c-logit">Output head</span> (<code>lm_head</code>) [248320, 5120]</td><td class="num">1</td><td class="num">1,271,398,400</td><td class="num">4.6%</td></tr>
        <tr class="sum"><td>Text model</td><td></td><td class="num">26,895,998,464</td><td class="num">96.8%</td></tr>
        <tr><td><span class="c-vision">Vision encoder</span></td><td class="num">27 blocks + merger</td><td class="num">≈ 460.7 M</td><td class="num">1.7%</td></tr>
        <tr><td><span class="c-mtp">MTP head</span></td><td class="num">1 attention layer + fc</td><td class="num">≈ 424.7 M</td><td class="num">1.5%</td></tr>
        <tr class="sum"><td>Total</td><td></td><td class="num">27,781,427,952</td><td class="num">100%</td></tr>
      </table></div>
      <div class="lx-prose"><p>Check: 27,781,427,952 parameters × 2 bytes = 55,562,855,904 bytes, which is exactly the size recorded in the model's own file index.</p>
      <p>Grouped by <em>job</em> instead of by layer, the picture is clearer still. MLPs hold 17.11 B (61.6%), DeltaNet mixers 5.56 B (20.0%), attention mixers 1.68 B (6.0%), and the two vocabulary tables 2.54 B (9.2%). The 129 layer norms (two per layer plus the final one) hold just 660,480 parameters together.</p></div>` },

    { scene: {
      id: "param-census", title: "The parameter census",
      build: buildCensus,
      visual: "A single horizontal bar representing all 27,781,427,952 parameters (every number computed from tensor shapes) fills with coloured segments one cue at a time: MLPs (green, 61.6%), DeltaNet mixers (blue, 20.0%), attention mixers (violet, 6.0%), embedding (teal, 4.6%), output head (pink, 4.6%), vision (orchid, 1.7%), MTP (gold, 1.5%). Below it, a grid of 278 squares (one square = 100 M parameters, largest-remainder rounding) recolours to match, with a legend of exact counts on the right. A magnifier finally finds the norms: a hairline at the end of the bar.",
      cues: [
        { id: "bar",   say: "This bar is all twenty-seven point eight billion parameters. Let's colour it by job.", vis: "Empty bar and an empty grid of 278 squares; the total 27,781,427,952 above." },
        { id: "mlp",   say: "Most of it, about sixty-two percent, is the sixty-four M L Ps, the multi-layer perceptrons. That is where much of what the model knows is thought to be stored.", vis: "Green segment grows to 61.6%; 171 squares turn green; legend row 17.11 B." },
        { id: "mix",   say: "The token mixers take about a quarter. Twenty percent for the forty-eight DeltaNet layers, and six percent for the sixteen attention layers.", vis: "Blue 20.0% and violet 6.0% segments; squares and legend follow." },
        { id: "vocab", say: "The input and output tables, one row per vocabulary token, take about nine percent together. The vision encoder and the multi-token prediction head share the last three percent.", vis: "Teal, pink, orchid and gold segments complete the bar and the grid." },
        { id: "norms", say: "And the normalisation weights, two in every layer plus one at the top, add up to only about six hundred and sixty thousand numbers. Too small to even see.", vis: "A magnifier over the end of the bar finds a hairline: 660,480 norm weights · 0.002% of the model." },
      ],
    } },

    { prose: `
      <h3>How much memory does it need?</h3>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Format</th><th class="num">Bits per weight</th><th class="num">Size</th><th>Notes</th></tr>
        <tr><td><abbr>bf16</abbr> (original)</td><td class="num">16</td><td class="num">55.6 GB</td><td>As published</td></tr>
        <tr><td>Q8_0</td><td class="num">≈ 8.5</td><td class="num">≈ 29 GB</td><td>Practically lossless</td></tr>
        <tr><td><abbr>Q4</abbr> (Q4_K_M)</td><td class="num">≈ 5.6</td><td class="num">19.0 GB</td><td>Popular for desktops; small quality loss</td></tr>
      </table></div>
      <p>Weights are not the only memory cost. While the model writes, it also keeps a cache of past work for each conversation (<a href="#kv-cache">Chapter 14</a>).</p>` },

    { deep: `
      <h3>Reproducing the count yourself</h3>
      <p>With hidden size <i>d</i> = 5,120, MLP width <i>f</i> = 17,408 and vocabulary <i>V</i> = 248,320:</p>
      <ul>
        <li>MLP: 3<i>df</i> = 3 · 5,120 · 17,408 = 267,386,880.</li>
        <li>DeltaNet mixer: <i>d</i>(2 · 2,048 + 6,144) + <i>d</i> · 6,144 + 2 · 48<i>d</i> + 10,240 · 4 + 48 + 48 + 128 + 6,144<i>d</i> = 115,876,064.</li>
        <li>Attention mixer: <i>d</i> · 12,288 + 2 · <i>d</i> · 1,024 + 6,144 · <i>d</i> + 2 · 256 = 104,858,112.</li>
        <li>Two layer norms: 2<i>d</i> = 10,240.</li>
        <li>Text model: 48 · 383,273,184 + 16 · 372,255,232 + 2<i>Vd</i> + <i>d</i> = 26,895,998,464.</li>
      </ul>
      <p>Note that 24 heads × 256 = 6,144, which is <em>larger</em> than the hidden size of 5,120. The attention block widens the vector internally before <code>o_proj</code> narrows it back down. The same happens in DeltaNet, where 48 value heads × 128 = 6,144.</p>
      <h3>Compute per token</h3>
      <p>Each weight is used for one multiply-add per token, so a forward pass costs about 2 × 26.9 B ≈ 54 billion operations for the text model (the embedding lookup is free, so strictly 2 × 25.6 B ≈ 51 billion). Attention over the cache adds 2 × 16 layers × 24 heads × 256 × 2 ≈ 0.4 million operations per earlier token. That is small at short context but grows with conversation length.</p>` },
  ],
});
})();
