/* Revibing HCI, UIST 2026.
   No animation library. Everything here is plain DOM, CSS transitions and one
   requestAnimationFrame loop for the stroke, so any organizer can edit it
   without a build step. Every moving part obeys three rules: it stops when it
   scrolls out of view, it stops when the tab is hidden, and it holds a still
   frame when the visitor asks for reduced motion. */

(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Asset paths go through here. On the real site it hands back the path
     unchanged; the single-file preview build swaps in a data URI. */
  function asset(path) {
    return (window.__INLINE && window.__INLINE[path]) || path;
  }

  /* Small helper: run fn when el is on screen and the tab is visible, and call
     stop when either stops being true. Returns nothing; it just wires it up. */
  function whenVisible(el, start, stop) {
    var onScreen = false;
    function sync() {
      if (onScreen && !document.hidden) start(); else stop();
    }
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.2 }).observe(el);
    document.addEventListener("visibilitychange", sync);
    /* focus and pageshow are the safety net: in a frame, or coming back from
       the back button, a visibilitychange can go missing */
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
  }

  /* ---- visitor-selectable style, remembered between visits ---- */
  var page = document.getElementById("page");
  var STYLES = ["quiet", "studio"];
  var KEY = "revibe-style";

  function setStyle(name, remember) {
    if (STYLES.indexOf(name) < 0) name = STYLES[0];
    page.className = "page " + name;
    document.querySelectorAll(".styleswitch button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.style === name));
    });
    if (remember) { try { localStorage.setItem(KEY, name); } catch (e) {} }
  }
  try { setStyle(localStorage.getItem(KEY) || "quiet", false); } catch (e) { setStyle("quiet", false); }
  document.querySelectorAll(".styleswitch button").forEach(function (b) {
    b.addEventListener("click", function () { setStyle(b.dataset.style, true); });
  });

  /* ================= the hero visual =================
     A paper page on the left, and on the right the system that paper
     describes, rebuilt and running. The origin sequence plays once: the page
     straightens, a reading band crosses it and leaves two marks, then the
     application assembles a piece at a time. After that only the
     demonstration stroke repeats, and the Replay button plays the whole thing
     again on request. */

  var CONTROLS = [["Bold", "b"], ["Italic", "i"], ["Underline", "u"], ["Larger", "g"]];
  var CHECK = '<svg viewBox="0 0 12 12" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2 4.8 8.5 9.5 3.5"/></svg>';

  (function heroVisual() {
    var app = document.getElementById("rv-app");
    var wrapControls = document.getElementById("rv-controls");
    var ink = document.getElementById("rv-ink");
    var paper = document.getElementById("rv-paper");
    var sweep = document.getElementById("rv-sweep");
    var marks = [].slice.call(document.querySelectorAll(".rv-mark"));
    var figbox = document.querySelector(".rv-figbox");
    var statusEl = document.getElementById("rv-status");
    var word = document.getElementById("rv-word");
    var preview = document.querySelector(".rv-preview");
    if (!app || !wrapControls || !ink) return;

    /* build the controls */
    var lastMoved = 0;
    var switches = CONTROLS.map(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "rv-sw pending";
      b.setAttribute("role", "switch");
      b.setAttribute("aria-checked", "false");
      b.innerHTML = '<span class="lbl">' + c[0] + '</span><span class="box">' + CHECK + "</span>";
      b.addEventListener("click", function () {
        /* a drag that happens to end on a control is a stroke, not a click */
        var moved = lastMoved;
        lastMoved = 0;
        if (moved > 6) return;
        setControl(b, b.getAttribute("aria-checked") !== "true");
      });
      wrapControls.appendChild(b);
      return { el: b, cls: c[1] };
    });

    function setControl(el, on) {
      el.setAttribute("aria-checked", String(on));
      var cls = switches.filter(function (s) { return s.el === el; })[0].cls;
      word.classList.toggle(cls, on);
    }
    function clearControls() {
      switches.forEach(function (s) {
        s.el.setAttribute("aria-checked", "false");
        word.classList.remove(s.cls);
      });
    }

    /* the stroke */
    var NS = "http://www.w3.org/2000/svg";
    var path = document.createElementNS(NS, "path");
    path.setAttribute("class", "rv-stroke");
    ink.appendChild(path);

    var pts = [], boxes = [], drawing = false, gesture = null, onScreen = false;
    var ghostRaf = null, ghostOn = false, ghostRuns = 0;
    var idleTimer = null, seqTimers = [], done = false;

    function measure() {
      var base = app.getBoundingClientRect();
      ink.setAttribute("viewBox", "0 0 " + base.width + " " + base.height);
      boxes = switches.map(function (s) {
        var r = s.el.querySelector(".box").getBoundingClientRect();
        return { el: s.el, x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, hit: false };
      });
    }
    function render() {
      path.setAttribute("d", pts.length < 2 ? "" :
        "M" + pts.map(function (p) { return p.x.toFixed(1) + " " + p.y.toFixed(1); }).join(" L "));
    }
    function crossAt(p) {
      boxes.forEach(function (b) {
        var m = 3;
        if (b.hit) return;
        if (p.x > b.x - m && p.x < b.x + b.w + m && p.y > b.y - m && p.y < b.y + b.h + m) {
          b.hit = true;
          setControl(b.el, b.el.getAttribute("aria-checked") !== "true");
        }
      });
    }
    /* sample along the segment, so a fast drag cannot jump over a control */
    function crossSegment(a, b) {
      var steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (var i = 1; i <= steps; i++) {
        crossAt({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps });
      }
    }
    function pos(e) {
      var r = app.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    app.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancelToFinished();
      stopGhost();
      measure();
      gesture = { moved: 0, sw: e.target.closest ? e.target.closest(".rv-sw") : null };
      drawing = true;
      pts = [pos(e)];
      path.setAttribute("class", "rv-stroke");
      render();
      try { app.setPointerCapture(e.pointerId); } catch (err) {}
    });
    app.addEventListener("pointermove", function (e) {
      if (!drawing) return;
      var p = pos(e), prev = pts[pts.length - 1];
      var d = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (d < 2) return;
      gesture.moved += d;
      if (!gesture.sw || gesture.moved > 6) crossSegment(prev, p);
      pts.push(p);
      render();
    });
    function endStroke() {
      if (!drawing) return;
      drawing = false;
      lastMoved = gesture ? gesture.moved : 0;
      gesture = null;
      var tap = lastMoved < 6;
      if (tap) { pts = []; render(); }
      else setTimeout(function () { if (!drawing) { pts = []; render(); } }, 900);
      ghostRuns = 0;
      scheduleGhost(9000);
    }
    app.addEventListener("pointerup", endStroke);
    app.addEventListener("pointercancel", endStroke);

    /* the demonstration stroke: one line down through every control */
    function ghostPath() {
      var out = [];
      if (!boxes.length) return out;
      var cx = boxes[0].x + boxes[0].w / 2;
      var top = boxes[0].y - boxes[0].h * 1.6;
      var bottom = boxes[boxes.length - 1].y + boxes[boxes.length - 1].h * 2.2;
      var wobble = boxes[0].w * 0.5;
      for (var i = 0; i <= 70; i++) {
        var t = i / 70;
        out.push({ x: cx + Math.sin(t * 5.4) * wobble, y: top + t * (bottom - top) });
      }
      return out;
    }
    function runGhost() {
      idleTimer = null;
      if (REDUCED || !onScreen || document.hidden || drawing || !done) return;
      measure();
      clearControls();
      var trail = ghostPath(), i = 1;
      if (trail.length < 2) return;
      ghostOn = true;
      pts = [trail[0]];
      path.setAttribute("class", "rv-stroke ghost");
      (function step() {
        if (!ghostOn || document.hidden || !onScreen) { ghostRaf = null; return; }
        crossAt(trail[i]);
        pts.push(trail[i]);
        render();
        if (++i < trail.length) { ghostRaf = requestAnimationFrame(step); return; }
        ghostRaf = null;
        setTimeout(function () {
          if (!ghostOn) return;
          pts = []; render();
          /* every few strokes, build the whole thing again from the paper */
          if (++ghostRuns >= 3) { ghostRuns = 0; seqTimers.push(setTimeout(play, 2600)); return; }
          scheduleGhost(6500);
        }, 1500);
      })();
    }
    function stopGhost() {
      ghostOn = false;
      if (ghostRaf) { cancelAnimationFrame(ghostRaf); ghostRaf = null; }
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    function scheduleGhost(ms) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(runGhost, ms);
    }

    /* the origin sequence */
    function typeInto(el, text, then) {
      el.classList.add("busy");
      var i = 0;
      (function next() {
        if (document.hidden) { seqTimers.push(setTimeout(next, 250)); return; }
        el.textContent = text.slice(0, ++i);
        if (i < text.length) { seqTimers.push(setTimeout(next, 26)); return; }
        el.classList.remove("busy");
        if (then) seqTimers.push(setTimeout(then, 260));
      })();
    }
    function at(ms, fn) { seqTimers.push(setTimeout(fn, ms)); }

    function showAll() {
      paper.classList.add("up");
      sweep.classList.add("run");
      marks.forEach(function (m) { m.classList.add("on"); });
      figbox.classList.add("on");
      app.classList.remove("pending");
      preview.classList.remove("pending");
      switches.forEach(function (s) { s.el.classList.remove("pending"); });
    }
    function finish() {
      done = true;
      statusEl.classList.remove("busy");
      statusEl.textContent = "revibe running";
      measure();
      scheduleGhost(400);
    }
    /* if the visitor reaches for the demo mid-build, give it to them at once */
    function cancelToFinished() {
      if (done) return;
      seqTimers.forEach(clearTimeout);
      seqTimers = [];
      showAll();
      finish();
      stopGhost();
    }
    function reset() {
      seqTimers.forEach(clearTimeout);
      seqTimers = [];
      stopGhost();
      done = false;
      pts = []; render();
      clearControls();
      paper.classList.remove("up");
      sweep.classList.remove("run");
      marks.forEach(function (m) { m.classList.remove("on"); });
      figbox.classList.remove("on");
      app.classList.add("pending");
      preview.classList.add("pending");
      switches.forEach(function (s) { s.el.classList.add("pending"); });
      statusEl.classList.remove("busy");
      statusEl.textContent = " ";
    }
    function play() {
      reset();
      if (REDUCED) {
        showAll();
        done = true;
        statusEl.textContent = "revibe running";
        measure();
        /* a finished still frame: the stroke already drawn, three controls set */
        var trail = ghostPath();
        pts = trail.slice(0, Math.round(trail.length * 0.82));
        pts.forEach(crossAt);
        path.setAttribute("class", "rv-stroke ghost");
        render();
        return;
      }
      /* reading the paper takes most of the sequence, because that is the part
         the workshop is about. The interface then arrives a piece at a time. */
      at(150, function () { paper.classList.add("up"); });
      at(420, function () { sweep.classList.add("run"); });
      at(1150, function () { marks[0].classList.add("on"); });
      at(1450, function () { marks[1].classList.add("on"); });
      at(1750, function () { figbox.classList.add("on"); });
      at(2350, function () { marks[2].classList.add("on"); });
      at(2650, function () { marks[3].classList.add("on"); });
      at(700, function () {
        typeInto(statusEl, "reading the paper", function () {
          typeInto(statusEl, "extracting the figures", function () {
            typeInto(statusEl, "listing the controls", function () {
              typeInto(statusEl, "building the interface");
              at(80, function () { app.classList.remove("pending"); });
              switches.forEach(function (s, i) {
                at(220 + i * 140, function () { s.el.classList.remove("pending"); });
              });
              at(220 + switches.length * 140 + 80, function () { preview.classList.remove("pending"); });
              at(220 + switches.length * 140 + 420, finish);
            });
          });
        });
      });
    }

    window.addEventListener("resize", function () {
      stopGhost();
      measure();
      if (done && !REDUCED) scheduleGhost(1200);
    });

    /* the sequence waits for someone to actually be looking: on screen, and in
       a visible tab. Focus and pageshow are the safety net if a
       visibilitychange goes missing, as it can inside a frame. */
    var started = false;
    function tryStart() {
      if (started || !onScreen || document.hidden) return;
      started = true;
      play();
    }
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (!onScreen) { stopGhost(); return; }
      tryStart();
      if (done && !drawing) scheduleGhost(1800);
    }, { threshold: 0.2 }).observe(app);
    function onVisible() {
      if (document.hidden) { stopGhost(); return; }
      tryStart();
      if (done && !REDUCED && !drawing && onScreen) scheduleGhost(1500);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);
  })();

  /* ================= the ambient field =================
     One glyph per shelved system. Papers come back as running interfaces, and
     they come back in different shapes, because the ten systems in the paper
     were a node editor, a notebook, a video tool and more. The change moves as a
     wave across the hero, left to right: papers ahead of it, systems inside it,
     papers again behind. A few never come back at all. Hovering a paper revives
     it yourself. */

  var GLYPHS = [
    /* window with a sidebar */
    '<rect x="1" y="1" width="30" height="21" rx="2.5"/><path d="M1 6.5h30M11 6.5V22"/>' +
    '<path d="M14.5 11h13M14.5 14.5h9M14.5 18h13"/>',
    /* node canvas */
    '<rect x="1" y="1" width="30" height="21" rx="2.5"/>' +
    '<rect x="4.5" y="7" width="7" height="5" rx="1.2"/><rect x="20" y="4.5" width="7" height="5" rx="1.2"/>' +
    '<rect x="19" y="13.5" width="8" height="5" rx="1.2"/><path d="M11.5 9.5h8.5M11.5 10.5l7.5 5.5"/>',
    /* timeline */
    '<rect x="1" y="1" width="30" height="21" rx="2.5"/><path d="M1 6.5h30"/>' +
    '<path d="M4.5 14h23"/><path d="M8 11v6M15.5 11v6M23 11v6"/>',
    /* bar chart */
    '<rect x="1" y="1" width="30" height="21" rx="2.5"/><path d="M5 18h22"/>' +
    '<path d="M9 18v-6M14 18v-9M19 18v-4M24 18v-8"/>',
    /* two speech bubbles */
    '<rect x="1" y="1" width="30" height="21" rx="2.5"/>' +
    '<path d="M5 6h12v6H8l-3 3z"/><path d="M27 11h-9v6h6l3 3z"/>',
    /* table */
    '<rect x="1" y="1" width="30" height="21" rx="2.5"/><path d="M1 6.5h30"/>' +
    '<path d="M1 13h30M1 18h30M11 6.5V22M21 6.5V22"/>'
  ];
  var PAPER_GLYPH =
    '<svg width="20" height="27" viewBox="0 0 20 27" fill="none" class="hf-paper" stroke-width="1.25">' +
    '<rect x="1" y="1" width="18" height="25" rx="1.8"/>' +
    '<path d="M4.5 6.5h11M4.5 10h11M4.5 13.5h7M4.5 17h11M4.5 20.5h5"/></svg>';

  function sysGlyph(i) {
    return '<svg width="26" height="18" viewBox="0 0 32 23" fill="none" class="hf-sys" ' +
      'stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">' + GLYPHS[i % GLYPHS.length] + "</svg>";
  }

  (function heroField() {
    var host = document.getElementById("hero-field");
    if (!host) return;

    var grid = document.createElement("div");
    grid.className = "hf-grid hf-instant";
    host.appendChild(grid);

    var seed = 20261102;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }

    /* Enough glyphs to cover the hero, worked out from the measured grid rather
       than guessed, and capped so the page never builds thousands of nodes. */
    var CAP = 540;
    var cells = [];
    function need() {
      var probe = document.createElement("div");
      probe.className = "hf-cell";
      grid.appendChild(probe);
      var track = probe.getBoundingClientRect();
      var cw = Math.max(40, track.width + 24), ch = Math.max(36, track.height + 20);
      grid.removeChild(probe);
      var cols = Math.ceil(grid.clientWidth / cw);
      var rows = Math.ceil(grid.clientHeight / ch);
      return Math.min(CAP, Math.max(40, cols * rows));
    }
    function build(n) {
      for (var i = cells.length; i < n; i++) {
        var cell = document.createElement("div");
        cell.className = "hf-cell";
        cell.innerHTML = '<div class="hf-flip"><div class="hf-face front">' + PAPER_GLYPH +
          '</div><div class="hf-face back">' + sysGlyph(Math.floor(rnd() * GLYPHS.length)) + "</div></div>";
        /* a few never come back. That is the honest part of the picture. */
        if (rnd() < 0.07) cell.classList.add("stuck");
        /* they stay on their rows and columns; only the angle varies, the way a
           shelf of papers does */
        cell.style.transform = "rotate(" + (rnd() * 11 - 5.5).toFixed(1) + "deg)";
        cell.addEventListener("pointerenter", function (e) { flip(e.currentTarget); });
        cell.addEventListener("click", function (e) { flip(e.currentTarget); });
        grid.appendChild(cell);
        cells.push(cell);
      }
    }
    build(need());

    var order = [], head = 0, cols = 12, timer = null, running = false;

    /* a glyph that just changed is briefly brighter, which is what lets the eye
       follow the front of the wave and see that a hover landed */
    function mark(el) {
      el.classList.add("just");
      setTimeout(function () { el.classList.remove("just"); }, 900);
    }
    function revive(el, quiet) {
      if (el.classList.contains("stuck") || el.classList.contains("on")) return;
      el.classList.add("on");
      if (!quiet) mark(el);
    }
    function retire(el) {
      if (el.classList.contains("stuck") || !el.classList.contains("on")) return;
      el.classList.remove("on");
      mark(el);
    }
    /* the visitor's own move: papers become systems and systems become papers */
    function flip(el) {
      if (el.classList.contains("stuck")) return;
      if (el.classList.contains("on")) retire(el); else revive(el);
    }

    /* The order is column by column, left to right, with a slight downward tilt
       and a little jitter so the front is ragged rather than a straight edge.
       Walking it turns papers into systems in a wave that crosses the hero. */
    function plan() {
      cols = Math.max(4, Math.round(grid.clientWidth / Math.max(1, cells[0].offsetWidth + 24)));
      var live = cells.filter(function (c) { return !c.classList.contains("stuck"); });
      order = live.map(function (c) {
        return { el: c, key: c.offsetLeft + c.offsetTop * 0.22 + rnd() * 90 };
      }).sort(function (a, b) { return a.key - b.key; }).map(function (o) { return o.el; });
    }

    /* how much of the shelf is running at any moment: the width of the wave */
    function band() { return Math.max(1, Math.round(order.length * 0.34)); }

    function step() {
      var n = order.length;
      if (!n) return;
      /* enough glyphs per step that the front advances about a column every
         three seconds, which is slow enough to ignore and fast enough to see */
      var per = Math.max(2, Math.round(cols / 14));
      for (var i = 0; i < per; i++) {
        revive(order[head % n]);
        retire(order[(head - band() + n * 2) % n]);
        head++;
      }
    }

    function tick() {
      timer = null;
      if (!running || document.hidden) return;
      step();
      timer = setTimeout(tick, 420 + rnd() * 260);
    }

    function seedInstantly() {
      plan();
      /* quietly: the first paint should not flare a hundred glyphs at once */
      for (var i = 0; i < band(); i++) revive(order[i], true);
      head = band();
      /* the instant class is on the grid, so this lands without 100 flips */
      requestAnimationFrame(function () { grid.classList.remove("hf-instant"); });
    }

    seedInstantly();
    if (REDUCED) return;

    window.addEventListener("resize", function () {
      var n = need();
      if (n > cells.length) { build(n); plan(); }
    });
    whenVisible(grid, function () {
      running = true;
      if (!timer) timer = setTimeout(tick, 700);
    }, function () {
      running = false;
      clearTimeout(timer);
      timer = null;
    });
  })();

  /* ================= the grading wall =================
     The ten systems that were revibed. Spellburst, Vizability and XCreation
     reached a complete best run; the lowest best run in the paper was 80%.
     Per-test detail is a stand-in until the published rubrics are pulled from
     the paper's supplement, which the caption says. */

  var SYSTEMS = [
    ["Spellburst",      "100%", "10.1145/3586183.3606719"],
    ["VizAbility",      "100%", "10.1145/3654777.3676414"],
    ["XCreation",       "100%", "10.1145/3586183.3606826"],
    ["B2",              "",     "10.1145/3379337.3415851"],
    ["CoLadder",        "",     "10.1145/3654777.3676357"],
    ["EvalGen",         "",     "10.1145/3654777.3676450"],
    ["GenAssist",       "",     "10.1145/3586183.3606735"],
    ["mage",            "",     "10.1145/3379337.3415842"],
    ["Rescribe",        "",     "10.1145/3379337.3415864"],
    ["Sketch-n-Sketch", "",     "10.1145/3332165.3347925"]
  ];

  (function wall() {
    var host = document.getElementById("wall");
    if (!host) return;
    var seed = 7;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    SYSTEMS.forEach(function (s) {
      var complete = s[1] !== "";
      var cs = "";
      for (var i = 0; i < 14; i++) {
        var cls = "c";
        if (!complete) {
          var r = rnd();
          if (r > 0.93) cls += r > 0.975 ? " f" : " p";
        }
        cs += '<span class="' + cls + '"></span>';
      }
      var row = document.createElement("div");
      row.className = "wrow";
      row.innerHTML = '<a class="nm" href="https://doi.org/' + s[2] + '">' + s[0] +
        '</a><span class="cs">' + cs + '</span><span class="sc">' + s[1] + "</span>";
      host.appendChild(row);
    });
  })();

  /* ================= paper, and what came back =================
     Two cards. The front is the paper's real first page; the back holds the
     real screenshot of its reimplementation, taken from Figure 1 of the paper.
     The screenshot is landscape and the page is portrait, so the back frames
     the screenshot rather than cropping the card to fit it. Only one card
     turns at a time. */

  var PAIRS = [
    { name: "Spellburst", meta: "UIST 2023", tool: "Claude Code",
      doi: "10.1145/3586183.3606719",
      page: "assets/paper/spellburst-p1.jpg",
      shot: "assets/paper/revibe-spellburst-claude.jpg",
      alt: "First page of the Spellburst paper, UIST 2023.",
      shotAlt: "Spellburst reimplemented by Claude Code: a dark node canvas beside a code editor." },
    { name: "Rescribe", meta: "UIST 2020", tool: "Cursor",
      doi: "10.1145/3379337.3415864",
      page: "assets/paper/rescribe-p1.jpg",
      shot: "assets/paper/revibe-rescribe-cursor.jpg",
      alt: "First page of the Rescribe paper, UIST 2020.",
      shotAlt: "Rescribe reimplemented by Cursor: a video, a transcript with gaps, and a description pane." }
  ];

  (function cards() {
    var host = document.getElementById("cardrow");
    if (!host) return;

    var made = PAIRS.map(function (p) {
      var wrap = document.createElement("div");
      wrap.className = "card";
      wrap.innerHTML =
        '<div class="cd"><div class="cd-in">' +
          '<div class="cd-face f"><img src="' + asset(p.page) + '" alt="' + p.alt + '"></div>' +
          '<div class="cd-face b"><img src="' + asset(p.shot) + '" alt="' + p.shotAlt + '">' +
            '<span class="cd-lbl">Rebuilt by ' + p.tool + "</span></div>" +
        "</div></div>" +
        '<p class="cardcap"><a href="https://doi.org/' + p.doi + '"><b>' + p.name +
          "</b></a>, " + p.meta + ", and what " + p.tool + " built from it.</p>";
      host.appendChild(wrap);
      return wrap.querySelector(".cd");
    });

    if (REDUCED) { made[1].classList.add("flip"); return; }

    var turn = 0, timer = null, running = false;
    function tick() {
      timer = null;
      if (!running) return;
      made[turn % made.length].classList.toggle("flip");
      turn++;
      timer = setTimeout(tick, 4200);
    }
    whenVisible(host, function () {
      running = true;
      if (!timer) timer = setTimeout(tick, 1600);
    }, function () {
      running = false;
      clearTimeout(timer);
      timer = null;
    });
  })();

  /* ---- mean revibeability by tool ----
     From the paper: Cursor 0.914 (min 0.8), Claude Code 0.87 (min 0.53), Gemini
     0.67 (min 0.33), each a mean across every run rather than the best one. */
  var TOOLS = [["Cursor", 0.914], ["Claude Code", 0.87], ["Gemini", 0.67]];

  (function tools() {
    var host = document.getElementById("tools");
    if (!host) return;
    TOOLS.forEach(function (t) {
      var row = document.createElement("div");
      row.className = "trow";
      row.innerHTML = '<span class="nm">' + t[0] + '</span>' +
        '<span class="bar"><i style="width:' + Math.round(t[1] * 100) + '%"></i></span>' +
        '<span class="val">' + Math.round(t[1] * 100) + "%</span>";
      host.appendChild(row);
    });
  })();

  /* ---- one icon language for the whole page ----
     24 grid, stroke 1.5 everywhere, round caps and joins, everything inside a
     20 unit optical area, coordinates on the quarter grid. Drawn for this
     content rather than pulled from a generic set. See ICONS.md. */
  var I = {
    /* every glyph fills roughly x 2.5 to 21.5, y 3 to 21, so none of them reads
       as a small squashed mark next to the others */
    kinds:   '<rect x="3" y="3" width="18" height="8.5" rx="2"/><path d="M3 6.75h18"/>' +
             '<circle cx="7" cy="17.5" r="3.5"/>' +
             '<rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    spec:    '<rect x="4.5" y="2.75" width="15" height="18.5" rx="2"/>' +
             '<path d="M8 9 9.75 10.75 13.5 7"/>' +
             '<path d="M8 14.5h8M8 17.75h5"/>',
    compare: '<rect x="2.5" y="4" width="8.5" height="16" rx="2"/>' +
             '<rect x="13" y="4" width="8.5" height="16" rx="2"/>' +
             '<circle cx="6.75" cy="12" r="2"/>' +
             '<rect x="15.25" y="10" width="4" height="4" rx="1"/>',
    teach:   '<path d="M2.5 8.5 12 3.75l9.5 4.75L12 13.25z"/>' +
             '<path d="M6 11v5.5c0 1.75 2.7 3 6 3s6-1.25 6-3V11"/>',
    gap:     '<path d="M12 3.5H5A1.5 1.5 0 0 0 3.5 5v14A1.5 1.5 0 0 0 5 20.5h7"/>' +
             '<path d="M12 3.5h7A1.5 1.5 0 0 1 20.5 5v14a1.5 1.5 0 0 1-1.5 1.5h-7" stroke-dasharray="2 2.5"/>' +
             '<path d="M3.5 8.5h17"/>',
    endures: '<path d="M6.5 3.25h11M6.5 20.75h11"/>' +
             '<path d="M6.5 3.25c0 4.5 5.5 6.75 5.5 8.75s-5.5 4.25-5.5 8.75"/>' +
             '<path d="M17.5 3.25c0 4.5-5.5 6.75-5.5 8.75s5.5 4.25 5.5 8.75"/>',
    walk:    '<rect x="2.5" y="3.5" width="19" height="13.5" rx="2"/><path d="M2.5 7.75h19"/>' +
             '<path d="M12 17v3.5M8.75 20.5h6.5"/>' +
             '<path d="M11 10.5l4.5 1.5-1.75.75-.75 1.75z" fill="currentColor" stroke="none"/>',
    groups:  '<circle cx="6.75" cy="6.75" r="3.25"/><circle cx="17.25" cy="6.75" r="3.25"/>' +
             '<path d="M2 19.5c0-3 2.1-4.75 4.75-4.75S11.5 16.5 11.5 19.5"/>' +
             '<path d="M12.5 19.5c0-3 2.1-4.75 4.75-4.75S22 16.5 22 19.5"/>',
    remix:   '<circle cx="6" cy="4.5" r="2"/><circle cx="6" cy="19.5" r="2"/><circle cx="18" cy="12" r="2"/>' +
             '<path d="M6 6.5v11"/><path d="M6 12h10"/>' +
             '<path d="M13.5 9.25 16.25 12 13.5 14.75"/>',
    extend:  '<rect x="2.5" y="3.5" width="19" height="17" rx="2"/><path d="M2.5 8.25h19"/>' +
             '<path d="M12 11.5v5.5M9.25 14.25h5.5"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[name] + "</svg>";
  }

  /* ---- the six breakout themes ---- */
  var THEMES = [
    ["kinds",   "What gets revibed", "How revibeability shifts across systems, algorithms, datasets and techniques."],
    ["spec",    "Writing for revibeability", "What authors should share, and what that asks of open science."],
    ["compare", "Revibing as a research method", "Living baselines, rapid variations, and when a revibe is a valid comparison."],
    ["teach",   "Revibing as pedagogy", "From reimplementation assignments to revibe and extend projects."],
    ["gap",     "Limitations of revibeability", "Where revibes break down, and what negative effects follow."],
    ["endures", "Future of systems contributions", "What lasts in a systems paper when the system is cheap to rebuild."]
  ];
  var themes = document.getElementById("themes");
  if (themes) {
    THEMES.forEach(function (t) {
      var li = document.createElement("li");
      li.innerHTML = '<span class="ic">' + icon(t[0]) + "</span><b>" + t[1] + "</b><span>" + t[2] + "</span>";
      themes.appendChild(li);
    });
  }

  /* ---- the four beats of the live session, same icon language ---- */
  var STEPS = [
    ["walk",   "Walk through one paper", "Together, on the system nominated by participants."],
    ["groups", "Follow along in groups", "Two or three people to a revibe."],
    ["remix",  "Remix while it builds", "Variations on the classic paper that raise a fresh question."],
    ["extend", "Add your own extension", "The rest of the block is yours."]
  ];
  var steps = document.getElementById("steps");
  if (steps) {
    STEPS.forEach(function (t, i) {
      var li = document.createElement("li");
      li.innerHTML = '<span class="n">' + (i + 1) + '</span><span class="ic">' + icon(t[0]) +
        "</span><b>" + t[1] + "</b><span class=\"sd\">" + t[2] + "</span>";
      steps.appendChild(li);
    });
  }

  /* ---- organizing committee. Add a photo by dropping a file into
          assets/photos and putting its name in the fourth slot. ---- */
  var CREW = [
    ["Yoonjoo Lee", "University of Michigan", "https://yoonjoolee.com/", "yoonjoo-lee"],
    ["Tae Soo Kim", "KAIST", "https://taesookim.com/", "tae-soo-kim"],
    ["Kevin Pu", "University of Toronto", "https://kevinpjk.github.io/", "kevin-pu"],
    ["Mira Dontcheva", "Adobe Research", "https://research.adobe.com/person/mira-dontcheva/", "mira-dontcheva"],
    ["Bjoern Hartmann", "UC Berkeley", "https://people.eecs.berkeley.edu/~bjoern/", "bjoern-hartmann"],
    ["Toby Jia-Jun Li", "University of Notre Dame", "https://toby.li/", "toby-li"],
    ["Brad A Myers", "Carnegie Mellon University", "https://www.cs.cmu.edu/~bam/", "brad-myers"],
    ["Jeffrey Nichols", "Apple", "http://www.jeffreynichols.com/", "jeffrey-nichols"],
    ["April Yi Wang", "ETH Zurich", "https://aprilwang.me/", "april-wang"],
    ['Xuhai "Orson" Xu', "Columbia University", "https://orsonxu.com/", "orson-xu"],
    ["Eytan Adar", "University of Michigan", "https://www.cond.org/", "eytan-adar"]
  ];
  function fillCrew(host, people, leadCount) {
    if (!host) return;
    people.forEach(function (m, i) {
      var words = m[0].replace(/"[^"]*"/g, "").trim().split(/\s+/).filter(function (w) { return /^[A-Z]/.test(w); });
      var initials = words[0][0] + words[words.length - 1][0];
      var el = document.createElement("div");
      el.className = i < leadCount ? "p lead" : "p";
      var av = m[3]
        ? '<span class="av has-photo" style="background-image:url(' + asset("assets/photos/" + m[3] + ".jpg") + ')" aria-hidden="true">' + initials + "</span>"
        : '<span class="av" aria-hidden="true">' + initials + "</span>";
      el.innerHTML = av + '<span><a class="nm" href="' + m[2] + '">' + m[0] + "</a>" +
        '<span class="af">' + m[1] + "</span></span>";
      host.appendChild(el);
    });
  }
  /* the first three lead the workshop and take the top row on their own */
  fillCrew(document.getElementById("crew"), CREW, 3);

  /* ---- the application form. One place to change when the URL exists. ---- */
  var APPLY_URL = "https://uist.acm.org/2026/attending/#registration";
  if (APPLY_URL) {
    document.querySelectorAll("[data-apply]").forEach(function (a) { a.href = APPLY_URL; });
  }

  /* ---- links that leave the page open in a new tab ----
     Runs last, so it catches the committee, the wall, the cards and the apply
     buttons as well as the markup. Anchors within the page are left alone. */
  document.querySelectorAll("a[href]").forEach(function (a) {
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    a.target = "_blank";
    a.rel = "noopener";
  });
})();
