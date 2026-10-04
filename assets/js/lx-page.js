/* ==========================================================================
   LX page — builds the course from the chapter definitions registered with
   LX.chapter(). One chapter is shown at a time (hash routing: #<chapter-id>);
   the start page shows a card per chapter.

   Chapter definition:
   {
     id, num, title, toc?,            // toc = shorter title for the contents list
     kicker, lede,
     body: [                          // blocks, in order
       { prose: "<p>html</p>" },      // Overview text (always visible)
       { deep:  "<p>html</p>" },      // "Deeper · the math" (fold-out; hidden in Overview mode)
       { note:  "html" },             // side remark
       { scene: { id, title, cues:[{id, say, vis?}], visual?, build? } },
       { widget:{ id, title, plan } } // interactive element (LX.widget(id, mount))
     ]
   }
   A scene without build() is shown as a script card (narration + what is on screen).
   Scenes are mounted the first time their chapter is shown.
   ========================================================================== */
(function () {
  "use strict";
  const pad = n => String(n).padStart(2, "0");

  function sceneBlock(scene) {
    const host = document.createElement("div");
    if (scene.deep) {
      // a worked example that belongs to the "Deeper" level
      const wrap = document.createElement("div");
      wrap.className = "lx-deep-scene";
      wrap.innerHTML = `<div class="lx-deep-scene-label">Deeper · worked example, animated</div>`;
      const inner = sceneBlock({ ...scene, deep: false });
      wrap.appendChild(inner);
      wrap.__inner = inner;
      return wrap;
    }
    if (scene.build) {
      host.className = "lx-player lx-pending";
      host.__mount = () => { host.classList.remove("lx-pending"); LX.mountScene(host, scene); };
      return host;
    }
    host.className = "lx-script";
    host.innerHTML = `
      <div class="lx-script-head"><b>${scene.title || scene.id}</b><span><span class="state">script · animation not built yet</span> · ${scene.id}</span></div>
      ${scene.visual ? `<div class="lx-script-visual">${scene.visual}</div>` : ""}
      <ol>${scene.cues.map(c => `<li>${c.say}${c.vis ? `<span class="vis">${c.vis}</span>` : ""}</li>`).join("")}</ol>`;
    return host;
  }

  function widgetBlock(w) {
    const host = document.createElement("div");
    host.className = "lx-widget";
    if (LX.widgets[w.id]) {
      host.innerHTML = `<h4>${w.title}</h4>${w.sub ? `<p class="sub">${w.sub}</p>` : ""}<div class="lx-widget-body"></div>`;
      host.__mount = () => LX.widgets[w.id](host.querySelector(".lx-widget-body"));
    } else host.innerHTML = `<h4>${w.title} <span class="c-cache mono" style="font-size:12px">· interactive, not built yet</span></h4><p class="sub" style="margin:0">${w.plan || ""}</p>`;
    return host;
  }

  /** Narration minutes for a chapter (estimated until voice-over exists). */
  function minutes(ch) {
    let s = 0;
    for (const b of ch.body || []) if (b.scene) for (const c of b.scene.cues) s += LX.estimate(c.say || "");
    return Math.max(1, Math.round(s / 60));
  }
  const sceneCount = ch => (ch.body || []).filter(b => b.scene).length;
  const deepCount = ch => (ch.body || []).filter(b => b.deep != null).length;

  function chapterEl(ch, i, all) {
    const sec = document.createElement("section");
    sec.className = "lx-chapter"; sec.id = ch.id; sec.hidden = true;
    const meta = ch.id === "glossary" ? "" :
      `<div class="lx-chapter-meta">Chapter ${ch.num} of ${all.length - 1} · ${sceneCount(ch)} animation${sceneCount(ch) === 1 ? "" : "s"} · about ${minutes(ch)} min</div>`;
    sec.innerHTML = `<header>
        <div class="lx-kicker">Chapter ${pad(ch.num)}${ch.kicker ? " · " + ch.kicker : ""}</div>
        <h2>${ch.title}</h2>
        ${ch.lede ? `<p class="lx-lede">${ch.lede}</p>` : ""}
        ${meta}
      </header>`;
    for (const b of ch.body || []) {
      if (b.prose != null) sec.insertAdjacentHTML("beforeend", `<div class="lx-prose">${b.prose}</div>`);
      else if (b.deep != null) {
        const h = (b.deep.match(/<h3>(.*?)<\/h3>/) || [])[1];
        sec.insertAdjacentHTML("beforeend", `<details class="lx-deep"><summary><span class="lab">Deeper · the math</span>${h ? `<span class="what">${h.replace(/<[^>]+>/g, "")}</span>` : ""}<span class="chev" aria-hidden="true"></span></summary><div class="lx-prose">${b.deep}</div></details>`);
      }
      else if (b.note != null) sec.insertAdjacentHTML("beforeend", `<div class="lx-note">${b.note}</div>`);
      else if (b.scene) sec.appendChild(sceneBlock(b.scene));
      else if (b.widget) sec.appendChild(widgetBlock(b.widget));
      else if (b.html != null) sec.insertAdjacentHTML("beforeend", b.html);
    }
    // previous / next
    const prev = all[i - 1], next = all[i + 1];
    const card = (c, dir) => c ? `<a class="lx-pn ${dir}" href="#${c.id}"><span class="dir">${dir === "prev" ? "← Previous" : "Next →"}</span><span class="t"><span class="n">${pad(c.num)}</span>${c.toc || c.title}</span></a>`
                                 : `<a class="lx-pn ${dir}" href="#home"><span class="dir">${dir === "prev" ? "← Back" : "Done"}</span><span class="t">All chapters</span></a>`;
    sec.insertAdjacentHTML("beforeend", `<nav class="lx-pager" aria-label="Chapter navigation">${card(prev, "prev")}${card(next, "next")}</nav>`);
    return sec;
  }

  function glossaryChapter(num) {
    const items = Object.entries(LX.glossary).sort((a, b) => a[0].localeCompare(b[0], "en", { sensitivity: "base" }));
    return {
      id: "glossary", num, title: "Glossary", toc: "Glossary", kicker: "Every abbreviation, written out",
      lede: "Hover or tap any dotted abbreviation in the course to see its card. Here they all are in one place.",
      body: [{ html: `<dl class="lx-gloss">${items.map(([k, g]) => `<div><dt>${k}</dt><dd><span class="full">${g.full}</span><br>${g.def}<br><span class="say">say: “${g.say}”</span></dd></div>`).join("")}</dl>` }],
    };
  }

  LX.buildPage = function () {
    const chapters = [...LX.chapters].sort((a, b) => a.num - b.num);
    chapters.push(glossaryChapter(chapters.length ? chapters[chapters.length - 1].num + 1 : 1));
    const byId = new Map(chapters.map(c => [c.id, c]));

    // contents
    const toc = document.querySelector(".lx-toc ol");
    toc.innerHTML = chapters.map(c => `<li><a href="#${c.id}"><span class="n">${pad(c.num)}</span><span>${c.toc || c.title}</span></a></li>`).join("");
    const links = new Map([...toc.querySelectorAll("a")].map(a => [a.getAttribute("href").slice(1), a]));

    // start page: chapter cards
    const home = document.querySelector(".lx-home");
    home.insertAdjacentHTML("beforeend", `<div class="lx-cards">${chapters.map(c => `
      <a class="lx-card" href="#${c.id}">
        <span class="n">${pad(c.num)}</span>
        <span class="t">${c.toc || c.title}</span>
        ${c.lede ? `<span class="d">${c.lede}</span>` : ""}
        ${c.id === "glossary" ? "" : `<span class="m">${sceneCount(c)} animation${sceneCount(c) === 1 ? "" : "s"} · ~${minutes(c)} min</span>`}
      </a>`).join("")}</div>`);

    // the whole story, at several depths
    const storyHost = document.querySelector(".lx-stories");
    if (storyHost && LX.mountStories) LX.mountStories(storyHost);

    // chapters (hidden until routed to)
    const main = document.querySelector(".lx-main");
    const sections = new Map();
    chapters.forEach((c, i) => {
      const el = chapterEl(c, i, chapters);
      main.appendChild(el);
      LX.decorate(el, true);
      LX.mathHelp && LX.mathHelp(el);
      sections.set(c.id, el);
    });

    // router
    const shell = document.querySelector(".lx-shell");
    function show(id, focusTop = true) {
      const ch = byId.get(id);
      home.hidden = !!ch;
      sections.forEach((el, k) => (el.hidden = k !== id));
      links.forEach(a => a.classList.remove("active"));
      if (ch) {
        links.get(id)?.classList.add("active");
        const el = sections.get(id);
        if (!el.__mounted) { el.__mounted = true; el.querySelectorAll(".lx-player.lx-pending, .lx-widget").forEach(h => h.__mount && h.__mount()); }
        document.title = `${ch.toc || ch.title} · LLM Explained`;
      } else document.title = "LLM Explained";
      shell.classList.remove("toc-open");
      if (focusTop) window.scrollTo({ top: 0, behavior: "instant" });
    }
    function route() {
      const raw = decodeURIComponent(location.hash.slice(1));
      if (byId.has(raw)) return show(raw);
      // an anchor inside a chapter, e.g. #some-element
      const target = raw && document.getElementById(raw);
      const sec = target && target.closest(".lx-chapter");
      if (sec) { show(sec.id, false); target.scrollIntoView(); return; }
      show(null);
    }
    window.addEventListener("hashchange", route);
    route();

    // mobile: contents as a fold-out
    document.querySelector(".lx-toc-toggle")?.addEventListener("click", () => shell.classList.toggle("toc-open"));

    // level switch (Overview / Deeper), remembered per viewer
    const KEY = "lx-level";
    let level = "deeper";
    try { level = localStorage.getItem(KEY) || level; } catch (e) {}
    const hint = document.querySelector(".lx-level-hint");
    const totalDeep = chapters.reduce((n, c) => n + deepCount(c), 0);
    const setLevel = l => {
      level = l; document.body.dataset.level = l;
      document.querySelectorAll(".lx-level button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.level === l)));
      if (hint) hint.textContent = l === "overview"
        ? `Math hidden: ${totalDeep} “Deeper” boxes are tucked away. Switch to Deeper to see them.`
        : `Math shown as fold-out “Deeper” boxes (${totalDeep} in total). Tap one to open it.`;
      try { localStorage.setItem(KEY, l); } catch (e) {}
    };
    document.querySelectorAll(".lx-level button").forEach(b => (b.onclick = () => setLevel(b.dataset.level)));
    setLevel(level);
  };

  /** Find a scene definition by id across all chapters. */
  LX.findScene = id => {
    for (const ch of LX.chapters) for (const b of ch.body || []) if (b.scene && b.scene.id === id) return b.scene;
    if (LX.storyScenes && LX.storyScenes[id]) return LX.storyScenes[id];
    const st = LX.stories && LX.stories.find(s => "story-" + s.id === id);
    if (st) return LX.storyAsScene(st);
    return null;
  };
})();
