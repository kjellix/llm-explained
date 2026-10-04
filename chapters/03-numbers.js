/* Chapter 03 — Numbers, vectors, matrices, tensors */
LX.chapter({
  id: "numbers", num: 3, title: "Vectors, matrices and tensors", toc: "Vectors, matrices, tensors",
  kicker: "The only data type a model knows",
  lede: "Inside the model there are no words, only numbers arranged in lists and grids. Four words describe every arrangement: scalar, vector, matrix, tensor.",
  body: [
    { prose: `
      <p>Before we follow a token into the model, we need the vocabulary for what it turns into. Everything the model stores and everything it computes is numbers. What differs is how many directions the numbers are laid out in.</p>` },

    { scene: {
      id: "tensor-ladder", title: "From one number to a tensor",
      visual: "A single glowing cell grows step by step: into a column (vector), then a grid (matrix), then a stack of grids (3-D tensor). A shape label in brackets updates at each step, and the dimension being added is highlighted with a bracket.",
      cues: [
        { id: "scalar", say: "A single number is called a scalar. It has no direction and no shape. Just a value, like zero point four two.", vis: "One cell with the value 0.42. Label: scalar · shape [ ]" },
        { id: "vector", say: "Put numbers in a list and you have a vector. A vector has one direction, so its shape is just its length. Each token inside Qwen 3.8 is a vector of length five thousand one hundred and twenty.", vis: "The cell grows into a column of cells; bracket shows length. Label: vector · shape [5120]" },
        { id: "matrix", say: "Put several vectors side by side and you get a matrix, a grid with rows and columns. Five tokens, each with five thousand one hundred and twenty numbers, make a matrix of shape five by five thousand one hundred and twenty.", vis: "Five columns appear, one per token chip above them. Label: matrix · shape [5, 5120]" },
        { id: "tensor", say: "Add one more direction and the grid becomes a stack of grids. The general word for any number of directions is tensor. A tensor is just a container of numbers with a shape.", vis: "The grid splits into 24 thin slices fanned out in depth (attention heads). Label: tensor · shape [5, 24, 256]" },
        { id: "rule",   say: "So every vector is a tensor, but not every tensor is a vector. When engineers say tensor, they usually mean: some block of numbers, and here is its shape.", vis: "All four shapes side by side with their shape labels: [ ] · [5120] · [5, 5120] · [5, 24, 256]" },
      ],
      build(ctx) {
        const { svg } = ctx, D = LX.draw, el = LX.el, ups = [];
        D.backdrop(svg);
        const R = LX.rng(23);
        const CELL = 26, STEP = 30, ROWS = 16, TOP = 250, NCOL = 5;
        const X0 = 800;                                   // vector-stage column centre
        const XC = i => 640 + i * 80;                     // matrix-stage column centres
        const rowY = r => TOP + r * STEP;
        const SC = 7;                                     // the row that holds the scalar 0.42
        const vals = Array.from({ length: NCOL }, () => Array.from({ length: ROWS }, () => +((R() * 2 - 1) * (.3 + R() * .7)).toFixed(2)));
        vals[0][SC] = .42;
        const cell = (parent, cx, y, v, size = CELL) =>
          el("rect", { x: cx - size / 2, y, width: size, height: size, rx: 3, fill: LX.valueColor(v), stroke: LX.col("line-2"), "stroke-width": 1 }, parent);

        /* ---- shape readout (top left) ---- */
        D.label(svg, 80, 92, "Shape");
        const shapeT = D.text(svg, 80, 150, "", { mono: true, size: 44, weight: 500, color: "embed" });
        const nameT = D.text(svg, 80, 194, "", { size: 20, color: "text-2" });
        const STAGES = [
          ["scalar", "[ ]", "scalar · 0 directions"],
          ["vector", "[5120]", "vector · 1 direction"],
          ["matrix", "[5, 5120]", "matrix · 2 directions"],
          ["tensor", "[5, 24, 256]", "tensor · 3 directions"],
          ["rule", "0 · 1 · 2 · 3", "all four are tensors; only the shape differs"],
        ];

        /* ---- main construction ---- */
        const main = el("g", {}, svg);
        // depth copies (drawn first so they sit behind the front grid)
        const DEPTH = 7, DX = 14, DY = 8;
        const depth = [];
        for (let k = DEPTH; k >= 1; k--) {
          const g = el("g", { transform: `translate(${k * DX} ${-k * DY})` }, main);
          for (let i = 0; i < NCOL; i++)
            el("rect", { x: XC(i) - CELL / 2, y: TOP, width: CELL, height: ROWS * STEP - (STEP - CELL), rx: 4,
              fill: LX.mix("bg", "attn", .1), stroke: LX.col("attn"), "stroke-opacity": .55, "stroke-width": 1 }, g);
          depth.push({ g, k });
        }
        // token chips above the matrix
        const TOK = ["The", " cat", " sat", " on", " the"];
        const chips = TOK.map((tk, i) => D.tokenChip(main, { x: XC(i) - 35, y: 136, w: 70, h: 40, text: tk, size: 18 }));
        // front columns
        const cols = vals.map((col, i) => {
          const g = el("g", {}, main);
          const cx = i === 0 ? X0 : XC(i);
          const cells = col.map((v, r) => cell(g, cx, rowY(r), v));
          return { g, cells };
        });
        const scalarCell = cols[0].cells[SC];
        main.appendChild(cols[0].g);                       // column 0 on top while it grows
        const scalarCx = X0, scalarCy = rowY(SC) + CELL / 2;
        const valT = D.text(svg, scalarCx + 52, scalarCy + 9, "0.42", { mono: true, size: 26, color: "text" });

        // brackets
        const bLen = D.bracket(main, { x1: X0 + 29, y1: TOP, x2: X0 + 29, y2: rowY(ROWS - 1) + CELL, side: "right", label: "5,120 numbers (16 shown)", color: "embed" });
        const bHead = D.bracket(main, { x1: XC(0) - 29, y1: TOP, x2: XC(0) - 29, y2: rowY(ROWS - 1) + CELL, side: "left", label: "256 per head", color: "attn" });
        const bTok = D.bracket(main, { x1: XC(0) - 13, y1: rowY(ROWS - 1) + CELL + 14, x2: XC(4) + 13, y2: rowY(ROWS - 1) + CELL + 14, side: "bottom", label: "5 tokens", color: "token" });
        const dpx = XC(4) + 13, dpy = TOP;
        const bDepth = el("g", {}, main);
        el("path", { d: `M${dpx + 4} ${dpy - 4} L${dpx + DEPTH * DX + 4} ${dpy - DEPTH * DY - 4}`, stroke: LX.col("attn"), "stroke-width": 1.5, fill: "none", "stroke-dasharray": "4 4" }, bDepth);
        D.text(bDepth, dpx + DEPTH * DX + 14, dpy - DEPTH * DY + 2, "24 heads (8 drawn)", { mono: true, size: 14, color: "attn" });
        const note = D.text(main, 800, 812, "e.g. the queries of 5 tokens, split into 24 attention heads of 256 numbers each", { size: 16, color: "muted", anchor: "middle" });

        /* ---- final summary row ---- */
        const sum = el("g", {}, svg);
        const minis = [];
        const BASE = 600, MC = 22, MS = 26;
        const miniCol = (g, cx, n, k = 0) => { for (let r = 0; r < n; r++) cell(g, cx, BASE - (n - r) * MS + 4, vals[k % NCOL][r], MC); };
        const defs = [
          { x: 330, name: "Scalar", shape: "[ ]", draw: g => cell(g, 330, BASE - 36, .42, 40) },
          { x: 650, name: "Vector", shape: "[5120]", draw: g => miniCol(g, 650, 8) },
          { x: 980, name: "Matrix", shape: "[5, 5120]", draw: g => { for (let i = 0; i < 5; i++) miniCol(g, 928 + i * MS, 8, i); } },
          { x: 1310, name: "Tensor", shape: "[5, 24, 256]", draw: g => {
              for (let k = 4; k >= 1; k--) { const gg = el("g", { transform: `translate(${k * 10} ${-k * 8})` }, g);
                for (let i = 0; i < 5; i++) el("rect", { x: 1238 + i * MS - MC / 2, y: BASE - 8 * MS + 4, width: MC, height: 8 * MS - 4, rx: 3, fill: LX.mix("bg", "attn", .1), stroke: LX.col("attn"), "stroke-opacity": .55 }, gg); }
              for (let i = 0; i < 5; i++) miniCol(g, 1238 + i * MS, 8, i);
            } },
        ];
        defs.forEach(d => {
          const g = el("g", {}, sum);
          d.draw(g);
          D.text(g, d.x, BASE + 54, d.name, { size: 24, weight: 600, anchor: "middle" });
          D.text(g, d.x, BASE + 86, d.shape, { mono: true, size: 18, color: "embed", anchor: "middle" });
          minis.push(g);
        });
        const ruleT = D.text(sum, 800, 300, "Every vector is a tensor. Not every tensor is a vector.", { size: 26, weight: 500, anchor: "middle", color: "text-2" });

        ups.push(t => {
          // readout
          let s = 0;
          STAGES.forEach((st, i) => { if (t >= ctx.cue(st[0]).start) s = i; });
          shapeT.textContent = STAGES[s][1];
          nameT.textContent = STAGES[s][2];
          const fin = ctx.p(t, STAGES[s][0], 0, .1);
          D.fade(shapeT, fin); D.fade(nameT, fin);

          // scalar: one big glowing cell
          const grow = ctx.p(t, "scalar", 0, .25, LX.ease.back);
          const vec = ctx.p(t, "vector", 0, .3, LX.ease.inOut);
          const scale = (grow * 2.2) * (1 - vec) + 1 * vec;
          scalarCell.setAttribute("transform", `translate(${scalarCx} ${scalarCy}) scale(${Math.max(.001, scale)}) translate(${-scalarCx} ${-scalarCy})`);
          scalarCell.setAttribute("filter", vec < .9 && grow > 0 ? "url(#lx-glow)" : "none");
          D.fade(scalarCell, Math.min(1, grow * 3));
          D.fade(valT, ctx.p(t, "scalar", .2, .4) * (1 - ctx.p(t, "vector", 0, .2)));
          valT.setAttribute("x", scalarCx + 52 + 30 * (1 - ctx.p(t, "scalar", .2, .4)) * 0);

          // vector: other cells emerge from the scalar's position
          cols[0].cells.forEach((c, r) => {
            if (r === SC) return;
            const q = ctx.p(t, "vector", .02 + Math.abs(r - SC) * .015, .22 + Math.abs(r - SC) * .015, LX.ease.inOut);
            c.setAttribute("transform", `translate(0 ${(scalarCy - CELL / 2 - rowY(r)) * (1 - q)})`);
            D.fade(c, q);
          });

          // matrix: column 0 slides to its place, the other columns rise into theirs
          const m = ctx.p(t, "matrix", 0, .18, LX.ease.inOut);
          cols[0].g.setAttribute("transform", `translate(${(XC(0) - X0) * m} 0)`);
          for (let i = 1; i < NCOL; i++) {
            const q = ctx.p(t, "matrix", .08 + i * .05, .3 + i * .05, LX.ease.inOut);
            cols[i].g.setAttribute("transform", `translate(0 ${(1 - q) * 14})`);
            D.fade(cols[i].g, q);
          }
          chips.forEach((c, i) => c.show(ctx.p(t, "matrix", .3 + i * .05, .48 + i * .05)));
          // length bracket follows the right edge
          const bx = (XC(4) - X0) * ctx.p(t, "matrix", .1, .45, LX.ease.inOut);
          bLen.g.setAttribute("transform", `translate(${bx} 0)`);
          const tens = ctx.p(t, "tensor", 0, .2);
          bLen.show(ctx.p(t, "vector", .35, .5) * (1 - tens));
          bTok.show(ctx.p(t, "matrix", .55, .7));

          // tensor: depth slices fan out behind
          depth.forEach(({ g, k }) => {
            const q = ctx.p(t, "tensor", .1 + k * .05, .35 + k * .05, LX.ease.out);
            g.setAttribute("transform", `translate(${k * DX * q} ${-k * DY * q})`);
            D.fade(g, q * (1 - k * .08));
          });
          bHead.show(tens);
          D.fade(bDepth, ctx.p(t, "tensor", .5, .65));
          D.fade(note, ctx.p(t, "tensor", .6, .75));

          // rule: summary row replaces the construction
          const r = ctx.p(t, "rule", 0, .2, LX.ease.inOut);
          D.fade(main, 1 - r);
          D.fade(valT, valT.getAttribute("opacity") * (1 - r));
          minis.forEach((g, i) => {
            const q = ctx.p(t, "rule", .1 + i * .08, .3 + i * .08);
            g.setAttribute("opacity", q); g.setAttribute("transform", `translate(0 ${(1 - q) * 14})`);
          });
          D.fade(ruleT, ctx.p(t, "rule", .45, .6));
        });
        return t => ups.forEach(u => u(t));
      },
    } },

    { prose: `
      <h3>The four words</h3>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Name</th><th>Directions</th><th>Example in Qwen3.8-27B</th><th>Shape</th></tr>
        <tr><td><strong>Scalar</strong></td><td>0</td><td>The temperature setting, one probability</td><td class="num">[ ]</td></tr>
        <tr><td><strong>Vector</strong></td><td>1</td><td>One token's hidden state</td><td class="num">[5120]</td></tr>
        <tr><td><strong>Matrix</strong></td><td>2</td><td>The embedding table; the hidden states of a whole prompt</td><td class="num">[248320, 5120]</td></tr>
        <tr><td><strong>Tensor</strong></td><td>any</td><td>Queries split into heads; a batch of prompts</td><td class="num">[T, 24, 256]</td></tr>
      </table></div>
      <p>A <strong>shape</strong> lists how far a tensor stretches in each direction. It is the most useful thing to keep track of when reading about models. In this course, <code>T</code> always means "number of tokens being processed right now".</p>

      <h3>What actually travels through the model</h3>
      <p>The thing that flows from layer to layer is a tensor of shape <code>[T, 5120]</code>, one 5,120-number vector per token. It is called the <strong>hidden state</strong>, or the <strong>residual stream</strong>. When the model reads your prompt, <code>T</code> is the length of the prompt. When it writes, <code>T</code> is usually just 1, the newest token. Chapter 13 explains why.</p>

      <h3>Parameters are matrices too</h3>
      <p>The 27.8 billion parameters are stored as matrices. For example, the first projection in each <abbr>MLP</abbr> is a matrix of shape <code>[5120, 17408]</code>, about 89 million numbers. Running the model is mostly one operation, repeated: <strong>multiply a vector by a matrix</strong>.</p>` },

    { scene: {
      id: "matvec", title: "Vector × matrix: the one operation",
      visual: "A token vector (teal column, 8 cells shown) on the left, a weight matrix (8 × 12 grid shown) in the middle, the output vector as a row beneath the matrix, and a worked-arithmetic panel on the right. One column of the matrix lights up, its cells pair with the input cells, the products are written out row by row and summed, and the sum travels into the first output cell. Then the highlight sweeps across and fills every output cell.",
      cues: [
        { id: "setup",  say: "Here is the operation that does almost all the work. On the left is a token's vector. In the middle is a weight matrix, one of the model's learned tables.", vis: "Input vector and matrix fade in, labelled [5120] and [5120 × 17408]; empty output slots wait beneath the matrix." },
        { id: "dot",    say: "To get one output number, take one column of the matrix. Multiply each of its numbers by the matching number in the vector, and add all the products together. This is called a dot product.", vis: "Column 1 highlights; pairs connect with lines; the eight products are written out on the right and summed; the sum travels into output cell 1." },
        { id: "all",    say: "Do the same for every column, and you get a whole new vector. Here, five thousand one hundred and twenty numbers go in, and seventeen thousand four hundred and eight come out.", vis: "The highlight sweeps left to right; output cells fill one by one; label [17408]." },
        { id: "count",  say: "That one step is eighty-nine million multiplications and additions. A single token passes through hundreds of these matrices, about fifty-one billion operations for every token the model writes.", vis: "Counter ticks up: 5,120 × 17,408 = 89,128,960 multiply-adds → ≈ 51 billion per token." },
      ],
      build(ctx) {
        const { svg } = ctx, D = LX.draw, el = LX.el, ups = [];
        D.backdrop(svg);
        const R = LX.rng(11);
        const N = 8, M = 12, C = 34, S = 40;
        const Y0 = 250, XI = 260, XM = 420, YO = 640, XP = 1000;
        const rowY = i => Y0 + i * S;
        const colX = j => XM + j * S;
        const r2 = v => Math.round(v * 100) / 100;
        const f2 = v => (v < 0 ? "−" : "") + Math.abs(v).toFixed(2);
        const x = Array.from({ length: N }, () => r2((R() * 2 - 1) * .95));
        const W = Array.from({ length: N }, () => Array.from({ length: M }, () => r2((R() * 2 - 1) * .95)));
        const prods = j => x.map((xi, i) => r2(xi * W[i][j]));
        const y = Array.from({ length: M }, (_, j) => r2(prods(j).reduce((a, b) => a + b, 0)));
        const ymax = Math.max(...y.map(Math.abs));
        const cellR = (g, cx, cy, v, o = {}) => el("rect", { x: cx, y: cy, width: C, height: C, rx: 4, fill: LX.valueColor(v), stroke: LX.col("line-2"), "stroke-width": 1, ...o }, g);

        /* input vector */
        const gIn = el("g", {}, svg);
        D.label(gIn, XI - 17, Y0 - 50, "Token vector x");
        D.text(gIn, XI - 17, Y0 - 24, "[5120] · 8 shown", { mono: true, size: 15, color: "embed" });
        x.forEach((v, i) => cellR(gIn, XI - C / 2, rowY(i), v));

        /* weight matrix */
        const gW = el("g", {}, svg);
        D.label(gW, XM, Y0 - 50, "Weight matrix W · MLP up-projection");
        D.text(gW, XM, Y0 - 24, "[5120 × 17408] · 8 × 12 shown", { mono: true, size: 15, color: "mlp" });
        W.forEach((row, i) => row.forEach((v, j) => cellR(gW, colX(j), rowY(i), v)));

        /* output slots */
        const gOut = el("g", {}, svg);
        D.label(gOut, XI - 17, YO + 23, "Output y");
        const outBg = [], outCells = [];
        for (let j = 0; j < M; j++) {
          outBg.push(el("rect", { x: colX(j), y: YO, width: C, height: C, rx: 4, fill: "none", stroke: LX.col("line-2"), "stroke-width": 1, "stroke-dasharray": "3 3" }, gOut));
          outCells.push(cellR(gOut, colX(j), YO, y[j] / ymax, { opacity: 0 }));
        }
        const outShape = D.text(svg, XM, YO + C + 32, "[17408] · 12 shown", { mono: true, size: 15, color: "embed" });

        /* highlights */
        const hiIn = el("rect", { x: XI - C / 2 - 5, y: Y0 - 5, width: C + 10, height: N * S + 2, rx: 7, fill: "none", stroke: LX.col("embed"), "stroke-width": 2, filter: "url(#lx-glow)" }, svg);
        const hiCol = el("rect", { x: colX(0) - 5, y: Y0 - 5, width: C + 10, height: N * S + 2, rx: 7, fill: "none", stroke: LX.col("text"), "stroke-width": 2, filter: "url(#lx-glow)" }, svg);
        const hiOut = el("rect", { x: colX(0) - 5, y: YO - 5, width: C + 10, height: C + 10, rx: 7, fill: "none", stroke: LX.col("text"), "stroke-width": 2 }, svg);

        /* pair lines for column 0 */
        const pairs = x.map((_, i) => {
          const yy = rowY(i) + C / 2;
          const a = D.arrow(svg, { x1: XI + C / 2 + 4, y1: yy, x2: XM - 6, y2: yy, color: "line-2", width: 1.5, head: false });
          const m = D.text(svg, (XI + XM) / 2 + 9, yy + 5, "×", { mono: true, size: 16, color: "muted", anchor: "middle" });
          return { a, m };
        });

        /* arithmetic panel */
        const gP = el("g", {}, svg);
        D.label(gP, XP, Y0 - 50, "One output = one dot product");
        const p0 = prods(0);
        const rowsP = x.map((xi, i) => {
          const r = D.text(gP, XP, rowY(i) + 24, `${f2(xi).padStart(5)} × ${f2(W[i][0]).padStart(5)} = ${f2(p0[i]).padStart(5)}`, { mono: true, size: 20, color: "text-2" });
          r.style.whiteSpace = "pre";
          return r;
        });
        const sumLine = el("line", { x1: XP, y1: rowY(N) + 2, x2: XP + 340, y2: rowY(N) + 2, stroke: LX.col("line-2"), "stroke-width": 1.5 }, gP);
        const sumT = D.text(gP, XP + 340, rowY(N) + 36, `sum = ${f2(y[0])}`, { mono: true, size: 24, weight: 600, anchor: "end" });
        const y0T = D.text(svg, colX(0) + C / 2, YO + C + 32, f2(y[0]), { mono: true, size: 16, anchor: "middle", color: "text" });
        const matFrame = el("rect", { x: XM - 8, y: Y0 - 8, width: M * S + 8, height: N * S + 8, rx: 8, fill: "none", stroke: LX.col("mlp"), "stroke-width": 2, filter: "url(#lx-glow)" }, svg);
        const flyPath = el("path", { d: `M${XP + 150} ${rowY(N) + 44} C ${XP - 60} ${YO + 90}, ${colX(0) + 160} ${YO + 110}, ${colX(0) + C / 2} ${YO + C + 6}`, fill: "none" }, svg);
        const fly = D.traveller(svg, flyPath, { color: "embed", r: 7 });

        // sweep summary text (replaces arithmetic rows)
        const gS = el("g", {}, svg);
        D.text(gS, XP, Y0 + 40, "Same recipe for every column:", { size: 22, color: "text-2" });
        D.text(gS, XP, Y0 + 80, "12 columns → 12 outputs here,", { size: 22, color: "text-2" });
        D.text(gS, XP, Y0 + 120, "17,408 in the real matrix.", { size: 22, color: "text" });

        // count panel
        const gC = el("g", {}, svg);
        D.text(gC, XP, Y0 + 30, "5,120 × 17,408", { mono: true, size: 30, color: "text-2" });
        const cnt = D.text(gC, XP, Y0 + 92, "", { mono: true, size: 44, weight: 600, color: "mlp" });
        D.text(gC, XP, Y0 + 126, "multiply-adds · one matrix, one token", { size: 18, color: "muted" });
        el("line", { x1: XP, y1: Y0 + 166, x2: XP + 470, y2: Y0 + 166, stroke: LX.col("line-2"), "stroke-width": 1.5 }, gC);
        const gC2 = el("g", {}, gC);
        D.text(gC2, XP, Y0 + 212, "× hundreds of matrices in 64 layers", { size: 20, color: "text-2" });
        D.text(gC2, XP, Y0 + 262, "≈ 51 billion", { mono: true, size: 40, weight: 600 });
        D.text(gC2, XP, Y0 + 294, "operations for every token written", { size: 18, color: "muted" });

        ups.push(t => {
          const su = ctx.p(t, "setup", 0, .35);
          D.fade(gIn, su); D.fade(gW, ctx.p(t, "setup", .2, .55)); D.fade(gOut, ctx.p(t, "setup", .45, .75));
          D.fade(outShape, ctx.p(t, "all", .7, .85));

          // dot: one column
          const hi = ctx.p(t, "dot", 0, .1);
          const all = ctx.p(t, "all", .05, .85, LX.ease.inOut);
          const jf = all * (M - 1);
          const jCur = Math.min(M - 1, Math.round(jf));
          const hx = colX(0) + jf * S - 5;
          D.fade(hiIn, hi * (1 - ctx.p(t, "count", 0, .15)));
          D.fade(hiCol, hi * (1 - ctx.p(t, "all", .88, 1)));
          hiCol.setAttribute("x", hx);
          hiOut.setAttribute("x", hx);
          D.fade(hiOut, ctx.p(t, "dot", .78, .88) * (1 - ctx.p(t, "all", .88, 1)));

          const lines = ctx.p(t, "dot", .08, .25) * (1 - ctx.p(t, "all", 0, .08));
          pairs.forEach((pr, i) => {
            pr.a.draw(LX.clamp(lines * 1.6 - i * .08));
            D.fade(pr.a.g, 1 - ctx.p(t, "all", 0, .08));
            D.fade(pr.m, LX.clamp(lines * 1.6 - i * .08) * .9);
          });
          const off = 1 - ctx.p(t, "all", 0, .1);
          rowsP.forEach((r, i) => D.fade(r, ctx.p(t, "dot", .22 + i * .045, .3 + i * .045) * off));
          D.fade(sumLine, ctx.p(t, "dot", .62, .68) * off);
          D.fade(sumT, ctx.p(t, "dot", .66, .74) * off);
          fly.at(ctx.p(t, "dot", .74, .92, LX.ease.inOut));

          // output cells
          outCells.forEach((c, j) => {
            const filled = j === 0 ? ctx.p(t, "dot", .88, .95) : (t >= ctx.cue("all").start ? LX.clamp((jf - j + 1) * 1.5) : 0);
            D.fade(c, filled);
            c.setAttribute("filter", Math.abs(jf - j) < .5 && all > 0 && all < 1 ? "url(#lx-glow)" : "none");
          });

          D.fade(gS, ctx.p(t, "all", .1, .2) * (1 - ctx.p(t, "count", 0, .1)));

          // count
          D.fade(gC, ctx.p(t, "count", .05, .15));
          const k = ctx.p(t, "count", .1, .5, LX.ease.inOut);
          cnt.textContent = "= " + Math.round(89128960 * k).toLocaleString("en-US");
          D.fade(gC2, ctx.p(t, "count", .55, .7));
          // the matrix is framed while we count
          D.fade(matFrame, ctx.p(t, "count", .05, .2));
          D.fade(y0T, ctx.p(t, "dot", .9, .97) * (1 - ctx.p(t, "all", .6, .7)));
        });
        return t => ups.forEach(u => u(t));
      },
    } },

    { prose: `
      <h3>How big is a number?</h3>
      <p>Qwen3.8-27B is published in <abbr>bf16</abbr>, a 16-bit (2-byte) number format. 27.78 billion parameters × 2 bytes = <strong>55.6 GB</strong>. To run on a desktop machine, models are usually <strong>quantized</strong>: each weight is stored with far fewer bits. The common <abbr>Q4</abbr> file of this model averages about 5.6 bits per weight and is 19 GB, at a small cost in quality. The next section shows how that works.</p>
      <p>Size matters for more than storage. To write <em>each</em> token, the computer must read essentially every weight from memory once. On most hardware, writing speed is limited by how fast memory can be read, not by how fast the chip can multiply.</p>` },

    { prose: `
      <h3>Quantization: fewer bits per weight</h3>
      <p>A trained model's weights are 16-bit numbers, but they do not need that much precision to work. <strong>Quantization</strong> stores each weight as a small whole number instead, and keeps one shared <strong>scale</strong> for a small group of neighbouring weights. To use a weight, the computer multiplies the small number by its group's scale and gets back a close approximation of the original.</p>
      <p>With 4 bits, a weight can only be one of 16 levels. The trick that makes this work is the grouping: each block of 32 weights gets its own scale, chosen so that its 16 levels are spread exactly over the range of <em>those</em> weights. A block of tiny weights gets finely spaced levels, a block of large ones gets wider steps.</p>` },

    { scene: {
      id: "quantize-block", title: "Squeezing 32 weights into 4 bits each",
      visual: "One block of 32 real-looking weights (seeded, roughly bell-shaped) drawn as bars around a zero line, with their 16-bit values. The largest absolute value is highlighted and becomes the scale. A ladder of 16 horizontal levels appears over the bars; each bar snaps to its nearest level, and its 4-bit code (0–15) appears beneath. The block is then stored as 32 tiny codes plus one scale; a byte counter compares 64 bytes (16-bit) with 18 bytes (4-bit + scale). Finally the codes are expanded back (code × scale) and the small rounding error of each weight is shown as a thin pink sliver, with the average error printed.",
      cues: [
        { id: "block",  say: "Here are thirty-two neighbouring weights from one row of a weight matrix. Stored as sixteen-bit numbers, they take sixty-four bytes.", vis: "32 bars around zero with their values; counter 32 × 2 bytes = 64 bytes." },
        { id: "scale",  say: "Quantization first finds the largest weight in the block, and uses it to set a scale. That scale spreads sixteen evenly spaced levels across exactly the range this block needs.", vis: "The largest |w| glows; a ladder of 16 levels spreads over the bars; the scale value appears." },
        { id: "snap",   say: "Each weight then snaps to its nearest level, and only the level's number is stored: four bits, a whole number from zero to fifteen.", vis: "Bars snap to the ladder one by one; a 4-bit code appears under each." },
        { id: "store",  say: "The block now takes sixteen bytes of codes plus two bytes for the scale. Eighteen bytes instead of sixty-four, three and a half times smaller.", vis: "Codes pack into a strip; byte counter 64 → 18; ratio 3.6×." },
        { id: "error",  say: "When the model runs, each code is multiplied by the scale to get the weight back. It is not exact, but the errors are small, and spread out like noise. Billions of slightly rounded weights still give almost the same answers.", vis: "Codes expand back to bars; thin pink slivers show each error; average error printed." },
      ],
    } },

    { html: `<div class="lx-prose"><h3>What a "Q4" file really contains</h3>
      <p>The name hides a mix. Inside the common Q4_K_M file of Qwen3.8-27B, different parts of the model get different precision. The large MLP matrices tolerate coarse rounding best, so they get the fewest bits. Parts that are more sensitive keep more:</p></div>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Tensors</th><th>Format</th><th class="num">Bits per weight</th><th class="num">Share of weights</th></tr>
        <tr><td>All MLP matrices (gate, up, down) and the embedding table</td><td>Q4_K</td><td class="num">4.5</td><td class="num">68%</td></tr>
        <tr><td>All attention and DeltaNet projections (queries, keys, values, gates)</td><td>Q8_0</td><td class="num">8.5</td><td class="num">25%</td></tr>
        <tr><td>The output head and the attention output projections</td><td>Q6_K</td><td class="num">6.6</td><td class="num">7%</td></tr>
        <tr><td>Norms, the short convolution, DeltaNet's time constants</td><td>32-bit float</td><td class="num">32</td><td class="num">&lt; 0.1%</td></tr>
        <tr class="sum"><td>Whole file (26.9 B text-model weights)</td><td></td><td class="num">5.64</td><td class="num">18.96 GB</td></tr>
      </table></div>
      <div class="lx-prose"><p class="c-muted">Read directly from the file's own tensor list. Other publishers mix formats differently, so two "Q4" files of the same model can differ in size and quality.</p>
      <p>Two more things are quantized in practice. The <strong>KV cache</strong> can be stored in 8 bits instead of 16, halving its memory at a small cost (<a href="#kv-cache">Chapter 14</a>). And the <em>activations</em>, the vectors flowing through the model, usually stay in 16 bits: the weights are expanded back just before each multiplication. That expansion costs a little arithmetic, which matters on chips that are already short of compute (<a href="#hardware">Chapter 17</a>).</p></div>` },

    { widget: {
      id: "quant-playground", title: "Try it: quantize a block of weights",
      sub: "A row of 256 weights, quantized live. Choose the bits per weight and the block size; the chart shows the first 32 weights before (outline) and after (filled) rounding, with each block's levels. Add an outlier to see why small blocks matter.",
    } },

    { deep: `
      <h3>Dot product and matrix–vector product</h3>
      <p>The dot product of two vectors of length <i>n</i> multiplies matching entries and sums:</p>
      <math display="block"><mrow><mi mathvariant="bold">a</mi><mo>·</mo><mi mathvariant="bold">b</mi><mo>=</mo><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><msub><mi>a</mi><mi>i</mi></msub><msub><mi>b</mi><mi>i</mi></msub></mrow></math>
      <div class="lx-read">For every position i from 1 to n, multiply a's i-th number by b's i-th number. Add up all those products. The total is the dot product, one single number. a and b are two vectors of the same length n. Example: (1, 2, 3) · (4, 5, 6) = 1·4 + 2·5 + 3·6 = 32.</div>
      <p>A row vector <b>x</b> of shape <code>[n]</code> times a matrix <i>W</i> of shape <code>[n, m]</code> gives <b>y</b> of shape <code>[m]</code>, where each output is a dot product with one column:</p>
      <math display="block"><mrow><msub><mi>y</mi><mi>j</mi></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><msub><mi>x</mi><mi>i</mi></msub><mspace width="0.15em"/><msub><mi>W</mi><mrow><mi>i</mi><mi>j</mi></mrow></msub></mrow></math>
      <div class="lx-read">To get output number j, walk down column j of the matrix W: for every row i from 1 to n, multiply the input's i-th number x<sub>i</sub> by the matrix entry in row i, column j, and add up all those products. Do that once for each column j, and you have the whole output vector y. In the MLP example, x has n = 5,120 numbers, W has m = 17,408 columns, so this recipe runs 17,408 times, each time over 5,120 pairs.</div>
      <p>Cost: <i>n · m</i> multiply-adds, usually counted as 2<i>nm</i> floating-point operations. For the MLP up-projection, 5,120 × 17,408 = 89,128,960 multiply-adds. Summed over the whole model, a common rule of thumb is 2 × (number of parameters) operations per token: 2 × 27.8 billion ≈ 55.6 billion. Counting only the weights an ordinary text token actually uses (no vision encoder, no multi-token-prediction head, and a lookup instead of a multiplication for the embedding) gives the exact figure: <strong>51.2 billion operations</strong> (<a href="#recap">Chapter 18</a>). The attention over earlier tokens comes on top of that.</p>
      <h3>Inner dimensions must match</h3>
      <p>Shapes compose like dominoes: <code>[T, 5120] × [5120, 17408] → [T, 17408]</code>. The shared 5,120 disappears and the outer sizes remain. With <code>T</code> tokens at once, the same matrix is reused for every token. That is why processing a long prompt in one go is far more efficient than processing it one token at a time.</p>
      <h3>Inside bf16</h3>
      <p>A bf16 number has 1 sign bit, 8 exponent bits and 7 fraction bits. Its range matches 32-bit floats (about 10<sup>±38</sup>), but it has only about 2–3 significant decimal digits. Neural networks tolerate that low precision remarkably well.</p>` },

    { deep: `
      <h3>Quantization as a formula</h3>
      <p>For a block of weights <i>w</i><sub>1</sub>, …, <i>w</i><sub><i>n</i></sub> and <i>b</i> bits, the simplest symmetric scheme picks one scale per block and rounds:</p>
      <math display="block"><mrow><mi>s</mi><mo>=</mo><mfrac><mrow><munder><mi>max</mi><mi>i</mi></munder><mo>|</mo><msub><mi>w</mi><mi>i</mi></msub><mo>|</mo></mrow><mrow><msup><mn>2</mn><mrow><mi>b</mi><mo>−</mo><mn>1</mn></mrow></msup><mo>−</mo><mn>1</mn></mrow></mfrac><mo>,</mo><mspace width="1em"/><msub><mi>q</mi><mi>i</mi></msub><mo>=</mo><mtext>round</mtext><mo>(</mo><msub><mi>w</mi><mi>i</mi></msub><mo>/</mo><mi>s</mi><mo>)</mo><mo>,</mo><mspace width="1em"/><msub><mover><mi>w</mi><mo>^</mo></mover><mi>i</mi></msub><mo>=</mo><mi>s</mi><mo>·</mo><msub><mi>q</mi><mi>i</mi></msub></mrow></math>
      <div class="lx-read">First find the largest weight in the block, ignoring its sign, and divide it by the largest whole number the bits can hold on each side of zero; that is the scale <i>s</i>. Then, for each weight, divide by the scale and round to the nearest whole number <i>q</i>; only <i>q</i> is stored. To use the weight again, multiply <i>q</i> by <i>s</i>. With 8 bits the largest whole number is 127, so a block whose largest weight is 0.254 gets the scale 0.002, and a weight of 0.1 is stored as 50 and comes back as exactly 0.100.</div>
      <p>The cost in bits per weight is the code plus the block's share of the scale:</p>
      <math display="block"><mrow><mtext>bits per weight</mtext><mo>=</mo><mi>b</mi><mo>+</mo><mfrac><mtext>bits for the scale(s)</mtext><mi>n</mi></mfrac></mrow></math>
      <div class="lx-read">Add the bits of the code to the scale's bits spread over all the weights in the block. Q8_0 stores 32 weights as 8-bit codes plus one 16-bit scale: 8 + 16 / 32 = 8.5 bits per weight. Q4_0 does the same with 4-bit codes: 4 + 16 / 32 = 4.5.</div>
      <h3>K-quants</h3>
      <p>Formats with a K, such as Q4_K and Q6_K, group 256 weights into a super-block of smaller blocks. Each small block gets its own scale and, for Q4_K, an offset, both stored in only 6 bits, and one 16-bit pair at the super-block level scales those in turn. A Q4_K super-block takes 144 bytes for 256 weights, 4.5 bits per weight, while fitting each small block more closely than a single scale could.</p>
      <h3>Measuring the damage</h3>
      <p>The usual quality check compares the quantized model's next-token probabilities with the original model's on the same text, for example as the average KL divergence between the two distributions, or as the change in perplexity. Good 4- to 6-bit files typically stay close to the original; below about 3 bits the loss grows quickly.</p>` },
  ],
});

