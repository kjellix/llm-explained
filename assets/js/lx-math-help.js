/* ==========================================================================
   LX math help — a "How to read this" button under every display formula.

   The panel has two parts:
   1. "In words": the authored reading, a <div class="lx-read"> placed right
      after the </math> in the chapter HTML.
   2. "Symbols": generated automatically from the symbols the formula uses,
      so nobody has to remember what ∑, a fraction bar or ᵀ means.
   ========================================================================== */
(function () {
  "use strict";

  const SYMBOLS = {
    sum:     ["∑ (big sigma)", "Add up. The expression after it is calculated <i>for each</i> value of the counter written underneath (for example <i>i</i> = 1), up to the value on top, and all results are added together."],
    prod:    ["∏ (big pi)", "Multiply together. Like ∑, but the results are multiplied instead of added."],
    frac:    ["Fraction bar", "The top divided by the bottom."],
    sqrt:    ["√ square root", "The number that, multiplied by itself, gives what is under the sign. √256 = 16."],
    sub:     ["Small number or letter below (x<sub>i</sub>)", "An index: which one we mean. <i>x</i><sub><i>i</i></sub> is the <i>i</i>-th number in the list <i>x</i>; <i>W</i><sub><i>ij</i></sub> is row <i>i</i>, column <i>j</i> of the table <i>W</i>."],
    square:  ["Small 2 above (x²)", "Squared: the number multiplied by itself."],
    pow:     ["Small text above (aᵇ)", "A power: <i>a</i> multiplied by itself <i>b</i> times. For non-whole <i>b</i> it still means “raised to the power”."],
    transpose:["Small T above (Kᵀ)", "Transpose: flip a table so rows become columns. For two vectors, <b>a</b>ᵀ<b>b</b> is just their dot product."],
    exp:     ["e or exp", "The exponential: <i>e</i> ≈ 2.718 raised to a power. It turns any number into a positive one, and makes big numbers much bigger. exp(0) = 1, exp(2) ≈ 7.4."],
    log:     ["log or ln", "The natural logarithm, the reverse of exp: ln(<i>e</i><sup>x</sup>) = <i>x</i>. The log of a probability (between 0 and 1) is negative; ln 1 = 0."],
    argmax:  ["arg max", "Not the largest value itself, but <i>which</i> choice gives the largest value."],
    max:     ["max / min", "The largest / smallest of the values listed."],
    norm:    ["‖x‖ double bars", "The length of a vector: square every number, add them up, take the square root."],
    hadamard:["⊙ circle-dot", "Multiply two lists number by number: first with first, second with second, and so on."],
    dot:     ["· centre dot", "Multiplication (for two vectors in bold: the dot product, multiply matching numbers and add them up)."],
    given:   ["∣ vertical bar", "“Given”: <i>p</i>(<i>a</i> ∣ <i>b</i>) is the probability of <i>a</i> when we already know <i>b</i>."],
    in:      ["∈", "“Is one of”: <i>v</i> ∈ <i>V</i> means <i>v</i> is a member of the set <i>V</i>."],
    approx:  ["≈", "Approximately equal."],
    implies: ["⇒", "“Which means that”."],
    leq:     ["≤ ≥", "Less than or equal / greater than or equal."],
    hat:     ["Hat (x̂)", "A modified version of <i>x</i>, here: the normalised one."],
    softmax: ["softmax", "Turns a list of scores into probabilities: take exp of each score, then divide each by the total so they add up to 1."],
    sigmoid: ["σ (sigma)", "The sigmoid function: squashes any number into the range 0 to 1. σ(0) = 0.5, large positive → close to 1, large negative → close to 0."],
    greek:   ["Greek letters (α, β, θ, ε …)", "Just names for numbers, like x and y. Their meaning is given in the text: here for example a gate, a learning rate, an angle or a tiny constant."],
    bold:    ["Bold letters", "Bold lower-case letters (<b>x</b>, <b>q</b>) are vectors: whole lists of numbers. Capital letters (<i>W</i>, <i>S</i>, <i>Q</i>) are usually matrices: tables of numbers."],
    cos:     ["cos", "Cosine of an angle: 1 when two directions are the same, 0 when they are at right angles, −1 when opposite."],
  };

  /** Work out which SYMBOLS keys a <math> element uses. */
  function detect(m) {
    const found = new Set();
    const txt = e => (e.textContent || "").trim();
    m.querySelectorAll("*").forEach(e => {
      const tag = e.localName, t = txt(e);
      if (tag === "mfrac") found.add("frac");
      if (tag === "msqrt" || tag === "mroot") found.add("sqrt");
      if (tag === "mover" && /[\^ˆ]/.test(txt(e.lastElementChild || e))) found.add("hat");
      if (tag === "msub" || tag === "msubsup") found.add("sub");
      if (tag === "msup" || tag === "msubsup") {
        const base = txt(e.firstElementChild || e), sup = txt(e.lastElementChild || e);
        if (sup === "T") found.add("transpose");
        else if (base === "e") found.add("exp");
        else if (sup === "2") found.add("square");
        else if (!/^[*′']$/.test(sup)) found.add("pow");
      }
      if (tag === "mo" || tag === "mi" || tag === "mtext") {
        if (/∑/.test(t)) found.add("sum");
        if (/∏/.test(t)) found.add("prod");
        if (/⊙/.test(t)) found.add("hadamard");
        if (t === "·") found.add("dot");
        if (t === "∣" || t === "|") found.add("given");
        if (t === "∈") found.add("in");
        if (t === "≈") found.add("approx");
        if (t === "⇒") found.add("implies");
        if (/[≤≥]/.test(t)) found.add("leq");
        if (t === "‖") found.add("norm");
        if (/^(exp)$/.test(t)) found.add("exp");
        if (/^(log|ln)$/.test(t)) found.add("log");
        if (/^arg/.test(t)) found.add("argmax");
        if (/^(max|min)$/.test(t)) found.add("max");
        if (/softmax/i.test(t)) found.add("softmax");
        if (/^cos/.test(t)) found.add("cos");
        if (t === "σ") found.add("sigmoid");
        else if (/^[αβγδεθλμτφψωΔ]$/.test(t)) found.add("greek");
      }
      if (e.getAttribute && e.getAttribute("mathvariant") === "bold") found.add("bold");
    });
    return [...found];
  }

  let uid = 0;
  /** Add a help button and panel under every display formula inside root. */
  LX.mathHelp = function (root) {
    root.querySelectorAll('math[display="block"]').forEach(m => {
      if (m.closest(".lx-formula")) return;
      const read = m.nextElementSibling && m.nextElementSibling.classList.contains("lx-read") ? m.nextElementSibling : null;
      const keys = detect(m);
      if (!read && !keys.length) return;
      const wrap = document.createElement("div");
      wrap.className = "lx-formula";
      m.parentNode.insertBefore(wrap, m);
      wrap.appendChild(m);
      const id = "lx-mh-" + (++uid);
      const btn = document.createElement("button");
      btn.className = "lx-math-btn"; btn.type = "button";
      btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", id);
      btn.innerHTML = `<span class="q">?</span> How to read this`;
      const panel = document.createElement("div");
      panel.className = "lx-math-help"; panel.id = id; panel.hidden = true;
      panel.innerHTML = (read ? `<div class="lx-mh-words"><b>In words</b>${read.innerHTML}</div>` : "")
        + (keys.length ? `<div class="lx-mh-syms"><b>Symbols in this formula</b><dl>${keys.map(k => `<dt>${SYMBOLS[k][0]}</dt><dd>${SYMBOLS[k][1]}</dd>`).join("")}</dl></div>` : "");
      if (read) read.remove();
      btn.onclick = () => {
        const open = panel.hidden;
        panel.hidden = !open; btn.setAttribute("aria-expanded", String(open));
        btn.innerHTML = open ? `<span class="q">×</span> Hide explanation` : `<span class="q">?</span> How to read this`;
      };
      wrap.appendChild(btn);
      wrap.appendChild(panel);
    });
  };
})();
