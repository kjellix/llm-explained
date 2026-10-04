/* Chapter 15 — Multi-token prediction and speculative decoding */
LX.chapter({
  id: "mtp", num: 15, title: "Multi-token prediction and speculative decoding", toc: "MTP & speculative decoding",
  kicker: "Guess ahead, check in one go",
  lede: "Writing is slow because the whole model must be read from memory for every single token. Speculative decoding guesses several tokens cheaply, then lets the big model check them all at once.",
  body: [
    { prose: `
      <p>Chapter 13 showed that decoding is limited by memory, not arithmetic. To write one token, the computer reads essentially every weight of the model, does a little maths with them, and throws most of its computing power away. Checking five tokens at once costs almost the same as checking one, because the weights are read only once either way.</p>
      <p>Speculative decoding uses that spare capacity. A cheap <strong>drafter</strong> guesses the next few tokens. The big model then <strong>verifies</strong> all the guesses in a single pass. Every guess it agrees with is a token you got almost for free.</p>` },

    { scene: {
      id: "spec-decode", title: "Draft, verify, accept",
      visual: "Top row: the text so far. A small, dim drafter box quickly emits three amber-dashed draft chips. The big 64-layer stack then takes all draft chips at once (one pulse, like a mini prefill). Above each draft chip a check or cross appears. Accepted chips turn solid; the first rejected chip is replaced by the big model's own token; the rest fade away.",
      cues: [
        { id: "slow",   say: "Normally, the model writes one token per pass. Each pass reads every weight from memory, and most of the chip's arithmetic sits idle.", vis: "The big stack pulses once per token; the 'normal' timeline gets one block per pass; the compute meter stays near 10 %; counter: 1 pass → 1 token." },
        { id: "draft",  say: "With speculative decoding, a small, fast drafter first guesses the next few tokens. Here it proposes three: on, the, mat.", vis: "The gold drafter box glows and sends three dashed draft chips below the stack: ·on ·the ·mat." },
        { id: "verify", say: "The big model now reads all three guesses in a single pass, just like a short prefill. For every position, it computes what it would have written itself.", vis: "One light pulse climbs the stack for all three positions at once; the big model's own tokens appear above: ·on ·the ·floor; compute meter rises to 30 %." },
        { id: "accept", say: "Wherever the guesses match, they are accepted. At the first mismatch we stop, and keep the big model's own token there instead.", vis: "Green ticks over ·on and ·the (they turn solid); a pink cross over ·mat, which fades; the model's ·floor glows; 'on the floor' joins the text." },
        { id: "gain",   say: "One pass produced three tokens instead of one. And because the big model checked every token, the text is exactly what it would have written anyway.", vis: "Counter: 1 pass → 3 tokens. The speculative timeline gets one block (gold drafting sliver + '3 tok') against three normal blocks; formula box: α = 0.7, k = 3 → (1 − α⁴)/(1 − α) = 2.53; 'Output: identical to normal decoding'." },
        { id: "cost",   say: "The catch is that bad guesses waste work. If the drafter is often wrong, the extra drafting and checking can make generation slower, not faster.", vis: "Second round: drafts ·and ·purred ·.; the model writes '.'; a cross on ·and, the rest fade; counter: 1 pass → 1 token; timelines: 4 normal blocks vs 2 speculative blocks with gold drafting cost; formula: α = 0.3 → 1.42." },
      ],
    } },

    { prose: `
      <h3>Qwen3.8's built-in drafter: the MTP head</h3>
      <p>Qwen3.8-27B ships with its own drafter, an <abbr>MTP</abbr> module. It is one extra layer that sits on top of the main model and predicts the token <em>after</em> the next one.</p>
      <ul>
        <li>It takes two inputs: the main model's final hidden state for the current position, and the embedding of the token just chosen. Each is normalised with its own <abbr>RMSNorm</abbr>, the two 5,120-number vectors are joined into 10,240 numbers, and a matrix squeezes them back to 5,120.</li>
        <li>That vector goes through <strong>one full gated-attention layer with its own <abbr>MLP</abbr></strong>, the same design as the model's 16 attention layers.</li>
        <li>It <strong>reuses</strong> the main model's embedding table and output head, so it can predict any of the 248,320 tokens without storing another 2.5 billion parameters.</li>
      </ul>
      <p>All of this costs 424.7 million parameters, about 1.5% of the model. Running it is much cheaper than running 64 layers, so it can draft one or more tokens ahead between big passes.</p>` },

    { html: `<div class="lx-table-wrap"><table class="lx-table">
        <tr><th>MTP part</th><th>Shape</th><th class="num">Parameters</th></tr>
        <tr><td>Norms: two input norms, two in-layer norms, one output norm</td><td class="mono">5 × [5120]</td><td class="num">25,600</td></tr>
        <tr><td>Combine (fc)</td><td class="mono">[10240 → 5120]</td><td class="num">52,428,800</td></tr>
        <tr><td>Gated attention (24 Q heads, 4 KV heads, head size 256)</td><td class="mono">q, k, v, o</td><td class="num">104,858,112</td></tr>
        <tr><td>SwiGLU MLP</td><td class="mono">5120 → 17408 → 5120</td><td class="num">267,386,880</td></tr>
        <tr><td>Embedding table and output head</td><td>shared with main model</td><td class="num">0</td></tr>
        <tr class="sum"><td>Total</td><td></td><td class="num">≈ 424.7 M</td></tr>
      </table></div>` },

    { scene: {
      id: "mtp-head", title: "How the MTP head drafts the token after next",
      visual: "Right side: the top of the main 64-layer stack outputs a teal hidden-state vector and a chosen token (·on). Two small norm boxes take the hidden state and the embedding of ·on; their vectors join into one long 10,240 strip, which a matrix block shrinks to 5,120. One violet attention+MLP block processes it, and the shared output head (same block as the main model's, drawn with a dashed link) produces bars for the token after next (·the).",
      cues: [
        { id: "inputs",  say: "The multi-token prediction head starts from two things: the main model's last hidden state, and the token that was just picked.", vis: "Teal vector from the stack top; token chip ·on looked up in the shared embedding table." },
        { id: "combine", say: "Each is normalised, the two vectors are placed end to end, ten thousand two hundred and forty numbers, and one matrix folds them back down to five thousand one hundred and twenty.", vis: "Two RMSNorm boxes light up; a joined strip [10240] (embedding cells outlined amber, hidden-state cells teal) folds through the gold fc block (52,428,800 weights) into a [5120] vector; tally adds fc and norms." },
        { id: "layer",   say: "Then comes a single gated attention layer with its own feed-forward block, built exactly like one of the model's sixteen attention layers.", vis: "The violet 'gated attention + MLP' block lights up as a pulse passes through; tally adds 104,858,112 + 267,386,880." },
        { id: "head",    say: "Finally it borrows the main model's output head to score every token in the vocabulary. Its favourite becomes the draft for the token after next.", vis: "Dashed lm_head block (borrowed from the main model); bars ·the 58 % · ·a 17 % · ·his 6 % (illustrative); ·the becomes a dashed gold draft chip for token t + 2; total: 424,699,392 ≈ 424.7 M, 1.5 % of the model." },
      ],
    } },

    { prose: `
      <h3>Why the output stays exactly the same</h3>
      <p>The drafter only ever <em>suggests</em>. Every token that reaches you was checked by the full model at its proper position. With greedy decoding (always the top token), a draft is accepted only if it is exactly the token the big model would have picked, so the text is identical. With sampling, a slightly cleverer accept/reject rule keeps the probabilities exactly the same as normal sampling. Speculative decoding changes the <strong>speed</strong>, never the <strong>result</strong>.</p>

      <h3>When it helps, and when it does not</h3>
      <p>The gain depends almost entirely on the <strong>acceptance rate</strong>: how often the drafter guesses right. Predictable text such as boilerplate code, repeated phrases or reformatting is drafted well. Free-flowing prose and tricky code are guessed less often. Every rejected draft still cost drafting time and a wider verification pass. If acceptance is low, those costs can outweigh the gains and generation gets <em>slower</em>. Whether speculation pays off depends on the model, the hardware and the kind of text, so it is worth measuring rather than assuming.</p>

      <h3>Other drafters</h3>
      <p>The MTP head is not the only option. A separate small model can act as the drafter, either a tiny model from the same family or one trained specifically to imitate the big model's next-token choices. Some newer drafters propose a whole block of tokens in one go instead of one at a time. The verify-and-accept step is the same in every case.</p>` },

    { widget: { id: "spec-calc", title: "Speculation calculator",
      sub: "Set how often drafts are accepted, how many tokens are drafted, and what drafting and verifying cost. The numbers update live." } },

    { deep: `
      <h3>Expected tokens per verification pass</h3>
      <p>Assume each drafted token is accepted independently with probability α, and the drafter proposes <i>k</i> tokens. The big model always contributes one token of its own: either the correction at the first mismatch, or a bonus token after all <i>k</i> are accepted. The expected number of tokens produced per big-model pass is</p>
      <math display="block"><mrow><mi>E</mi><mo>[</mo><mtext>tokens</mtext><mo>]</mo><mo>=</mo><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>0</mn></mrow><mi>k</mi></munderover><msup><mi>α</mi><mi>i</mi></msup><mo>=</mo><mfrac><mrow><mn>1</mn><mo>−</mo><msup><mi>α</mi><mrow><mi>k</mi><mo>+</mo><mn>1</mn></mrow></msup></mrow><mrow><mn>1</mn><mo>−</mo><mi>α</mi></mrow></mfrac></mrow></math>
      <div class="lx-read">α is the chance that one drafted token is accepted, and k is how many tokens are drafted. Add up 1 + α + α<sup>2</sup> + … + α<sup>k</sup>: the 1 is the token the big model always contributes, α is the chance the first draft survives, α<sup>2</sup> the chance the first two survive, and so on. The fraction on the right is a shortcut for the same sum. Example from the text: α = 0.7, k = 3 gives 1 + 0.7 + 0.49 + 0.343 ≈ 2.53 tokens per pass of the big model.</div>
      <p>With α = 0.7 and <i>k</i> = 3: (1 − 0.7<sup>4</sup>) / 0.3 = (1 − 0.2401) / 0.3 ≈ <strong>2.53 tokens per pass</strong>. With α = 0.5: (1 − 0.0625) / 0.5 ≈ 1.88. If a pass with drafting costs <i>c</i> times a normal pass, the speed-up is roughly E[tokens] / <i>c</i>. That falls below 1 when acceptance is poor.</p>
      <h3>Keeping the distribution exact when sampling</h3>
      <p>Let <i>p</i> be the big model's distribution and <i>q</i> the drafter's. A drafted token <i>x</i> is accepted with probability min(1, <i>p</i>(<i>x</i>) / <i>q</i>(<i>x</i>)). On rejection, a replacement is sampled from the leftover distribution, proportional to max(0, <i>p</i> − <i>q</i>). The resulting tokens are distributed exactly according to <i>p</i>, as if no drafter had been used.</p>
      <h3>Why verification is nearly free</h3>
      <p>Verifying <i>k</i> + 1 positions multiplies a <code>[k+1, 5120]</code> matrix by each weight matrix instead of a <code>[1, 5120]</code> vector. The weights, which are the expensive memory reads, are fetched once for all positions. As long as <i>k</i> + 1 is small, the pass is still memory-bound and takes about as long as decoding a single token.</p>` },
  ],
});

