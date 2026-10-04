/* Chapter 01 — The big picture */
LX.chapter({
  id: "big-picture", num: 1, title: "The big picture", toc: "The big picture",
  kicker: "One function, used in a loop",
  lede: "A large language model is one enormous function. Text goes in. Out comes a probability for every token that could come next.",
  body: [
    { prose: `
      <p>An <abbr>LLM</abbr> does exactly one thing. You give it some text, and it predicts what comes next. Chatting, writing code, translating and step-by-step reasoning are all this one prediction, repeated over and over.</p>
      <p>This course follows that prediction through a real model, <strong>Qwen3.8-27B</strong>, from the first character you type to the token it picks.</p>` },

    { scene: {
      id: "big-picture", title: "The whole journey in one picture",
      cues: [
        { id: "intro",  say: "A large language model does one thing. Given some text, it predicts what comes next." },
        { id: "tokens", say: "First, the text is cut into tokens, small pieces of words. Each token is replaced by its ID, a whole number that names it in the model's vocabulary." },
        { id: "vecs",   say: "Each ID then picks out a long list of numbers, called a vector. In Qwen 3.8, every token becomes five thousand one hundred and twenty numbers." },
        { id: "layers", say: "Those vectors flow up through sixty-four layers. Each layer reads them, mixes in information from the other tokens, and adds what it has worked out." },
        { id: "probs",  say: "At the top, the model gives a probability to every one of its two hundred and forty-eight thousand possible tokens. Here, the word mat is the favourite." },
        { id: "loop",   say: "One token is picked and added to the text. Then the whole process runs again for the next one. That loop is how a model writes." },
      ],
      build(ctx) {
        const { svg } = ctx, D = LX.draw, ups = [];
        D.backdrop(svg);

        /* input text */
        D.label(svg, 80, 92, "Input text");
        const FULL = "The cat sat on the";
        const inp = D.text(svg, 80, 148, "", { size: 42, weight: 650 });
        const added = LX.el("tspan", { fill: LX.col("logit") }, inp);
        const base = LX.el("tspan", {}, inp); inp.insertBefore(base, added);
        const caret = LX.el("rect", { x: 80, y: 114, width: 3, height: 42, fill: LX.col("token") }, svg);

        /* tokens, ids, vectors */
        D.label(svg, 80, 206, "Tokens → IDs → embedding vectors");
        const TOK = [["The", 760], [" cat", 7993], [" sat", 7338], [" on", 383], [" the", 279]];
        const R = LX.rng(7);
        const cols = TOK.map(([tok, id], i) => {
          const x = 80 + i * 138;
          const chip = D.tokenChip(svg, { x, y: 228, text: tok, id });
          const vals = Array.from({ length: 14 }, () => (R() * 2 - 1) * (.35 + R() * .65));
          const vec = D.vector(svg, { x: x + 59, y: 340, values: vals });
          return { chip, vec };
        });
        const vlab = D.label(svg, 80, 742, "each token → 5,120 numbers (14 shown)");

        /* layer stack */
        const a1 = D.arrow(svg, { x1: 778, y1: 500, x2: 850, y2: 500 });
        const sx = 876, sw = 300, sh = 21, sg = 7.5, N = 16, bottom = 734;
        D.label(svg, sx, 206, "Qwen3.8-27B · 64 layers");
        D.text(svg, sx, 232, "16 shown · pattern: 3 × DeltaNet → 1 × Attention", { size: 14, color: "text-2" });
        const slabs = [];
        for (let i = 0; i < N; i++) {
          const attn = i % 4 === 3, y = bottom - (i + 1) * (sh + sg);
          const b = D.block(svg, { x: sx, y, w: sw, h: sh, kind: attn ? "attn" : "delta", strong: attn });
          D.text(b.g, sx + 14, y + 15, `L${i + 1}`, { mono: true, size: 12, color: attn ? "text" : "muted" });
          D.text(b.g, sx + 56, y + 15, attn ? "Gated Attention + MLP" : "Gated DeltaNet + MLP", { mono: true, size: 12.5, weight: attn ? 500 : 400, color: attn ? "text" : "delta" });
          slabs.push(b);
        }
        const more = D.text(svg, sx + sw / 2, bottom - N * (sh + sg) - 16, "⋮  layers 17–64", { mono: true, size: 13, color: "dim", anchor: "middle" });

        /* probabilities */
        const a2 = D.arrow(svg, { x1: 1196, y1: 500, x2: 1262, y2: 500 });
        D.label(svg, 1290, 206, "Next token · probability");
        const bars = D.bars(svg, { x: 1290, y: 262, items: [[" mat", .38], [" floor", .17], [" couch", .09], [" bed", .06], [" sofa", .05], [" roof", .03]] });
        const pick = LX.el("rect", { x: 1278, y: 236, width: 274, height: 52, rx: 6, fill: "none", stroke: LX.col("logit"), "stroke-width": 2 }, svg);

        /* flying token for the loop */
        const fly = D.tokenChip(svg, { x: 0, y: 0, w: 96, h: 46, text: " mat", color: "logit", size: 20 });
        const loopArc = LX.el("path", { d: "M1350 236 C 1300 40, 700 30, 520 100", fill: "none" }, svg);
        const LA = loopArc.getTotalLength();

        ups.push(t => {
          // intro: type the text
          const typed = ctx.p(t, "intro", 0, .45, LX.ease.linear);
          D.type(base, FULL, typed);
          added.textContent = ctx.p(t, "loop", .62, .7) > .5 ? " mat" : "";
          const w = inp.getComputedTextLength();
          caret.setAttribute("x", 84 + w);
          caret.setAttribute("opacity", t < ctx.cue("tokens").start ? (Math.floor(t * 2.5) % 2 ? .25 : 1) : 0);

          // tokens + ids
          cols.forEach((c, i) => {
            c.chip.show(ctx.p(t, "tokens", .05 + i * .07, .35 + i * .07));
            c.chip.idShow(ctx.p(t, "tokens", .55 + i * .06, .75 + i * .06));
            c.vec.reveal(ctx.p(t, "vecs", .05 + i * .08, .55 + i * .08, LX.ease.linear));
          });
          D.fade(vlab, ctx.p(t, "vecs", .6, .8));

          // layers with a light pulse travelling upward
          a1.draw(ctx.p(t, "layers", 0, .12));
          const pulse = ctx.p(t, "layers", .15, .85, LX.ease.inOut) * (N + 3) - 1.5;
          slabs.forEach((s, i) => {
            s.show(ctx.p(t, "layers", .02 + i * .006, .12 + i * .006), 0);
            s.pulse(LX.clamp(1 - Math.abs(pulse - i) / 1.8));
          });
          D.fade(more, ctx.p(t, "layers", .2, .3));

          // probabilities
          a2.draw(ctx.p(t, "probs", 0, .12));
          bars.grow(ctx.p(t, "probs", .1, .6));
          D.fade(pick, ctx.p(t, "probs", .7, .8) * (1 - ctx.p(t, "loop", .1, .2)));

          // loop: chosen token flies back to the input
          const f = ctx.p(t, "loop", .1, .62, LX.ease.inOut);
          if (f > 0 && f < 1) {
            const pt = loopArc.getPointAtLength(LA * f);
            fly.g.setAttribute("transform", `translate(${pt.x - 48} ${pt.y - 23})`);
            fly.g.setAttribute("opacity", 1); fly.glow(true);
          } else fly.g.setAttribute("opacity", 0);
        });
        return t => ups.forEach(u => u(t));
      },
    } },

    { prose: `
      <h3>The six steps</h3>
      <p>Every token the model writes goes through the same pipeline. Each step has its own chapter:</p>
      <ol>
        <li><strong class="c-token">Tokenize.</strong> Cut the text into tokens and look up each token's <abbr>ID</abbr>. <a href="#tokens">Chapter 4</a></li>
        <li><strong class="c-embed">Embed.</strong> Swap each ID for a vector of 5,120 numbers. <a href="#embeddings">Chapter 5</a></li>
        <li><strong class="c-delta">Run</strong> <strong class="c-attn">the layers.</strong> 64 layers, each with a token-mixing part (attention or DeltaNet) and an <abbr>MLP</abbr>. <a href="#layer">Chapters 6–10</a></li>
        <li><strong class="c-logit">Score.</strong> Turn the last vector into one score per vocabulary token, then into probabilities. <a href="#output">Chapter 11</a></li>
        <li><strong class="c-logit">Sample.</strong> Pick one token, more or less adventurously depending on temperature. <a href="#sampling">Chapter 12</a></li>
        <li><strong class="c-cache">Repeat.</strong> Add the token to the text and go again, reusing saved work from the cache. <a href="#prefill-decode">Chapters 13–14</a></li>
      </ol>

      <h3>Where the knowledge lives</h3>
      <p>The model's behaviour is stored in its <strong>parameters</strong> (also called <em>weights</em>): 27.8 billion numbers arranged in large tables called matrices. Running the model means multiplying vectors by those matrices, over and over.</p>
      <p>The scale is hard to picture. Writing <em>one</em> token takes about <strong>51 billion</strong> multiplications and additions, and reading all of the weights from memory once: about 19 GB in the common 4-bit version. A person doing one calculation per second would need about 1,600 years for that single token. The full count, part by part, is in <a href="#recap">Chapter 18</a>.</p>
      <p>The parameters were set during <strong>training</strong>. The model saw trillions of tokens of text and tried to predict each next token. After every guess, all the parameters were nudged slightly in the direction that would have made the right token more likely. When you use the model, which is called <strong>inference</strong>, the parameters never change. All the model learns from your conversation lives in the text itself and in the cache built from it.</p>` },

    { html: `<div class="lx-prose"><h3>Our running example: Qwen3.8-27B</h3>
      <p>We use one real, openly published model all the way through, so every number is concrete. It is a modern <em>hybrid</em> design: most of its layers use a newer, cheaper way of mixing tokens (Gated DeltaNet) instead of classic attention.</p></div>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Property</th><th class="num">Value</th><th>What it means</th></tr>
        <tr><td>Parameters</td><td class="num">27.78 billion</td><td>Learned numbers in all weight matrices</td></tr>
        <tr><td>Layers</td><td class="num">64</td><td>48 Gated DeltaNet + 16 Gated Attention, in a 3 : 1 pattern</td></tr>
        <tr><td>Hidden size</td><td class="num">5,120</td><td>Length of the vector that represents each token</td></tr>
        <tr><td>Vocabulary</td><td class="num">248,320</td><td>Number of different tokens it knows</td></tr>
        <tr><td>Context length</td><td class="num">262,144</td><td>Maximum tokens it can see at once</td></tr>
        <tr><td>Storage (<abbr>bf16</abbr>)</td><td class="num">55.6 GB</td><td>2 bytes per parameter</td></tr>
        <tr><td>Extras</td><td class="num">0.46 B + 0.42 B</td><td>A vision encoder for images, and a multi-token prediction head</td></tr>
      </table></div>` },

    { deep: `
      <h3>The model as a probability function</h3>
      <p>Write the tokens so far as <i>x</i><sub>1</sub>, …, <i>x</i><sub><i>t</i></sub>. The model, with parameters θ, computes a probability for every token <i>v</i> in the vocabulary <i>V</i>:</p>
      <math display="block"><mrow><msub><mi>p</mi><mi>θ</mi></msub><mo>(</mo><msub><mi>x</mi><mrow><mi>t</mi><mo>+</mo><mn>1</mn></mrow></msub><mo>=</mo><mi>v</mi><mo>∣</mo><msub><mi>x</mi><mn>1</mn></msub><mo>,</mo><mo>…</mo><mo>,</mo><msub><mi>x</mi><mi>t</mi></msub><mo>)</mo><mo>,</mo><mspace width="1em"/><munder><mo>∑</mo><mrow><mi>v</mi><mo>∈</mo><mi>V</mi></mrow></munder><msub><mi>p</mi><mi>θ</mi></msub><mo>(</mo><mi>v</mi><mo>∣</mo><mo>…</mo><mo>)</mo><mo>=</mo><mn>1</mn></mrow></math>
      <div class="lx-read">Read it as: <i>the probability that the next token is v, given all the tokens so far</i>. The small θ just says “computed by the model with its parameters”. The second part says that if you go through <b>every</b> token v in the vocabulary and add up its probability, you get exactly 1. So the model hands out 100% of its belief across all 248,320 tokens, for example 38% to <code>·mat</code>, 17% to <code>·floor</code>, and the rest spread over everything else.</div>
      <p>With |<i>V</i>| = 248,320, that is a list of 248,320 numbers that add up to 1. By the chain rule of probability, the probability of a whole text is the product of its next-token probabilities. That is why predicting one token at a time is enough to model all of language:</p>
      <math display="block"><mrow><mi>p</mi><mo>(</mo><msub><mi>x</mi><mn>1</mn></msub><mo>,</mo><mo>…</mo><mo>,</mo><msub><mi>x</mi><mi>T</mi></msub><mo>)</mo><mo>=</mo><munderover><mo>∏</mo><mrow><mi>t</mi><mo>=</mo><mn>1</mn></mrow><mi>T</mi></munderover><mi>p</mi><mo>(</mo><msub><mi>x</mi><mi>t</mi></msub><mo>∣</mo><msub><mi>x</mi><mrow><mo>&lt;</mo><mi>t</mi></mrow></msub><mo>)</mo></mrow></math>
      <div class="lx-read">The probability of a whole text equals the probability of the first token, times the probability of the second given the first, times the probability of the third given the first two, and so on up to the last token T. Here x<sub>&lt;t</sub> means “all tokens before position t”. Example: if the model gives “The” 0.1, then “cat” after “The” 0.05, then “sat” after “The cat” 0.2, the three-token text gets 0.1 × 0.05 × 0.2 = 0.001.</div>
      <h3>Training in one line</h3>
      <p>Training minimises the <em>cross-entropy loss</em>, the negative log-probability the model gave to the token that actually came next, averaged over trillions of positions:</p>
      <math display="block"><mrow><mi>ℒ</mi><mo>(</mo><mi>θ</mi><mo>)</mo><mo>=</mo><mo>−</mo><mfrac><mn>1</mn><mi>T</mi></mfrac><munderover><mo>∑</mo><mrow><mi>t</mi><mo>=</mo><mn>1</mn></mrow><mi>T</mi></munderover><mi>log</mi><msub><mi>p</mi><mi>θ</mi></msub><mo>(</mo><msub><mi>x</mi><mi>t</mi></msub><mo>∣</mo><msub><mi>x</mi><mrow><mo>&lt;</mo><mi>t</mi></mrow></msub><mo>)</mo></mrow></math>
      <div class="lx-read">For every position t in the training text, look up the probability the model gave to the token that really came next, and take its logarithm. Add those up over all T positions, divide by T to get the average, and flip the sign so the result is positive. ℒ(θ) is the loss, a single number that says how surprised the model was on average; training adjusts the parameters θ to make it smaller. Example: probabilities 0.38 and 0.9 give −(ln 0.38 + ln 0.9) / 2 ≈ (0.97 + 0.11) / 2 ≈ 0.54.</div>
      <p>If the model gave the right token probability 0.38, the loss for that position is −ln 0.38 ≈ 0.97. A perfect prediction (probability 1) gives 0. Gradient descent moves every parameter a tiny step in the direction that lowers this number.</p>` },
  ],
});
