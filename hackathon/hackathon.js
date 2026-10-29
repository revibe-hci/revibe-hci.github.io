/* The hackathon page: copy a block to the clipboard, and open or close a long
   prompt. The page reads fine without it. */

(function () {
  "use strict";

  /* Where the workshop repository will live. Until it is public the page shows
     a placeholder. */
  var REPO_URL = "https://github.com/revibe-hci/uist2026-workshop.git";

  if (REPO_URL) {
    document.querySelectorAll("[data-repo]").forEach(function (el) { el.textContent = REPO_URL; });
  }

  /* The workshop's FigJam board. Until it is set, the button is hidden and
     in-text mentions stay plain text. */
  var FIGJAM_URL = "";

  document.querySelectorAll("[data-figjam]").forEach(function (a) {
    if (FIGJAM_URL) { a.href = FIGJAM_URL; return; }
    if (a.classList.contains("btn")) { a.hidden = true; return; }
    a.replaceWith(document.createTextNode(a.textContent));
  });

  /* Presenting to the room: the page as slides, one section or step each,
     scaled so every slide fits the screen. Press P (outside a text field) or
     add ?present to the address; arrows or space to move, Esc to leave. */
  var deck = null, at = 0;

  function slides() {
    var $$ = function (sel) { return [].slice.call(document.querySelectorAll(sel)); };
    var setup = $$("#setup .wrap > *"), part = [[], [], []], n = -1;
    setup.forEach(function (el) {
      if (el.tagName === "H3") {
        var t = el.textContent;
        n = /Who You Are|What You Need/.test(t) ? 0 : /Repository/.test(t) ? 1 : 2;
      }
      part[Math.max(n, 0)].push(el);
    });
    var list = [
      $$(".mhead .wrap > *"),
      $$("#papers .wrap > *"),
      part[0], part[1], part[2],
      $$("#steps .sec-head, #steps .glance")
    ];
    $$("#steps .step").forEach(function (el) { list.push([el]); });
    list.push($$("#rubric .sec-head").concat($$("#rubric .test").slice(0, 1)));
    list.push($$("#share .wrap > *"), $$("#remix .wrap > *"));
    return list.filter(function (l) { return l.length; });
  }

  function show(i) {
    var all = slides();
    at = Math.max(0, Math.min(i, all.length - 1));
    var stage = deck.querySelector(".stage");
    stage.innerHTML = "";
    stage.style.transform = "none";
    all[at].forEach(function (el) {
      var c = el.cloneNode(true);
      [c].concat([].slice.call(c.querySelectorAll("[id]"))).forEach(function (x) { x.removeAttribute("id"); });
      // a clone does not keep the chosen options, so copy them over
      var from = el.querySelectorAll("select"), to = c.querySelectorAll("select");
      for (var k = 0; k < from.length; k++) to[k].selectedIndex = from[k].selectedIndex;
      c.querySelectorAll("[hidden]").forEach(function (x) { x.remove(); });
      stage.appendChild(c);
    });
    var w = stage.offsetWidth, h = stage.offsetHeight;
    var scale = Math.min((innerWidth - 96) / w, (innerHeight - 110) / h, 1.8);
    stage.style.transform = "translate(-50%, 0) scale(" + scale + ")";
    stage.style.top = Math.max(24, (innerHeight - 40 - h * scale) / 2) + "px";
    deck.querySelector(".count").textContent = (at + 1) + " / " + all.length;
  }

  function present(on) {
    if (on && !deck) {
      deck = document.createElement("div");
      deck.className = "deck";
      deck.innerHTML = '<div class="stage"></div><div class="deck-bar"><button type="button" data-go="-1" aria-label="Previous">&larr;</button>' +
        '<span class="count"></span><button type="button" data-go="1" aria-label="Next">&rarr;</button>' +
        '<span class="hint">Arrows to move &middot; Esc to leave</span></div>';
      deck.addEventListener("click", function (e) {
        var b = e.target.closest("[data-go]");
        if (b) show(at + Number(b.dataset.go));
      });
      document.getElementById("page").appendChild(deck);
      document.documentElement.classList.add("presenting");
      show(at);
    } else if (!on && deck) {
      deck.remove(); deck = null;
      document.documentElement.classList.remove("presenting");
    }
  }

  if (new URLSearchParams(location.search).has("present")) setTimeout(function () { present(true); }, 0);
  addEventListener("resize", function () { if (deck) show(at); });
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "p" || e.key === "P") { present(!deck); return; }
    if (!deck) return;
    if (e.key === "Escape") present(false);
    else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "PageDown") { e.preventDefault(); show(at + 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); show(at - 1); }
    else if (e.key === "Home") show(0);
  });

  /* Long prompts show a few lines until "Show all". */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".more");
    if (!btn) return;
    var box = btn.closest(".prompt");
    btn.textContent = box.classList.toggle("open") ? "Show less" : "Show all";
  });

  /* Copy: the text of the block's <pre>, exactly as shown. */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy");
    if (!btn) return;
    var pre = btn.closest(".prompt, .cmd").querySelector("pre");
    var text = pre.innerText.replace(/\s+$/, "");
    function done() {
      btn.textContent = "Copied";
      btn.classList.add("done");
      setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1600);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else {
      fallback(text);
      done();
    }
  });
  function fallback(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(area);
  }

  /* Links that leave the site open in a new tab, as on the main page. */
  document.querySelectorAll("a[href]").forEach(function (a) {
    var href = a.getAttribute("href");
    if (/^https?:|^mailto:/.test(href)) {
      a.target = "_blank";
      a.rel = "noopener";
    }
  });
})();
