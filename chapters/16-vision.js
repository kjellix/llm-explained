/* Chapter 16 — How the model sees images */
(function () {
"use strict";
LX.chapter({
  id: "vision", num: 16, title: "How the model sees images", toc: "Vision",
  kicker: "Pictures become tokens too",
  lede: "The language model only understands 5,120-number vectors. A separate vision encoder cuts an image into small squares and turns them into vectors of exactly that size, which then join the text as if they were tokens.",
  body: [
    { prose: `
      <p>Qwen3.8-27B can read images and video. The 64 layers you have met do not change at all for this. Instead, a separate network, the <strong>vision encoder</strong>, translates pixels into the same kind of vectors that text tokens become. After that, the language model treats an image as a run of special tokens in the middle of the text.</p>
      <p>The encoder is a <abbr>ViT</abbr> with 460.7 million parameters, about 1.7% of the whole model.</p>` },

    { scene: {
      id: "image-to-tokens", title: "From pixels to visual tokens",
      visual: "A photo (drawn as a simple geometric illustration, 1024 × 768) sits on the left. A fine grid of 16 × 16-pixel squares fades over it (64 × 48 patches). Each patch flattens into a short orchid vector and passes up through a 27-block encoder stack (orchid). Then groups of 2 × 2 neighbouring patches merge into one vector, a projection widens it to 5,120, and the resulting visual tokens slide into the text row between two special chips <vision_start> … <vision_end>.",
      cues: [
        { id: "image",   say: "Here is an image, one thousand and twenty-four pixels wide and seven hundred and sixty-eight tall. To the model, it starts as nothing but colour values: red, green and blue for every pixel.", vis: "Image fades in with a size label 1024 × 768 × 3." },
        { id: "patches", say: "First, the image is cut into small squares called patches, sixteen by sixteen pixels each. That gives sixty-four patches across and forty-eight down, three thousand and seventy-two in total.", vis: "Grid overlay; counter 64 × 48 = 3,072 patches." },
        { id: "embed",   say: "Each patch is flattened and multiplied by a learned matrix, turning it into a vector of one thousand one hundred and fifty-two numbers. A learned position vector is added, so the encoder knows where each patch came from.", vis: "One patch zooms out, becomes a strip [1152], position tag added." },
        { id: "vit",     say: "These patch vectors go through the vision transformer, twenty-seven blocks of attention and feed-forward layers. Here, every patch may look at every other patch, in any direction, because an image has no left-to-right order.", vis: "Orchid stack of 27 blocks pulses; attention lines fan between patches in all directions." },
        { id: "merge",   say: "Next, each group of two by two neighbouring patches is merged into one vector. Three thousand and seventy-two patches become seven hundred and sixty-eight, and each of them now covers thirty-two by thirty-two pixels.", vis: "Patches combine four at a time; counter 3,072 → 768." },
        { id: "project", say: "A small feed-forward network widens each merged vector to five thousand one hundred and twenty numbers, exactly the size of a text token's vector.", vis: "Strip [4608] → merger block → [5120], coloured teal like text embeddings." },
        { id: "join",    say: "Finally, the seven hundred and sixty-eight visual tokens are placed into the text between a vision start and a vision end marker. From here on, they flow through the same sixty-four layers as every word.", vis: "Text row: 'What is in' <vision_start> ▢▢▢…▢ <vision_end> 'this picture?' then the row enters the familiar layer stack." },
      ],
      build: buildImageToTokens,
    } },

    { prose: `
      <h3>The vision encoder in numbers</h3>` },
    { html: `<div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Part</th><th>Setting</th><th>Meaning</th></tr>
        <tr><td>Patch size</td><td class="num">16 × 16 px</td><td>Each patch is one input square</td></tr>
        <tr><td>Temporal patch</td><td class="num">2 frames</td><td>Two video frames are packed into one patch. A still image is duplicated to fill both slots.</td></tr>
        <tr><td>Patch embedding</td><td class="num">1,536 → 1,152</td><td>3 colours × 2 frames × 16 × 16 pixels, projected to the encoder width</td></tr>
        <tr><td>Position embedding</td><td class="num">2,304 learned</td><td>A 48 × 48 grid of position vectors, stretched (interpolated) to fit the actual image size. In addition, every encoder block applies a 2-D rotary position embedding over height and width.</td></tr>
        <tr><td>Encoder blocks</td><td class="num">27</td><td>Each: <abbr>LayerNorm</abbr> → full attention over the whole image (16 heads) → LayerNorm → feed-forward with <abbr>GELU</abbr></td></tr>
        <tr><td>Width / feed-forward size</td><td class="num">1,152 / 4,304</td><td>Vector size inside the encoder, and the hidden size of its feed-forward layers</td></tr>
        <tr><td>Spatial merge</td><td class="num">2 × 2</td><td>Four neighbouring patches become one visual token (32 × 32 px)</td></tr>
        <tr><td>Merger</td><td class="num">4,608 → 4,608 → 5,120</td><td>Two-layer projection into the language model's vector space</td></tr>
        <tr class="sum"><td>Total</td><td class="num">460.7 M</td><td>Parameters in the vision encoder</td></tr>
      </table></div>` },

    { prose: `
      <h3>Where an image sits in the text</h3>
      <p>The tokenizer reserves special tokens for this. A <code>&lt;vision_start&gt;</code> token (ID 248053) opens the image. It is followed by one placeholder token (ID 248056) for every visual token, and a <code>&lt;vision_end&gt;</code> token (ID 248054) closes it. Video uses its own placeholder (ID 248057). Before the first layer runs, each placeholder's embedding is swapped for the matching vector from the vision encoder.</p>
      <p>From then on, the language model makes no distinction. Attention and DeltaNet layers mix visual tokens with word tokens, which is how the model can answer "what colour is the car?" by attending from the word <em>colour</em> to the patches that show the car.</p>

      <h3>Positions in three dimensions</h3>
      <p>Text has one position per token: first, second, third. An image is two-dimensional, and video adds time. Qwen3.8 therefore uses <abbr>mRoPE</abbr>: each token's position is a triple (time, height, width). Text tokens simply use the same number three times. Image tokens share one time value and get the row and column of their place in the merged grid, counted on from the position where the image starts, so the attention layers know which patches are neighbours, both across and down. The text after the image continues one past the largest position used.</p>` },

    { scene: {
      id: "mrope-grid", title: "Three-part positions for text and images",
      visual: "Three text chips, a 4 × 3 grid of orchid image tokens, then two text chips. A glowing highlight walks through the tokens in order, and each token's (time, height, width) triple appears as it passes. Text counts up with all three equal; the image keeps time = 3 while height and width follow row and column (offset by the start position); text after the image resumes at 7. Three dials (time gold, height violet, width blue) turn by each axis's value as the highlight moves.",
      cues: [
        { id: "text",  say: "For ordinary text, the position is one number, counting up token by token. Multimodal rotary position embedding, or em rope, simply writes that number three times: time, height and width.", vis: "Text chips with (0,0,0), (1,1,1), (2,2,2)." },
        { id: "image", say: "For an image, the three parts finally differ. All its tokens share one time value, while height and width give the row and column of each token in the grid.", vis: "Image tiles light up row by row; triples (3,3,3), (3,3,4) … (3,5,6): time stays 3, height = 3 + row, width = 3 + column." },
        { id: "after", say: "After the image, text continues from the next free number. So the model always knows what came before what, and which image patches sit next to each other.", vis: "Final text chips continue at (7,7,7), (8,8,8), one past the largest position used; the three dials turn in step again." },
      ],
      build: buildMropeGrid,
    } },

    { prose: `
      <h3>Images are expensive</h3>
      <p>Each visual token costs the same as a text token once it is inside the language model: one pass through all 64 layers, and room in the <abbr>KV</abbr> cache. Our 1024 × 768 image becomes <strong>768 tokens</strong>, roughly as much as a page and a half of text. In the KV cache alone, that is 768 × 64 <abbr>KiB</abbr> = 48 <abbr>MiB</abbr>. A larger image, or a few seconds of video, can easily use thousands of tokens. That is why vision models often shrink images first, and why you pay for image size.</p>
      <p>Qwen3.8's image processor sets the limits: the image is rescaled so its area lies between 65,536 pixels (256 × 256) and 16,777,216 pixels (4096 × 4096), with both sides rounded to multiples of 32. One image therefore costs between <strong>64 and 16,384 tokens</strong>.</p>` },

    { widget: { id: "image-tokens", title: "How many tokens is my image?",
      sub: "Enter an image size, or a video length, and see how Qwen3.8's image processor resizes it and what it costs in tokens and KV cache." } },

    { deep: `
      <h3>Patch embedding is a strided convolution</h3>
      <p>One patch holds 3 colour channels × 2 frames × 16 × 16 pixels = 1,536 numbers. The patch embedding is a single linear map <i>W</i> ∈ ℝ<sup>1536 × 1152</sup> plus a bias, applied to every patch separately:</p>
      <math display="block"><mrow><msub><mi mathvariant="bold">z</mi><mi>p</mi></msub><mo>=</mo><mtext>flatten</mtext><mo>(</mo><msub><mtext>patch</mtext><mi>p</mi></msub><mo>)</mo><mspace width="0.2em"/><mi>W</mi><mo>+</mo><mi mathvariant="bold">b</mi><mo>+</mo><msub><mi mathvariant="bold">e</mi><mrow><mtext>pos</mtext><mo>(</mo><mi>p</mi><mo>)</mo></mrow></msub></mrow></math>
      <div class="lx-read">For patch p: lay its 1,536 pixel values out in one long row (flatten), multiply by the learned matrix W to get 1,152 numbers, add the bias b, and add the position vector e<sub>pos</sub>(p) that says where in the image the patch sits. The result z<sub>p</sub> is that patch's starting vector in the vision encoder, playing the same role a token's embedding plays for text.</div>
      <p>That is 1,536 × 1,152 + 1,152 = 1,770,624 parameters. Applying the same small matrix to every non-overlapping 16 × 16 window is exactly a 3-D convolution with kernel (2, 16, 16) and the same stride, which is how it is implemented.</p>
      <h3>Counting visual tokens</h3>
      <p>For an image resized to height <i>H</i> and width <i>W</i> (both multiples of 32):</p>
      <math display="block"><mrow><msub><mi>N</mi><mtext>patches</mtext></msub><mo>=</mo><mfrac><mi>H</mi><mn>16</mn></mfrac><mo>·</mo><mfrac><mi>W</mi><mn>16</mn></mfrac><mo>,</mo><mspace width="1em"/><msub><mi>N</mi><mtext>tokens</mtext></msub><mo>=</mo><mfrac><msub><mi>N</mi><mtext>patches</mtext></msub><mn>4</mn></mfrac><mo>=</mo><mfrac><mi>H</mi><mn>32</mn></mfrac><mo>·</mo><mfrac><mi>W</mi><mn>32</mn></mfrac></mrow></math>
      <div class="lx-read">Divide the image height H by 16 and the width W by 16 to count patches along each side, and multiply to get the number of patches. Every 2 × 2 block of patches is merged into one visual token, so divide by 4; that is the same as dividing each side by 32 and multiplying. Example from the text: a 768 × 1024 image gives 48 × 64 = 3,072 patches, and 24 × 32 = 768 visual tokens.</div>
      <p>For 768 × 1024: 48 · 64 = 3,072 patches → 24 · 32 = 768 tokens. For video, every pair of frames forms one temporal slice, so the count is multiplied by (number of frames) / 2.</p>
      <h3>The merger</h3>
      <p>The merger normalises each 1,152-vector, then concatenates four neighbouring ones into a single vector of 4 × 1,152 = 4,608 numbers. It applies a 4,608 → 4,608 layer, an activation, and a 4,608 → 5,120 layer. Its output lives in the same space as the embedding table's rows, so the language model can read it.</p>
      <h3>Encoder attention is not causal</h3>
      <p>Inside the language model, a token may only look at earlier tokens. Inside the vision encoder there is no such mask: each of the 16 heads (72 numbers each, since 1,152 / 16 = 72) lets every patch attend to every other patch of the same image. There is no windowing: attention covers the whole image (or each frame pair of a video). The encoder runs once per image, before the language model starts on it.</p>` },
  ],
});

/* ======================================================================
   Scene builders for chapter 16
   ====================================================================== */

/* ---- the procedural image (image pixel coordinates, 1024 × 768) ---- */
const IMG = { W: 1024, H: 768 };
const PAL = { wall: "#26304a", floor: "#3a2e2a", win: "#1f4a78", frame: "#c9d3e6", sun: "#f5c062",
  mat: "#8f3d4f", stripe: "#c86a74", body: "#d79e63", head: "#e0a96c", tail: "#d38f55", eye: "#1b2233", nose: "#c86a74" };
const inE = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function inTri(px, py, a, b, c) {
  const s = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const p = [px, py], d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
const EAR1 = [[478, 352], [498, 288], [530, 338]], EAR2 = [[558, 338], [588, 288], [602, 356]];
/** colour of one image pixel — the same geometry the SVG draws, so the zoomed patch matches */
function colorAt(x, y) {
  if (inE(x, y, 510, 395, 9, 9) || inE(x, y, 555, 395, 9, 9)) return PAL.eye;
  if (inE(x, y, 533, 420, 6, 6)) return PAL.nose;
  if (inE(x, y, 530, 400, 70, 70) || inTri(x, y, ...EAR1) || inTri(x, y, ...EAR2)) return PAL.head;
  if (inE(x, y, 400, 500, 150, 95)) return PAL.body;
  if (inE(x, y, 420, 610, 256, 56) && !inE(x, y, 420, 610, 244, 44)) return PAL.stripe;
  if (inE(x, y, 420, 610, 320, 72)) return PAL.mat;
  if (inE(x, y, 800, 170, 38, 38)) return PAL.sun;
  const inOuter = x >= 635 && x <= 905 && y >= 85 && y <= 335, inInner = x >= 645 && x <= 895 && y >= 95 && y <= 325;
  if (inOuter && !inInner) return PAL.frame;
  if (inInner) return (Math.abs(x - 770) < 4 || Math.abs(y - 210) < 4) ? PAL.frame : PAL.win;
  return y < 520 ? PAL.wall : PAL.floor;
}
function drawImage(parent, X, Y, S) {
  const el = LX.el, g = el("g", {}, parent);
  el("rect", { x: X(0), y: Y(0), width: IMG.W * S, height: 520 * S, fill: PAL.wall }, g);
  el("rect", { x: X(0), y: Y(520), width: IMG.W * S, height: 248 * S, fill: PAL.floor }, g);
  el("rect", { x: X(640), y: Y(90), width: 260 * S, height: 240 * S, fill: PAL.win, stroke: PAL.frame, "stroke-width": 10 * S }, g);
  el("line", { x1: X(770), y1: Y(95), x2: X(770), y2: Y(325), stroke: PAL.frame, "stroke-width": 8 * S }, g);
  el("line", { x1: X(645), y1: Y(210), x2: X(895), y2: Y(210), stroke: PAL.frame, "stroke-width": 8 * S }, g);
  el("circle", { cx: X(800), cy: Y(170), r: 38 * S, fill: PAL.sun }, g);
  el("ellipse", { cx: X(420), cy: Y(610), rx: 320 * S, ry: 72 * S, fill: PAL.mat }, g);
  el("ellipse", { cx: X(420), cy: Y(610), rx: 250 * S, ry: 50 * S, fill: "none", stroke: PAL.stripe, "stroke-width": 12 * S }, g);
  el("path", { d: `M${X(270)} ${Y(520)} C ${X(160)} ${Y(500)}, ${X(150)} ${Y(400)}, ${X(220)} ${Y(380)}`, fill: "none", stroke: PAL.tail, "stroke-width": 26 * S, "stroke-linecap": "round" }, g);
  el("ellipse", { cx: X(400), cy: Y(500), rx: 150 * S, ry: 95 * S, fill: PAL.body }, g);
  [EAR1, EAR2].forEach(t => el("polygon", { points: t.map(p => `${X(p[0])},${Y(p[1])}`).join(" "), fill: PAL.head }, g));
  el("circle", { cx: X(530), cy: Y(400), r: 70 * S, fill: PAL.head }, g);
  el("circle", { cx: X(510), cy: Y(395), r: 9 * S, fill: PAL.eye }, g);
  el("circle", { cx: X(555), cy: Y(395), r: 9 * S, fill: PAL.eye }, g);
  el("circle", { cx: X(533), cy: Y(420), r: 6 * S, fill: PAL.nose }, g);
  return g;
}
/** one <path> with all lines of a grid of `step`-pixel cells over the image */
function gridPath(X, Y, step) {
  let d = "";
  for (let x = step; x < IMG.W; x += step) d += `M${X(x)} ${Y(0)}V${Y(IMG.H)}`;
  for (let y = step; y < IMG.H; y += step) d += `M${X(0)} ${Y(y)}H${X(IMG.W)}`;
  return d;
}
const fmtN = n => n.toLocaleString("en-US");

function buildImageToTokens(ctx) {
  const D = LX.draw, el = LX.el, col = LX.col, mix = LX.mix, svg = ctx.svg, ups = [];
  const P = (id, a, b, e) => ctx.p(ctx._t, id, a, b, e);
  D.backdrop(svg);

  /* ---- numbers, computed ---- */
  const PATCH = 16, MERGE = 2, TOK_PX = PATCH * MERGE;
  const nx = IMG.W / PATCH, ny = IMG.H / PATCH, nPatch = nx * ny;
  const nTok = (IMG.W / TOK_PX) * (IMG.H / TOK_PX);
  const patchNums = PATCH * PATCH * 3 * 2;               // 16·16 px · 3 colours · 2 frames
  const ENC = 1152, CAT = ENC * MERGE * MERGE, OUT = 5120;
  const kvMiB = nTok * 64 / 1024;                        // 64 KiB per token

  /* ---- the image ---- */
  const S = 0.5, IX = 80, IY = 140, X = x => IX + x * S, Y = y => IY + y * S;
  D.label(svg, IX, IY - 22, "Input image");
  const image = drawImage(svg, X, Y, S);
  const size = D.text(svg, IX, Y(IMG.H) + 30, `${IMG.W} × ${IMG.H} pixels × 3 colours`, { mono: true, size: 15, color: "muted" });
  el("rect", { x: X(0), y: Y(0), width: IMG.W * S, height: IMG.H * S, fill: "none", stroke: col("line-2"), "stroke-width": 1 }, svg);
  const fine = el("path", { d: gridPath(X, Y, PATCH), stroke: "#e4e9f2", "stroke-opacity": .35, "stroke-width": .6, fill: "none" }, svg);
  const coarse = el("path", { d: gridPath(X, Y, TOK_PX), stroke: col("vision"), "stroke-opacity": .8, "stroke-width": 1.1, fill: "none" }, svg);
  const cnt = D.text(svg, IX, Y(IMG.H) + 58, `${nx} × ${ny} = ${fmtN(nPatch)} patches of ${PATCH} × ${PATCH} px`, { mono: true, size: 16, color: "vision" });

  /* the patch we follow: column 28, row 25 (edge of the cat's head) */
  const PC = 28, PR = 25, px0 = PC * PATCH, py0 = PR * PATCH;
  const hi = el("rect", { x: X(px0), y: Y(py0), width: PATCH * S, height: PATCH * S, fill: "none", stroke: col("vision"), "stroke-width": 2.2, filter: "url(#lx-glow)" }, svg);

  /* ---- patch embedding panel ---- */
  const TX = 660, TY = 150, CELL = 9;
  const tileLab = D.label(svg, TX, TY - 18, `One patch · column ${PC}, row ${PR}`);
  const tile = el("g", {}, svg);
  for (let j = 0; j < PATCH; j++) for (let i = 0; i < PATCH; i++)
    el("rect", { x: TX + i * CELL, y: TY + j * CELL, width: CELL - .6, height: CELL - .6, fill: colorAt(px0 + i + .5, py0 + j + .5) }, tile);
  el("rect", { x: TX - 1, y: TY - 1, width: PATCH * CELL + 1.4, height: PATCH * CELL + 1.4, fill: "none", stroke: col("vision"), "stroke-width": 1.5 }, tile);
  const zoomArrow = D.arrow(svg, { d: `M${X(px0 + PATCH)} ${Y(py0)} C ${X(px0) + 80} ${Y(py0) - 120}, ${TX - 70} ${TY + 60}, ${TX - 8} ${TY + 60}`, color: "vision", width: 1.6 });
  const t1 = D.text(svg, TX, TY + PATCH * CELL + 30, `${PATCH} × ${PATCH} px × 3 colours × 2 frames`, { mono: true, size: 14, color: "text-2" });
  const t2 = D.text(svg, TX, TY + PATCH * CELL + 52, `= ${fmtN(patchNums)} numbers`, { mono: true, size: 14, color: "text-2" });
  const t3 = D.text(svg, TX, TY + PATCH * CELL + 72, "a still image fills both frames", { size: 13, color: "muted" });
  const R = LX.rng(16);
  const vals = n => Array.from({ length: n }, () => (R() * 2 - 1) * (.3 + R() * .7));
  const embArrow = D.arrow(svg, { x1: TX + 72, y1: TY + PATCH * CELL + 84, x2: TX + 72, y2: TY + PATCH * CELL + 118, color: "vision", width: 1.6 });
  const wLab = D.text(svg, TX + 86, TY + PATCH * CELL + 106, `× W  ${fmtN(patchNums)} → ${fmtN(ENC)}`, { mono: true, size: 14, color: "vision" });
  const encVec = D.vector(svg, { x: TX, y: TY + PATCH * CELL + 144, values: vals(12), cell: 16, gap: 3, dir: "h" });
  const encLab = D.text(svg, TX + 12 * 19 + 8, TY + PATCH * CELL + 149, `[${fmtN(ENC)}]`, { mono: true, size: 14, color: "vision" });
  const posTag = D.text(svg, TX, TY + PATCH * CELL + 184, `+ position (row ${PR}, column ${PC})`, { mono: true, size: 14, color: "vision" });

  /* ---- vision encoder stack ---- */
  const SX = 990, SW = 170, SH = 10, SG = 4, NB = 27, SB = 500;
  const encTitle = D.label(svg, SX, 110, "Vision encoder · 27 blocks");
  const slabs = [];
  for (let i = 0; i < NB; i++) slabs.push(D.block(svg, { x: SX, y: SB - (i + 1) * (SH + SG) + SG, w: SW, h: SH, kind: "vision" }));
  const encNote1 = D.text(svg, SX, SB + 30, "full attention · whole image", { size: 14, color: "text-2" });
  const encNote2 = D.text(svg, SX, SB + 50, "16 heads × 72 numbers", { mono: true, size: 13, color: "muted" });
  /* attention lines from the followed patch to patches all over the image */
  const targets = [[33, 21], [36, 20], [15, 27], [25, 33], [40, 38], [50, 10], [44, 14], [20, 36], [31, 29], [10, 12], [56, 30], [26, 22]];
  const cxp = X(px0 + PATCH / 2), cyp = Y(py0 + PATCH / 2);
  const attLines = targets.map(([c, r], i) => el("line", { x1: cxp, y1: cyp, x2: X(c * PATCH + 8), y2: Y(r * PATCH + 8), stroke: col("vision"), "stroke-width": 1 + (i % 3) * .5, "stroke-opacity": 0 }, svg));
  const vitArrow = D.arrow(svg, { x1: TX + 12 * 19 + 70, y1: TY + PATCH * CELL + 144, x2: SX - 12, y2: 380, color: "vision", width: 1.6 });

  /* ---- 2 × 2 merge + merger ---- */
  const MX = 1210;
  const mergeTitle = D.label(svg, MX, 140, "2 × 2 merge");
  const grp = el("rect", { x: X(28 * PATCH), y: Y(24 * PATCH), width: TOK_PX * S, height: TOK_PX * S, fill: "none", stroke: col("vision"), "stroke-width": 2.4, filter: "url(#lx-glow)" }, svg);
  const smalls = [0, 1, 2, 3].map(k => D.vector(svg, { x: MX + (k % 2) * 140, y: 170 + Math.floor(k / 2) * 26, values: vals(4), cell: 14, gap: 3, dir: "h" }));
  const smallLab = D.text(svg, MX, 228, `4 neighbours × [${fmtN(ENC)}], side by side`, { mono: true, size: 13, color: "muted" });
  const catVec = D.vector(svg, { x: MX, y: 250, values: vals(16), cell: 14, gap: 3, dir: "h" });
  const catLab = D.text(svg, MX + 16 * 17 + 6, 255, `[${fmtN(CAT)}]`, { mono: true, size: 13, color: "vision" });
  const merger = D.block(svg, { x: MX, y: 286, w: 300, h: 66, kind: "vision", label: "Merger", sub: `LayerNorm → ${fmtN(CAT)} → GELU → ${fmtN(OUT)}`, size: 16 });
  const outVec = D.vector(svg, { x: MX, y: 390, values: vals(16), cell: 14, gap: 3, dir: "h" });
  const outFrame = el("rect", { x: MX - 5, y: 390 - 12, width: 16 * 17 + 7, height: 24, rx: 4, fill: "none", stroke: col("embed"), "stroke-width": 1.6 }, svg);
  const outLab = D.text(svg, MX + 16 * 17 + 8, 395, `[${fmtN(OUT)}]`, { mono: true, size: 13, color: "embed" });
  const outNote = D.text(svg, MX, 428, "same size as a text token's vector", { size: 14, color: "embed" });
  const mCount = D.text(svg, MX, 470, "", { mono: true, size: 16, color: "vision" });
  const mCount2 = D.text(svg, MX, 494, `one visual token per ${TOK_PX} × ${TOK_PX} px`, { mono: true, size: 13, color: "muted" });
  const mergeArrow = D.arrow(svg, { x1: SX + SW + 10, y1: 200, x2: MX - 14, y2: 190, color: "vision", width: 1.6 });

  /* ---- the text row the language model sees ---- */
  const RY = 660, rowLab = D.label(svg, 80, RY - 30, "The token sequence the language model reads");
  const items = [["What", "t"], [" is", "t"], [" in", "t"], ["<vision_start>", "s", 248053], ["RUN"], ["<vision_end>", "s", 248054], [" this", "t"], [" picture?", "t"]];
  let rx = 80;
  const row = [];
  items.forEach(it => {
    if (it[0] === "RUN") {
      const g = el("g", {}, svg), n = 12, sq = 20, gp = 4;
      for (let i = 0; i < n; i++) el("rect", { x: rx + i * (sq + gp), y: RY + 13, width: sq, height: sq + 6, rx: 3, fill: mix("bg", "vision", .55), stroke: col("vision"), "stroke-width": 1 }, g);
      D.text(g, rx + n * (sq + gp) + 4, RY + 34, "…", { size: 20, color: "vision" });
      D.text(g, rx, RY + 76, `image pad 248056 × ${fmtN(nTok)}`, { mono: true, size: 13, color: "vision" });
      row.push({ g, x: rx, w: n * (sq + gp) + 26 });
      rx += n * (sq + gp) + 40;
      return;
    }
    const special = it[1] === "s", size = special ? 15 : 20;
    const w = 26 + it[0].length * size * .6;
    const chip = D.tokenChip(svg, { x: rx, y: RY, w, h: 50, text: it[0], id: it[2], color: special ? "vision" : "token", size });
    row.push({ chip, x: rx, w });
    rx += w + 12;
  });
  const runItem = row[4];
  const joinArrow = D.arrow(svg, { d: `M${MX - 8} 390 H 1196 V 590 H ${runItem.x + runItem.w / 2} V ${RY + 6}`, color: "embed", width: 1.6 });
  const toLayers = D.arrow(svg, { x1: rx + 4, y1: RY + 25, x2: rx + 60, y2: RY + 25, color: "muted", width: 1.6 });
  const layers = D.block(svg, { x: rx + 72, y: RY - 4, w: 1520 - rx - 72, h: 58, kind: "delta", label: "64 layers", sub: "same as for words", size: 16 });
  const kvNote = D.text(svg, 80, RY + 112, `${fmtN(nTok)} visual tokens · ${kvMiB} MiB of KV cache at 64 KiB per token`, { mono: true, size: 14, color: "muted" });

  return t => {
    ctx._t = t;
    // image
    D.fade(image, P("image", 0, .3)); D.fade(size, P("image", .3, .6));
    // patches
    const fineOn = P("patches", 0, .4), fineOff = P("merge", 0, .4);
    D.fade(fine, fineOn * (1 - fineOff));
    D.fade(cnt, P("patches", .4, .7));
    // follow one patch
    D.fade(hi, P("embed", 0, .15) * (1 - P("merge", .1, .3)));
    zoomArrow.draw(P("embed", .1, .3)); D.fade(tileLab, P("embed", .15, .3));
    D.fade(tile, P("embed", .2, .45)); tile.setAttribute("transform", `translate(${(1 - P("embed", .2, .45)) * -20} 0)`);
    D.fade(t1, P("embed", .4, .55)); D.fade(t2, P("embed", .45, .6)); D.fade(t3, P("embed", .5, .62));
    embArrow.draw(P("embed", .55, .65)); D.fade(wLab, P("embed", .58, .7));
    encVec.reveal(P("embed", .62, .85, LX.ease.linear)); D.fade(encLab, P("embed", .75, .85));
    D.fade(posTag, P("embed", .82, .97));
    // encoder
    D.fade(encTitle, P("vit", 0, .2));
    vitArrow.draw(P("vit", 0, .15));
    const pulse = P("vit", .2, .9, LX.ease.inOut) * (NB + 4) - 2;
    slabs.forEach((s, i) => { s.show(P("vit", .02 + i * .006, .15 + i * .006), 0); s.pulse(LX.clamp(1 - Math.abs(pulse - i) / 2.5)); });
    D.fade(encNote1, P("vit", .3, .45)); D.fade(encNote2, P("vit", .4, .55));
    const lines = P("vit", .3, .6) * (1 - .7 * P("merge", 0, .3));
    attLines.forEach((l, i) => l.setAttribute("stroke-opacity", LX.clamp(lines * 1.4 - i * .03) * .8));
    // merge
    mergeArrow.draw(P("merge", 0, .15)); D.fade(mergeTitle, P("merge", 0, .2));
    D.fade(coarse, P("merge", .05, .4));
    D.fade(grp, P("merge", .2, .35));
    const sm = P("merge", .3, .5), cat = P("merge", .5, .75);
    smalls.forEach((v, k) => { D.fade(v.g, sm * (1 - cat * .75)); });
    D.fade(smallLab, sm * (1 - cat * .75));
    catVec.reveal(cat, .2); D.fade(catLab, cat);
    const q = P("merge", .6, .95, LX.ease.inOut);
    mCount.textContent = `${fmtN(Math.round(nPatch - (nPatch - nTok) * q))} ${q < 1 ? "patches" : "patches → " + fmtN(nTok) + " tokens"}`;
    if (q >= 1) mCount.textContent = `${fmtN(nPatch)} patches → ${fmtN(nTok)} tokens`;
    D.fade(mCount, P("merge", .55, .65)); D.fade(mCount2, P("merge", .85, 1));
    // project
    merger.show(P("project", 0, .3)); merger.pulse(LX.clamp(Math.sin(Math.PI * P("project", .2, .7, LX.ease.linear))));
    outVec.reveal(P("project", .5, .8, LX.ease.linear)); D.fade(outFrame, P("project", .65, .85)); D.fade(outLab, P("project", .7, .85));
    D.fade(outNote, P("project", .8, .95));
    // join
    D.fade(rowLab, P("join", 0, .15));
    row.forEach((it, i) => {
      const p = P("join", .05 + i * .04, .22 + i * .04);
      if (it.chip) { it.chip.show(p); it.chip.idShow(p); } else D.fade(it.g, p);
    });
    joinArrow.draw(P("join", .25, .5));
    toLayers.draw(P("join", .6, .7)); layers.show(P("join", .65, .8));
    layers.pulse(LX.clamp(Math.sin(Math.PI * P("join", .75, 1, LX.ease.linear))) * .8);
    D.fade(kvNote, P("join", .8, .95));
  };
}

function buildMropeGrid(ctx) {
  const D = LX.draw, el = LX.el, col = LX.col, mix = LX.mix, svg = ctx.svg;
  const P = (id, a, b, e) => ctx.p(ctx._t, id, a, b, e);
  D.backdrop(svg);
  D.label(svg, 80, 110, "Position of every token: (time, height, width)");

  /* tokens: 3 text, a 4 × 3 image (row-major), 2 text — positions as in the model */
  const toks = [];
  const CH = 56, CY = 248;
  let x = 80, n = 0;
  [["What"], [" is"], [" in"]].forEach(([w]) => { const cw = 30 + w.length * 13; toks.push({ kind: "text", w, x, y: CY, cw, ch: CH, pos: [n, n, n] }); x += cw + 16; n++; });
  const GX = x + 40, GY = 150, TS = 82, TG = 8, COLS = 4, ROWS = 3, t0 = n;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    toks.push({ kind: "img", x: GX + c * (TS + TG), y: GY + r * (TS + TG), cw: TS, ch: TS, pos: [t0, t0 + r, t0 + c], r, c });
  const maxPos = Math.max(t0, t0 + ROWS - 1, t0 + COLS - 1);
  x = GX + COLS * (TS + TG) + 26; n = maxPos + 1;                    // text continues after the largest position used
  [[" this"], [" picture?"]].forEach(([w]) => { const cw = 30 + w.length * 13; toks.push({ kind: "text", w, x, y: CY, cw, ch: CH, pos: [n, n, n] }); x += cw + 16; n++; });

  /* draw */
  const gridG = el("g", {}, svg), axisG = el("g", {}, svg);
  toks.forEach(tk => {
    if (tk.kind === "text") {
      tk.chip = D.tokenChip(svg, { x: tk.x, y: tk.y, w: tk.cw, h: tk.ch, text: tk.w, size: 22 });
      tk.lab = D.text(svg, tk.x + tk.cw / 2, tk.y + tk.ch + 32, `(${tk.pos.join(",")})`, { mono: true, size: 17, anchor: "middle", color: "text-2" });
    } else {
      tk.box = el("rect", { x: tk.x, y: tk.y, width: TS, height: TS, rx: 6, fill: mix("bg", "vision", .28), stroke: col("vision"), "stroke-width": 1.3 }, gridG);
      tk.lab = D.text(gridG, tk.x + TS / 2, tk.y + TS / 2 + 6, `(${tk.pos.join(",")})`, { mono: true, size: 15, anchor: "middle" });
    }
  });
  D.text(axisG, GX + (COLS * (TS + TG) - TG) / 2, GY - 16, "column → width", { mono: true, size: 14, color: "delta", anchor: "middle" });
  const vt = D.text(axisG, GX - 14, GY + (ROWS * (TS + TG)) / 2, "row → height", { mono: true, size: 14, color: "attn", anchor: "middle" });
  vt.setAttribute("transform", `rotate(-90 ${GX - 14} ${GY + (ROWS * (TS + TG)) / 2})`);
  D.text(axisG, GX, GY + ROWS * (TS + TG) + 14, `one image · time = ${t0} for every patch`, { mono: true, size: 14, color: "mtp" });
  const hl = el("rect", { x: 0, y: 0, width: 10, height: 10, rx: 8, fill: "none", stroke: col("embed"), "stroke-width": 2.5, filter: "url(#lx-glow)" }, svg);

  /* three dials */
  const dials = [["time", "mtp"], ["height", "attn"], ["width", "delta"]].map(([name, c], i) => {
    const cx = 380 + i * 420, cy = 600, R = 78, g = el("g", {}, svg);
    el("circle", { cx, cy, r: R, fill: mix("bg", c, .08), stroke: col(c), "stroke-width": 1.5 }, g);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; el("line", { x1: cx + Math.cos(a) * (R - 8), y1: cy + Math.sin(a) * (R - 8), x2: cx + Math.cos(a) * R, y2: cy + Math.sin(a) * R, stroke: col("line-2"), "stroke-width": 1.5 }, g); }
    const needle = el("line", { x1: cx, y1: cy, x2: cx + R - 14, y2: cy, stroke: col(c), "stroke-width": 3.5, "stroke-linecap": "round", filter: "url(#lx-glow)" }, g);
    el("circle", { cx, cy, r: 5, fill: col(c) }, g);
    const lab = D.text(g, cx, cy + R + 34, name, { mono: true, size: 18, color: c, anchor: "middle" });
    return { g, needle, lab, cx, cy, R, name };
  });
  const STEP = 0.55;          // illustrative turn per position step
  const note = D.text(svg, 80, 820, "Each axis drives its own share of the 32 rotating pairs, interleaved T·H·W (11 + 11 + 10). For plain text all three are equal: ordinary RoPE.", { size: 16, color: "muted" });

  return t => {
    ctx._t = t;
    // which token is current (fractional index)
    const a = P("text", .1, .9, LX.ease.inOut) * 2;                       // 0..2
    const b = P("image", .15, .92, LX.ease.inOut) * 11;                   // 0..11
    const c2 = P("after", .15, .8, LX.ease.inOut);                        // 0..1
    let k = a;
    if (t >= ctx.cue("image").start) k = 3 + b;
    if (t >= ctx.cue("after").start) k = 15 + c2;
    const i0 = Math.floor(k), f = k - i0, A = toks[i0], B = toks[Math.min(i0 + 1, toks.length - 1)];
    const lerp = LX.lerp;
    const hx = lerp(A.x, B.x, f) - 6, hy = lerp(A.y, B.y, f) - 6, hw = lerp(A.cw, B.cw, f) + 12, hh = lerp(A.ch, B.ch, f) + 12;
    LX.attr(hl, { x: hx, y: hy, width: hw, height: hh, opacity: P("text", 0, .1) });
    // reveal
    toks.forEach((tk, i) => {
      const shown = tk.kind === "text" ? (i < 3 ? P("text", 0, .1) : P("after", 0, .15)) : P("image", 0, .15);
      if (tk.chip) tk.chip.show(shown, 8); else D.fade(tk.box, shown);
      const passed = LX.clamp((k - i) * 3 + 1);
      D.fade(tk.lab, shown * passed);
    });
    D.fade(axisG, P("image", .08, .25));
    // dials follow the current position triple
    const pos = [0, 1, 2].map(j => lerp(A.pos[j], B.pos[j], f));
    dials.forEach((d, j) => {
      D.fade(d.g, P("text", 0, .15));
      const ang = -Math.PI / 2 + pos[j] * STEP;
      LX.attr(d.needle, { x2: d.cx + Math.cos(ang) * (d.R - 14), y2: d.cy + Math.sin(ang) * (d.R - 14) });
      d.lab.textContent = `${d.name} · ${Math.round(pos[j])}`;
    });
    D.fade(note, P("after", .5, .8));
  };
}

})();