/* ---------------------------------------------------------------------------
   Chapter 15 animations: speculative decoding and the MTP head.
   All counts (tokens per pass, parameter totals) are computed here.
   --------------------------------------------------------------------------- */
(function () {
  "use strict";
  const D = LX.draw, el = LX.el, col = LX.col, mix = LX.mix, clamp = LX.clamp, E = LX.ease;
  const ch = LX.chapters.find(c => c.id === "mtp");
  const scene = id => ch.body.find(b => b.scene && b.scene.id === id).scene;
  const int = n => Math.round(n).toLocaleString("en-US");
  const expTokens = (a, k) => (1 - Math.pow(a, k + 1)) / (1 - a);   // 1 + a + … + a^k

  /** check mark / cross drawn as paths, scaled by p */
  function tick(parent, x, y, ok) {
    const g = el("g", { transform: `translate(${x} ${y})`, opacity: 0 }, parent);
    el("circle", { r: 15, fill: mix("bg", ok ? "mlp" : "logit", .18), stroke: col(ok ? "mlp" : "logit"), "stroke-width": 1.5 }, g);
    el("path", { d: ok ? "M-7 0 L-2 5 L7 -6" : "M-6 -6 L6 6 M6 -6 L-6 6", stroke: col(ok ? "mlp" : "logit"), "stroke-width": 2.6, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    return { g, show(p) { g.setAttribute("opacity", p); g.setAttribute("transform", `translate(${x} ${y}) scale(${0.6 + 0.4 * E.back(clamp(p))})`); } };
  }
  /** a token chip whose outline can be dashed (draft) or solid */
  function chip(parent, o) {
    const c = D.tokenChip(parent, o);
    return Object.assign(c, { dashed(on) { c.box.setAttribute("stroke-dasharray", on ? "6 5" : "none"); } });
  }
  const setFill = (r, k, a) => r.setAttribute("fill", mix("bg", k, a));

  /* ============================================================ spec-decode */
  scene("spec-decode").build = function (ctx) {
    const svg = ctx.svg;
    D.backdrop(svg);
    const A1 = 0.7, A2 = 0.3, K = 3;
    const E1 = expTokens(A1, K), E2 = expTokens(A2, K);

    /* text so far */
    D.label(svg, 80, 92, "Text so far");
    const txt = D.text(svg, 80, 150, "The cat sat", { size: 40, weight: 600 });
    const adds = [" on", " the", " floor", "."].map(w => { const s = el("tspan", { "fill-opacity": 0 }, txt); s.textContent = w; return s; });

    /* big model stack */
    const sx = 600, sw = 420, top = 290, N = 16, sh = 14, sg = 6;
    D.label(svg, sx, 280, "Qwen3.8-27B · 64 layers");
    const slabs = [];
    for (let i = 0; i < N; i++) {
      const attn = i % 4 === 3, y = top + (N - 1 - i) * (sh + sg);
      slabs.push({ r: el("rect", { x: sx, y, width: sw, height: sh, rx: 3, fill: mix("bg", attn ? "attn" : "delta", attn ? .32 : .14), stroke: col(attn ? "attn" : "delta"), "stroke-width": 1 }, svg), attn });
    }
    const bot = top + N * (sh + sg) - sg;
    const band = el("rect", { x: sx - 6, y: bot, width: sw + 12, height: 16, rx: 5, fill: col("embed"), opacity: 0, filter: "url(#lx-glow)" }, svg);
    const pulseAt = q => {                         // q in 0..1, bottom → top
      if (q <= 0 || q >= 1) { band.setAttribute("opacity", 0); slabs.forEach(s => setFill(s.r, s.attn ? "attn" : "delta", s.attn ? .32 : .14)); return; }
      const y = bot - q * (bot - top) - 8;
      band.setAttribute("y", y); band.setAttribute("opacity", .55);
      slabs.forEach((s, i) => { const sy = top + (N - 1 - i) * (sh + sg); const near = clamp(1 - Math.abs(sy - y) / 40); setFill(s.r, s.attn ? "attn" : "delta", (s.attn ? .32 : .14) + near * .45); });
    };

    /* columns for the three positions */
    const CX = [700, 810, 920], CW = 100;
    const drafts1 = [" on", " the", " mat"], outs1 = [" on", " the", " floor"];
    const drafts2 = [" and", " purred", "."], outs2 = ["."];
    const mk = (words, y, color) => words.map((w, i) => chip(svg, { x: CX[i] - CW / 2, y, w: CW, h: 50, text: w, color, size: 22 }));
    const d1 = mk(drafts1, 680, "token"), o1 = mk(outs1, 196, "logit");
    const d2 = mk(drafts2, 680, "token"), o2 = mk(outs2, 196, "logit");
    [...d1, ...d2].forEach(c => c.dashed(true));
    const t1 = [tick(svg, CX[0] + 44, 668, true), tick(svg, CX[1] + 44, 668, true), tick(svg, CX[2] + 44, 668, false)];
    const t2 = [tick(svg, CX[0] + 44, 668, false)];
    const lDraft = D.label(svg, 600, 760, "draft · proposed by the drafter", { color: "token" });
    const lOut = D.label(svg, 630, 226, "big model writes", { color: "logit", size: 12, anchor: "end" });

    /* drafter */
    const drafter = D.block(svg, { x: 120, y: 660, w: 280, h: 70, kind: "mtp", label: "drafter", sub: "small and fast · MTP head" });
    const dArrow = D.arrow(svg, { d: "M400 695 C 480 695, 540 705, 640 705", color: "mtp" });

    /* right panel: compute meter, counter, formula, timeline */
    const RX = 1120, RW = 400;
    D.label(svg, RX, 104, "Compute used per pass");
    el("rect", { x: RX, y: 116, width: RW, height: 14, rx: 3, fill: col("line") }, svg);
    const meter = el("rect", { x: RX, y: 116, width: 0, height: 14, rx: 3, fill: col("embed") }, svg);
    const meterTxt = D.text(svg, RX + RW, 104, "", { mono: true, size: 14, color: "muted", anchor: "end" });
    const counter = D.text(svg, RX, 196, "", { size: 34, weight: 650 });
    const counterSub = D.text(svg, RX, 226, "", { size: 16, color: "text-2" });
    const fBox = el("rect", { x: RX, y: 262, width: RW, height: 108, rx: 8, fill: col("panel"), stroke: col("line-2") }, svg);
    const f1 = D.text(svg, RX + 18, 296, "", { mono: true, size: 15, color: "mtp" });
    const f2 = D.text(svg, RX + 18, 324, "expected tokens per pass", { size: 15, color: "text-2" });
    const f3 = D.text(svg, RX + 18, 354, "", { mono: true, size: 18, weight: 600 });
    const fGroup = [fBox, f1, f2, f3];

    D.label(svg, RX, 448, "Passes of the big model over time");
    const laneY = { normal: 492, spec: 572 };
    D.text(svg, RX, laneY.normal - 12, "normal", { size: 14, color: "muted" });
    D.text(svg, RX, laneY.spec - 12, "speculative", { size: 14, color: "muted" });
    const lane = (y, n) => Array.from({ length: n }, (_, i) => {
      const g = el("g", { opacity: 0 }, svg);
      const r = el("rect", { x: 0, y, width: 0, height: 30, rx: 4, fill: mix("bg", "delta", .35), stroke: col("delta") }, g);
      const tt = D.text(g, 0, y + 21, "", { mono: true, size: 14, anchor: "middle" });
      return { g, r, tt };
    });
    const normal = lane(laneY.normal, 4), spec = lane(laneY.spec, 2);
    const specCost = [0, 1].map(() => el("rect", { x: 0, y: laneY.spec, width: 0, height: 30, rx: 3, fill: mix("bg", "mtp", .5), stroke: col("mtp"), opacity: 0 }, svg));
    const setBlock = (b, x, w, label) => { b.r.setAttribute("x", x); b.r.setAttribute("width", w); b.tt.setAttribute("x", x + w / 2); b.tt.textContent = label; };
    const PW = 70, PG = 10;
    normal.forEach((b, i) => setBlock(b, RX + i * (PW + PG), PW, "1 tok"));
    setBlock(spec[0], RX + 22, PW, "3 tok"); setBlock(spec[1], RX + 22 + PW + PG + 22, PW, "1 tok");
    specCost.forEach((r, i) => { r.setAttribute("x", RX + i * (PW + PG + 22)); r.setAttribute("width", 18); });
    const unchanged = D.text(svg, RX, 652, "Output: identical to normal decoding", { size: 17, color: "mlp", weight: 600, opacity: 0 });
    const wasted = D.text(svg, RX, 682, "", { size: 14, color: "logit" });

    return t => {
      /* slow: three ordinary passes, one token each */
      const s = k => ctx.p(t, "slow", .1 + k * .28, .34 + k * .28, E.inOut);
      const slowQ = [0, 1, 2].map(s);
      const sv = ctx.p(t, "verify", .12, .55, E.inOut), sc = ctx.p(t, "cost", .35, .55, E.inOut);
      const live = slowQ.find(q => q > 0 && q < 1) ?? (sv > 0 && sv < 1 ? sv : (sc > 0 && sc < 1 ? sc : 0));
      pulseAt(live);
      normal.forEach((b, i) => D.fade(b.g, i < 3 ? slowQ[i] > .95 ? 1 : 0 : ctx.p(t, "cost", .75, .85)));
      const meterV = t < ctx.cue("verify").start ? (ctx.p(t, "slow", .1, .3) * .1) : .1 + .2 * ctx.p(t, "verify", .3, .6);
      meter.setAttribute("width", RW * meterV); meterTxt.textContent = Math.round(meterV * 100) + " %";

      /* draft */
      D.fade(drafter.g, ctx.p(t, "draft", 0, .2)); drafter.pulse(ctx.active(t, "draft") ? ctx.p(t, "draft", .1, .5) : 0);
      dArrow.draw(ctx.p(t, "draft", .15, .4));
      const out1 = ctx.p(t, "cost", 0, .15);                  // first round leaves during "cost"
      d1.forEach((c, i) => {
        const p = ctx.p(t, "draft", .3 + i * .15, .55 + i * .15);
        const rejectFade = i === 2 ? ctx.p(t, "accept", .45, .7) : 0;
        c.show(p * (1 - rejectFade) * (1 - out1));
        c.dashed(!(i < 2 && ctx.p(t, "accept", .3, .4) >= 1));
      });
      D.fade(lDraft, ctx.p(t, "draft", .3, .5));
      dArrow.g.setAttribute("opacity", 1 - out1);

      /* verify: big model's own tokens above */
      o1.forEach((c, i) => c.show(ctx.p(t, "verify", .55 + i * .1, .75 + i * .1) * (1 - out1)));
      D.fade(lOut, ctx.p(t, "verify", .6, .8));

      /* accept */
      t1.forEach((k, i) => k.show(ctx.p(t, "accept", .05 + i * .12, .25 + i * .12) * (1 - out1)));
      o1[2].glow(ctx.p(t, "accept", .4, .5) > 0 && out1 < 1);
      const toText = ctx.p(t, "accept", .7, .95);
      adds.slice(0, 3).forEach((sp, i) => sp.setAttribute("fill-opacity", clamp(toText * 3 - i)));
      adds[2].setAttribute("fill", col("logit"));

      /* gain */
      const g = ctx.p(t, "gain", 0, .2);
      if (t < ctx.cue("cost").start + ctx.cue("cost").dur * .7) {
        counter.textContent = g > 0 ? "1 pass → 3 tokens" : (t >= ctx.cue("slow").start ? "1 pass → 1 token" : "");
        counterSub.textContent = g > 0 ? "two accepted drafts + the model's own token" : (t >= ctx.cue("slow").start ? "ordinary decoding" : "");
      }
      D.fade(counter, Math.max(ctx.p(t, "slow", 0, .1), 0)); D.fade(counterSub, ctx.p(t, "slow", 0, .1));
      D.fade(spec[0].g, ctx.p(t, "gain", .2, .4)); D.fade(specCost[0], ctx.p(t, "gain", .2, .4));
      const fShow = ctx.p(t, "gain", .45, .65);
      fGroup.forEach(n => D.fade(n, fShow));
      const useLow = ctx.p(t, "cost", .75, .8) >= 1;
      f1.textContent = useLow ? `α = ${A2} (bad drafts) · k = ${K}` : `α = ${A1} · k = ${K}`;
      f3.textContent = `(1 − α^${K + 1}) / (1 − α) = ${(useLow ? E2 : E1).toFixed(2)}`;
      D.fade(unchanged, ctx.p(t, "gain", .6, .8));

      /* cost: a round where the first draft is wrong */
      d2.forEach((c, i) => {
        const p = ctx.p(t, "cost", .15 + i * .05, .3 + i * .05);
        const fade = i > 0 ? ctx.p(t, "cost", .62, .75) : 0;
        c.show(p * (1 - fade));
      });
      o2[0].show(ctx.p(t, "cost", .5, .6));
      t2[0].show(ctx.p(t, "cost", .58, .68));
      adds[3].setAttribute("fill-opacity", ctx.p(t, "cost", .7, .8));
      if (ctx.p(t, "cost", .75, .8) >= 1) { counter.textContent = "1 pass → 1 token"; counterSub.textContent = "first draft rejected · drafting work wasted"; }
      D.fade(spec[1].g, ctx.p(t, "cost", .75, .85)); D.fade(specCost[1], ctx.p(t, "cost", .75, .85));
      wasted.textContent = ctx.p(t, "cost", .8, .9) > 0 ? "gold = drafting cost · pays off only when drafts are accepted" : "";
    };
  };

  /* =============================================================== mtp-head */
  scene("mtp-head").build = function (ctx) {
    const svg = ctx.svg;
    D.backdrop(svg);
    const H = 5120;
    const P = { norms: 5 * H, fc: 2 * H * H, attn: H * 12288 + 2 * H * 1024 + 6144 * H + 2 * 256, mlp: 3 * H * 17408 };
    const total = P.norms + P.fc + P.attn + P.mlp;          // 424,699,392
    const MODEL = 27781427952;
    const R = LX.rng(15);
    const vals = n => Array.from({ length: n }, () => (R() * 2 - 1) * (.3 + R() * .7));

    /* sources */
    D.label(svg, 80, 92, "Inputs");
    const stack = [];
    for (let i = 0; i < 6; i++) {
      const attn = i % 4 === 3;
      stack.push(el("rect", { x: 80, y: 120 + i * 18, width: 230, height: 12, rx: 3, fill: mix("bg", attn ? "attn" : "delta", attn ? .3 : .14), stroke: col(attn ? "attn" : "delta") }, svg));
    }
    D.text(svg, 80, 250, "main model · top of the 64 layers", { size: 15, color: "text-2" });
    const hArrow = D.arrow(svg, { x1: 320, y1: 160, x2: 410, y2: 160, color: "embed" });
    const hVec = D.vector(svg, { x: 430, y: 160, values: vals(14), cell: 22, gap: 4, dir: "h" });
    const hLab = D.text(svg, 430, 130, "h  ·  final hidden state at position t  [5120]", { mono: true, size: 14, color: "embed" });

    const onChip = D.tokenChip(svg, { x: 80, y: 312, w: 110, h: 52, text: " on", color: "token", size: 22 });
    const embBox = D.block(svg, { x: 210, y: 312, w: 150, h: 52, kind: "embed", label: "embedding", sub: "shared with main" });
    embBox.r.setAttribute("stroke-dasharray", "6 4");
    const eArrow = D.arrow(svg, { x1: 365, y1: 338, x2: 410, y2: 338, color: "token" });
    const eVec = D.vector(svg, { x: 430, y: 338, values: vals(14), cell: 22, gap: 4, dir: "h" });
    const eLab = D.text(svg, 430, 308, "embedding of the token just chosen (t + 1)  [5120]", { mono: true, size: 14, color: "token" });

    /* combine */
    const n1 = D.block(svg, { x: 820, y: 140, w: 130, h: 40, kind: "norm", label: "RMSNorm", size: 14 });
    const n2 = D.block(svg, { x: 820, y: 318, w: 130, h: 40, kind: "norm", label: "RMSNorm", size: 14 });
    const joined = el("g", {}, svg);
    const jv = vals(28), cells = [];
    jv.forEach((v, i) => cells.push(el("rect", { x: 300 + i * 26, y: 440, width: 22, height: 22, rx: 3, fill: LX.valueColor(v), stroke: col(i < 14 ? "token" : "embed"), "stroke-width": 1 }, joined)));
    const jLab = D.text(svg, 300, 426, "embedding ‖ hidden state, end to end  [10240]", { mono: true, size: 14, color: "text-2" });
    const fc = D.block(svg, { x: 560, y: 500, w: 250, h: 60, kind: "mtp", label: "fc · 10240 → 5120", sub: int(P.fc) + " weights" });
    const fcArrow = D.arrow(svg, { x1: 664, y1: 466, x2: 664, y2: 498, color: "mtp" });
    const outVec = D.vector(svg, { x: 520, y: 610, values: vals(13), cell: 22, gap: 4, dir: "h" });
    const ovArrow = D.arrow(svg, { x1: 685, y1: 562, x2: 685, y2: 596, color: "mtp" });

    /* layer */
    const layer = D.block(svg, { x: 900, y: 580, w: 280, h: 62, kind: "attn", label: "gated attention + MLP", sub: "one layer · like the 16 in the model" });
    const lArrow = D.arrow(svg, { x1: 862, y1: 611, x2: 898, y2: 611, color: "attn" });

    /* head */
    const head = D.block(svg, { x: 1230, y: 580, w: 290, h: 62, kind: "logit", label: "lm_head", sub: "borrowed from the main model" });
    head.r.setAttribute("stroke-dasharray", "7 5");
    const hdArrow = D.arrow(svg, { x1: 1182, y1: 611, x2: 1228, y2: 611, color: "logit" });
    const bars = D.bars(svg, { x: 1230, y: 690, w: 290, row: 46, items: [[" the", .58], [" a", .17], [" his", .06]] });
    const draft = D.tokenChip(svg, { x: 1010, y: 690, w: 120, h: 54, text: " the", color: "mtp", size: 24 });
    draft.box.setAttribute("stroke-dasharray", "6 5");
    const dLab = D.text(svg, 1070, 772, "draft for token t + 2", { size: 15, color: "mtp", anchor: "middle" });

    /* parameter tally */
    D.label(svg, 80, 720, "Parameters of the MTP head");
    const tally = [
      ["fc", P.fc, "mtp"], ["gated attention", P.attn, "attn"], ["MLP", P.mlp, "mlp"], ["norms", P.norms, "norm"],
    ].map(([k, v, c], i) => {
      const t1 = D.text(svg, 80, 756 + i * 26, k, { size: 15, color: c });
      const t2 = D.text(svg, 420, 756 + i * 26, int(v), { mono: true, size: 15, anchor: "end" });
      return [t1, t2];
    });
    const totalT = D.text(svg, 80, 874, `total ${int(total)} ≈ ${(total / 1e6).toFixed(1)} M · ${(total / MODEL * 100).toFixed(1)} % of the model`, { size: 16, weight: 600, color: "mtp" });

    const pulse = el("circle", { r: 7, fill: col("embed"), filter: "url(#lx-glow)", opacity: 0 }, svg);
    const path = el("path", { d: "M664 470 L664 610 L1200 611 L1380 611", fill: "none" }, svg);
    const PL = path.getTotalLength();

    return t => {
      /* inputs */
      const a = ctx.p(t, "inputs", 0, .3), b = ctx.p(t, "inputs", .35, .7);
      hArrow.draw(a); hVec.reveal(ctx.p(t, "inputs", .2, .5, E.linear)); D.fade(hLab, a);
      onChip.show(ctx.p(t, "inputs", .4, .55)); D.fade(embBox.g, ctx.p(t, "inputs", .5, .65));
      eArrow.draw(ctx.p(t, "inputs", .6, .75)); eVec.reveal(ctx.p(t, "inputs", .65, .95, E.linear)); D.fade(eLab, ctx.p(t, "inputs", .7, .9));
      stack.forEach((r, i) => r.setAttribute("opacity", 1));

      /* combine */
      n1.show(ctx.p(t, "combine", 0, .15)); n2.show(ctx.p(t, "combine", .05, .2));
      n1.pulse(ctx.active(t, "combine") ? ctx.p(t, "combine", .1, .3) * (1 - ctx.p(t, "combine", .35, .5)) : 0);
      n2.pulse(ctx.active(t, "combine") ? ctx.p(t, "combine", .15, .35) * (1 - ctx.p(t, "combine", .35, .5)) : 0);
      const j = ctx.p(t, "combine", .3, .6, E.inOut);
      cells.forEach((c, i) => c.setAttribute("opacity", clamp(j * 1.4 - i / 40)));
      D.fade(jLab, ctx.p(t, "combine", .45, .6));
      fcArrow.draw(ctx.p(t, "combine", .6, .7)); fc.show(ctx.p(t, "combine", .62, .75));
      ovArrow.draw(ctx.p(t, "combine", .78, .86)); outVec.reveal(ctx.p(t, "combine", .8, 1, E.linear));

      /* layer */
      lArrow.draw(ctx.p(t, "layer", 0, .2)); layer.show(ctx.p(t, "layer", .1, .35));
      layer.pulse(ctx.active(t, "layer") ? Math.sin(Math.PI * ctx.p(t, "layer", .3, 1, E.linear)) : 0);

      /* head */
      hdArrow.draw(ctx.p(t, "head", 0, .15)); head.show(ctx.p(t, "head", .05, .25));
      bars.grow(ctx.p(t, "head", .25, .6));
      bars.rows.forEach(r => r.bg.setAttribute("opacity", ctx.p(t, "head", .15, .35)));   // empty tracks only appear with the head
      draft.show(ctx.p(t, "head", .65, .85)); draft.glow(ctx.p(t, "head", .7, .8) > 0);
      D.fade(dLab, ctx.p(t, "head", .75, .9));

      /* travelling pulse through fc → layer → head while those cues play */
      const q = t < ctx.cue("combine").start + ctx.cue("combine").dur * .6 ? 0 : ctx.span(t, ctx.cue("combine").start + ctx.cue("combine").dur * .6, ctx.cue("head").start + ctx.cue("head").dur * .25, E.linear);
      if (q > 0 && q < 1) { const pt = path.getPointAtLength(PL * q); pulse.setAttribute("cx", pt.x); pulse.setAttribute("cy", pt.y); pulse.setAttribute("opacity", 1); } else pulse.setAttribute("opacity", 0);

      /* tally: each part appears with its cue */
      const tp = [ctx.p(t, "combine", .7, .85), ctx.p(t, "layer", .3, .5), ctx.p(t, "layer", .5, .7), ctx.p(t, "combine", .2, .35)];
      tally.forEach(([x1, x2], i) => { D.fade(x1, tp[i]); D.fade(x2, tp[i]); });
      D.fade(totalT, ctx.p(t, "head", .85, 1));
    };
  };
})();

/* ============================================================ spec-calc widget */
(function () {
  "use strict";
  const E = (a, k) => (a >= 0.9999 ? k + 1 : (1 - Math.pow(a, k + 1)) / (1 - a));
  LX.widget("spec-calc", el => {
    const st = { a: 0.7, k: 3, c: 0.05, v: 1.1 };
    const slider = (key, label, min, max, step) =>
      `<div class="lx-range" style="grid-template-columns:minmax(110px,170px) 1fr 56px"><span>${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${st[key]}"><output></output></div>`;
    el.innerHTML = slider("a", "Acceptance rate α", 0, 0.95, 0.01) + slider("k", "Draft length k", 1, 8, 1)
      + slider("c", "Draft cost per token", 0, 0.5, 0.01) + slider("v", "Verify cost (× one pass)", 1, 2, 0.05)
      + `<div class="sc-out" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:16px 0 12px"></div>
         <p class="sc-note" style="margin:0 0 10px;font-size:14px"></p>
         <svg class="sc-chart" viewBox="0 0 640 240" style="width:100%;height:auto;display:block" role="img" aria-label="Tokens per pass and speed-up for each draft length"></svg>
         <p style="margin:6px 0 0;font-size:12.5px;color:var(--lx-muted)">Bars: expected tokens per big-model pass. Dots: speed-up after drafting and verification costs. Costs are relative to one ordinary decode pass of the big model.</p>`;
    const out = el.querySelector(".sc-out"), note = el.querySelector(".sc-note"), svg = el.querySelector(".sc-chart");
    const card = (label, val, color) => `<div style="background:var(--lx-panel);border:1px solid var(--lx-line);border-radius:10px;padding:10px 12px"><div style="font:500 11px var(--lx-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--lx-muted)">${label}</div><div style="font:650 24px var(--lx-sans);color:${color}">${val}</div></div>`;
    const speed = (a, k) => E(a, k) / (st.v + k * st.c);
    function chart() {
      const VW = el.clientWidth && el.clientWidth < 520 ? 400 : 640; svg.setAttribute("viewBox", `0 0 ${VW} 240`);
      const X0 = 58, X1 = VW - 16, Y0 = 34, Y1 = 196, n = 8, bw = (X1 - X0) / n;
      const ys = [], sp = [];
      for (let k = 1; k <= n; k++) { ys.push(E(st.a, k)); sp.push(speed(st.a, k)); }
      const top = Math.max(9, ...sp.map(v => v * 1.05));
      const y = v => Y1 - (v / top) * (Y1 - Y0);
      let h = `<line x1="${X0}" y1="${Y1}" x2="${X1}" y2="${Y1}" style="stroke:var(--lx-line-2)"/>`;
      [1, 2, 4, 6, 8].filter(v => v <= top).forEach(v => {
        h += `<line x1="${X0}" y1="${y(v)}" x2="${X1}" y2="${y(v)}" style="stroke:var(--lx-line)" stroke-dasharray="${v === 1 ? "" : "3 4"}"/><text x="${X0 - 8}" y="${y(v) + 4}" text-anchor="end" style="fill:var(--lx-muted);font:16px var(--lx-mono)">${v}</text>`;
      });
      const best = sp.indexOf(Math.max(...sp));
      ys.forEach((v, i) => {
        const x = X0 + i * bw + bw * 0.18, w = bw * 0.64, on = i + 1 === st.k;
        h += `<rect x="${x}" y="${y(v)}" width="${w}" height="${Y1 - y(v)}" rx="3" style="fill:var(--lx-mtp);opacity:${on ? 1 : .35}"/>`;
        h += `<text x="${x + w / 2}" y="${Y1 + 20}" text-anchor="middle" style="fill:${on ? "var(--lx-text)" : "var(--lx-muted)"};font:16px var(--lx-mono)">${VW < 640 ? "" : "k="}${i + 1}</text>`;
        const sy = y(sp[i]), col = sp[i] < 1 ? "var(--lx-logit)" : "var(--lx-embed)";
        h += `<circle cx="${x + w / 2}" cy="${sy}" r="${on ? 6 : 4.5}" style="fill:${col};stroke:var(--lx-bg);stroke-width:2"/>`;
        if (i === best) h += `<text x="${x + w / 2}" y="${sy - 11}" text-anchor="middle" style="fill:var(--lx-embed);font:600 15px var(--lx-mono)">best</text>`;
      });
      h += `<text x="${X0}" y="18" style="fill:var(--lx-muted);font:16px var(--lx-mono)">tokens per pass / speed-up ×</text>`;
      svg.innerHTML = h;
    }
    function render() {
      el.querySelectorAll("input").forEach(inp => { const k = inp.dataset.k; inp.nextElementSibling.textContent = k === "k" ? st.k : k === "v" ? st.v.toFixed(2) + "×" : st[k].toFixed(2); });
      const e = E(st.a, st.k), cost = st.v + st.k * st.c, s = e / cost;
      out.innerHTML = card("Tokens per pass", e.toFixed(2), "var(--lx-mtp)") + card("Cost per round", cost.toFixed(2) + "×", "var(--lx-text)")
        + card("Speed-up", s.toFixed(2) + "×", s < 1 ? "var(--lx-logit)" : "var(--lx-embed)");
      note.innerHTML = Math.abs(s - 1) < 0.01
        ? `<span style="color:var(--lx-mtp)">Roughly break-even: what the accepted drafts save is eaten up by drafting and verification.</span>`
        : s < 1
        ? `<span style="color:var(--lx-logit)">Here speculation costs more than it saves: generation would be about ${Math.max(1, Math.round((1 - s) * 100))}% slower than plain decoding.</span>`
        : `Each round of drafting plus one verification pass yields ${e.toFixed(2)} tokens on average, for ${cost.toFixed(2)}× the cost of one plain pass.`;
      chart();
    }
    el.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => { st[inp.dataset.k] = Number(inp.value); render(); }));
    render();
  });
})();