/* ------------------------------------------------------------------ builds */
(function () {
  "use strict";
  const D = LX.draw, el = LX.el, col = LX.col;

  /** Seeded, roughly bell-shaped weights (Box–Muller). */
  function bell(seed, n, sd) {
    const R = LX.rng(seed), out = [];
    while (out.length < n) {
      const u = Math.max(1e-9, R()), v = R();
      const r = Math.sqrt(-2 * Math.log(u));
      out.push(r * Math.cos(2 * Math.PI * v) * sd, r * Math.sin(2 * Math.PI * v) * sd);
    }
    return out.slice(0, n);
  }
  /** Symmetric absmax quantisation of one block: codes 0…2^b−1 = level + 2^(b−1). */
  function quantBlock(ws, bits) {
    const half = 2 ** (bits - 1), qmax = half - 1;
    const amax = Math.max(...ws.map(Math.abs)) || 1e-12;
    const scale = amax / qmax;
    const q = ws.map(w => Math.max(-half, Math.min(qmax, Math.round(w / scale))));
    return { scale, half, q, codes: q.map(v => v + half), rec: q.map(v => v * scale) };
  }
  const f3 = v => (v < 0 ? "−" : "") + Math.abs(v).toFixed(3);

  /* ============================================== scene: quantize-block */
  const scene = LX.findScene("quantize-block");
  if (scene) scene.build = function (ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);
    // 32 weights: bell-shaped, clipped, plus one moderately larger weight that sets the scale
    const w = bell(29, 32, 0.017).map(v => Math.max(-0.042, Math.min(0.042, v)));
    w[19] = 0.058;
    const Q = quantBlock(w, 4);
    const absErr = w.map((v, i) => Math.abs(v - Q.rec[i]));
    const meanErr = absErr.reduce((a, b) => a + b, 0) / 32;
    const meanAbs = w.reduce((a, b) => a + Math.abs(b), 0) / 32;
    const imax = w.reduce((m, v, i) => (Math.abs(v) > Math.abs(w[m]) ? i : m), 0);

    // layout
    const X0 = 170, P = 38, BW = 26, Z = 445;
    const U = 200 / Math.abs(w[imax]);              // px per unit weight
    const bx = i => X0 + i * P;
    const yOf = v => Z - v * U;

    D.label(svg, 80, 92, "One block · 32 neighbouring weights from one row");
    const bytesT = D.text(svg, 1520, 92, "32 × 2 bytes = 64 bytes", { mono: true, size: 20, anchor: "end", color: "text" });
    const bytesS = D.text(svg, 1520, 122, "16-bit numbers", { mono: true, size: 15, anchor: "end", color: "muted" });

    // zero line
    el("line", { x1: X0 - 20, x2: bx(31) + BW + 20, y1: Z, y2: Z, stroke: col("line-2"), "stroke-width": 1.5 }, svg);
    D.text(svg, X0 - 30, Z + 5, "0", { mono: true, size: 14, color: "muted", anchor: "end" });

    // level ladder (16 levels: (code − 8) × scale)
    const ladder = el("g", {}, svg), rungs = [];
    for (let c = 0; c < 16; c++) {
      const y = yOf((c - 8) * Q.scale);
      const ln = el("line", { x1: X0 - 20, x2: bx(31) + BW + 20, y1: y, y2: y, stroke: col("embed"), "stroke-width": 1, "stroke-dasharray": "3 5", opacity: .55 }, ladder);
      const tx = D.text(ladder, bx(31) + BW + 34, y + 5, String(c), { mono: true, size: 14, color: "embed" });
      rungs.push({ ln, tx });
    }
    const ladLab = D.text(ladder, bx(31) + BW + 34, yOf(7 * Q.scale) - 22, "code", { mono: true, size: 14, color: "muted" });

    // bars
    const bars = w.map((v, i) => {
      const g = el("g", {}, svg);
      const orig = el("rect", { x: bx(i), width: BW, rx: 2, fill: "none", stroke: col("text-2"), "stroke-width": 1.2, "stroke-dasharray": "4 3", opacity: 0 }, g);
      const bar = el("rect", { x: bx(i), width: BW, rx: 2, fill: LX.valueColor(v / Math.abs(w[imax])) }, g);
      const err = el("rect", { x: bx(i) - 3, width: BW + 6, fill: col("logit"), opacity: 0 }, g);
      const val = D.text(g, 0, 0, f3(v), { mono: true, size: 14, color: "text-2", anchor: "end" });
      val.setAttribute("transform", `translate(${bx(i) + BW / 2 + 5} 692) rotate(-90)`);
      const code = D.text(g, bx(i) + BW / 2, 718, String(Q.codes[i]), { mono: true, size: 16, color: "token", anchor: "middle", weight: 600, opacity: 0 });
      return { g, orig, bar, err, val, code, v, r: Q.rec[i] };
    });
    const setBar = (b, v) => { const y1 = yOf(Math.max(0, v)), y2 = yOf(Math.min(0, v)); LX.attr(b.bar, { y: y1, height: Math.max(1, y2 - y1) }); };
    bars.forEach(b => { const y1 = yOf(Math.max(0, b.v)), y2 = yOf(Math.min(0, b.v)); LX.attr(b.orig, { y: y1, height: Math.max(1, y2 - y1) }); });

    // scale callout
    const scG = el("g", {}, svg);
    const ring = el("rect", { x: bx(imax) - 6, y: yOf(w[imax]) - 8, width: BW + 12, height: Z - yOf(w[imax]) + 16, rx: 5, fill: "none", stroke: col("token"), "stroke-width": 2, filter: "url(#lx-glow)" }, scG);
    const scT1 = D.text(scG, 80, 150, `largest |w| = ${f3(Math.abs(w[imax]))}`, { mono: true, size: 18, color: "token" });
    const scT2 = D.text(scG, 80, 178, `scale s = ${f3(Math.abs(w[imax]))} ÷ 7 = ${Q.scale.toFixed(4)}`, { mono: true, size: 18, color: "text" });
    const scT3 = D.text(scG, 80, 204, "level = (code − 8) × s · codes 0–15", { mono: true, size: 15, color: "muted" });

    // packed strip (store cue)
    const strip = el("g", {}, svg);
    const SX = 170, SY = 760, cw = 34;
    const packCells = [];
    for (let k = 0; k < 16; k++) {
      const x = SX + k * (cw + 6);
      const r = el("rect", { x, y: SY, width: cw, height: 40, rx: 4, fill: LX.mix("bg", "token", .14), stroke: col("token"), "stroke-width": 1.2 }, strip);
      const t = D.text(strip, x + cw / 2, SY + 26, `${Q.codes[2 * k].toString(16)}${Q.codes[2 * k + 1].toString(16)}`, { mono: true, size: 15, anchor: "middle", color: "text" });
      packCells.push([r, t]);
    }
    const scBox = el("rect", { x: SX + 16 * (cw + 6) + 16, y: SY, width: 120, height: 40, rx: 4, fill: LX.mix("bg", "embed", .16), stroke: col("embed"), "stroke-width": 1.4 }, strip);
    const scBoxT = D.text(strip, SX + 16 * (cw + 6) + 76, SY + 26, "scale", { mono: true, size: 15, anchor: "middle", color: "embed" });
    const stripL = D.text(strip, SX, SY + 66, "16 bytes of codes (two 4-bit codes per byte, shown in hex)  +  2 bytes for the scale", { size: 15, color: "muted" });

    // error readout
    const errT = D.text(svg, 1520, 786, `average error ${meanErr.toFixed(4)}`, { mono: true, size: 18, anchor: "end", color: "logit", opacity: 0 });
    const errT2 = D.text(svg, 1520, 812, `≈ ${Math.round(meanErr / meanAbs * 100)}% of a typical weight (${meanAbs.toFixed(4)})`, { mono: true, size: 15, anchor: "end", color: "muted", opacity: 0 });

    ups.push(t => {
      // block: bars grow in
      const g0 = ctx.p(t, "block", 0, .55);
      bars.forEach((b, i) => {
        const p = LX.clamp(g0 * 1.6 - i / 32 * .6);
        setBar(b, b.v * p);
        D.fade(b.val, LX.clamp(p * 2 - .4) * (1 - ctx.p(t, "snap", 0, .1)));
      });
      // scale: highlight + ladder
      const ps = ctx.p(t, "scale", 0, .25);
      D.fade(ring, ps * (1 - ctx.p(t, "store", 0, .2)));
      D.fade(scT1, ps); D.fade(scT2, ctx.p(t, "scale", .25, .5)); D.fade(scT3, ctx.p(t, "scale", .5, .75));
      rungs.forEach((r, c) => { const q = ctx.p(t, "scale", .35 + c * .03, .55 + c * .03); D.fade(r.ln, q * .55); D.fade(r.tx, q); });
      D.fade(ladLab, ctx.p(t, "scale", .6, .8));
      // snap: bars move to their level one by one, codes appear
      const sn = ctx.p(t, "snap", 0, .85, LX.ease.linear);
      bars.forEach((b, i) => {
        const q = LX.ease.out(LX.clamp((sn - .1) / .9 * 32 - i));
        if (t >= ctx.cue("snap").start) setBar(b, b.v + (b.r - b.v) * q);
        D.fade(b.orig, q * .9);
        D.fade(b.code, q);
      });
      // store: pack + bytes
      const st = ctx.p(t, "store", 0, .6);
      D.fade(strip, st);
      packCells.forEach(([r, tx], k) => D.fade(r, LX.clamp(st * 1.5 - k / 16 * .5)));
      const sv = ctx.p(t, "store", .55, .75);
      bytesT.textContent = sv < .5 ? "32 × 2 bytes = 64 bytes" : "16 + 2 = 18 bytes";
      bytesS.textContent = sv < .5 ? "16-bit numbers" : `64 ÷ 18 ≈ ${(64 / 18).toFixed(1)}× smaller`;
      bytesT.setAttribute("fill", sv < .5 ? col("text") : col("token"));
      // error slivers
      const er = ctx.p(t, "error", .1, .6);
      bars.forEach(b => {
        const y1 = yOf(Math.max(b.v, b.r)), y2 = yOf(Math.min(b.v, b.r));
        LX.attr(b.err, { y: y1, height: Math.max(1.5, y2 - y1), opacity: er * .9 });
      });
      D.fade(errT, ctx.p(t, "error", .45, .7)); D.fade(errT2, ctx.p(t, "error", .55, .8));
    });
    return t => ups.forEach(u => u(t));
  };

  /* ============================================= widget: quant-playground */
  LX.widget("quant-playground", host => {
    const ROWN = 256, SIZES = [8, 16, 32, 64, 128, 256];
    const presets = { bell: () => bell(41, ROWN, 0.02), tiny: () => bell(43, ROWN, 0.002) };
    const st = { preset: "bell", bits: 4, si: 2, outlier: false };
    host.innerHTML = `
      <div class="qp-presets" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <button data-p="bell" class="lx-speed">Bell-shaped</button>
        <button data-p="outlier" class="lx-speed">One outlier</button>
        <button data-p="tiny" class="lx-speed">All tiny</button>
      </div>
      <div class="qp-ctl" style="display:grid;grid-template-columns:auto 1fr 3.6em;gap:8px 12px;align-items:center;font-size:14px;color:var(--lx-text-2)">
        <label for="qp-bits">Bits per weight</label><input id="qp-bits" type="range" min="2" max="8" step="1" value="4"><output class="mono" data-o="bits"></output>
        <label for="qp-bs">Block size</label><input id="qp-bs" type="range" min="0" max="5" step="1" value="2"><output class="mono" data-o="bs"></output>
        <label for="qp-out" style="grid-column:1/3"><input id="qp-out" type="checkbox"> add one outlier (weight 4 = 0.25)</label><span></span>
      </div>
      <svg class="qp-chart" viewBox="0 0 640 300" style="width:100%;height:auto;display:block;margin:12px 0 4px" role="img" aria-label="First 32 weights before and after quantization"></svg>
      <div class="qp-codes mono" style="display:flex;flex-wrap:wrap;gap:3px;font-size:12.5px;margin:2px 0 12px"></div>
      <div class="qp-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px"></div>`;
    const svg = host.querySelector(".qp-chart"), codesEl = host.querySelector(".qp-codes"), statsEl = host.querySelector(".qp-stats");
    const stat = (k, v, c = "text") => `<div style="background:var(--lx-panel);border:1px solid var(--lx-line);border-radius:8px;padding:8px 10px"><div style="font-size:12px;color:var(--lx-muted)">${k}</div><div class="mono" style="font-size:16px;color:var(--lx-${c})">${v}</div></div>`;

    function render() {
      const n = SIZES[st.si], bits = st.bits;
      const row = presets[st.preset === "tiny" ? "tiny" : "bell"]().slice();
      if (st.outlier) row[4] = 0.25;
      // quantise block by block
      const rec = new Array(ROWN), codes = new Array(ROWN), scales = [];
      for (let b = 0; b < ROWN; b += n) {
        const Q = quantBlock(row.slice(b, b + n), bits);
        scales.push({ start: b, s: Q.scale, half: Q.half });
        Q.rec.forEach((v, i) => (rec[b + i] = v));
        Q.codes.forEach((v, i) => (codes[b + i] = v));
      }
      const errs = row.map((v, i) => Math.abs(v - rec[i]));
      const meanErr = errs.reduce((a, b) => a + b, 0) / ROWN;
      const meanAbs = row.reduce((a, b) => a + Math.abs(b), 0) / ROWN;
      const bpw = bits + 16 / n, bytesBlock = n * bits / 8 + 2;
      // chart: first 32 weights
      const V = 32, W0 = 40, PW = (620 - W0) / V, Z = 150;
      const shown = row.slice(0, V), amax = Math.max(...shown.map(Math.abs), ...rec.slice(0, V).map(Math.abs)) || 1;
      const U = 120 / amax, y = v => Z - v * U;
      let h = `<line x1="${W0 - 6}" x2="634" y1="${Z}" y2="${Z}" stroke="${LX.col("line-2")}"/>`;
      // level lines per block within the view
      scales.filter(sc => sc.start < V).forEach(sc => {
        const x1 = W0 + sc.start * PW, x2 = W0 + Math.min(V, sc.start + n) * PW;
        const nlev = 2 * sc.half, step = sc.s * U;
        if (step >= 2.2) for (let c = -sc.half; c < sc.half; c++) { const yy = y(c * sc.s); if (yy > 4 && yy < 296) h += `<line x1="${x1}" x2="${x2}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${LX.col("embed")}" stroke-opacity=".35" stroke-dasharray="2 3"/>`; }
        else h += `<rect x="${x1}" y="${(y(sc.half * sc.s)).toFixed(1)}" width="${x2 - x1}" height="${(2 * sc.half * step).toFixed(1)}" fill="${LX.col("embed")}" fill-opacity=".06"/>`;
        if (sc.start > 0) h += `<line x1="${x1}" x2="${x1}" y1="10" y2="290" stroke="${LX.col("muted")}" stroke-width="1.2"/>`;
      });
      shown.forEach((v, i) => {
        const x = W0 + i * PW + 2, bw = PW - 4, r = rec[i];
        const a = (vv) => [Math.min(y(vv), Z), Math.abs(y(vv) - Z)];
        const [ry, rh] = a(r), [oy, oh] = a(v);
        h += `<rect x="${x}" y="${ry}" width="${bw}" height="${Math.max(1, rh)}" rx="1.5" fill="${LX.valueColor(r / amax)}"/>`;
        h += `<rect x="${x}" y="${oy}" width="${bw}" height="${Math.max(1, oh)}" rx="1.5" fill="none" stroke="${LX.col("text-2")}" stroke-dasharray="3 2"/>`;
        if (errs[i] * U > .8) h += `<rect x="${x - 1}" y="${Math.min(y(v), y(r))}" width="${bw + 2}" height="${Math.abs(y(v) - y(r))}" fill="${LX.col("logit")}" fill-opacity=".85"/>`;
      });
      h += `<text x="${W0 - 10}" y="${Z + 4}" fill="${LX.col("muted")}" font-family="${D.MONO}" font-size="12" text-anchor="end">0</text>`;
      svg.innerHTML = h;
      codesEl.innerHTML = `<span style="color:var(--lx-muted);margin-right:4px">codes:</span>` + codes.slice(0, V).map((c, i) => `<span style="padding:1px 4px;border-radius:4px;background:var(--lx-panel);color:${i % n === 0 && i ? "var(--lx-cache)" : "var(--lx-token)"}">${c}</span>`).join("");
      const used = new Set(codes.slice(0, Math.min(n, ROWN))).size;
      statsEl.innerHTML =
        stat("Levels per weight", `${2 ** bits}`) +
        stat("Bits per weight (incl. scale)", `${bits} + 16/${n} = ${bpw.toFixed(bpw % 1 ? 3 : 0).replace(/\.?0+$/, "")}`, "token") +
        stat("Bytes per block", `${n * bits / 8} + 2 = ${bytesBlock}`) +
        stat("256 weights", `${(ROWN / n * bytesBlock).toFixed(0)} B vs 512 B (16-bit)`) +
        stat("Levels used in block 1", `${used} of ${2 ** bits}`) +
        stat("Average error · share of a typical weight", `${meanErr.toFixed(5)} · ${Math.round(meanErr / meanAbs * 100)}%`, "logit");
      host.querySelector('[data-o="bits"]').textContent = bits;
      host.querySelector('[data-o="bs"]').textContent = n;
      host.querySelectorAll(".qp-presets button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.p === (st.outlier && st.preset === "bell" ? "outlier" : st.preset))));
    }
    host.querySelector("#qp-bits").oninput = e => { st.bits = +e.target.value; render(); };
    host.querySelector("#qp-bs").oninput = e => { st.si = +e.target.value; render(); };
    const outCb = host.querySelector("#qp-out");
    outCb.onchange = () => { st.outlier = outCb.checked; render(); };
    host.querySelectorAll(".qp-presets button").forEach(b => (b.onclick = () => {
      if (b.dataset.p === "outlier") { st.preset = "bell"; st.outlier = true; }
      else { st.preset = b.dataset.p; st.outlier = false; }
      outCb.checked = st.outlier; render();
    }));
    render();
  });
})();
