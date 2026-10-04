/* ==========================================================================
   LX story — tells the whole journey as one continuous film, at several
   levels of depth, by playing scenes back to back.

   A story is a list of items:
     "scene-id"                      an existing scene (from a chapter or LX.storyScene)
     { bridge: {...} }               a short orienting scene with narration over
                                     the "journey strip" (Tokenize → … → Repeat)
   LX.story({ id, level, title, sub, items }) registers it. LX.compose()
   turns it into one ordinary scene, so the page player, the narration audio
   and the video renderer all treat a story exactly like a single scene.
   ========================================================================== */
(function () {
  "use strict";
  LX.stories = [];
  LX.storyScenes = {};
  LX.story = def => LX.stories.push(def);
  LX.storyScene = def => (LX.storyScenes[def.id] = def);

  /* ------------------------------------------------- the journey strip */
  const STAGES = [
    { key: "tokenize", label: "Tokenize", color: "token" },
    { key: "embed",    label: "Embed",    color: "embed" },
    { key: "layers",   label: "64 layers", color: "delta" },
    { key: "score",    label: "Score",    color: "logit" },
    { key: "sample",   label: "Sample",   color: "logit" },
    { key: "repeat",   label: "Repeat",   color: "cache" },
  ];
  LX.STAGES = STAGES;

  /** Draw the six-stage strip; returns {set(activeKey, p)} for highlighting. */
  LX.draw.journey = function (parent, { x = 160, y = 760, w = 1280 } = {}) {
    const D = LX.draw, n = STAGES.length, gap = 18, bw = (w - gap * (n - 1)) / n, items = [];
    STAGES.forEach((s, i) => {
      const bx = x + i * (bw + gap);
      const b = D.block(parent, { x: bx, y, w: bw, h: 52, kind: s.color, label: s.label, size: 16 });
      if (i < n - 1) D.arrow(parent, { x1: bx + bw + 3, y1: y + 26, x2: bx + bw + gap - 3, y2: y + 26, width: 1.5 }).draw(1);
      items.push({ ...s, b });
    });
    return {
      set(active, p = 1) {
        items.forEach(it => {
          const on = it.key === active;
          it.b.g.setAttribute("opacity", on ? 1 : .45);
          it.b.pulse(on ? p * (0.55 + 0.45 * Math.sin(p * Math.PI)) : 0);
        });
      },
    };
  };

  /** A bridge: big title, one or two lines of narration, journey strip. */
  function bridgeScene(id, br) {
    return {
      id, title: br.title, lead: 0.3, hold: 0.6,
      cues: (br.cues || [{ id: "b", say: br.say }]).map((c, i) => ({ id: c.id || "b" + i, say: c.say })),
      build(ctx) {
        const D = LX.draw, svg = ctx.svg;
        D.backdrop(svg);
        const kick = D.label(svg, 800, 300, br.kicker || "", { anchor: "middle", color: "embed", size: 15 });
        const title = D.text(svg, 800, 380, br.title, { size: 58, weight: 650, anchor: "middle" });
        const sub = br.sub ? D.text(svg, 800, 440, br.sub, { size: 24, anchor: "middle", color: "text-2" }) : null;
        const strip = br.stage ? D.journey(svg) : null;
        const first = ctx.cues[0].id;
        return t => {
          const p = ctx.p(t, first, 0, .25);
          D.fade(kick, p); D.fade(title, p); title.setAttribute("transform", `translate(0 ${(1 - p) * 12})`);
          if (sub) D.fade(sub, ctx.p(t, first, .1, .35));
          if (strip) strip.set(br.stage, ctx.span(t, 0, ctx.duration, LX.ease.linear));
        };
      },
    };
  }

  /** A cover: fully drawn from the very first frame, so it doubles as the poster.
      variant "short" | "main" | "full" shows how deep that version goes. */
  function coverScene(id, cv) {
    return {
      id, title: cv.title, lead: 0, hold: 0.8,
      cues: [{ id: "intro", say: cv.say }],
      build(ctx) {
        const D = LX.draw, svg = ctx.svg, el = LX.el, col = LX.col;
        D.backdrop(svg);
        const pulsers = [];
        D.label(svg, 80, 96, cv.kicker || "LLM Explained", { color: "embed", size: 15 });
        D.text(svg, 80, 168, cv.title, { size: 64, weight: 650 });
        D.text(svg, 80, 214, cv.sub || "", { size: 24, color: "text-2" });
        const strip = D.journey(svg, { x: 80, y: 770, w: 1440 });

        if (cv.variant === "short") {
          // one sentence, one choice: the whole idea in a single picture
          D.text(svg, 80, 420, "The cat sat on the", { size: 72, weight: 600 });
          const chip = D.tokenChip(svg, { x: 790, y: 352, w: 210, h: 92, text: " mat", color: "logit", size: 50 });
          chip.glow(true);
          [["floor", .17], ["sofa", .05], ["moon", .002]].forEach(([w, p], i) =>
            D.text(svg, 1060 + i * 150, 412 - i * 8, w, { mono: true, size: 30 - i * 5, color: "muted", opacity: .75 - i * .2 }));
          D.text(svg, 80, 560, "Tokenize · embed · refine through many layers · score every option · pick one · repeat", { size: 26, color: "text-2" });
          pulsers.push(t => chip.box.setAttribute("stroke-width", 1.5 + .8 * (0.5 + 0.5 * Math.sin(t * 2))));
        }

        if (cv.variant === "main") {
          // tokens → stack → attention → bars, as small exact diagrams
          const toks = [["The", 760], [" cat", 7993], [" sat", 7338]];
          toks.forEach(([w, n], i) => D.tokenChip(svg, { x: 80, y: 300 + i * 110, w: 150, h: 60, text: w, id: n, size: 26 }));
          // 64-layer stack with the 3:1 pattern
          const sx = 330, sw = 300;
          for (let i = 0; i < 64; i++) {
            const attn = i % 4 === 3, y = 690 - i * 6.6;
            el("rect", { x: sx, y, width: sw, height: 4.6, rx: 1, fill: LX.mix("bg", attn ? "attn" : "delta", attn ? .75 : .45) }, svg);
          }
          D.label(svg, sx, 262, "64 layers · 3 : 1 pattern", { size: 13 });
          const pulse = el("rect", { x: sx - 4, y: 0, width: sw + 8, height: 10, rx: 3, fill: col("embed"), opacity: .5, filter: "url(#lx-glow)" }, svg);
          pulsers.push(t => { const k = (t * 14) % 64; pulse.setAttribute("y", 690 - k * 6.6 - 2.7); });
          // attention heatmap (causal), computed from tiny vectors
          const hx = 720, hy = 300, c = 52, q = [[1, 0], [0, 1], [1, 1], [2, 1]], kk = q;
          D.label(svg, hx, 280, "attention weights", { size: 13 });
          q.forEach((qi, r) => {
            const sc = kk.map((kj, j) => j <= r ? (qi[0] * kj[0] + qi[1] * kj[1]) / Math.SQRT2 : -Infinity);
            const m = Math.max(...sc), ex = sc.map(v => Math.exp(v - m)), z = ex.reduce((a, b) => a + b, 0);
            ex.forEach((e, j) => el("rect", { x: hx + j * (c + 4), y: hy + r * (c + 4), width: c, height: c, rx: 4,
              fill: j <= r ? LX.mix("panel", "attn", .15 + .85 * e / z) : col("panel"), stroke: col("line"), "stroke-width": 1 }, svg));
          });
          // next-token probabilities
          D.label(svg, 1040, 280, "next token", { size: 13 });
          const bars = D.bars(svg, { x: 1040, y: 330, w: 420, row: 66, items: [[" mat", .38], [" floor", .17], [" couch", .09], [" bed", .06], [" sofa", .05]] });
          bars.grow(1);
        }

        if (cv.variant === "full") {
          // a mosaic of every chapter, coloured by the step it belongs to
          const tint = { tokens: "token", embeddings: "embed", layer: "delta", attention: "attn", deltanet: "delta", mlp: "mlp", qwen: "delta",
            output: "logit", sampling: "logit", "prefill-decode": "cache", "kv-cache": "cache", mtp: "mtp", vision: "vision", hardware: "norm" };
          const chs = [...LX.chapters].sort((a, b) => a.num - b.num);
          const cols = 6, tw = 228, th = 92, gx = 12, gy = 12, x0 = 80, y0 = 262;
          chs.forEach((ch, i) => {
            const x = x0 + (i % cols) * (tw + gx), y = y0 + Math.floor(i / cols) * (th + gy), k = tint[ch.id] || "embed";
            el("rect", { x, y, width: tw, height: th, rx: 8, fill: LX.mix("bg", k, .14), stroke: col(k), "stroke-width": 1.2 }, svg);
            D.text(svg, x + 14, y + 28, String(ch.num).padStart(2, "0"), { mono: true, size: 14, color: k });
            const tt = D.text(svg, x + 14, y + 58, (ch.toc || ch.title).replace(/<[^>]+>/g, ""), { size: 17, weight: 600 });
            for (let fs = 17; fs > 12 && tt.getComputedTextLength() > tw - 26; fs -= 0.5) tt.setAttribute("font-size", fs);
            const n = (ch.body || []).filter(b => b.scene).length;
            D.text(svg, x + 14, y + 80, n + " scene" + (n === 1 ? "" : "s"), { mono: true, size: 12, color: "muted" });
          });
          const facts = [["27.8 B", "parameters"], ["64", "layers"], ["248,320", "tokens in the vocabulary"], ["51 B", "operations per token"]];
          facts.forEach(([v, l], i) => {
            D.text(svg, 80 + i * 360, 630, v, { size: 46, weight: 650, color: "embed" });
            D.text(svg, 80 + i * 360, 664, l, { size: 18, color: "text-2" });
          });
        }

        return t => {
          strip.set(LX.STAGES[Math.floor(t / 1.6) % LX.STAGES.length].key, (t / 1.6) % 1);
          pulsers.forEach(f => f(t));
        };
      },
    };
  }

  /** Resolve a scene id from chapters or story scenes. */
  function sceneById(id) {
    return LX.storyScenes[id] || (LX.findScene && LX.findScene(id));
  }

  /**
   * Compose several scenes into one. Each child is built into its own nested
   * <svg>, keeps its own cue timing (and voice timings), and is shown only
   * while it plays, with a short cross-fade.
   */
  LX.compose = function (id, title, children) {
    const XF = 0.5;  // cross-fade seconds
    // Pre-compute child timelines without building (duration + cues).
    const plan = [];
    let off = 0;
    children.forEach(ch => {
      const tmp = LX.makeContext(document.createElementNS("http://www.w3.org/2000/svg", "svg"), ch);
      plan.push({ scene: ch, offset: off, duration: tmp.duration, cues: tmp.cues });
      off += tmp.duration;
    });
    const cues = [];
    plan.forEach(pl => pl.cues.forEach(c => cues.push({
      id: pl.scene.id + "/" + c.id, say: c.say, show: c.show, at: pl.offset + c.start, dur: c.dur,
      src: { scene: pl.scene.id, cue: c.id },
    })));
    return {
      id, title, cues, duration: off, lead: 0, composite: true,
      build(ctx) {
        // one shared backdrop + defs first, so url(#lx-glow) always resolves to a visible filter
        LX.draw.backdrop(ctx.svg, { grid: false });
        const layers = plan.map(pl => {
          const nested = LX.el("svg", { x: 0, y: 0, width: LX.W, height: LX.H, viewBox: `0 0 ${LX.W} ${LX.H}`, display: "none" }, ctx.svg);
          return { ...pl, nested, update: null };
        });
        const ensure = L => { if (!L.update) L.update = L.scene.build(LX.makeContext(L.nested, L.scene)); };
        // build upcoming scenes ahead of time, off the playback path, so a scene change never stalls
        const idle = window.requestIdleCallback || (fn => setTimeout(fn, 30));
        const prebuild = i => {
          const L = layers[i];
          if (!L || L.update || L.queued) return;
          L.queued = true;
          idle(() => {
            if (L.update) return;
            const wasHidden = L.nested.getAttribute("display") === "none";
            L.nested.setAttribute("display", "inline"); L.nested.setAttribute("visibility", "hidden");
            ensure(L); L.update(0);
            L.nested.setAttribute("visibility", "visible");
            if (wasHidden) L.nested.setAttribute("display", "none");
          });
        };
        let lastActive = -1;
        return t => {
          let active = layers.findIndex(L => t >= L.offset && t < L.offset + L.duration);
          if (active < 0) active = t <= 0 ? 0 : layers.length - 1;
          prebuild(active + 1); prebuild(active + 2);
          layers.forEach((L, i) => {
            const local = t - L.offset;
            const show = i === active || (i === active - 1 && t - layers[active].offset < XF);
            if (!show) { if (L.nested.getAttribute("display") !== "none") L.nested.setAttribute("display", "none"); return; }
            L.nested.setAttribute("display", "inline");   // visible before building, so text can be measured
            ensure(L);
            L.update(Math.max(0, Math.min(local, L.duration)));
            const fadeIn = i === active && i > 0 ? Math.min(1, local / XF) : 1;
            L.nested.setAttribute("opacity", fadeIn);
          });
          lastActive = active;
        };
      },
    };
  };

  /** Build the composite scene for a story definition. */
  LX.storyAsScene = function (story) {
    const kids = [];
    story.items.forEach((it, i) => {
      if (typeof it === "string") {
        const sc = sceneById(it);
        if (!sc) console.warn("LX story", story.id, ": unknown scene", it);
        else if (!sc.build) console.warn("LX story", story.id, ": scene not built yet", it);
        else kids.push(sc);
      } else if (it.bridge) kids.push(bridgeScene(story.id + "-b" + i, it.bridge));
      else if (it.cover) kids.push(coverScene(story.id + "-cover", it.cover));
    });
    return LX.compose("story-" + story.id, story.title, kids);
  };

  /** Start-page player with level tabs. */
  LX.mountStories = function (host) {
    const stories = [...LX.stories].sort((a, b) => a.level - b.level);
    if (!stories.length) return;
    host.innerHTML = `<div class="lx-story">
        <div class="lx-story-head">
          <div><div class="lx-kicker">Watch the whole story</div><h2>Choose your depth</h2></div>
          <div class="lx-story-tabs" role="tablist">${stories.map((s, i) => `<button role="tab" data-i="${i}" aria-selected="${i === 0}"><b>${s.title}</b><span>${s.sub || ""}</span></button>`).join("")}</div>
        </div>
        <div class="lx-story-stage"></div>
      </div>`;
    const stage = host.querySelector(".lx-story-stage");
    const cache = {};
    let current = null;
    const select = i => {
      host.querySelectorAll(".lx-story-tabs button").forEach(b => b.setAttribute("aria-selected", String(+b.dataset.i === i)));
      if (current) current.pause && current.pause();
      stage.innerHTML = "";
      const div = document.createElement("div");
      stage.appendChild(div);
      const s = stories[i];
      const missing = s.items.filter(it => typeof it === "string" && !(sceneById(it) || {}).build);
      if (missing.length) {
        // not all animations exist yet: show the narration script for review
        div.className = "lx-script";
        const scenes = s.items.filter(it => typeof it === "string").map(sceneById).filter(Boolean);
        div.innerHTML = `<div class="lx-script-head"><b>${s.title}</b><span class="state">script · ${missing.length} of ${scenes.length} animations not built yet</span></div>`
          + scenes.map(sc => `<div class="lx-script-visual"><b>${sc.title}</b>${sc.build ? " · animated" : ""}</div><ol>${sc.cues.map(c => `<li>${c.say}${c.vis ? `<span class="vis">${c.vis}</span>` : ""}</li>`).join("")}</ol>`).join("");
        current = null;
        return;
      }
      cache[s.id] = cache[s.id] || LX.storyAsScene(s);
      current = LX.mountScene(div, cache[s.id], { autoplay: false, poster: "start" });
    };
    host.querySelectorAll(".lx-story-tabs button").forEach(b => (b.onclick = () => select(+b.dataset.i)));
    select(0);
  };
})();
