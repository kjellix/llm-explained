/* ==========================================================================
   The whole journey, told continuously at three depths.
   Level 1 uses its own simplified scenes (registered with LX.storyScene).
   Levels 2 and 3 reuse the chapter scenes, joined by bridges with narration.
   Narration is written as teaching, never as question and answer.
   ========================================================================== */
(function () {
  "use strict";

  /* ----------------------------------------------------------------------
     LEVEL 1 · The short version (about 3–4 minutes, for anyone)
     ---------------------------------------------------------------------- */
  const L1 = [
    { id: "s1-one-job", title: "One job: guess what comes next",
      visual: "A chat bubble with 'The cat sat on the' and a blinking cursor. A cloud of candidate next words fades in around the cursor (mat, floor, sofa, moon …), each with a faint size showing how likely it is. The biggest one, 'mat', slides into place. Then the sentence grows word by word as the same thing repeats.",
      cues: [
        { id: "job",    say: "A language model has exactly one job. It reads some text and guesses what comes next.", vis: "Chat bubble with 'The cat sat on the' and a blinking cursor." },
        { id: "guess",  say: "Not just one guess, but a likelihood for every possible next word. Mat is very likely here. Moon is not.", vis: "Candidate words float around the cursor, sized by likelihood." },
        { id: "repeat", say: "It picks one, adds it to the text, and does the whole thing again. Every answer you have ever read from a chatbot was written this way, one small piece at a time.", vis: "'mat' glows, flies into the sentence; ' and purred.' follows, word by word." },
      ] },
    { id: "s2-pieces", title: "Text becomes pieces, pieces become numbers",
      visual: "The sentence breaks apart into rounded amber chips: The · cat · sat · on · the · mat. A number appears under each chip (760, 7993, 7338 …). A long Norwegian word on the side breaks into many more chips than its English translation.",
      cues: [
        { id: "cut",    say: "The model cannot read letters. First, the text is cut into small pieces called tokens. A common word is usually one piece.", vis: "The sentence splits into token chips." },
        { id: "number", say: "Each piece is swapped for a number, its place in a fixed list of about a quarter of a million pieces. From here on, the model only sees numbers.", vis: "A number fades in under every chip; the letters dim." },
        { id: "lang",   say: "Rarer words need more pieces. A long Norwegian word can cost six pieces, where the English phrase costs two.", vis: "'sannsynlighetsfordeling' → 6 chips vs 'probability distribution' → 2 chips." },
      ] },
    { id: "s3-meaning", title: "Numbers that carry meaning",
      visual: "Each token number unfolds into a tall column of small coloured cells (a list of thousands of numbers, a few shown). The columns then lift off as dots onto a dark map, where dog lands near cat, and king near queen. A short arrow from 'man' to 'woman' runs parallel to one from 'king' to 'queen'.",
      cues: [
        { id: "list",  say: "Next, each number is replaced by a long list of numbers, five thousand of them. Think of it as the token's coordinates in a space of meaning.", vis: "Each chip's number unfolds into a column of coloured cells." },
        { id: "map",   say: "In that space, words used in similar ways end up close together. Dog lands near cat. King lands near queen. Nobody placed them there. The model learned it from reading.", vis: "Columns become dots on a map; clusters form; dog near cat, king near queen." },
        { id: "dir",   say: "Even directions mean something. The step from man to woman points the same way as the step from king to queen.", vis: "Two parallel arrows: man → woman, king → queen." },
      ] },
    { id: "s4-layers", title: "Many layers of refinement",
      visual: "The dots return as columns standing side by side, then rise into a tall stack of 64 thin layers. In each layer, two things happen visibly: faint arcs connect the word columns (they look at each other: 'it' reaches back to 'cat'), then each column brightens on its own (each word is thought about separately). A light pulse climbs the stack. Small notes are added to each column as it rises.",
      cues: [
        { id: "stack",  say: "Now the lists travel up through a tall stack of layers. Our example model has sixty-four of them.", vis: "Columns rise into a stack of 64 thin layers; a light pulse climbs." },
        { id: "look",   say: "In each layer, the words first look at each other. A word like it can reach back and find out that it means the cat.", vis: "Faint violet arcs join every word to the words before it; a bold glowing arc links 'it' back to 'cat' (“it” = the cat)." },
        { id: "think",  say: "Then each word is processed on its own, using knowledge stored in the layer, like facts and patterns of language.", vis: "A green outline flashes around each column in turn, and a green note cell is added under it." },
        { id: "notes",  say: "Each layer adds its notes to the lists. By the top, the list for the last word holds a rich picture of what the whole text is about, and what should come next.", vis: "The last column ('tired') glows teal; the light pulse reaches the top of the stack." },
      ] },
    { id: "s5-choose", title: "A score for every word, then a choice",
      visual: "The last column flows into a long row of bars, one per possible token; a handful are tall (mat, floor, sofa), the rest a flat tail. A dial labelled 'adventurousness' (temperature) turns: low makes the tallest bar dominate; high flattens the bars. A ball drops onto the bars and lands on 'mat'. A second run drops another ball that lands on 'floor', giving a different sentence.",
      cues: [
        { id: "score",  say: "At the top, the model turns that final list into a score for every piece it knows, and the scores into likelihoods that add up to one hundred percent.", vis: "A long row of bars appears; mat 38 %, floor 17 %, sofa 5 % … and a flat tail." },
        { id: "temp",   say: "Then it chooses. A setting called temperature decides how adventurous it is. Low temperature almost always takes the favourite. High temperature takes more chances.", vis: "A temperature dial turns: T = 0.3 → mat towers (≈ 93 %); T = 2.2 → the bars flatten; back to 1.0." },
        { id: "pick",   say: "One piece is picked, mat, and added to the text.", vis: "A ball lands on 'mat'; it flies up into the sentence." },
        { id: "again",  say: "Run the same text again, and the ball can land somewhere else. This time it lands on floor. That is why the same question can get a different answer.", vis: "A second ball (a seeded draw at T = 1.0) drops and lands on 'floor'; a second line appears under the first: 'The cat sat on the floor', labelled run 2." },
      ] },
    { id: "s6-loop", title: "Reading fast, writing one piece at a time",
      visual: "Left: the whole prompt slides into the stack at once, as one wide wave (fast). An orange 'memory' shelf beside the stack fills up. Right: writing; one narrow token at a time climbs the stack, glances at the shelf, and adds one small block to it. A counter shows the answer growing.",
      cues: [
        { id: "read",   say: "Reading your message is fast, because every word goes through the layers at the same time.", vis: "The whole prompt rises through the stack as one wide wave." },
        { id: "memory", say: "On the way, the model keeps notes about every word in a memory called the cache, so it does not have to read the earlier text again for every new word.", vis: "The orange memory shelf beside the stack, filled row by row during the reading pass, lights up." },
        { id: "write",  say: "Writing is slower. Each new piece goes through all the layers on its own, checks the memory, and adds one more note. That is why answers appear word by word.", vis: "mat, and, purred each climb the stack alone, glancing at the shelf; each adds one column to it; the sentence grows." },
      ] },
    { id: "s7-scale", title: "Where the knowledge lives",
      visual: "The layer stack dissolves into a vast grid of tiny points: 27.8 billion numbers (drawn as a dense field). A counter for one token runs up to 51 billion calculations. Final frame: the six-step strip Tokenize → Embed → 64 layers → Score → Sample → Repeat, with a small loop arrow from Repeat back to the start.",
      cues: [
        { id: "params", say: "Everything the model knows is stored in its parameters, about twenty-eight billion numbers, tuned while it read trillions of words.", vis: "The stack dissolves into a dense field of points; label 27.8 billion numbers." },
        { id: "cost",   say: "Writing a single piece of text takes about fifty billion calculations. A person doing one per second would need sixteen hundred years.", vis: "Counter runs to 51 billion; small caption ≈ 1,600 years by hand." },
        { id: "recap",  say: "Cut into pieces. Turn pieces into meaning. Refine through many layers. Score every option. Pick one. And repeat. That is how a language model writes.", vis: "The six-step strip lights up stage by stage; a loop arrow returns to the start." },
      ] },
  ];
  /* ---------------- Level-1 builders: big, simple, continuous ---------------- */
  const D = LX.draw, el = LX.el, col = LX.col, mix = LX.mix, clamp = LX.clamp, E = LX.ease;
  const SX = 100, SY = 150, FS = 46, CW = FS * 0.6;          // the sentence, top-left, monospaced
  const blink = t => (Math.floor(t * 2.2) % 2 ? .2 : 1);
  const lerp = LX.lerp;
  /** A local glow filter (unique id per scene, so stories never depend on another scene's defs). */
  function glow(svg, id, sd = 8) {
    const defs = svg.querySelector("defs") || el("defs", {}, svg);
    const f = el("filter", { id, x: "-200%", y: "-200%", width: "500%", height: "500%" }, defs);
    el("feGaussianBlur", { stdDeviation: sd, result: "b" }, f);
    const m = el("feMerge", {}, f); el("feMergeNode", { in: "b" }, m); el("feMergeNode", { in: "SourceGraphic" }, m);
    return `url(#${id})`;
  }
  /** Big chip with monospaced text; width from character count. */
  function chip(parent, x, y, text, { size = 34, color = "token" } = {}) {
    const w = text.length * size * 0.6 + 40, h = size * 1.65;
    const g = el("g", {}, parent);
    const box = el("rect", { x, y, width: w, height: h, rx: 10, fill: mix("bg", color, .12), stroke: col(color), "stroke-width": 2 }, g);
    const tx = D.text(g, x + w / 2, y + h / 2 + size * .36, "", { mono: true, size, anchor: "middle" });
    if (text.startsWith("·")) { const s = el("tspan", { fill: col("dim") }, tx); s.textContent = "·"; }
    const r = el("tspan", {}, tx); r.textContent = text.replace(/^·/, "");
    return { g, box, x, y, w, h, cx: x + w / 2 };
  }
  /** Row of chips starting at x. */
  function chipRow(parent, x, y, texts, o = {}) {
    const gap = o.gap ?? 18, out = [];
    texts.forEach(t => { const c = chip(parent, x, y, t, o); out.push(c); x += c.w + gap; });
    return out;
  }
  const show = (g, p, dy = 0) => { g.setAttribute("opacity", p); g.setAttribute("transform", `translate(0 ${(1 - p) * dy})`); };
  /** One label slot whose text changes per cue. */
  function slot(svg, x, y, size, color) {
    return D.text(svg, x, y, "", { size, color, weight: 600 });
  }
  /** The layer stack used in s4, s6, s7 (16 slabs drawn for 64 layers). */
  function stack(svg, x, w, { bottom = 800, n = 16, h = 22, gap = 9 } = {}) {
    const slabs = [];
    for (let i = 0; i < n; i++) {
      const attn = i % 4 === 3, y = bottom - (i + 1) * (h + gap);
      const r = el("rect", { x, y, width: w, height: h, rx: 6, fill: mix("bg", attn ? "attn" : "delta", attn ? .28 : .12), stroke: col(attn ? "attn" : "delta"), "stroke-width": 1.6 }, svg);
      slabs.push({ r, y, attn });
    }
    return {
      slabs, top: bottom - n * (h + gap), bottom,
      pulse(level, G) {                // level: 0..n+2 position of the light band
        slabs.forEach((s, i) => {
          const q = clamp(1 - Math.abs(level - i) / 1.6);
          s.r.setAttribute("fill", mix("bg", s.attn ? "attn" : "delta", (s.attn ? .28 : .12) + q * .5));
          s.r.setAttribute("filter", q > .2 ? G : "none");
        });
      },
      show(p) { slabs.forEach((s, i) => s.r.setAttribute("opacity", clamp(p * 1.6 - i / slabs.length * .6))); },
    };
  }
  const fmtInt = n => Math.round(n).toLocaleString("en-US");

  const BUILD = {
    /* ------------------------------------------------------------ s1 */
    "s1-one-job"(ctx) {
      const svg = ctx.svg; D.backdrop(svg); const G = glow(svg, "s1g");
      const bubble = el("rect", { x: 70, y: 88, width: 1180, height: 96, rx: 20, fill: mix("bg", "embed", .06), stroke: col("line-2"), "stroke-width": 1.5 }, svg);
      const sent = D.text(svg, SX, SY, "", { mono: true, size: FS, weight: 500 });
      const base = el("tspan", {}, sent), add = el("tspan", { fill: col("logit") }, sent), more = el("tspan", { fill: col("text-2") }, sent);
      const BASE = "The cat sat on the", MORE = " and purred.";
      const caret = el("rect", { x: 0, y: SY - 38, width: 4, height: 46, fill: col("token") }, svg);
      const lab = D.label(svg, 560, 290, "how likely is each next word?".replace("how likely is each next word?", "likelihood of each possible next word"), { size: 20 });
      const C = [["mat", .38, 880, 360], ["floor", .17, 1210, 450], ["couch", .09, 690, 500], ["bed", .06, 1010, 580], ["sofa", .05, 1330, 640], ["roof", .03, 800, 670], ["moon", .004, 1130, 740], ["banana", .002, 620, 760]];
      const cx0 = SX + 18 * CW + 6, cy0 = SY + 16;
      const cands = C.map(([w, p, x, y], i) => {
        const size = 24 + Math.sqrt(p) * 66;
        const line = el("path", { d: `M${cx0} ${cy0} Q ${(cx0 + x) / 2} ${y - 120} ${x} ${y - size * .9}`, fill: "none", stroke: col("line-2"), "stroke-width": 1.2, "stroke-dasharray": "4 6" }, svg);
        const g = el("g", {}, svg);
        const t = D.text(g, 0, 0, w, { mono: true, size, anchor: "middle", weight: 600, color: i === 0 ? "logit" : (p < .01 ? "dim" : "text") });
        const pct = D.text(g, 0, 30, (p * 100 >= 1 ? Math.round(p * 100) : (p * 100).toFixed(1)) + "%", { mono: true, size: 20, anchor: "middle", color: "muted" });
        return { g, t, pct, line, x, y, size };
      });
      return t => {
        D.fade(bubble, ctx.p(t, "job", 0, .2));
        base.textContent = BASE.slice(0, Math.round(BASE.length * ctx.p(t, "job", .1, .6, E.linear)));
        const fly = ctx.p(t, "repeat", .12, .4, E.inOut);
        add.textContent = fly >= 1 ? " mat" : "";
        more.textContent = MORE.slice(0, Math.round(MORE.length * ctx.p(t, "repeat", .55, .85, E.linear)));
        const chars = base.textContent.length + add.textContent.length + more.textContent.length;
        caret.setAttribute("x", SX + chars * CW + 4);
        caret.setAttribute("opacity", blink(t));
        D.fade(lab, ctx.p(t, "guess", 0, .2) * (1 - ctx.p(t, "repeat", .15, .3)));
        cands.forEach((c, i) => {
          const a = ctx.p(t, "guess", .08 + i * .07, .3 + i * .07);
          const out = i === 0 ? 0 : ctx.p(t, "repeat", .1, .28);
          c.line.setAttribute("opacity", a * (1 - ctx.p(t, "repeat", 0, .15)));
          if (i === 0) {
            const tx = lerp(c.x, SX + 20.5 * CW, fly), ty = lerp(c.y, SY, fly), s = lerp(1, FS / c.size, fly);
            c.g.setAttribute("transform", `translate(${tx} ${ty}) scale(${s})`);
            c.g.setAttribute("opacity", fly >= 1 ? 0 : a);
            c.pct.setAttribute("opacity", 1 - fly);
            c.t.setAttribute("filter", ctx.p(t, "repeat", 0, .12) > 0 && fly < 1 ? G : "none");
          } else {
            c.g.setAttribute("transform", `translate(${c.x} ${c.y})`);
            c.g.setAttribute("opacity", a * (1 - out));
          }
        });
        bubble.setAttribute("filter", ctx.p(t, "repeat", .38, .45) > 0 && ctx.p(t, "repeat", .45, .6) < 1 ? G : "none");
      };
    },

    /* ------------------------------------------------------------ s2 */
    "s2-pieces"(ctx) {
      const svg = ctx.svg; D.backdrop(svg); const G = glow(svg, "s2g");
      const bubble = el("rect", { x: 70, y: 88, width: 1180, height: 96, rx: 20, fill: mix("bg", "embed", .06), stroke: col("line-2"), "stroke-width": 1.5 }, svg);
      const STR = "The cat sat on the mat";
      const sent = D.text(svg, SX, SY, STR, { mono: true, size: FS, weight: 500 });
      const cuts = [3, 7, 11, 14, 18].map(i => el("line", { x1: SX + i * CW, x2: SX + i * CW, y1: SY - 50, y2: SY + 16, stroke: col("token"), "stroke-width": 3, "stroke-linecap": "round" }, svg));
      const TOK = ["The", "·cat", "·sat", "·on", "·the", "·mat"], IDS = [760, 7993, 7338, 383, 279, 5344];
      const spans = [[0, 3], [3, 7], [7, 11], [11, 14], [14, 18], [18, 22]];
      const chips = chipRow(svg, SX, 250, TOK);
      const ids = chips.map((c, i) => D.text(svg, c.cx, c.y + c.h + 42, String(IDS[i]), { mono: true, size: 30, anchor: "middle", color: "token", weight: 500 }));
      const head = D.label(svg, SX, 512, "Same meaning, different number of pieces", { size: 20 });
      const enL = D.text(svg, SX, 590, "English", { size: 24, color: "text-2" });
      const noL = D.text(svg, SX, 722, "Norwegian", { size: 24, color: "text-2" });
      const en = chipRow(svg, 300, 552, ["·probability", "·distribution"], { size: 30, gap: 14 });
      const no = chipRow(svg, 300, 684, ["·sann", "syn", "ligh", "ets", "ford", "eling"], { size: 30, gap: 14 });
      const enC = D.text(svg, 1500, 595, "2 pieces", { mono: true, size: 30, anchor: "end", color: "embed", weight: 600 });
      const noC = D.text(svg, 1500, 727, "6 pieces", { mono: true, size: 30, anchor: "end", color: "logit", weight: 600 });
      return t => {
        D.fade(bubble, 1 - ctx.p(t, "cut", 0, .2));
        cuts.forEach((l, i) => { const p = ctx.p(t, "cut", .08 + i * .04, .25 + i * .04); l.setAttribute("opacity", p * (1 - ctx.p(t, "number", .3, .6))); l.setAttribute("y1", SY - 50 * p); });
        chips.forEach((c, i) => {
          const p = ctx.p(t, "cut", .35 + i * .06, .65 + i * .06, E.inOut);
          const sx = SX + (spans[i][0] + spans[i][1]) / 2 * CW, dx = (sx - c.cx) * (1 - p), dy = (SY - 30 - c.y) * (1 - p);
          c.g.setAttribute("transform", `translate(${dx} ${dy})`);
          c.g.setAttribute("opacity", p);
          c.box.setAttribute("filter", ctx.active(t, "cut") && p > .9 && ctx.p(t, "cut", .9, 1) < 1 ? G : "none");
        });
        ids.forEach((d, i) => D.fade(d, ctx.p(t, "number", .1 + i * .07, .35 + i * .07)));
        D.fade(sent, 1 - .75 * ctx.p(t, "number", .45, .75));
        D.fade(head, ctx.p(t, "lang", 0, .15));
        D.fade(enL, ctx.p(t, "lang", .05, .2)); D.fade(noL, ctx.p(t, "lang", .3, .45));
        en.forEach((c, i) => show(c.g, ctx.p(t, "lang", .08 + i * .06, .25 + i * .06), 10));
        no.forEach((c, i) => show(c.g, ctx.p(t, "lang", .33 + i * .05, .5 + i * .05), 10));
        D.fade(enC, ctx.p(t, "lang", .25, .35)); D.fade(noC, ctx.p(t, "lang", .7, .8));
      };
    },

    /* ------------------------------------------------------------ s3 */
    "s3-meaning"(ctx) {
      const svg = ctx.svg; D.backdrop(svg); const G = glow(svg, "s3g");
      const sent = D.text(svg, SX, SY, "The cat sat on the mat", { mono: true, size: FS, weight: 500, opacity: .25 });
      const TOK = ["The", "·cat", "·sat", "·on", "·the", "·mat"], IDS = [760, 7993, 7338, 383, 279, 5344];
      const chips = chipRow(svg, SX, 250, TOK);
      const ids = chips.map((c, i) => D.text(svg, c.cx, c.y + c.h + 42, String(IDS[i]), { mono: true, size: 30, anchor: "middle", color: "token", weight: 500 }));
      const R = LX.rng(31);
      const cols = chips.map(c => D.vector(svg, { x: c.cx, y: 400, values: Array.from({ length: 10 }, () => (R() * 2 - 1) * (.35 + R() * .65)), cell: 26, gap: 6 }));
      const listLab = D.label(svg, SX, 760, "each piece → a list of about 5,000 numbers", { size: 20 });
      // the map
      const mapLab = D.label(svg, SX, 250, "A map of meaning · flattened from about 5,000 directions", { size: 20 });
      const bg = el("g", {}, svg);
      for (let i = 0; i < 70; i++) el("circle", { cx: 140 + R() * 1320, cy: 290 + R() * 520, r: 3, fill: col("line-2") }, bg);
      const clusters = [["animals", 430, 330], ["people", 1110, 255], ["actions", 790, 400], ["furniture", 1080, 560], ["small words", 470, 610]]
        .map(([n, x, y]) => D.text(svg, x, y, n, { size: 22, anchor: "middle", color: "muted" }));
      const P = { The: [440, 680], cat: [400, 400], sat: [760, 470], on: [580, 660], the: [520, 720], mat: [1000, 640],
        dog: [490, 440], kitten: [350, 470], puppy: [470, 510], king: [1020, 320], queen: [1220, 290], man: [1000, 440], woman: [1200, 410],
        ran: [830, 440], jumped: [840, 520], floor: [1090, 690], sofa: [1150, 620], a: [410, 750] };
      const mk = (w, main) => {
        const g = el("g", {}, svg);
        const c = el("circle", { cx: 0, cy: 0, r: main ? 11 : 9, fill: col(main ? "embed" : "text-2") }, g);
        const tx = D.text(g, 18, 8, w, { size: 24, color: main ? "text" : "text-2", weight: main ? 600 : 400 });
        return { g, c, tx };
      };
      const mains = ["The", "cat", "sat", "on", "the", "mat"].map(w => mk(w, true));
      const others = ["dog", "kitten", "puppy", "king", "queen", "man", "woman", "ran", "jumped", "floor", "sofa", "a"].map(w => ({ w, ...mk(w, false) }));
      const a1 = D.arrow(svg, { x1: P.man[0] + 12, y1: P.man[1] - 2, x2: P.woman[0] - 14, y2: P.woman[1] + 2, color: "embed", width: 3 });
      const a2 = D.arrow(svg, { x1: P.king[0] + 12, y1: P.king[1] - 2, x2: P.queen[0] - 14, y2: P.queen[1] + 2, color: "embed", width: 3 });
      const dirLab = D.text(svg, 1110, 520, "same step, same meaning", { size: 22, anchor: "middle", color: "embed", weight: 600 });
      return t => {
        const toMap = ctx.p(t, "map", 0, .35, E.inOut);
        D.fade(sent, .25 * (1 - .6 * toMap));
        chips.forEach((c, i) => D.fade(c.g, 1 - toMap));
        ids.forEach((d, i) => D.fade(d, (1 - ctx.p(t, "list", .05, .25)) * (1 - toMap)));
        cols.forEach((v, i) => { v.reveal(ctx.p(t, "list", .1 + i * .07, .45 + i * .07, E.linear)); v.g.setAttribute("opacity", 1 - toMap); });
        D.fade(listLab, ctx.p(t, "list", .5, .7) * (1 - toMap));
        D.fade(mapLab, ctx.p(t, "map", .25, .4));
        D.fade(bg, ctx.p(t, "map", .2, .45));
        clusters.forEach((c, i) => D.fade(c, ctx.p(t, "map", .55 + i * .04, .7 + i * .04)));
        const names = ["The", "cat", "sat", "on", "the", "mat"];
        mains.forEach((m, i) => {
          const sx = chips[i].cx, sy = 560, [mx, my] = P[names[i]];
          m.g.setAttribute("transform", `translate(${lerp(sx, mx, toMap)} ${lerp(sy, my, toMap)})`);
          m.g.setAttribute("opacity", ctx.p(t, "map", 0, .1));
          m.tx.setAttribute("opacity", ctx.p(t, "map", .3, .45));
        });
        others.forEach((o, i) => { o.g.setAttribute("transform", `translate(${P[o.w][0]} ${P[o.w][1]})`); o.g.setAttribute("opacity", ctx.p(t, "map", .45 + i * .025, .6 + i * .025)); });
        // highlight dog/cat and king/queen pairs during map
        const hl = ctx.p(t, "map", .7, .8) * (1 - ctx.p(t, "dir", 0, .1));
        mains[1].c.setAttribute("filter", hl > .5 ? G : "none");
        others[0].c.setAttribute("filter", hl > .5 ? G : "none");
        a1.draw(ctx.p(t, "dir", .1, .4)); a2.draw(ctx.p(t, "dir", .3, .6));
        D.fade(dirLab, ctx.p(t, "dir", .6, .75));
        [others[3], others[4], others[5], others[6]].forEach(o => o.c.setAttribute("filter", ctx.p(t, "dir", .1, .2) > .5 ? G : "none"));
      };
    },

    /* ------------------------------------------------------------ s4 */
    "s4-layers"(ctx) {
      const svg = ctx.svg; D.backdrop(svg); const G = glow(svg, "s4g");
      const sent = D.text(svg, SX, SY, "The cat sat because it was tired", { mono: true, size: FS, weight: 500 });
      const TOK = ["The", "cat", "sat", "because", "it", "was", "tired"];
      const xs = TOK.map((_, i) => 150 + i * 92), R = LX.rng(44);
      const heads = TOK.map((w, i) => D.text(svg, xs[i], 262, w, { mono: true, size: 22, anchor: "middle", color: "token" }));
      const cols = TOK.map((_, i) => D.vector(svg, { x: xs[i], y: 285, values: Array.from({ length: 8 }, () => (R() * 2 - 1) * (.3 + R() * .7)), cell: 24, gap: 6 }));
      const colTop = 285, colBot = 285 + 8 * 30 - 6;
      const notes = TOK.map((_, i) => el("rect", { x: xs[i] - 12, y: colBot + 10, width: 24, height: 24, rx: 4, fill: col("mlp"), opacity: 0 }, svg));
      const flash = TOK.map((_, i) => el("rect", { x: xs[i] - 18, y: colTop - 8, width: 36, height: colBot - colTop + 50, rx: 8, fill: "none", stroke: col("mlp"), "stroke-width": 2.5, opacity: 0 }, svg));
      const arcY = colBot + 50;
      const arcs = [];
      for (let j = 1; j < TOK.length; j++) for (let i = 0; i < j; i++) {
        const strong = j === 4 && i === 1;
        const h = 30 + (j - i) * 22;
        arcs.push({ strong, p: el("path", { d: `M${xs[j]} ${arcY} Q ${(xs[i] + xs[j]) / 2} ${arcY + h * 1.6} ${xs[i]} ${arcY}`, fill: "none", stroke: col("attn"), "stroke-width": strong ? 4.5 : 1.2, opacity: 0 }, svg) });
      }
      const itcat = D.text(svg, (xs[1] + xs[4]) / 2, arcY + 150, "“it” = the cat", { size: 24, anchor: "middle", color: "attn", weight: 600 });
      const glowLast = el("rect", { x: xs[6] - 20, y: colTop - 12, width: 40, height: colBot - colTop + 24, rx: 10, fill: "none", stroke: col("embed"), "stroke-width": 3, opacity: 0 }, svg);
      const st = stack(svg, 920, 540);
      const stLab = D.text(svg, 920, st.top - 18, "64 layers", { size: 24, color: "text-2", weight: 600 });
      const arr = D.arrow(svg, { x1: 790, y1: 420, x2: 890, y2: 420, width: 2.5 });
      const msg = slot(svg, SX, 820, 30, "text");
      const MSG = [["look", "1 · Words look at each other", "attn"], ["think", "2 · Each word is processed on its own", "mlp"], ["notes", "Each layer adds its notes", "embed"]];
      return t => {
        cols.forEach((v, i) => { v.reveal(ctx.p(t, "stack", .02 + i * .03, .22 + i * .03, E.linear)); });
        heads.forEach((h, i) => D.fade(h, ctx.p(t, "stack", .02 + i * .03, .15 + i * .03)));
        st.show(ctx.p(t, "stack", .1, .45)); D.fade(stLab, ctx.p(t, "stack", .3, .45));
        arr.draw(ctx.p(t, "stack", .4, .55));
        const lv = ctx.span(t, ctx.cue("stack").start + ctx.cue("stack").dur * .5, ctx.cue("notes").end, E.linear) * 19 - 1.5;
        st.pulse(lv, G);
        // look
        arcs.forEach((a, k) => {
          const p = ctx.p(t, "look", .1 + (k % 7) * .03, .4 + (k % 7) * .03);
          const fadeBack = ctx.p(t, "think", 0, .2);
          a.p.setAttribute("opacity", a.strong ? p * (1 - .6 * fadeBack) : p * .35 * (1 - .8 * fadeBack));
          if (a.strong) a.p.setAttribute("filter", p > .5 && fadeBack < 1 ? G : "none");
        });
        D.fade(itcat, ctx.p(t, "look", .5, .65) * (1 - ctx.p(t, "think", 0, .2)));
        // think
        flash.forEach((f, i) => {
          const a = ctx.p(t, "think", .15 + i * .1, .25 + i * .1), b = ctx.p(t, "think", .25 + i * .1, .35 + i * .1);
          f.setAttribute("opacity", a * (1 - b));
          notes[i].setAttribute("opacity", a);
        });
        // notes
        const g = ctx.p(t, "notes", .3, .5);
        glowLast.setAttribute("opacity", g); glowLast.setAttribute("filter", g > .5 ? G : "none");
        // message slot
        let m = null; MSG.forEach(([id, s, c]) => { if (t >= ctx.cue(id).start) m = [id, s, c]; });
        if (m) { msg.textContent = m[1]; msg.setAttribute("fill", col(m[2])); D.fade(msg, ctx.p(t, m[0], 0, .12)); } else D.fade(msg, 0);
        D.fade(sent, 1);
      };
    },

    /* ------------------------------------------------------------ s5 */
    "s5-choose"(ctx) {
      const svg = ctx.svg; D.backdrop(svg); const G = glow(svg, "s5g");
      const sent = D.text(svg, SX, SY, "", { mono: true, size: FS, weight: 500 });
      const base = el("tspan", {}, sent), add = el("tspan", { fill: col("logit") }, sent); base.textContent = "The cat sat on the";
      const caret = el("rect", { x: 0, y: SY - 38, width: 4, height: 46, fill: col("token") }, svg);
      const R = LX.rng(55);
      const vec = D.vector(svg, { x: 170, y: 300, values: Array.from({ length: 10 }, () => (R() * 2 - 1) * (.4 + R() * .6)), cell: 26, gap: 6 });
      const vglow = el("rect", { x: 148, y: 290, width: 44, height: 334, rx: 10, fill: "none", stroke: col("embed"), "stroke-width": 3 }, svg);
      const vlab = D.text(svg, 170, 660, "last word", { size: 20, anchor: "middle", color: "embed" });
      const arr = D.arrow(svg, { x1: 215, y1: 460, x2: 300, y2: 460, width: 2.5 });
      // bars: named + tail
      const N = 90, X0 = 330, BW = 9, STEP = 13, BASE = 700;
      const named = { 8: ["mat", .38], 22: ["floor", .17], 35: ["couch", .09], 47: ["bed", .06], 60: ["sofa", .05], 74: ["roof", .03] };
      const p0 = []; let tail = 0;
      for (let i = 0; i < N; i++) { if (named[i]) p0.push(named[i][1]); else { const v = .2 + R(); p0.push(v); tail += v; } }
      for (let i = 0; i < N; i++) if (!named[i]) p0[i] = p0[i] / tail * .22;
      const logit = p0.map(Math.log);
      const bars = p0.map((_, i) => el("rect", { x: X0 + i * STEP, y: BASE, width: BW, height: 0, rx: 2, fill: col("logit"), opacity: named[i] ? 1 : .45 }, svg));
      el("line", { x1: X0 - 10, x2: X0 + N * STEP, y1: BASE + 1, y2: BASE + 1, stroke: col("line-2") }, svg);
      const labs = Object.entries(named).map(([i, [w]]) => ({ i: +i, w: D.text(svg, X0 + +i * STEP + BW / 2, 0, w, { mono: true, size: 22, anchor: "middle", color: "text" }), pc: D.text(svg, X0 + +i * STEP + BW / 2, 0, "", { mono: true, size: 20, anchor: "middle", color: "logit" }) }));
      const head = D.label(svg, X0, 270, "a likelihood for every possible piece", { size: 20 });
      // dial
      const DX = 1290, DY = 820, DR = 64;
      const dial = el("g", {}, svg);
      el("path", { d: `M${DX - DR} ${DY} A ${DR} ${DR} 0 0 1 ${DX + DR} ${DY}`, fill: "none", stroke: col("line-2"), "stroke-width": 6, "stroke-linecap": "round" }, dial);
      const needle = el("line", { x1: DX, y1: DY, x2: DX, y2: DY - DR + 8, stroke: col("logit"), "stroke-width": 4, "stroke-linecap": "round" }, dial);
      D.text(dial, DX, DY + 34, "temperature", { size: 22, anchor: "middle", color: "text-2" });
      D.text(dial, DX - DR - 14, DY + 6, "careful", { size: 20, anchor: "end", color: "muted" });
      D.text(dial, DX + DR + 14, DY + 6, "adventurous", { size: 20, anchor: "start", color: "muted" });
      const tval = D.text(dial, DX, DY - DR - 18, "", { mono: true, size: 22, anchor: "middle", color: "logit" });
      const ball = el("circle", { cx: X0 + 8 * STEP + BW / 2, cy: 300, r: 13, fill: col("logit"), filter: G, opacity: 0 }, svg);
      const fly = D.text(svg, 0, 0, "mat", { mono: true, size: 34, anchor: "middle", color: "logit", weight: 600 });
      // second run: a seeded draw at T = 1.0 that lands on 'floor' (index 22), found by search so it is computed, not assumed
      const IF = 22; let lo = 0; for (let i = 0; i < IF; i++) lo += p0[i]; const hi = lo + p0[IF];
      let u2 = 0; for (let sd = 1; sd < 5000; sd++) { const r2 = LX.rng(sd); r2(); const u = r2(); if (u >= lo && u < hi) { u2 = u; break; } }
      const ball2 = el("circle", { cx: X0 + IF * STEP + BW / 2, cy: 300, r: 13, fill: col("logit"), filter: G, opacity: 0 }, svg);
      const fly2 = D.text(svg, 0, 0, "floor", { mono: true, size: 34, anchor: "middle", color: "logit", weight: 600 });
      const alt = D.text(svg, SX, SY + 70, "", { mono: true, size: FS, weight: 500, opacity: 0 });
      const altBase = el("tspan", {}, alt), altAdd = el("tspan", { fill: col("logit") }, alt); altBase.textContent = "The cat sat on the";
      const run1 = D.text(svg, SX + 25 * CW, SY - 4, "run 1", { mono: true, size: 20, color: "muted", opacity: 0 });
      const run2 = D.text(svg, SX + 25 * CW, SY + 66, "run 2", { mono: true, size: 20, color: "muted", opacity: 0 });
      const u2lab = D.text(svg, X0 + IF * STEP + BW / 2 + 22, 300, "u = " + u2.toFixed(2), { mono: true, size: 18, color: "muted", opacity: 0 });
      const Tof = t => {
        if (!(t >= ctx.cue("temp").start)) return 1;
        const a = ctx.p(t, "temp", .12, .38, E.inOut), b = ctx.p(t, "temp", .45, .72, E.inOut), c = ctx.p(t, "temp", .8, .95, E.inOut);
        return Math.exp(lerp(lerp(lerp(0, Math.log(.3), a), Math.log(2.2), b), 0, c));
      };
      return t => {
        D.fade(vec.g, ctx.p(t, "score", 0, .15)); D.fade(vlab, ctx.p(t, "score", 0, .15));
        vec.reveal(1); vglow.setAttribute("opacity", ctx.p(t, "score", 0, .15) * (1 - ctx.p(t, "score", .4, .6))); vglow.setAttribute("filter", G);
        arr.draw(ctx.p(t, "score", .1, .25));
        D.fade(head, ctx.p(t, "score", .2, .35));
        const T = Tof(t), grow = ctx.p(t, "score", .2, .7);
        const q = logit.map(z => Math.exp(z / T)), s = q.reduce((a, b) => a + b, 0);
        bars.forEach((b, i) => {
          const h = Math.max(named[i] ? 2 : 4, 350 * (q[i] / s) / .95) * clamp(grow * 1.4 - i / N * .4);
          b.setAttribute("y", BASE - h); b.setAttribute("height", h);
        });
        labs.forEach(L => {
          const pr = q[L.i] / s, h = 350 * pr / .95 * clamp(grow * 1.4 - L.i / N * .4);
          L.w.setAttribute("y", BASE - h - 36); L.pc.setAttribute("y", BASE - h - 12);
          L.pc.textContent = (pr * 100 >= 1 ? Math.round(pr * 100) : (pr * 100).toFixed(1)) + "%";
          const a = ctx.p(t, "score", .55, .7); D.fade(L.w, a); D.fade(L.pc, a);
        });
        D.fade(dial, ctx.p(t, "temp", 0, .1));
        const ang = clamp((Math.log(T) - Math.log(.3)) / (Math.log(2.2) - Math.log(.3))) * 160 - 80;
        needle.setAttribute("transform", `rotate(${ang} ${DX} ${DY})`);
        tval.textContent = "T = " + T.toFixed(1);
        // pick
        const drop = ctx.p(t, "pick", .05, .3, E.in), hMat = 350 * (q[8] / s) / .95;
        ball.setAttribute("cy", lerp(300, BASE - hMat - 13, drop));
        ball.setAttribute("opacity", ctx.p(t, "pick", 0, .05) * (1 - ctx.p(t, "pick", .35, .45)));
        const againOn = t >= ctx.cue("again").start;
        bars[8].setAttribute("filter", drop >= 1 && !againOn ? G : "none");
        const f = ctx.p(t, "pick", .4, .75, E.inOut);
        const fx = lerp(X0 + 8 * STEP + BW / 2, SX + 20.5 * CW, f), fy = lerp(BASE - hMat - 50, SY, f);
        fly.setAttribute("transform", `translate(${fx} ${fy}) scale(${lerp(1, FS / 34, f)})`);
        fly.setAttribute("opacity", f > 0 && f < 1 ? 1 : 0);
        add.textContent = f >= 1 ? " mat" : "";
        // second run lands on floor
        const d2 = ctx.p(t, "again", .08, .32, E.in), hF = 350 * (q[IF] / s) / .95;
        ball2.setAttribute("cy", lerp(300, BASE - hF - 13, d2));
        ball2.setAttribute("opacity", ctx.p(t, "again", .04, .1) * (1 - ctx.p(t, "again", .38, .46)));
        D.fade(u2lab, ctx.p(t, "again", .1, .2) * (1 - ctx.p(t, "again", .4, .5)));
        bars[IF].setAttribute("filter", d2 >= 1 ? G : "none");
        const f2 = ctx.p(t, "again", .4, .7, E.inOut);
        const gx = lerp(X0 + IF * STEP + BW / 2, SX + 21.5 * CW, f2), gy = lerp(BASE - hF - 50, SY + 70, f2);
        fly2.setAttribute("transform", `translate(${gx} ${gy}) scale(${lerp(1, FS / 34, f2)})`);
        fly2.setAttribute("opacity", f2 > 0 && f2 < 1 ? 1 : 0);
        D.fade(alt, ctx.p(t, "again", .35, .45));
        altAdd.textContent = f2 >= 1 ? " floor" : "";
        D.fade(run1, ctx.p(t, "again", .3, .4)); D.fade(run2, ctx.p(t, "again", .35, .45));
        caret.setAttribute("x", SX + (18 + (add.textContent ? 4 : 0)) * CW + 4); caret.setAttribute("opacity", blink(t));
      };
    },

    /* ------------------------------------------------------------ s6 */
    "s6-loop"(ctx) {
      const svg = ctx.svg; D.backdrop(svg); const G = glow(svg, "s6g");
      const sent = D.text(svg, SX, SY, "", { mono: true, size: FS, weight: 500 });
      const base = el("tspan", {}, sent), add = el("tspan", { fill: col("logit") }, sent); base.textContent = "The cat sat on the";
      const SXk = 760, SW = 480, st = stack(svg, SXk, SW), lane = SW / 6;
      const PR = ["The", "·cat", "·sat", "·on", "·the"];
      const pchips = PR.map((w, i) => { const g = el("g", {}, svg); el("rect", { x: SXk + i * lane + 6, y: 816, width: lane - 12, height: 40, rx: 8, fill: mix("bg", "token", .12), stroke: col("token"), "stroke-width": 1.5 }, g); D.text(g, SXk + i * lane + lane / 2, 843, w.replace("·", ""), { mono: true, size: 20, anchor: "middle" }); return g; });
      const band = el("rect", { x: SXk + 4, y: 0, width: lane * 5 - 8, height: 30, rx: 8, fill: col("embed"), opacity: 0 }, svg);
      // memory shelf: 16 rows × 8 columns
      const MX = 1290, cw = 24, rows = st.slabs.map(s => s.y);
      const shelfLab = D.text(svg, MX, st.top - 18, "memory (cache)", { size: 22, color: "cache", weight: 600 });
      const shelfFrame = el("rect", { x: MX - 8, y: st.top - 6, width: 8 * (cw + 2) + 14, height: st.bottom - st.top + 4, rx: 10, fill: "none", stroke: col("cache"), "stroke-width": 1.5, "stroke-dasharray": "5 5" }, svg);
      const cells = [];
      for (let c = 0; c < 8; c++) { cells.push(rows.map(y => el("rect", { x: MX + c * (cw + 2), y, width: cw, height: 22, rx: 4, fill: col("cache"), opacity: 0 }, svg))); }
      const msg1 = D.text(svg, SX, 360, "Reading", { size: 40, weight: 650 });
      const msg1b = D.text(svg, SX, 410, "every word at once · fast", { size: 26, color: "embed" });
      const msg2 = D.text(svg, SX, 560, "Writing", { size: 40, weight: 650 });
      const msg2b = D.text(svg, SX, 610, "one piece at a time", { size: 26, color: "logit" });
      const WR = [" mat", " and", " purred"];
      const tok = el("g", {}, svg);
      el("rect", { x: -lane / 2 + 6, y: -18, width: lane - 12, height: 36, rx: 8, fill: mix("bg", "logit", .2), stroke: col("logit"), "stroke-width": 2 }, tok);
      const tokT = D.text(tok, 0, 7, "", { mono: true, size: 18, anchor: "middle" });
      const glance = el("line", { stroke: col("cache"), "stroke-width": 2, "stroke-dasharray": "4 4", opacity: 0 }, svg);
      const H = st.bottom - st.top;
      return t => {
        st.show(1);
        pchips.forEach((g, i) => D.fade(g, ctx.p(t, "read", 0, .1)));
        // read: wide band rises; shelf columns 0..4 fill with it
        const r = ctx.p(t, "read", .15, .85, E.inOut);
        const by = st.bottom - 30 - r * (H - 30);
        band.setAttribute("y", by); band.setAttribute("opacity", r > 0 && r < 1 ? .45 : 0); band.setAttribute("filter", G);
        st.pulse(r > 0 && r < 1 ? r * 17.5 - 1 : -9, G);
        D.fade(msg1, ctx.p(t, "read", 0, .15)); D.fade(msg1b, ctx.p(t, "read", .1, .25));
        const sh = ctx.p(t, "memory", 0, .15);
        D.fade(shelfLab, Math.max(sh, r > 0 ? .5 : 0)); D.fade(shelfFrame, Math.max(sh, r > 0 ? .5 : 0));
        shelfFrame.setAttribute("filter", ctx.active(t, "memory") ? G : "none");
        cells.forEach((colc, c) => colc.forEach((cell, k) => {
          let on = 0;
          if (c < 5) on = r * 16 > k ? 1 : 0;
          else { const w = c - 5, seg = writeSeg(t, w); on = seg >= 1 ? 1 : seg > .85 ? 1 : 0; }
          cell.setAttribute("opacity", on * .85);
        }));
        // write: three tokens climb lane 5
        D.fade(msg2, ctx.p(t, "write", 0, .1)); D.fade(msg2b, ctx.p(t, "write", .05, .15));
        let shown = "", visible = false;
        WR.forEach((w, k) => {
          const s = writeSeg(t, k);
          if (s >= 1) shown += w;
          if (s > 0 && s < 1) {
            visible = true; tokT.textContent = w.trim();
            const y = st.bottom - 20 - Math.min(s / .85, 1) * (H - 20);
            tok.setAttribute("transform", `translate(${SXk + 5.5 * lane} ${y})`);
            const lvl = Math.min(s / .85, 1) * 16;
            glance.setAttribute("x1", SXk + 5.5 * lane + lane / 2 - 6); glance.setAttribute("y1", y);
            glance.setAttribute("x2", MX - 8); glance.setAttribute("y2", y);
            glance.setAttribute("opacity", s < .85 ? .8 : 0);
            st.pulse(lvl - .5, G);
          }
        });
        tok.setAttribute("opacity", visible ? 1 : 0); if (!visible) glance.setAttribute("opacity", 0);
        add.textContent = shown;
      };
      function writeSeg(t, k) { const a = .06 + k * .31; return ctx.p(t, "write", a, a + .27, E.linear); }
    },

    /* ------------------------------------------------------------ s7 */
    "s7-scale"(ctx) {
      const svg = ctx.svg; D.backdrop(svg); const G = glow(svg, "s7g");
      const st = stack(svg, 760, 480);
      // dense field of points: one path per brightness level
      const R = LX.rng(77), F1 = [], F2 = [];
      for (let r = 0; r < 52; r++) for (let c = 0; c < 160; c++) {
        const x = 160 + c * 8, y = 220 + r * 8, d = `M${x} ${y}h2v2h-2z`;
        (R() < .12 ? F2 : F1).push(d);
      }
      const f1 = el("path", { d: F1.join(""), fill: col("embed"), opacity: 0 }, svg);
      const f2 = el("path", { d: F2.join(""), fill: col("text"), opacity: 0 }, svg);
      const big = D.text(svg, 800, 712, "27.8 billion numbers", { size: 56, weight: 650, anchor: "middle" });
      const bigS = D.text(svg, 800, 762, "tuned while the model read trillions of words", { size: 26, anchor: "middle", color: "text-2" });
      const cnt = D.text(svg, 800, 430, "0", { mono: true, size: 72, weight: 600, anchor: "middle", color: "embed" });
      const cntL = D.text(svg, 800, 492, "calculations to write one piece of text", { size: 28, anchor: "middle", color: "text-2" });
      const hand = D.text(svg, 800, 560, "≈ 1,600 years for a person doing one per second", { size: 26, anchor: "middle", color: "muted" });
      const head = D.text(svg, 800, 330, "That is how a language model writes.", { size: 48, weight: 650, anchor: "middle" });
      const strip = D.journey(svg, { x: 160, y: 470, w: 1280 });
      const stripG = svg.lastElementChild; // not used for fading; we fade via a wrapper below
      const loop = el("path", { d: "M1388 540 C 1388 680, 212 680, 212 540", fill: "none", stroke: col("cache"), "stroke-width": 2.5, "stroke-dasharray": "6 6" }, svg);
      const trav = el("circle", { r: 8, fill: col("cache"), filter: G, opacity: 0 }, svg);
      const L = loop.getTotalLength();
      // wrap journey blocks: everything drawn by journey sits between `head` and `loop` in DOM order
      const jNodes = []; for (let n = head.nextSibling; n && n !== loop; n = n.nextSibling) jNodes.push(n);
      const KEYS = LX.STAGES.map(s => s.key);
      return t => {
        const out = ctx.p(t, "params", 0, .3);
        st.show(1 - out); st.pulse(-9, G);
        const fin = ctx.p(t, "params", .15, .5), dim = 1 - .7 * ctx.p(t, "cost", 0, .2), gone = 1 - ctx.p(t, "recap", 0, .15);
        f1.setAttribute("opacity", .55 * fin * dim * gone); f2.setAttribute("opacity", .9 * fin * dim * gone);
        D.fade(big, ctx.p(t, "params", .4, .55) * (1 - ctx.p(t, "cost", 0, .12)));
        D.fade(bigS, ctx.p(t, "params", .55, .7) * (1 - ctx.p(t, "cost", 0, .12)));
        const c = ctx.p(t, "cost", .08, .55, E.out);
        cnt.textContent = fmtInt(51e9 * c);
        D.fade(cnt, ctx.p(t, "cost", .05, .12) * gone); D.fade(cntL, ctx.p(t, "cost", .15, .3) * gone);
        D.fade(hand, ctx.p(t, "cost", .6, .75) * gone);
        // recap: stages light in turn, loop back
        const rp = ctx.p(t, "recap", .12, .78, E.linear);
        const k = Math.min(5, Math.floor(rp * 6));
        const vis = ctx.p(t, "recap", .05, .15);
        jNodes.forEach(n => n.setAttribute && n.setAttribute("opacity", vis));
        if (vis > 0) {
          const lp = ctx.p(t, "recap", .8, .95, E.inOut);
          strip.set(lp >= 1 ? KEYS[0] : KEYS[k], lp >= 1 ? 1 : (rp * 6) % 1);
          if (vis < 1) jNodes.forEach(n => n.setAttribute && n.setAttribute("opacity", vis));
          loop.setAttribute("stroke-dasharray", `${L} ${L}`); loop.setAttribute("stroke-dashoffset", L * (1 - lp));
          loop.setAttribute("opacity", lp > 0 ? 1 : 0);
          if (lp > 0 && lp < 1) { const pt = loop.getPointAtLength(L * lp); trav.setAttribute("cx", pt.x); trav.setAttribute("cy", pt.y); trav.setAttribute("opacity", 1); } else trav.setAttribute("opacity", 0);
        } else { loop.setAttribute("opacity", 0); trav.setAttribute("opacity", 0); }
        D.fade(head, ctx.p(t, "recap", .82, .97));
      };
    },
  };
  L1.forEach(s => { s.build = BUILD[s.id]; });

  L1.forEach(LX.storyScene);

  LX.story({
    id: "short", level: 1, title: "The short version", sub: "≈ 3 min · for anyone",
    items: [
      { cover: { variant: "short", kicker: "LLM Explained · level 1", title: "The short version", sub: "About 3 minutes · for anyone · no maths",
        say: "How does a chatbot write? Here is the whole idea in about three minutes." } },
      ...L1.map(s => s.id),
    ],
  });

  /* ----------------------------------------------------------------------
     LEVEL 2 · The main story (about 15–18 minutes)
     ---------------------------------------------------------------------- */
  const B = (stage, kicker, title, say, sub) => ({ bridge: { stage, kicker, title, say, sub } });
  LX.story({
    id: "main", level: 2, title: "The main story", sub: "≈ 16 min · technical",
    items: [
      { cover: { variant: "main", kicker: "LLM Explained · level 2", title: "The main story", sub: "About 16 minutes · inside a real 27-billion-parameter model",
        say: "The main story follows one token through a real model, step by step, with the real numbers." } },
      B(null, "LLM Explained", "How a language model writes",
        "This is the journey of a single token through a real language model, Qwen 3.8 with twenty-seven billion parameters. First the whole picture, then each step up close.",
        "Inside Qwen3.8-27B"),
      "big-picture",
      B(null, "One skeleton", "Not just Qwen", "Almost every language model is built from the same parts. Qwen is one variation; the skeleton is shared."),
      "same-skeleton",
      B("tokenize", "Step 1", "Tokenize", "It starts with text. Before anything else, the text must become numbers."),
      "token-split",
      B("embed", "Step 2", "Embed", "Token IDs are only labels. The next step gives each one a meaning the model can calculate with."),
      "embed-lookup",
      "meaning-space",
      B("layers", "Step 3", "Sixty-four layers", "Now the vectors enter the model proper: sixty-four layers, each with the same basic shape."),
      "layer-anatomy",
      B("layers", "Inside a layer", "Attention", "The first part of a layer lets tokens exchange information. In sixteen of the sixty-four layers, that is classic attention."),
      "attn-qkv",
      "attn-scores",
      B("layers", "Inside a layer", "Gated DeltaNet", "The other forty-eight layers use a cheaper way to remember the past: a fixed-size memory that is corrected, not just added to."),
      "delta-vs-plain",
      B("layers", "Inside a layer", "The MLP", "The second part of every layer works on each token alone. This is where most of the model's parameters, and much of its knowledge, live."),
      "mlp-shape",
      "qwen-zoom",
      B("score", "Step 4", "Score", "After the last layer, one vector must become a verdict on every possible next token."),
      "lm-head",
      B("sample", "Step 5", "Sample", "Probabilities are not yet a choice. How the model chooses changes the character of its writing."),
      "temperature",
      B("repeat", "Step 6", "Repeat", "Finally, the loop. Reading the prompt and writing the answer are two very different kinds of work."),
      "prefill-wave",
      "decode-loop",
      "prefix-cache",
      B(null, "The end of one token", "And then it all happens again",
        "Tokenize, embed, sixty-four layers, score, sample, repeat. Every word of every answer makes this whole journey. The chapters on this page go deeper into each step."),
    ],
  });

  /* ----------------------------------------------------------------------
     LEVEL 3 · The full course: every built scene, chapter by chapter
     ---------------------------------------------------------------------- */
  const STAGE_OF = { "big-picture": null, families: null, numbers: null, tokens: "tokenize", embeddings: "embed", layer: "layers", attention: "layers",
    deltanet: "layers", mlp: "layers", qwen: "layers", output: "score", sampling: "sample", "prefill-decode": "repeat", "kv-cache": "repeat",
    mtp: "repeat", vision: "tokenize", hardware: null, recap: null };
  const spell = n => ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
    "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"][n] || String(n);
  const strip = h => h.replace(/<[^>]+>/g, "");
  const full = [];
  [...LX.chapters].sort((a, b) => a.num - b.num).forEach(ch => {
    const scenes = (ch.body || []).filter(b => b.scene && b.scene.build).map(b => b.scene.id);
    if (!scenes.length) return;
    full.push({ bridge: { stage: STAGE_OF[ch.id] ?? null, kicker: "Chapter " + ch.num, title: strip(ch.title),
      say: `Chapter ${spell(ch.num)}. ${strip(ch.title)}. ${strip(ch.lede || "")}` } });
    full.push(...scenes);
  });
  full.unshift({ cover: { variant: "full", kicker: "LLM Explained · level 3", title: "The full course", sub: "Every chapter, every scene · for the curious and the technical",
    say: "The full course. Every chapter and every animation, from the first token to the hardware it runs on." } });
  LX.story({ id: "full", level: 3, title: "The full course", sub: "≈ 30+ min · every scene", items: full });
})();
