/* Chapter 04 — Tokenization */
(function () {
  "use strict";
  const D = LX.draw;
  const MONO_ADV = 0.6;   // JetBrains Mono advance width, in em: lets us place characters exactly without measuring

  /* ------------------------------------------------------------------
     Scene: token-split — text in, IDs out
     ------------------------------------------------------------------ */
  function buildTokenSplit(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);

    const SENT = "The cat sat on the mat.";
    const TOKS = [["The", 760, 0], [" cat", 7993, 3], [" sat", 7338, 7], [" on", 383, 11], [" the", 279, 14], [" mat", 5344, 18], [".", 13, 22]];
    const FS = 56, cw = FS * MONO_ADV, x0 = 800 - SENT.length * cw / 2, yS = 200;

    /* input sentence, one text node per token so pieces can be cut apart */
    D.label(svg, 80, 92, "Input text");
    const sentG = LX.el("g", {}, svg);
    const sentT = TOKS.map(([tok, , st]) => {
      const t = D.text(sentG, x0 + st * cw, yS, "", { mono: true, size: FS, weight: 500 });
      t.style.whiteSpace = "pre";
      return t;
    });
    const caret = LX.el("rect", { x: x0, y: yS - FS * .78, width: 3, height: FS * .92, fill: LX.col("token") }, svg);

    /* cut lines between pieces (the space stays with the following word) */
    const cuts = TOKS.slice(1).map(([, , st]) => {
      const x = x0 + st * cw;
      return LX.el("line", { x1: x, y1: yS - FS - 12, x2: x, y2: yS - FS - 12, stroke: LX.col("token"), "stroke-width": 2, "stroke-linecap": "round" }, svg);
    });

    /* chips */
    const CS = 30, ccw = CS * MONO_ADV, CH = 70, CY = 296, GAP = 26;
    const widths = TOKS.map(([tok]) => 44 + tok.length * ccw);
    let cx = 800 - (widths.reduce((a, b) => a + b, 0) + GAP * (TOKS.length - 1)) / 2;
    const chips = TOKS.map(([tok, id, st], i) => {
      const w = widths[i];
      const chip = D.tokenChip(svg, { x: cx, y: CY, w, h: CH, text: tok, size: CS });
      const idt = D.text(svg, cx + w / 2, CY + CH + 40, String(id), { mono: true, size: 24, anchor: "middle", color: "token", weight: 500 });
      // ghost copy that flies from the sentence into the chip
      const ghost = LX.el("g", {}, svg);
      const gt = D.text(ghost, 0, 0, tok, { mono: true, size: FS, weight: 500, anchor: "middle" });
      gt.style.whiteSpace = "pre";
      const from = { x: x0 + (st + tok.length / 2) * cw, y: yS };
      const to = { x: cx + w / 2, y: CY + CH / 2 + CS * .36 };
      cx += w + GAP;
      return { chip, idt, ghost, from, to };
    });

    /* comparison panel: space matters / IDs carry no meaning */
    const PX = 300, PY = 466, PW = 1000, PH = 236;
    const panel = LX.el("rect", { x: PX, y: PY, width: PW, height: PH, rx: 10, fill: LX.col("bg-2"), stroke: LX.col("line-2"), "stroke-width": 1.5, "stroke-dasharray": "6 6" }, svg);
    const pc = (x, tok, id) => {
      const chip = D.tokenChip(svg, { x, y: PY + 56, w: 112, h: 52, text: tok, size: 24 });
      const idt = D.text(svg, x + 56, PY + 56 + 52 + 32, String(id), { mono: true, size: 21, anchor: "middle", color: "token" });
      return { chip, idt };
    };
    const AX = 340, BX = 720;
    const labA = D.label(svg, AX, PY + 38, "Near-synonyms");
    const labB1 = D.label(svg, BX, PY + 38, "The space is part of the token");
    const labB2 = D.label(svg, BX, PY + 38, "Same word, four tokens");
    const rowA = [pc(AX, " big", 2330), pc(AX + 142, " large", 3349)];
    const rowB = [pc(BX, " cat", 7993), pc(BX + 142, "cat", 4466), pc(BX + 284, " Cat", 16847), pc(BX + 426, " CAT", 42525)];
    const neq = D.text(svg, BX + 127, PY + 91, "≠", { size: 26, color: "muted", anchor: "middle" });
    const divider = LX.el("line", { x1: 660, y1: PY + 22, x2: 660, y2: PY + PH - 56, stroke: LX.col("line-2"), "stroke-width": 1 }, svg);
    const verdict = D.text(svg, 800, PY + PH - 18, "Similar meaning, unrelated numbers. Any similarity must be learned.", { size: 17, color: "text-2", anchor: "middle" });

    /* ratio strip: 23 characters → 7 tokens */
    const RX = 342, RY = 756, RW = 36, RG = 4;
    const cells = [...SENT].map((ch, i) => {
      const g = LX.el("g", {}, svg);
      LX.el("rect", { x: RX + i * (RW + RG), y: RY, width: RW, height: 40, rx: 4, fill: LX.col("panel"), stroke: LX.col("line-2"), "stroke-width": 1 }, g);
      D.text(g, RX + i * (RW + RG) + RW / 2, RY + 27, ch === " " ? "·" : ch, { mono: true, size: 20, anchor: "middle", color: ch === " " ? "dim" : "text-2" });
      return g;
    });
    const brackets = TOKS.map(([tok, , st]) => D.bracket(svg, {
      x1: RX + st * (RW + RG) + 2, y1: RY + 58, x2: RX + (st + tok.length - 1) * (RW + RG) + RW - 2, y2: RY + 58, side: "bottom", color: "token", tick: 9,
    }));
    const rl1 = D.text(svg, RX - 22, RY + 27, "23 characters", { mono: true, size: 16, anchor: "end", color: "muted" });
    const rl2 = D.text(svg, RX - 22, RY + 64, "7 tokens", { mono: true, size: 16, anchor: "end", color: "token" });
    const rr = D.text(svg, RX + 23 * (RW + RG) + 10, RY + 46, "≈ ¾ word per token", { mono: true, size: 16, color: "text-2" });

    ups.push(t => {
      /* text: type the sentence */
      const n = Math.round(ctx.p(t, "text", .05, .6, LX.ease.linear) * SENT.length);
      sentT.forEach((el, i) => { const [tok, , st] = TOKS[i]; el.textContent = tok.slice(0, LX.clamp(n - st, 0, tok.length)); });
      caret.setAttribute("x", x0 + n * cw + 2);
      caret.setAttribute("opacity", t < ctx.cue("cut").start ? (Math.floor(t * 2.4) % 2 ? .25 : 1) : 0);

      /* cut: lines drop, pieces fly into chips */
      cuts.forEach((c, i) => {
        const q = ctx.p(t, "cut", .04 + i * .04, .24 + i * .04);
        c.setAttribute("y2", (yS - FS - 12) + q * (FS + 34));
        c.setAttribute("opacity", q > 0 ? 1 - ctx.p(t, "ids", .4, .8) : 0);
      });
      chips.forEach((c, i) => {
        const q = ctx.p(t, "cut", .34 + i * .045, .78 + i * .045, LX.ease.linear);
        const mv = LX.ease.inOut(LX.clamp(q / .8)), xf = LX.clamp((q - .8) / .2);   // fly, then cross-fade in place
        c.ghost.setAttribute("transform", `translate(${LX.lerp(c.from.x, c.to.x, mv)} ${LX.lerp(c.from.y, c.to.y, mv)}) scale(${LX.lerp(1, CS / FS, mv)})`);
        c.ghost.setAttribute("opacity", q <= 0 || q >= 1 ? 0 : Math.min(1, q * 8) * (1 - xf));
        c.chip.show(xf, 0);
        c.idt.setAttribute("opacity", ctx.p(t, "ids", .08 + i * .06, .3 + i * .06));
      });

      /* space: ·cat glows, ·cat vs cat appear in the panel */
      const sp = ctx.p(t, "space", .05, .25) * (1 - ctx.p(t, "ids", 0, .15));
      chips[1].chip.glow(sp > .5);
      D.fade(panel, ctx.p(t, "space", .1, .3));
      const pB = ctx.p(t, "space", .3, .55);
      rowB[0].chip.show(pB); rowB[0].idt.setAttribute("opacity", ctx.p(t, "space", .45, .65));
      rowB[1].chip.show(ctx.p(t, "space", .38, .63)); rowB[1].idt.setAttribute("opacity", ctx.p(t, "space", .5, .7));
      rowB[0].chip.glow(sp > .5 && t < ctx.cue("ids").start);
      const nm = ctx.p(t, "nomean", .05, .25);
      D.fade(neq, ctx.p(t, "space", .55, .75) * (1 - nm));
      D.fade(labB1, ctx.p(t, "space", .25, .45) * (1 - nm));
      D.fade(labB2, nm);

      /* ids: the sentence dims away */
      D.fade(sentG, 1 - .78 * ctx.p(t, "ids", .45, .9));

      /* nomean: the rest of the panel */
      D.fade(labA, ctx.p(t, "nomean", .05, .25));
      D.fade(divider, ctx.p(t, "nomean", .05, .25));
      rowA.forEach((c, i) => { c.chip.show(ctx.p(t, "nomean", .1 + i * .08, .3 + i * .08)); c.idt.setAttribute("opacity", ctx.p(t, "nomean", .2 + i * .08, .4 + i * .08)); });
      rowB.slice(2).forEach((c, i) => { c.chip.show(ctx.p(t, "nomean", .4 + i * .08, .6 + i * .08)); c.idt.setAttribute("opacity", ctx.p(t, "nomean", .5 + i * .08, .7 + i * .08)); });
      D.fade(verdict, ctx.p(t, "nomean", .75, .95));

      /* ratio */
      cells.forEach((c, i) => D.fade(c, ctx.p(t, "ratio", .04 + i * .016, .14 + i * .016)));
      brackets.forEach((b, i) => b.show(ctx.p(t, "ratio", .45 + i * .04, .6 + i * .04)));
      D.fade(rl1, ctx.p(t, "ratio", .25, .4));
      D.fade(rl2, ctx.p(t, "ratio", .65, .8));
      D.fade(rr, ctx.p(t, "ratio", .8, .95));
    });
    return t => ups.forEach(u => u(t));
  }

  /* ------------------------------------------------------------------
     Scene: bpe-merge — Byte-Pair Encoding on a toy corpus
     ------------------------------------------------------------------ */
  function buildBpe(ctx) {
    const { svg } = ctx, ups = [];
    D.backdrop(svg);

    /* run real BPE on the toy corpus (ties: first pair seen wins) */
    const WORDS = [["low", 5], ["lower", 2], ["newest", 6], ["widest", 3]];
    let seg = WORDS.map(([w]) => w.split(""));
    const stages = [seg], merges = [], tallies = [];
    for (;;) {
      const cnt = new Map();
      seg.forEach((s, wi) => { for (let i = 0; i < s.length - 1; i++) { const k = s[i] + "|" + s[i + 1]; cnt.set(k, (cnt.get(k) || 0) + WORDS[wi][1]); } });
      tallies.push([...cnt.entries()].map(([k, v]) => ({ pair: k.split("|"), v })).sort((a, b) => b.v - a.v));   // stable: first-seen wins ties
      if (!cnt.size) break;
      const { pair: [a, b], v } = tallies[tallies.length - 1][0];
      merges.push({ a, b, v, tok: a + b });
      seg = seg.map(s => { const o = []; for (let i = 0; i < s.length; i++) { if (i < s.length - 1 && s[i] === a && s[i + 1] === b) { o.push(a + b); i++; } else o.push(s[i]); } return o; });
      stages.push(seg);
    }
    const pieces = st => st.reduce((n, s, wi) => n + s.length * WORDS[wi][1], 0);

    /* timing of each merge: merge 1 in "merge", 2–4 in "again", the rest race by in "end" */
    const mergeP = (t, k) => {
      if (k === 0) return ctx.p(t, "merge", .2, .62, LX.ease.inOut);
      if (k <= 3) { const a = .04 + (k - 1) * .32; return ctx.p(t, "again", a, a + .24, LX.ease.inOut); }
      const a = .03 + (k - 4) * .045; return ctx.p(t, "end", a, a + .04, LX.ease.inOut);
    };

    /* left: the training words */
    D.label(svg, 80, 150, "Training text · word × count");
    const CW = 58, G = 8, X0 = 170, rowY = i => 182 + i * 104;
    const rows = WORDS.map(([w, c], wi) => {
      const g = LX.el("g", {}, svg);
      D.text(g, 92, rowY(wi) + 41, "×" + c, { mono: true, size: 22, color: "muted" });
      const rects = [], tA = [], tB = [];
      for (let i = 0; i < w.length; i++) {
        rects.push(LX.el("rect", { x: X0 + i * (CW + G), y: rowY(wi), width: CW, height: 64, rx: 6, fill: LX.mix("bg", "token", .1), stroke: LX.col("token"), "stroke-width": 1.5 }, g));
      }
      for (let i = 0; i < w.length; i++) {
        tA.push(D.text(g, 0, rowY(wi) + 41, "", { mono: true, size: 26, anchor: "middle" }));
        tB.push(D.text(g, 0, rowY(wi) + 41, "", { mono: true, size: 26, anchor: "middle" }));
      }
      return { g, rects, tA, tB };
    });
    const spanX = (start, len) => ({ x: X0 + start * (CW + G), w: len * (CW + G) - G });

    D.label(svg, 80, 660, "Pieces in the text");
    const piecesT = D.text(svg, 80, 716, "79", { mono: true, size: 44, weight: 500, color: "text" });

    /* middle: pair tally */
    const TX = 690, BX = 830, BW = 270;
    const tallyLab = D.label(svg, TX, 150, "Neighbouring pairs · count");
    const trows = Array.from({ length: 6 }, (_, j) => {
      const y = 182 + j * 60;
      const box = LX.el("rect", { x: TX - 14, y: y - 6, width: BX + BW + 70 - TX + 14, height: 48, rx: 6, fill: "none", stroke: LX.col("token"), "stroke-width": 1.5, opacity: 0 }, svg);
      const lab = D.text(svg, TX, y + 27, "", { mono: true, size: 21, color: "text-2" });
      const bg = LX.el("rect", { x: BX, y: y + 14, width: BW, height: 12, rx: 2, fill: LX.col("line") }, svg);
      const bar = LX.el("rect", { x: BX, y: y + 14, width: 0, height: 12, rx: 2, fill: LX.col("token") }, svg);
      const num = D.text(svg, BX + BW + 16, y + 27, "", { mono: true, size: 19, color: "muted" });
      return { box, lab, bg, bar, num };
    });
    const done = D.text(svg, TX, 220, "No pairs left: every word is one token.", { size: 18, color: "text-2", opacity: 0 });

    /* right: vocabulary */
    const VX = 1250;
    D.label(svg, VX, 150, "Vocabulary");
    const base = [...new Set(WORDS.map(w => w[0]).join(""))].sort();
    const baseCells = base.map((ch, i) => {
      const g = LX.el("g", {}, svg);
      const x = VX + (i % 5) * 52, y = 170 + Math.floor(i / 5) * 52;
      LX.el("rect", { x, y, width: 44, height: 44, rx: 5, fill: LX.mix("bg", "token", .1), stroke: LX.col("token"), "stroke-width": 1.2 }, g);
      D.text(g, x + 22, y + 29, ch, { mono: true, size: 20, anchor: "middle" });
      return g;
    });
    const ventries = merges.map((m, k) => {
      const g = LX.el("g", {}, svg), y = 290 + k * 36;
      LX.el("rect", { x: VX, y, width: 150, height: 30, rx: 5, fill: LX.mix("bg", "token", .16), stroke: LX.col("token"), "stroke-width": 1.2 }, g);
      D.text(g, VX + 12, y + 21, m.tok, { mono: true, size: 18 });
      D.text(g, VX + 170, y + 21, `${m.a}+${m.b}`, { mono: true, size: 14, color: "dim" });
      return g;
    });
    const sizeLab = D.label(svg, VX, 776, "Vocabulary size");
    const sizeT = D.text(svg, VX, 826, "", { mono: true, size: 36, weight: 500, color: "token" });
    const realNote = D.text(svg, VX, 856, "Qwen3.8 · learned from real text", { mono: true, size: 14, color: "muted", opacity: 0 });

    ups.push(t => {
      /* where are we in the merge sequence? */
      let s = 0, q = 0;
      for (let k = 0; k < merges.length; k++) { const p = mergeP(t, k); if (p >= 1) s = k + 1; else { q = p; break; } }
      const m = s < merges.length ? merges[s] : null;
      const select = s === 0 ? ctx.p(t, "count", .55, .75) : (q > 0 ? 1 : 0);   // the chosen pair glows

      /* words */
      const rowsIn = WORDS.map((_, wi) => ctx.p(t, "start", .1 + wi * .1, .35 + wi * .1));
      rows.forEach((r, wi) => {
        D.fade(r.g, rowsIn[wi]);
        const toks = stages[s][wi];
        r.rects.forEach(e => e.setAttribute("opacity", 0));
        r.tA.forEach(e => e.setAttribute("opacity", 0));
        r.tB.forEach(e => e.setAttribute("opacity", 0));
        let ci = 0;
        for (let j = 0; j < toks.length; j++) {
          const A = toks[j], startA = ci; ci += A.length;
          const isPair = m && j < toks.length - 1 && A === m.a && toks[j + 1] === m.b;
          const rA = r.rects[startA], sa = spanX(startA, A.length);
          const strength = .1 + Math.min(.12, (A.length - 1) * .03);
          if (isPair) {
            const B = toks[j + 1], startB = ci; ci += B.length;
            const sb = spanX(startB, B.length), sm = spanX(startA, A.length + B.length);
            const glow = select > .5;
            LX.attr(rA, { x: sa.x, width: LX.lerp(sa.w, sm.w, q), opacity: 1, fill: LX.mix("bg", "token", strength + .25 * select), filter: glow ? "url(#lx-glow)" : "none" });
            const rB = r.rects[startB];
            LX.attr(rB, { x: sb.x, width: sb.w, opacity: 1 - q, fill: LX.mix("bg", "token", .1 + .25 * select), filter: glow ? "url(#lx-glow)" : "none" });
            const o1 = 1 - LX.clamp((q - .2) / .3), o2 = LX.clamp((q - .5) / .3);
            LX.attr(r.tA[startA], { x: sa.x + sa.w / 2, opacity: o1 }); r.tA[startA].textContent = A;
            LX.attr(r.tA[startB], { x: sb.x + sb.w / 2, opacity: o1 }); r.tA[startB].textContent = B;
            LX.attr(r.tB[startA], { x: sm.x + sm.w / 2, opacity: o2 }); r.tB[startA].textContent = A + B;
            j++;
          } else {
            LX.attr(rA, { x: sa.x, width: sa.w, opacity: 1, fill: LX.mix("bg", "token", strength), filter: "none" });
            LX.attr(r.tA[startA], { x: sa.x + sa.w / 2, opacity: 1 }); r.tA[startA].textContent = A;
          }
        }
      });
      const pv = LX.lerp(pieces(stages[s]), m ? pieces(stages[s + 1]) : pieces(stages[s]), LX.clamp((q - .5) / .3));
      piecesT.textContent = String(Math.round(pv));

      /* tally (current stage; chosen pair boxed) */
      const tin = ctx.p(t, "count", .02, .15);
      D.fade(tallyLab, tin);
      const grow = ctx.p(t, "count", .08, .5);
      const tl = tallies[s];
      trows.forEach((r, j) => {
        const e = tl[j];
        const o = e ? tin : 0;
        [r.lab, r.bar, r.num].forEach(el => el.setAttribute("opacity", o * (j === 0 || select < .5 ? 1 : .55)));
        r.bg.setAttribute("opacity", o);
        if (!e) { r.box.setAttribute("opacity", 0); return; }
        r.lab.textContent = `${e.pair[0]} + ${e.pair[1]}`;
        r.bar.setAttribute("width", BW * e.v / 9 * (s === 0 ? grow : 1));
        r.num.textContent = String(e.v);
        r.box.setAttribute("opacity", j === 0 ? select : 0);
        r.box.setAttribute("filter", j === 0 && select > .5 ? "url(#lx-glow)" : "none");
      });
      D.fade(done, tl.length ? 0 : 1);

      /* vocabulary */
      baseCells.forEach((g, i) => D.fade(g, ctx.p(t, "start", .5 + i * .03, .62 + i * .03)));
      ventries.forEach((g, k) => D.fade(g, LX.clamp((mergeP(t, k) - .55) / .3)));
      const nv = base.length + merges.filter((_, k) => mergeP(t, k) > .7).length;
      const run = ctx.p(t, "end", .5, .95, LX.ease.inOut);
      const v = run > 0 ? Math.round(nv * Math.pow(248320 / nv, run)) : nv;
      sizeT.textContent = v.toLocaleString("en-US");
      D.fade(sizeLab, ctx.p(t, "start", .5, .7)); D.fade(sizeT, ctx.p(t, "start", .5, .7));
      D.fade(realNote, ctx.p(t, "end", .85, 1));
    });
    return t => ups.forEach(u => u(t));
  }


  LX.chapter({
    id: "tokens", num: 4, title: "Tokenization", toc: "Tokenization",
    kicker: "From text to whole numbers",
    lede: "A model cannot read letters. Before anything else, your text is cut into tokens, and each token is replaced by a number from a fixed list.",
    body: [
      { prose: `
        <p>A <strong>token</strong> is a small piece of text: often a whole common word, sometimes part of a word, a single punctuation mark, or a few bytes of an unusual character. The model's <strong>vocabulary</strong> is the fixed list of every token it knows. In Qwen3.8-27B that list has <strong>248,320</strong> entries, and each entry has a position in the list, its <abbr>ID</abbr>.</p>
        <p>Tokenization is the very first step, and it involves no neural network and no arithmetic. It is a set of fixed rules that turns a string into a list of whole numbers. The rules were learned once from a large sample of text, before the model itself was trained, and then frozen.</p>` },

      { scene: {
        id: "token-split", title: "Text in, IDs out", build: buildTokenSplit,
        visual: "The sentence “The cat sat on the mat.” is typed in. Thin cut lines drop between the pieces, the pieces fly down into amber token chips (a leading space shown as a dim dot), and the real Qwen3.8 ID fades in under each chip. A dashed panel shows that IDs carry no meaning, and a strip at the bottom compares 23 characters with 7 tokens.",
        cues: [
          { id: "text",  say: "Here is a short sentence. To us it is letters and spaces. To the model, it means nothing yet.", vis: "The sentence types in, in large monospaced text." },
          { id: "cut",   say: "The tokenizer cuts it into pieces. Common words like cat and sat get a token each, and the full stop gets its own.", vis: "Amber cut lines drop between the pieces, just before each space; copies of the pieces fly down and settle into token chips." },
          { id: "space", say: "Notice that the space usually belongs to the word after it. Space-cat is one token, and it is a different token from cat without a space.", vis: "The ·cat chip glows; a dashed panel opens below showing ·cat 7993 ≠ cat 4466." },
          { id: "ids",   say: "Each token is then swapped for its ID, its position in the vocabulary. These are the real IDs from Qwen 3.8. From here on, the model only sees whole numbers.", vis: "IDs fade in under each chip: 760 · 7993 · 7338 · 383 · 279 · 5344 · 13; the sentence above dims away." },
          { id: "nomean", say: "And these numbers carry no meaning. Big and large are unrelated numbers. Even cat with a space, cat without a space, and cat with a capital C are three different tokens. Any similarity has to be learned later.", vis: "The panel fills: near-synonyms ·big 2330 and ·large 3349; same word, four tokens: ·cat 7993 · cat 4466 · ·Cat 16847 · ·CAT 42525." },
          { id: "ratio", say: "Twenty-three characters became seven tokens. In English, one token is on average about three quarters of a word.", vis: "A strip of 23 character cells appears and is bracketed into 7 tokens; “≈ ¾ word per token”." },
        ],
      } },

      { prose: `
        <h3>Why not letters, or whole words?</h3>
        <p>Two obvious alternatives both fail:</p>
        <ul>
          <li><strong>One token per letter.</strong> The vocabulary would be tiny, but every text would become very long. The model would spend most of its effort just assembling words, and long documents would not fit.</li>
          <li><strong>One token per word.</strong> Texts would be short, but there are millions of words, names, typos and new inventions. Any word missing from the list could never be written or read.</li>
        </ul>
        <p>Tokens sit in between. Frequent words become a single token. Rare words are built from a few familiar pieces. And because the tokenizer can always fall back to raw bytes, <em>any</em> text can be represented, in any language, including emoji and code.</p>

        <h3>How the vocabulary is built: Byte-Pair Encoding</h3>
        <p>Qwen uses byte-level <abbr>BPE</abbr>. It starts from the 256 possible bytes and learns, from a huge sample of text, which neighbouring pairs occur most often. The most frequent pair is merged into a new token, and this is repeated until the vocabulary is the desired size. The merges are learned once, then frozen.</p>` },

      { scene: {
        id: "bpe-merge", title: "Byte-Pair Encoding, one merge at a time", build: buildBpe,
        visual: "A word list on the left (“low ×5, lower ×2, newest ×6, widest ×3”) shown as rows of single-character cells. A tally panel on the right counts every neighbouring pair. The top pair glows, its cells fuse into one wider cell everywhere it appears, and a new entry is appended to a growing vocabulary column. This repeats with acceleration.",
        cues: [
          { id: "start", say: "Byte-Pair Encoding, B P E for short, starts with the smallest possible pieces. Every word in the training text is split into single bytes.", vis: "Four words with counts (low ×5, lower ×2, newest ×6, widest ×3) appear as single-letter cells; the vocabulary starts with their 10 letters." },
          { id: "count", say: "Then it counts every pair of neighbouring pieces across all the text. Here, the pair e and s is tied for most common, so it goes first.", vis: "Pair-count bars grow; “e + s” (9, tied with “s + t”) is boxed and its cells glow in the words." },
          { id: "merge", say: "That pair is merged into one new token, e s, everywhere it appears. The vocabulary has grown by one.", vis: "Every “e”+“s” pair fuses into one “es” cell; “es” joins the vocabulary; pieces in the text drop from 79 to 70." },
          { id: "again", say: "Then count again and merge again. E s plus t becomes e s t. Then l plus o, then l o plus w. Each merge makes texts a little shorter.", vis: "Three faster merges, each after a fresh recount: es+t → est, l+o → lo, lo+w → low. Pieces drop to 47." },
          { id: "end",   say: "Repeat this about a quarter of a million times and you have Qwen's vocabulary: two hundred and forty-eight thousand three hundred and twenty tokens, from single bytes up to whole common words.", vis: "Eight more merges race by until every word is a single token; the vocabulary-size counter runs up to 248,320." },
        ],
      } },

      { prose: `
        <h3>Not all text is equally cheap</h3>
        <p>The merges reflect what was common in the training text. English prose tokenizes efficiently. Text that was rarer needs more pieces: less common languages, unusual names, long numbers, and some kinds of code.</p>
        <div class="lx-table-wrap"><table class="lx-table">
          <tr><th>Text</th><th>Typical split</th><th>Why</th></tr>
          <tr><td>“The weather is nice”</td><td><code>The</code> <code>·weather</code> <code>·is</code> <code>·nice</code></td><td>4 tokens. Very common English words: one token each</td></tr>
          <tr><td>“Været er fint i dag”</td><td><code>V</code> <code>æ</code> <code>ret</code> <code>·er</code> <code>·fint</code> <code>·i</code> <code>·dag</code></td><td>7 tokens for the same thought. “Været” alone needs three pieces</td></tr>
          <tr><td>“·sannsynlighetsfordeling”</td><td><code>·sann</code> <code>syn</code> <code>ligh</code> <code>ets</code> <code>ford</code> <code>eling</code></td><td>6 tokens. In English, “·probability ·distribution” is just 2</td></tr>
          <tr><td>“3.14159265”</td><td><code>3</code> <code>.</code> <code>1</code> <code>4</code> <code>1</code> <code>5</code> …</td><td>10 tokens. Qwen always splits numbers into single digits</td></tr>
        </table></div>
        <p class="c-muted">These splits come from running Qwen3.8's own merge list on the text.</p>
        <p>This matters in practice. The context limit, the speed and the cost of a model are all counted in tokens, not words. The same message in Norwegian usually costs noticeably more tokens than in English.</p>

        <h3>Special tokens</h3>
        <p>Some vocabulary entries are not text at all. They are markers that give the model structure:</p>
        <div class="lx-table-wrap"><table class="lx-table">
          <tr><th>Token</th><th class="num">ID</th><th>Purpose</th></tr>
          <tr><td><code>&lt;|im_start|&gt;</code>, <code>&lt;|im_end|&gt;</code></td><td class="num">248,045 / 248,046</td><td>Chat markers: where a system, user or assistant message begins and ends</td></tr>
          <tr><td><code>&lt;|endoftext|&gt;</code> (<abbr>EOS</abbr>)</td><td class="num">248,044</td><td>When the model produces this token, generation stops</td></tr>
          <tr><td>Vision start / end</td><td class="num">248,053 / 248,054</td><td>Bracket an image or video inside the text</td></tr>
          <tr><td>Image / video placeholder</td><td class="num">248,056 / 248,057</td><td>Slots that the vision encoder fills with picture information (<a href="#vision">Chapter 16</a>)</td></tr>
        </table></div>
        <p>A chat conversation is really one long token sequence: markers, the system prompt, your message, then the start of the assistant's turn. The model simply predicts what comes next.</p>

        <h3>An ID says nothing about meaning</h3>
        <p>Token IDs are labels, not measurements. Words that mean almost the same thing get unrelated numbers, and so do small variations of the same word:</p>
        <div class="lx-table-wrap"><table class="lx-table">
          <tr><th>Tokens</th><th class="num">IDs</th><th>Observation</th></tr>
          <tr><td><code>·big</code> · <code>·large</code> · <code>·huge</code></td><td class="num">2,330 · 3,349 · 6,552</td><td>Near-synonyms, unrelated numbers</td></tr>
          <tr><td><code>·cat</code> · <code>cat</code> · <code>·Cat</code> · <code>·CAT</code></td><td class="num">7,993 · 4,466 · 16,847 · 42,525</td><td>Four different tokens for “the same” word</td></tr>
          <tr><td><code>·dog</code> · <code>·hund</code></td><td class="num">5,388 · 183,612</td><td>Same meaning in English and Norwegian</td></tr>
        </table></div>
        <p>There is one faint pattern: IDs roughly follow the order in which merges were learned, so <em>lower IDs tend to be more common pieces</em> (<code>·the</code> is 279). That is all. Any notion that cat and dog are related, or that big and large mean the same, must be <em>learned</em>, and it is learned in the next step: the embedding (<a href="#embeddings">Chapter 5</a>).</p>` },

      { prose: `
      <h3>Norwegian costs more, on the way in and on the way out</h3>
      <p>The extra pieces are not the embedding's fault. The embedding only looks up one row per token. It is the <em>tokenizer's</em> merge list, learned from text in which English, Chinese and code are far more common than Norwegian, so Norwegian words were rarely merged into whole tokens.</p>
      <p>The same vocabulary is used for output. When the model answers in Norwegian, it also needs more tokens, and every token is one more full pass through all 64 layers. Measured with Qwen3.8's tokenizer on the same paragraph in both languages:</p>
      <div class="lx-table-wrap"><table class="lx-table">
        <tr><th>Language</th><th class="num">Words</th><th class="num">Tokens</th><th class="num">Tokens per word</th></tr>
        <tr><td>English</td><td class="num">50</td><td class="num">57</td><td class="num">1.14</td></tr>
        <tr><td>Norwegian</td><td class="num">42</td><td class="num">74</td><td class="num">1.76</td></tr>
      </table></div>
      <p>That is about <strong>30% more tokens</strong> for the same content: slower answers, higher cost, and less room in the context window. Most models show a similar gap, because most training text is English. Models with larger, more multilingual vocabularies lose less, and models trained specifically for Norwegian can do as well in Norwegian as in English.</p>
      <p><strong>Working language for agents.</strong> There is a real case for running agents in English: fewer tokens, tool descriptions and code are English anyway, and models have seen the most English training text. But translating Norwegian material back and forth introduces errors of its own, and modern models reason well in Norwegian. A practical middle ground: write system prompts, tool descriptions and internal planning in English, and keep Norwegian source material and user-facing answers in Norwegian. Whether quality actually improves for a given model and task is something to measure, not assume.</p>` },

    { widget: {
        id: "tokenizer-demo", title: "Try it: watch text become tokens",
        sub: "The real Qwen3.8 tokenizer, running in your browser. Pick a preset or type your own text: each chip is one token, with its ID underneath. A dim dot is a leading space.",
      } },

      { deep: `
        <h3>Bytes first: UTF-8</h3>
        <p>Before any merging, text is converted to bytes with <abbr data-k="UTF8">UTF-8</abbr>. Plain English letters take 1 byte each. The Norwegian letters æ, ø and å take 2 bytes each, and most emoji take 4. Because the base vocabulary contains all 256 byte values, no input can ever be "unknown". In the worst case it is spelled out byte by byte.</p>
        <h3>The BPE training loop</h3>
        <p>Given a corpus split into byte sequences, and a target vocabulary size <i>N</i>:</p>
        <ol>
          <li>Count every adjacent pair (<i>a</i>, <i>b</i>) across the corpus.</li>
          <li>Pick the most frequent pair: <math><mrow><mo>(</mo><msup><mi>a</mi><mo>*</mo></msup><mo>,</mo><msup><mi>b</mi><mo>*</mo></msup><mo>)</mo><mo>=</mo><munder><mrow><mi>arg</mi><mo>⁡</mo><mi>max</mi></mrow><mrow><mo>(</mo><mi>a</mi><mo>,</mo><mi>b</mi><mo>)</mo></mrow></munder><mtext>count</mtext><mo>(</mo><mi>a</mi><mo>,</mo><mi>b</mi><mo>)</mo></mrow></math></li>
          <li>Add the new token <i>ab</i> to the vocabulary, record the merge rule, and replace every occurrence.</li>
          <li>Repeat until the vocabulary has <i>N</i> entries.</li>
        </ol>
        <p>At use time, the tokenizer applies the recorded merges in the same order they were learned. Before merging, a pre-tokenizer splits text at boundaries such as spaces and punctuation, and splits numbers into digits. That is why a leading space sticks to the following word.</p>
        <h3>Compression ratio</h3>
        <p>A handy measure of tokenizer efficiency is tokens per word:</p>
        <math display="block"><mrow><mi>r</mi><mo>=</mo><mfrac><mtext>number of tokens</mtext><mtext>number of words</mtext></mfrac></mrow></math>
      <div class="lx-read">Count the tokens a text turns into, and divide by the number of words in it. r is the average number of tokens per word, so lower means the tokenizer is more efficient for that language. Example: the English paragraph in this chapter had 57 tokens for 50 words, r = 57 / 50 ≈ 1.14; the Norwegian version had 74 tokens for 42 words, r ≈ 1.76.</div>
        <p>For English with a modern vocabulary of 128,000 to 260,000 tokens, <i>r</i> is roughly 1.1 to 1.3. Languages with less training data, or with long compound words, have a higher <i>r</i>. A larger vocabulary lowers <i>r</i> and makes sequences shorter, but each vocabulary entry needs its own row in the embedding table and the output layer. Qwen's 248,320 entries cost about 2.5 billion parameters across those two tables (<a href="#embeddings">Chapter 5</a>).</p>` },
    ],
  });

  /* ------------------------------------------------------------------------
     Widget: a real Qwen3.8 tokenizer, running in the browser.
     Byte-level BPE with the model's own merge list and vocabulary
     (assets/data/qwen38-tokenizer.json, built by video/build_tokenizer_data.py).
     Verified token-for-token against the official `tokenizers` library.
     ------------------------------------------------------------------------ */
  const TOK_URL = "assets/data/qwen38-tokenizer.json";
  // Reference results for the presets (official tokenizer), used when the data file cannot be fetched (file://).
  const PRESETS = [{"name": "English", "text": "The cat sat on the mat.", "ids": [760, 7993, 7338, 383, 279, 5344, 13], "toks": ["The", "Ġcat", "Ġsat", "Ġon", "Ġthe", "Ġmat", "."]}, {"name": "Norwegian", "text": "Modellen leser hele dokumentet, finner de relevante avsnittene og skriver et kort sammendrag til kunden. Hvis svaret er usikkert, bør den stille et oppfølgingsspørsmål før den kaller et verktøy.", "ids": [4312, 15212, 501, 773, 52280, 82994, 294, 11, 205634, 401, 184779, 1759, 9326, 1390, 1885, 7119, 204513, 1778, 64564, 165906, 400, 3965, 9960, 580, 21470, 13, 177811, 13166, 10975, 2627, 586, 168091, 11, 161180, 3262, 230870, 1778, 3861, 193119, 3072, 64965, 16604, 166367, 44931, 3262, 580, 13555, 1778, 2652, 5659, 48561, 13], "toks": ["Mod", "ellen", "Ġle", "ser", "Ġhele", "Ġdokument", "et", ",", "Ġfinner", "Ġde", "Ġrelevante", "Ġav", "sn", "itt", "ene", "Ġog", "Ġskriver", "Ġet", "Ġkort", "Ġsamm", "end", "rag", "Ġtil", "Ġk", "unden", ".", "ĠHvis", "Ġsv", "aret", "Ġer", "Ġus", "ikkert", ",", "ĠbÃ¸r", "Ġden", "Ġstille", "Ġet", "Ġopp", "fÃ¸l", "ging", "ssp", "Ã¸r", "smÃ¥l", "ĠfÃ¸r", "Ġden", "Ġk", "aller", "Ġet", "Ġver", "kt", "Ã¸y", "."]}, {"name": "English (same text)", "text": "The model reads the whole document, finds the relevant sections and writes a short summary for the customer. If the answer is uncertain, it should ask a follow-up question before it calls any tool.", "ids": [760, 1558, 15339, 279, 4220, 2128, 11, 13325, 279, 9468, 13753, 321, 13514, 264, 2716, 11782, 364, 279, 5813, 13, 1368, 279, 4087, 369, 33955, 11, 424, 1220, 2466, 264, 1732, 5072, 3296, 1518, 424, 6526, 866, 5224, 13], "toks": ["The", "Ġmodel", "Ġreads", "Ġthe", "Ġwhole", "Ġdocument", ",", "Ġfinds", "Ġthe", "Ġrelevant", "Ġsections", "Ġand", "Ġwrites", "Ġa", "Ġshort", "Ġsummary", "Ġfor", "Ġthe", "Ġcustomer", ".", "ĠIf", "Ġthe", "Ġanswer", "Ġis", "Ġuncertain", ",", "Ġit", "Ġshould", "Ġask", "Ġa", "Ġfollow", "-up", "Ġquestion", "Ġbefore", "Ġit", "Ġcalls", "Ġany", "Ġtool", "."]}, {"name": "Long number", "text": "π ≈ 3.14159265358979, and today is 2026-10-04.", "ids": [46636, 211614, 220, 18, 13, 16, 19, 16, 20, 24, 17, 21, 20, 18, 20, 23, 24, 22, 24, 11, 321, 3242, 369, 220, 17, 15, 17, 21, 12, 16, 15, 12, 15, 19, 13], "toks": ["ÏĢ", "ĠâīĪ", "Ġ", "3", ".", "1", "4", "1", "5", "9", "2", "6", "5", "3", "5", "8", "9", "7", "9", ",", "Ġand", "Ġtoday", "Ġis", "Ġ", "2", "0", "2", "6", "-", "1", "0", "-", "0", "4", "."]}, {"name": "Code", "text": "def softmax(x):\n    e = np.exp(x - x.max())\n    return e / e.sum()", "ids": [727, 73756, 2007, 1590, 198, 262, 378, 283, 2510, 13359, 2007, 471, 830, 6469, 2072, 198, 262, 460, 378, 593, 378, 12801, 363], "toks": ["def", "Ġsoftmax", "(x", "):", "Ċ", "ĠĠĠ", "Ġe", "Ġ=", "Ġnp", ".exp", "(x", "Ġ-", "Ġx", ".max", "())", "Ċ", "ĠĠĠ", "Ġreturn", "Ġe", "Ġ/", "Ġe", ".sum", "()"]}, {"name": "Emoji", "text": "Ready? 🚀 Let's go! 👍🏽", "ids": [18622, 30, 10838, 248, 222, 6558, 579, 708, 0, 59720, 235, 9008, 237, 121], "toks": ["Ready", "?", "ĠðŁ", "ļ", "Ģ", "ĠLet", "'s", "Ġgo", "!", "ĠðŁĳ", "į", "ðŁ", "ı", "½"]}];

  // GPT-2 style byte → printable-character table used by byte-level BPE.
  const B2U = (() => {
    const bs = [];
    for (let i = 33; i <= 126; i++) bs.push(i);
    for (let i = 161; i <= 172; i++) bs.push(i);
    for (let i = 174; i <= 255; i++) bs.push(i);
    const cs = bs.slice(); let n = 0;
    for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
    const m = new Array(256); bs.forEach((b, i) => (m[b] = String.fromCharCode(cs[i])));
    return m;
  })();
  const U2B = new Map(B2U.map((u, b) => [u, b]));

  /** Turn a byte-level token string back into readable text (or hex bytes if it is part of a character). */
  function showToken(tok) {
    const bytes = Uint8Array.from([...tok].map(ch => U2B.get(ch)));
    try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), partial: false }; }
    catch (e) { return { text: [...bytes].map(b => b.toString(16).padStart(2, "0")).join(" "), partial: true }; }
  }

  let TOKENIZER = null;
  async function loadTokenizer() {
    if (TOKENIZER) return TOKENIZER;
    const data = await (await fetch(TOK_URL)).json();
    const ranks = new Map();
    data.merges.split("\n").forEach((l, i) => ranks.set(l, i));
    const ids = new Map(data.vocab.map((t, i) => [t, i]));
    // JS has no inline (?i:…) groups everywhere yet: spell out the case-insensitive contractions.
    const pattern = data.pretokenizer.replace("(?i:'s|'t|'re|'ve|'m|'ll|'d)", "'[sS]|'[tT]|'[rR][eE]|'[vV][eE]|'[mM]|'[lL][lL]|'[dD]");
    const pre = new RegExp(pattern, "gu");
    const specials = Object.keys(data.special).sort((a, b) => b.length - a.length);
    const specialRe = specials.length ? new RegExp("(" + specials.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")") : null;
    const enc = new TextEncoder(), cache = new Map();
    function bpe(piece) {
      if (cache.has(piece)) return cache.get(piece);
      let s = [...enc.encode(piece)].map(b => B2U[b]);
      while (s.length > 1) {
        let best = Infinity, at = -1;
        for (let i = 0; i < s.length - 1; i++) { const r = ranks.get(s[i] + " " + s[i + 1]); if (r !== undefined && r < best) { best = r; at = i; } }
        if (at < 0) break;
        s = s.slice(0, at).concat(s[at] + s[at + 1], s.slice(at + 2));
      }
      cache.set(piece, s);
      return s;
    }
    function encode(text) {
      const out = [];
      const parts = specialRe ? text.normalize("NFC").split(specialRe) : [text.normalize("NFC")];
      parts.forEach((part, k) => {
        if (!part) return;
        if (specialRe && k % 2 === 1) { out.push({ tok: part, id: data.special[part], special: true }); return; }
        pre.lastIndex = 0;
        let m, last = 0;
        const pieces = [];
        while ((m = pre.exec(part))) { if (m.index > last) pieces.push(part.slice(last, m.index)); pieces.push(m[0]); last = m.index + m[0].length; if (!m[0].length) pre.lastIndex++; }
        if (last < part.length) pieces.push(part.slice(last));
        pieces.forEach(p => bpe(p).forEach(t => out.push({ tok: t, id: ids.get(t) })));
      });
      return out;
    }
    TOKENIZER = { encode, size: data.vocab.length };
    return TOKENIZER;
  }
  LX.qwenTokenizer = loadTokenizer;   // also handy from the browser console

  LX.widget("tokenizer-demo", body => {
    body.innerHTML = `
      <div class="lx-tz-presets"></div>
      <textarea class="lx-tz-input" rows="3" spellcheck="false" aria-label="Text to tokenize"></textarea>
      <div class="lx-tz-stats"></div>
      <div class="lx-tz-status c-muted"></div>
      <div class="lx-tz-chips" aria-live="polite"></div>
      <div class="lx-tz-compare"></div>`;
    const css = document.createElement("style");
    css.textContent = `
      .lx-tz-presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      .lx-tz-presets button { font: 500 13px var(--lx-sans); color: var(--lx-text-2); background: var(--lx-panel); border: 1px solid var(--lx-line-2); border-radius: 999px; padding: 5px 12px; cursor: pointer; }
      .lx-tz-presets button[aria-pressed="true"] { border-color: var(--lx-token); color: var(--lx-text); }
      .lx-tz-input { width: 100%; box-sizing: border-box; resize: vertical; font: 15px/1.5 var(--lx-mono); color: var(--lx-text); background: var(--lx-bg); border: 1px solid var(--lx-line-2); border-radius: 10px; padding: 10px 12px; }
      .lx-tz-input:focus { outline: 2px solid var(--lx-token); outline-offset: 1px; }
      .lx-tz-stats { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 10px 0 4px; font: 500 13px var(--lx-mono); color: var(--lx-muted); }
      .lx-tz-stats b { color: var(--lx-token); font-weight: 600; }
      .lx-tz-status { font-size: 13px; min-height: 1em; margin-bottom: 8px; }
      .lx-tz-chips { display: flex; flex-wrap: wrap; gap: 6px 4px; max-height: 340px; overflow-y: auto; }
      .lx-tz-chip { display: inline-flex; flex-direction: column; align-items: center; min-width: 26px; padding: 3px 6px 2px; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--lx-token) 55%, transparent); background: color-mix(in srgb, var(--lx-token) 9%, var(--lx-bg)); }
      .lx-tz-chip:nth-child(even) { background: color-mix(in srgb, var(--lx-token) 18%, var(--lx-bg)); }
      .lx-tz-chip .t { font: 15px var(--lx-mono); color: var(--lx-text); white-space: pre; }
      .lx-tz-chip .t i { color: var(--lx-dim); font-style: normal; }
      .lx-tz-chip .t.partial { font-size: 11px; color: var(--lx-muted); }
      .lx-tz-chip .n { font: 11px var(--lx-mono); color: var(--lx-token); }
      .lx-tz-chip.special { border-color: var(--lx-attn); }
      .lx-tz-compare { margin-top: 12px; font-size: 14px; color: var(--lx-text-2); }
      .lx-tz-compare label { cursor: pointer; }`;
    body.appendChild(css);

    const $ = s => body.querySelector(s);
    const input = $(".lx-tz-input"), stats = $(".lx-tz-stats"), status = $(".lx-tz-status"), chipsEl = $(".lx-tz-chips"), cmp = $(".lx-tz-compare");
    const shown = PRESETS.filter(p => p.name !== "English (same text)");
    const english = PRESETS.find(p => p.name === "English (same text)");
    $(".lx-tz-presets").innerHTML = shown.map((p, i) => `<button type="button" data-i="${i}">${p.name}</button>`).join("");
    let tk = null, timer = 0;

    function chip(display, id, special) {
      const d = special ? { text: display, partial: false } : showToken(display);
      let t = d.text, lead = "";
      if (!d.partial) { const m = t.match(/^( +)(.*)$/s); if (m) { lead = "·".repeat(m[1].length); t = m[2]; } t = t.replace(/\n/g, "↵").replace(/\t/g, "⇥"); if (!t && !lead) t = "␠"; }
      const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      return `<span class="lx-tz-chip${special ? " special" : ""}"><span class="t${d.partial ? " partial" : ""}">${lead ? `<i>${lead}</i>` : ""}${esc(t)}</span><span class="n">${id ?? "?"}</span></span>`;
    }
    function render(text, toks) {
      const words = (text.trim().match(/\S+/g) || []).length;
      stats.innerHTML = `<span><b>${[...text].length}</b> characters</span><span><b>${words}</b> words</span><span><b>${toks.length}</b> tokens</span><span><b>${words ? (toks.length / words).toFixed(2) : "–"}</b> tokens per word</span>`;
      chipsEl.innerHTML = toks.slice(0, 600).map(x => chip(x.tok, x.id, x.special)).join("") + (toks.length > 600 ? `<span class="c-muted"> … ${toks.length - 600} more</span>` : "");
    }
    function presetToks(p) { return p.toks.map((t, i) => ({ tok: t, id: p.ids[i] })); }
    function run() {
      const text = input.value;
      const p = PRESETS.find(q => q.text === text);
      if (tk) render(text, tk.encode(text));
      else if (p) render(text, presetToks(p));
      else { stats.innerHTML = ""; chipsEl.innerHTML = ""; }
      const isNo = shown[1] && text === shown[1].text;
      cmp.innerHTML = isNo ? `<label><input type="checkbox" class="lx-tz-cmp"> Compare with the same text in English</label><div class="lx-tz-cmpout"></div>` : "";
      if (isNo) cmp.querySelector(".lx-tz-cmp").onchange = e => {
        const out = cmp.querySelector(".lx-tz-cmpout");
        out.innerHTML = e.target.checked ? `<p style="margin:8px 0 6px">English: <b class="c-token">${english.ids.length}</b> tokens, Norwegian: <b class="c-token">${shown[1].ids.length}</b> tokens, about <b>${Math.round((shown[1].ids.length / english.ids.length - 1) * 100)}%</b> more for the same content.</p><div class="lx-tz-chips">${presetToks(english).map(x => chip(x.tok, x.id)).join("")}</div>` : "";
      };
    }
    function pick(i) {
      body.querySelectorAll(".lx-tz-presets button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
      input.value = shown[i].text; run();
    }
    body.querySelectorAll(".lx-tz-presets button").forEach(b => (b.onclick = () => pick(+b.dataset.i)));
    input.addEventListener("input", () => {
      body.querySelectorAll(".lx-tz-presets button").forEach(b => b.setAttribute("aria-pressed", "false"));
      clearTimeout(timer); timer = setTimeout(() => {
        if (!tk && !PRESETS.some(p => p.text === input.value)) { stats.innerHTML = ""; chipsEl.innerHTML = ""; }
        run();
      }, 120);
    });
    pick(0);
    status.textContent = "Loading the Qwen3.8 tokenizer (about 2.7 MB)…";
    loadTokenizer().then(t => { tk = t; status.textContent = "Live Qwen3.8 tokenizer, using the model's own merge rules. Type anything."; run(); })
      .catch(() => { status.textContent = "The live tokenizer needs the page to be served over http(s). The presets below show the real results."; input.readOnly = true; });
  });
})();