/* ========================================================= image-tokens widget */
(function () {
  "use strict";
  const F = 32, MIN = 65536, MAX = 16777216;
  const bankers = x => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };  // Python round()
  /** Qwen-VL smart_resize: both sides multiples of 32, area within [MIN, MAX]. */
  function resize(h, w) {
    if (Math.max(h, w) / Math.min(h, w) > 200) return { error: "Aspect ratio above 200 is rejected." };
    let hb = Math.max(F, bankers(h / F) * F), wb = Math.max(F, bankers(w / F) * F);
    if (hb * wb > MAX) { const b = Math.sqrt(h * w / MAX); hb = Math.max(F, Math.floor(h / b / F) * F); wb = Math.max(F, Math.floor(w / b / F) * F); }
    else if (hb * wb < MIN) { const b = Math.sqrt(MIN / (h * w)); hb = Math.ceil(h * b / F) * F; wb = Math.ceil(w * b / F) * F; }
    return { h: hb, w: wb };
  }
  const fmtB = b => b >= 2 ** 30 ? (b / 2 ** 30).toFixed(2) + " GiB" : b >= 2 ** 20 ? (b / 2 ** 20).toFixed(1) + " MiB" : (b / 1024).toFixed(0) + " KiB";
  const n = v => v.toLocaleString("en-US");
  const INPUT = "background:var(--lx-panel);border:1px solid var(--lx-line-2);color:var(--lx-text);border-radius:7px;padding:6px 8px;font:500 14px var(--lx-mono);width:100%;min-width:0;";
  LX.widget("image-tokens", el => {
    const st = { w: 1024, h: 768, sec: 0, fps: 2 };
    const field = (key, label) => `<label style="display:grid;gap:4px;font-size:13px;color:var(--lx-text-2)">${label}<input type="number" min="0" step="1" data-k="${key}" value="${st[key]}" style="${INPUT}"></label>`;
    const presets = [["1024 × 768", 1024, 768], ["Phone photo 4032 × 3024", 4032, 3024], ["4K screenshot 3840 × 2160", 3840, 2160], ["Tiny icon 64 × 64", 64, 64]];
    el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">${presets.map((p, i) => `<button type="button" class="lx-speed it-pre" data-i="${i}">${p[0]}</button>`).join("")}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">${field("w", "Width (px)")}${field("h", "Height (px)")}${field("sec", "Video seconds (0 = image)")}${field("fps", "Frames per second")}</div>
      <div class="it-out" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:16px 0 12px"></div>
      <p class="it-note" style="margin:0 0 10px;font-size:14px;color:var(--lx-text-2)"></p>
      <svg class="it-grid" viewBox="0 0 640 360" style="width:100%;height:auto;display:block;max-height:420px" role="img" aria-label="Resized image with its grid of visual tokens"></svg>
      <p style="margin:6px 0 0;font-size:12.5px;color:var(--lx-muted)">Each cell is one visual token (32 × 32 pixels after the 2 × 2 merge). Video settings in a real deployment may use a lower pixel limit per frame than images.</p>`;
    const out = el.querySelector(".it-out"), note = el.querySelector(".it-note"), svg = el.querySelector(".it-grid");
    const card = (label, val, color = "var(--lx-text)") => `<div style="background:var(--lx-panel);border:1px solid var(--lx-line);border-radius:10px;padding:10px 12px"><div style="font:500 11px var(--lx-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--lx-muted)">${label}</div><div style="font:650 20px var(--lx-sans);color:${color}">${val}</div></div>`;
    function render() {
      const r = resize(Math.max(1, st.h), Math.max(1, st.w));
      if (r.error) { out.innerHTML = ""; note.textContent = r.error; svg.innerHTML = ""; return; }
      const frames = st.sec > 0 ? Math.max(2, 2 * Math.round(st.sec * st.fps / 2)) : 1;      // video frames come in pairs
      const slices = st.sec > 0 ? frames / 2 : 1;
      const gw = r.w / 32, gh = r.h / 32, perSlice = gw * gh, tokens = perSlice * slices;
      out.innerHTML = card("Resized to", `${n(r.w)} × ${n(r.h)}`) + card("Patches (16 px)", n((r.w / 16) * (r.h / 16) * slices))
        + card("Visual tokens", n(tokens), "var(--lx-vision)") + card("KV cache", fmtB(tokens * 65536), "var(--lx-cache)");
      note.innerHTML = (st.sec > 0 ? `${frames} frames → ${slices} time slices of ${n(perSlice)} tokens each. ` : "")
        + `Grid: ${gw} × ${gh} tokens${st.sec > 0 ? " per time slice" : ""}. That is about ${(tokens / 750).toFixed(tokens < 750 ? 2 : 1)} pages of text at roughly 750 tokens per page.`;
      // draw the merged grid to scale inside 640 × 360
      const sc = Math.min(620 / r.w, 350 / r.h), W = r.w * sc, H = r.h * sc, x0 = (640 - W) / 2, y0 = (360 - H) / 2;
      let h = `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" rx="2" style="fill:color-mix(in srgb, var(--lx-vision) 12%, var(--lx-bg));stroke:var(--lx-vision)"/>`;
      const step = Math.max(1, Math.ceil(Math.max(gw, gh) / 128));        // keep the drawing light for huge grids
      let d = "";
      for (let i = step; i < gw; i += step) d += `M${(x0 + i * 32 * sc).toFixed(1)} ${y0}V${(y0 + H).toFixed(1)}`;
      for (let j = step; j < gh; j += step) d += `M${x0} ${(y0 + j * 32 * sc).toFixed(1)}H${(x0 + W).toFixed(1)}`;
      h += `<path d="${d}" style="stroke:var(--lx-vision);stroke-opacity:.45;stroke-width:${sc * 32 > 6 ? 1 : .5}"/>`;
      svg.innerHTML = h;
    }
    el.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => { st[inp.dataset.k] = Math.max(0, Number(inp.value) || 0); render(); }));
    el.querySelectorAll(".it-pre").forEach(b => (b.onclick = () => {
      const p = presets[+b.dataset.i]; st.w = p[1]; st.h = p[2]; st.sec = 0;
      el.querySelector('[data-k="w"]').value = st.w; el.querySelector('[data-k="h"]').value = st.h; el.querySelector('[data-k="sec"]').value = 0; render();
    }));
    render();
  });
})();
