/* ==========================================================================
   LX engine — chapters, scenes, timeline, player, glossary.

   A scene is a deterministic function of time: build(ctx) creates the SVG
   once and returns update(t). Nothing in update() may depend on wall-clock
   or randomness, so any frame can be rendered at any time (the video
   renderer seeks frame by frame).

   Timing is expressed in *cues*. Each cue is one narration beat. Animations
   address time relative to a cue (ctx.p(t, "cueId", from, to)), so when real
   voice-over replaces the estimated durations, every animation stretches to
   fit automatically.
   ========================================================================== */
(function () {
  "use strict";
  const LX = (window.LX = window.LX || {});
  LX.chapters = [];
  LX.widgets = {};
  LX.timings = LX.timings || {};          // { sceneId: { cueId: seconds } } — filled by voice-over step
  LX.audio = LX.audio || {};              // { sceneId: { cueId: "url" } }   — filled by voice-over step
  LX.W = 1600; LX.H = 900;                // stage coordinate system (16:9)

  LX.chapter = def => LX.chapters.push(def);
  LX.widget = (id, mount) => (LX.widgets[id] = mount);

  /* ------------------------------------------------------------------ math */
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  LX.clamp = clamp; LX.lerp = lerp;
  LX.ease = {
    linear: t => t,
    out: t => 1 - Math.pow(1 - t, 3),
    in: t => t * t * t,
    inOut: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    soft: t => -(Math.cos(Math.PI * t) - 1) / 2,
    back: t => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };
  /** Seeded PRNG (deterministic). */
  LX.rng = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  /* ---------------------------------------------------------------- colour */
  const cssCache = {};
  /** Resolve a theme token to a hex colour: LX.col("attn") -> "#a08cff". */
  LX.col = name => {
    if (name.startsWith("#")) return name;
    if (!(name in cssCache)) cssCache[name] = getComputedStyle(document.documentElement).getPropertyValue("--lx-" + name).trim();
    return cssCache[name];
  };
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  /** Mix two colours (names or hex). */
  LX.mix = (a, b, t) => {
    const A = hex(LX.col(a)), B = hex(LX.col(b));
    return "#" + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))).toString(16).padStart(2, "0")).join("");
  };
  /** Diverging colour for a value in [-1, 1]. */
  LX.valueColor = v => (v < 0 ? LX.mix("zero", "neg", Math.min(1, -v)) : LX.mix("zero", "pos", Math.min(1, v)));

  /* --------------------------------------------------------------- timeline */
  /** Estimated narration length: ~150 words per minute plus a breath. */
  LX.estimate = say => Math.max(2.2, say.trim().split(/\s+/).length / 2.5 + 0.7);

  function timeline(scene) {
    const over = LX.timings[scene.id] || {};
    let t = scene.lead ?? 0.6;
    const cues = scene.cues.map((c, i) => {
      const id = c.id || "c" + i;
      const dur = over[id] ?? c.dur ?? LX.estimate(c.say || "");
      const start = c.at ?? t;            // composite scenes place cues explicitly
      const cue = { ...c, id, start, dur, end: start + dur, index: i };
      t = start + dur;
      return cue;
    });
    return { cues, byId: Object.fromEntries(cues.map(c => [c.id, c])), duration: scene.duration ?? t + (scene.hold ?? 1.5) };
  }

  /* ------------------------------------------------------------------- SVG */
  const NS = "http://www.w3.org/2000/svg";
  /** el("rect", {x:1}, parent) — create an SVG element. */
  LX.el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  LX.attr = (e, attrs) => { for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  /** Build the per-scene context handed to build(). */
  function makeContext(svg, scene) {
    const tl = timeline(scene);
    const ctx = {
      svg, W: LX.W, H: LX.H, scene, ...tl,
      cue: id => tl.byId[id],
      /** progress 0..1 inside a cue; from/to are fractions of the cue */
      p(t, id, from = 0, to = 1, ease = LX.ease.out) {
        const c = tl.byId[id];
        if (!c) throw new Error(`Scene ${scene.id}: unknown cue "${id}"`);
        const a = c.start + c.dur * from, b = c.start + c.dur * to;
        return ease(clamp((t - a) / Math.max(1e-6, b - a)));
      },
      /** progress 0..1 between absolute seconds */
      span: (t, a, b, ease = LX.ease.out) => ease(clamp((t - a) / Math.max(1e-6, b - a))),
      /** true while cue is the active one */
      active: (t, id) => { const c = tl.byId[id]; return t >= c.start && t < c.end; },
    };
    return ctx;
  }

  LX.makeContext = makeContext;           // used by composite scenes (lx-story.js)

  /* ================================================================ Player */
  const ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  };
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  /** Subtitles (the narration text over the stage): off by default, one switch for every player, remembered. */
  LX.captionsOn = () => { try { return localStorage.getItem("lx-cc") === "1"; } catch (e) { return false; } };
  LX.setCaptions = on => {
    document.documentElement.classList.toggle("lx-cc-on", on);
    document.querySelectorAll(".lx-cc").forEach(b => b.setAttribute("aria-pressed", String(on)));
    try { localStorage.setItem("lx-cc", on ? "1" : "0"); } catch (e) {}
  };

  /** Fullscreen: the real API where it exists (desktop, Android, iPad), otherwise
      (iPhone Safari) a fixed overlay that fills the screen. */
  function toggleFull(host) {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) return (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    if (host.classList.contains("lx-pseudo-full")) {
      host.classList.remove("lx-pseudo-full"); document.documentElement.classList.remove("lx-noscroll"); return;
    }
    const req = host.requestFullscreen || host.webkitRequestFullscreen;
    if (req && document.fullscreenEnabled !== false && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
      const r = req.call(host);
      if (r && r.catch) r.catch(() => pseudo(host));
    } else pseudo(host);
  }
  function pseudo(host) {
    host.classList.add("lx-pseudo-full"); document.documentElement.classList.add("lx-noscroll");
  }
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") document.querySelectorAll(".lx-pseudo-full").forEach(h => { h.classList.remove("lx-pseudo-full"); document.documentElement.classList.remove("lx-noscroll"); });
  });

  /** Mount a scene into a host element. opts.chrome=false gives a bare stage (video). */
  LX.mountScene = function (host, scene, opts = {}) {
    const chrome = opts.chrome !== false;
    host.classList.add("lx-player");
    host.innerHTML = (chrome ? `<div class="lx-player-title"><b>${scene.title || ""}</b><span>scene · ${scene.id}</span></div>` : "")
      + `<div class="lx-stage">${chrome ? `<div class="lx-caption" aria-live="polite"></div>` : ""}</div>`
      + (chrome ? `
        <div class="lx-controls">
          <button class="lx-btn play" title="Play / pause (space)">${ICON.play}</button>
          <button class="lx-btn" data-a="prev" title="Previous step (←)">${ICON.prev}</button>
          <button class="lx-btn" data-a="next" title="Next step (→)">${ICON.next}</button>
          <div class="lx-scrub" tabindex="0" role="slider" aria-label="Timeline"><div class="track"></div><div class="fill"></div><div class="knob"></div></div>
          <span class="lx-time">0:00 / 0:00</span>
          <button class="lx-cc" title="Subtitles (narration text)" aria-pressed="false">CC</button>
          <button class="lx-speed" title="Playback speed">1×</button>
          <button class="lx-btn" data-a="restart" title="Restart">${ICON.restart}</button>
          <button class="lx-btn" data-a="full" title="Fullscreen">${ICON.full}</button>
        </div>` : "");

    const stage = host.querySelector(".lx-stage");
    let big = null;
    if (chrome) {
      big = document.createElement("button");
      big.className = "lx-bigplay"; big.type = "button"; big.setAttribute("aria-label", "Play");
      big.innerHTML = ICON.play;
      stage.appendChild(big);
    }
    const svg = LX.el("svg", { viewBox: `0 0 ${LX.W} ${LX.H}`, role: "img", "aria-label": scene.title || scene.id }, stage);
    const ctx = makeContext(svg, scene);
    const update = scene.build(ctx);
    const D = ctx.duration;

    let t = 0, playing = false, speed = 1, last = 0, raf = 0;
    const cap = host.querySelector(".lx-caption");
    const fill = host.querySelector(".fill"), knob = host.querySelector(".knob");
    const time = host.querySelector(".lx-time"), playBtn = host.querySelector(".play");
    let shownCue = -1;

    if (chrome) {
      const scrub = host.querySelector(".lx-scrub");
      ctx.cues.forEach(c => {
        const k = document.createElement("div");
        k.className = "tick"; k.style.left = (c.start / D * 100) + "%";
        scrub.appendChild(k);
      });
    }

    /* narration: one audio clip per cue. A single <audio> element is reused for the
       whole playback (mobile browsers only allow sound that a tap has unlocked), the next
       clip is prefetched, and while a clip plays it is the master clock for the animation. */
    const voiceEl = new Audio();
    voiceEl.preload = "auto";
    let voiceCue = -1;
    const clipFor = c => { const k = c.src || { scene: scene.id, cue: c.id }; return LX.audio[k.scene] && LX.audio[k.scene][k.cue]; };
    function stopVoice() { voiceEl.pause(); voiceCue = -1; }
    const warm = new Map();
    function prefetch(i) {
      const c = ctx.cues[i], u = c && clipFor(c);
      if (u && !warm.has(u)) { const a = new Audio(); a.preload = "auto"; a.src = u; warm.set(u, a); if (warm.size > 4) warm.delete(warm.keys().next().value); }
    }
    function startVoice(i) {
      const url = clipFor(ctx.cues[i]);
      voiceCue = i;
      if (!url) { voiceEl.pause(); return; }
      const late = t - ctx.cues[i].start;
      if (!voiceEl.src.endsWith(url)) voiceEl.src = url;
      voiceEl.playbackRate = speed;
      voiceEl.currentTime = late > 0.6 ? late : 0;     // small lateness: start the clip from its first word
      voiceEl.play().catch(() => {});
      prefetch(i + 1);
    }
    function syncVoice(prevT) {
      if (!playing || LX.muted) return;
      const i = ctx.cues.findIndex(c => prevT < c.start + .02 && t >= c.start - .02);
      if (i >= 0 && i !== voiceCue) startVoice(i);
    }
    /** While a clip is audibly advancing, take the time from it so picture follows voice.
        If the clip stalls (buffering, no audio device), the animation keeps its own clock. */
    let lastAT = -1, lastAWall = 0;
    function voiceClock(now) {
      if (voiceCue < 0 || voiceEl.paused || voiceEl.ended) return null;
      const at = voiceEl.currentTime;
      if (at !== lastAT) { lastAT = at; lastAWall = now; }
      if (!(at > 0) || now - lastAWall > 250) return null;
      const c = ctx.cues[voiceCue];
      const tv = c.start + at;
      return tv < c.end ? tv : null;
    }

    function render() {
      update(t);
      if (!chrome) return;
      const pct = (t / D * 100) + "%";
      fill.style.width = pct; knob.style.left = pct;
      time.textContent = `${fmt(t)} / ${fmt(D)}`;
      let ci = -1;
      ctx.cues.forEach((c, i) => { if (t >= c.start - .05) ci = i; });
      if (ci !== shownCue) {
        shownCue = ci;
        cap.innerHTML = ci < 0 ? "" : (ctx.cues[ci].show || ctx.cues[ci].say);
        LX.decorate(cap);
      }
    }
    function seek(x) { stopVoice(); t = clamp(x, 0, D); render(); }
    function frame(now) {
      if (!playing) return;
      const prevT = t;
      t += (now - last) / 1000 * speed; last = now;
      const tv = voiceClock(now);
      if (tv != null) {
        if (tv > t + 0.08) t = tv;            // picture behind the voice: catch up
        else if (tv < t - 0.08) t = prevT;    // picture ahead (clip just started): wait, never rewind
      }
      syncVoice(prevT);
      if (t >= D) { t = D; playing = false; setIcon(); }
      render();
      if (playing) raf = requestAnimationFrame(frame);
    }
    function setIcon() {
      if (playBtn) playBtn.innerHTML = playing ? ICON.pause : ICON.play;
      if (big) big.hidden = playing;
    }
    function play() {
      if (t >= D - .01) t = 0;
      playing = true; last = performance.now(); setIcon(); cancelAnimationFrame(raf);
      // resume the clip of the cue we are inside, if any
      const i = ctx.cues.findIndex(c => t >= c.start && t < c.end);
      if (i >= 0 && !LX.muted) startVoice(i);
      raf = requestAnimationFrame(frame);
    }
    function pause() { playing = false; setIcon(); cancelAnimationFrame(raf); stopVoice(); }
    function step(dir) {
      const starts = ctx.cues.map(c => c.start);
      if (dir > 0) seek(starts.find(s => s > t + .05) ?? D);
      else { const prev = starts.filter(s => s < t - .3); seek(prev.length ? prev[prev.length - 1] : 0); }
    }

    if (chrome) {
      playBtn.onclick = () => (playing ? pause() : play());
      big.onclick = () => play();
      host.querySelector('[data-a="prev"]').onclick = () => step(-1);
      host.querySelector('[data-a="next"]').onclick = () => step(1);
      host.querySelector('[data-a="restart"]').onclick = () => { seek(0); play(); };
      host.querySelector('[data-a="full"]').onclick = () => toggleFull(host);
      host.querySelector(".lx-cc").onclick = () => LX.setCaptions(!document.documentElement.classList.contains("lx-cc-on"));
      LX.setCaptions(LX.captionsOn());
      const sp = host.querySelector(".lx-speed"), speeds = [1, 1.5, 2, 0.5, 0.75];
      sp.onclick = () => { speed = speeds[(speeds.indexOf(speed) + 1) % speeds.length]; sp.textContent = speed + "×"; voiceEl.playbackRate = speed; };
      const scrub = host.querySelector(".lx-scrub");
      const toT = e => { const r = scrub.getBoundingClientRect(); return (e.clientX - r.left) / r.width * D; };
      scrub.addEventListener("pointerdown", e => {
        const wasPlaying = playing; pause(); seek(toT(e)); scrub.setPointerCapture(e.pointerId);
        const mv = ev => seek(toT(ev));
        const up = () => { scrub.removeEventListener("pointermove", mv); scrub.removeEventListener("pointerup", up); if (wasPlaying) play(); };
        scrub.addEventListener("pointermove", mv); scrub.addEventListener("pointerup", up);
      });
      host.tabIndex = 0;
      host.addEventListener("keydown", e => {
        if (e.key === " ") { e.preventDefault(); playing ? pause() : play(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      });
      // Poster = the finished frame (or the first, for stories). Playback only starts on a tap,
      // because narration needs one; it pauses when the player scrolls out of view.
      new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting && playing && !host.classList.contains("lx-pseudo-full")) pause(); }),
        { threshold: 0 }).observe(stage);
      seek(opts.poster === "start" ? 0 : D);
      setIcon();
    } else {
      seek(0);
    }
    return { seek, play, pause, duration: D, cues: ctx.cues, get t() { return t; } };
  };

  /* ============================================================== Glossary */
  let pop;
  function showPop(e) {
    const g = LX.glossary && LX.glossary[e.currentTarget.dataset.k];
    if (!g) return;
    pop = pop || document.body.appendChild(Object.assign(document.createElement("div"), { className: "lx-pop" }));
    pop.innerHTML = `<b>${g.full}</b>${g.def}${g.say ? `<br><i>say: ${g.say}</i>` : ""}`;
    const r = e.currentTarget.getBoundingClientRect();
    pop.style.left = Math.min(window.innerWidth - 360, Math.max(12, r.left)) + "px";
    pop.style.top = (r.bottom + 10) + "px";
    pop.classList.add("on");
  }
  const hidePop = () => pop && pop.classList.remove("on");
  window.addEventListener("scroll", hidePop, { passive: true });

  /** Wire <abbr> elements to the glossary. With expand=true, the first
      occurrence of each abbreviation inside `root` is written out in full. */
  LX.decorate = function (root, expand = false) {
    const seen = new Set();
    root.querySelectorAll("abbr").forEach(a => {
      const k = a.dataset.k || a.textContent.trim();
      const g = LX.glossary && LX.glossary[k];
      if (!g) { console.warn("LX: no glossary entry for", k); return; }
      a.dataset.k = k;
      a.classList.add("lx-abbr");
      a.removeAttribute("title");
      a.onmouseenter = showPop; a.onmouseleave = hidePop;
      a.onclick = e => { if (pop && pop.classList.contains("on") && pop.dataset.k === k) hidePop(); else { showPop(e); pop.dataset.k = k; } };
      if (expand && !seen.has(k) && !a.hasAttribute("data-short")) {
        seen.add(k);
        a.insertAdjacentHTML("afterend", ` <span class="lx-expand">(${g.full})</span>`);
      }
    });
  };
})();
