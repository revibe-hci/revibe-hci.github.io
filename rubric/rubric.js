/* The rubric on the hackathon page. The group keeps one set of grades and
   updates it after every fix; each grade saves for everyone, and "Copy for the
   agent" hands the grades to the agent in step 5. The first copy also keeps a
   snapshot of the grades, so the table can see what the paper alone got.
   It also fills the page's prompts and commands ([data-fill]) with the
   group's paper and name.

   Grades are kept in the browser first, so nothing is lost on a refresh or a
   dropped connection, and sent to the backend (backend.gs) when it is set.
   Without a backend the page still works, for one laptop. */

(function () {
  "use strict";

  /* The deployed Apps Script web app (see backend.gs). Empty: this laptop only. */
  var BACKEND_URL = "https://script.google.com/macros/s/AKfycbygEXAMuIqeAZBK5eh6jwVwN0k7edzEFzmF0DKiyUxCx8VVVH3Kl7nN6kbuCSY4JMEqXw/exec";
  var CODE = "";            // must match CODE in backend.gs
  var POLL_MS = 10000;
  var NOW = "now", FIRST = "first";   // the live grades, and the snapshot taken at the first copy

  var R = window.RUBRICS || {};
  var $ = function (id) { return document.getElementById(id); };
  var form = $("setup-form"), testsEl = $("tests"), statusEl = $("status");

  var client = store("rubric:client") || Math.random().toString(36).slice(2, 10);
  store("rubric:client", client);

  var who = { paper: "", table: "", group: "" };
  var grades = {};          // "now|M-01" or "first|M-01" -> {grade, seen, updated}
  var pending = {};         // same keys, waiting to be sent
  var tableRows = [];       // everyone's grades at this table, from the backend
  var flushTimer = null, pollTimer = null;

  function store(key, value) {
    try {
      if (arguments.length === 1) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }
  function localKey() { return "rubric:" + [who.paper, who.table, who.group].join(":"); }
  function ready() { return who.paper && who.table && who.group; }
  function tests() {
    var p = R[who.paper];
    return p ? p.groups.reduce(function (all, g) { return all.concat(g.tests); }, []) : [];
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  /* ---------- who you are: form, URL and storage stay in step ---------- */

  $("paper").innerHTML = '<option value="">Pick</option>';
  Object.keys(R).forEach(function (slug) {
    var o = document.createElement("option");
    o.value = slug; o.textContent = R[slug].title;
    $("paper").appendChild(o);
  });

  function readUrl() {
    var q = new URLSearchParams(location.search);
    var saved = {};
    try { saved = JSON.parse(store("rubric:who") || "{}"); } catch (e) {}
    who.paper = q.get("paper") || saved.paper || "";
    if (!R[who.paper]) who.paper = "";
    who.table = q.get("table") || saved.table || "";
    who.group = q.get("group") || saved.group || "";
    $("paper").value = who.paper; $("table").value = who.table; $("group").value = who.group;
    who.table = $("table").value; who.group = $("group").value;   // drop values the lists do not offer
  }

  function writeUrl() {
    var q = new URLSearchParams();
    if (who.paper) q.set("paper", who.paper);
    if (who.table) q.set("table", who.table);
    if (who.group) q.set("group", who.group);
    if (new URLSearchParams(location.search).has("present")) q.set("present", "");
    history.replaceState(null, "", "?" + q.toString() + location.hash);
    store("rubric:who", JSON.stringify(who));
  }

  form.addEventListener("input", function () {
    var before = localKey(), paperBefore = who.paper;
    who.paper = $("paper").value; who.table = $("table").value; who.group = $("group").value;
    writeUrl();
    if (who.paper !== paperBefore) render();
    if (localKey() !== before) { load(); tableRows = []; poll(); }
    paint(); fill();
  });

  $("share").addEventListener("click", function () {
    copy(location.href, $("share"), "Link copied");
  });

  /* The page's prompts and commands, filled in with the group's own names. */
  function groupSlug() { return who.table && who.group ? "table" + who.table + "-group" + who.group : ""; }
  function fill() {
    var values = { system: who.paper ? R[who.paper].title : "", paper: who.paper, group: groupSlug(),
                   table: who.table ? "table" + who.table : "" };
    document.querySelectorAll("[data-fill]").forEach(function (el) {
      if (!el.dataset.ph) el.dataset.ph = el.textContent;
      var v = values[el.dataset.fill];
      el.textContent = v || el.dataset.ph;
      el.classList.toggle("filled", !!v);
    });
  }

  /* ---------- grades: local first, then the backend ---------- */

  function load() {
    grades = {}; pending = {};
    if (!ready()) return;
    try { grades = JSON.parse(store(localKey()) || "{}"); } catch (e) { grades = {}; }
  }
  function save() { if (ready()) store(localKey(), JSON.stringify(grades)); }

  function put(k, g) { g.updated = Date.now(); grades[k] = g; pending[k] = true; }

  function setGrade(id, field, value) {
    if (!ready()) { status("Fill in your paper, table and group first, so the grades are saved for your group.", true); return; }
    var k = NOW + "|" + id;
    var g = grades[k] || { grade: "", seen: "" };
    g[field] = value;
    put(k, g);
    save(); paint();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, field === "seen" ? 900 : 150);
  }

  function flush() {
    var keys = Object.keys(pending);
    if (!keys.length) return;
    if (!BACKEND_URL) { pending = {}; status("Saved on this laptop."); return; }
    var items = keys.map(function (k) {
      var g = grades[k], parts = k.split("|");
      return { paper: who.paper, table: who.table, group: who.group, version: parts[0], test: parts[1],
               grade: g.grade || "", seen: g.seen || "", updated: g.updated, client: client };
    });
    var sent = {};
    keys.forEach(function (k) { sent[k] = grades[k].updated; });
    fetch(BACKEND_URL, { method: "POST", body: JSON.stringify({ code: CODE, items: items }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error);
        keys.forEach(function (k) { if (grades[k].updated === sent[k]) delete pending[k]; });
        status("Saved for your group.");
      })
      .catch(function () {
        status("Not saved online yet. Kept on this laptop, retrying.", true);
        clearTimeout(flushTimer); flushTimer = setTimeout(flush, 5000);
      });
  }

  function poll() {
    clearTimeout(pollTimer);
    if (!BACKEND_URL || !ready()) { paintTable(); return; }
    var url = BACKEND_URL + "?paper=" + encodeURIComponent(who.paper) + "&table=" + encodeURIComponent(who.table) +
              "&code=" + encodeURIComponent(CODE);
    var key = localKey();
    fetch(url).then(function (r) { return r.json(); }).then(function (res) {
      if (!res.ok || localKey() !== key) return;
      tableRows = res.rows;
      var changed = false;
      res.rows.forEach(function (row) {
        if (row.group !== who.group) return;
        var k = row.version + "|" + row.test, g = grades[k];
        if (pending[k] || (g && g.updated >= row.updated)) return;
        grades[k] = { grade: row.grade, seen: row.seen, updated: row.updated };
        changed = true;
      });
      if (changed) { save(); paint(); }
      paintTable();
    }).catch(function () { status("Offline. Grades are kept on this laptop.", true); })
      .then(function () { pollTimer = setTimeout(poll, POLL_MS); });
  }

  function status(text, bad) { statusEl.textContent = text; statusEl.classList.toggle("bad", !!bad); }

  /* ---------- the tests ---------- */

  function render() {
    var p = R[who.paper];
    testsEl.innerHTML = "";
    $("need").hidden = !(p && p.need);
    if (!p) return;
    if (p.need) $("need").innerHTML = "<b>What you need to test:</b> " + esc(p.need);
    p.groups.forEach(function (grp, gi) {
      var sec = document.createElement("section");
      sec.className = "group";
      sec.innerHTML = "<h3>" + String.fromCharCode(65 + gi) + ". " + esc(grp.name) + "</h3>";
      grp.tests.forEach(function (t) {
        var el = document.createElement("article");
        el.className = "test"; el.dataset.id = t.id;
        el.innerHTML =
          '<div class="test-head"><span class="id">' + esc(t.id) + "</span><h4>" + esc(t.title) + "</h4>" +
          '<span class="ev">' + esc(t.evidence) + "</span></div>" +
          '<p class="try"><b>Try it:</b> ' + esc(t.steps) + "</p>" +
          '<div class="grade" role="group" aria-label="Grade ' + esc(t.id) + '">' +
          '<button type="button" data-g="full" aria-pressed="false"><b>Full</b><span>' + esc(t.full) + "</span></button>" +
          '<button type="button" data-g="partial" aria-pressed="false"><b>Partial</b><span>' + esc(t.partial) + "</span></button>" +
          '<button type="button" data-g="failure" aria-pressed="false"><b>Failure</b><span>' + esc(t.failure) + "</span></button></div>" +
          '<textarea class="seen" rows="1" placeholder="What we saw (the agent fixes from these notes)"></textarea>';
        sec.appendChild(el);
      });
      testsEl.appendChild(sec);
    });
  }

  testsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".grade button");
    if (b) {
      var id = b.closest(".test").dataset.id, now = (grades[NOW + "|" + id] || {}).grade;
      setGrade(id, "grade", now === b.dataset.g ? "" : b.dataset.g);   // a second click clears it
    }
  });
  testsEl.addEventListener("input", function (e) {
    if (!e.target.classList.contains("seen")) return;
    grow(e.target);
    setGrade(e.target.closest(".test").dataset.id, "seen", e.target.value);
  });

  function grow(ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; }

  function tally(from) {
    var list = tests(), t = { full: 0, partial: 0, failure: 0, n: list.length };
    list.forEach(function (x) { var g = (from(x.id) || {}).grade; if (g in t) t[g]++; });
    t.graded = t.full + t.partial + t.failure;
    t.score = t.n ? (t.full + 0.5 * t.partial) / t.n : 0;
    return t;
  }
  function mine(version) { return function (id) { return grades[version + "|" + id]; }; }

  function paint() {
    testsEl.querySelectorAll(".test").forEach(function (el) {
      var g = grades[NOW + "|" + el.dataset.id] || {};
      el.className = "test" + (g.grade ? " " + g.grade : "");
      el.querySelectorAll(".grade button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.g === g.grade)); });
      var ta = el.querySelector(".seen");
      if (document.activeElement !== ta && ta.value !== (g.seen || "")) { ta.value = g.seen || ""; grow(ta); }
    });
    var t = tally(mine(NOW));
    $("tally").innerHTML = ready()
      ? "<b>" + t.graded + " of " + t.n + "</b> graded &middot; score <b>" + t.score.toFixed(2) + "</b>" +
        (t.graded < t.n ? " so far" : "")
      : "Fill in &ldquo;Who You Are&rdquo; at the top of the page to grade.";
    $("copy-grades").disabled = !ready() || !t.graded;
    paintTable();
  }

  /* ---------- the table view ---------- */

  function paintTable() {
    var view = $("tableview");
    if (!BACKEND_URL || !ready()) { view.hidden = true; return; }
    var byGroup = {};
    tableRows.forEach(function (r) { (byGroup[r.group] = byGroup[r.group] || {})[r.version + "|" + r.test] = r; });
    byGroup[who.group] = grades;   // your own grades, including what has not reached the backend yet
    var cell = function (g, version) {
      var t = tally(function (id) { return byGroup[g][version + "|" + id]; });
      return t.graded ? t.score.toFixed(2) + ' <span class="sub">' + t.graded + "/" + t.n + "</span>" : '<span class="sub">–</span>';
    };
    var rows = Object.keys(byGroup).sort(function (a, b) { return a - b; }).map(function (g) {
      var you = g === who.group;
      return "<tr" + (you ? ' class="you"' : "") + "><td>Group " + esc(g) + (you ? ' <span class="sub">(you)</span>' : "") +
        '</td><td class="n">' + cell(g, FIRST) + '</td><td class="n">' + cell(g, NOW) + "</td></tr>";
    }).join("");
    $("scores").innerHTML = "<table><thead><tr><th>Group</th><th>From the paper alone</th><th>Now</th></tr></thead><tbody>" +
      rows + "</tbody></table>";
    view.hidden = false;
  }

  /* ---------- copy for the agent ---------- */

  function forAgent() {
    var p = R[who.paper], t = tally(mine(NOW));
    var out = ["We graded the system against the rubric below. Please fix the tests we graded partial or failure,",
               "using what we saw, and the ones we could not grade if they are missing.", "",
               "# Graded rubric: " + p.title,
               "Score " + t.score.toFixed(2) + ": " + t.full + " full, " + t.partial + " partial, " + t.failure +
               " failure, " + (t.n - t.graded) + " not graded, of " + t.n + " tests.", ""];
    p.groups.forEach(function (grp, gi) {
      out.push("## " + String.fromCharCode(65 + gi) + ". " + grp.name, "");
      grp.tests.forEach(function (x) {
        var g = grades[NOW + "|" + x.id] || {};
        out.push("### " + x.id + " · " + x.title, "Steps: " + x.steps, "Expected (full success): " + x.full,
                 "Grade: " + (g.grade || "not graded"));
        if (g.seen && g.seen.trim()) out.push("What we saw: " + g.seen.trim());
        out.push("");
      });
    });
    return out.join("\n");
  }

  /* The first copy is the hand-over after grading version 1: keep those grades
     as the "from the paper alone" snapshot, unless the group already has one. */
  function snapshot() {
    var has = tests().some(function (x) { return grades[FIRST + "|" + x.id]; });
    if (has) return;
    tests().forEach(function (x) {
      var g = grades[NOW + "|" + x.id];
      if (g) put(FIRST + "|" + x.id, { grade: g.grade, seen: g.seen });
    });
    save(); flush();
  }

  $("copy-grades").addEventListener("click", function () {
    snapshot();
    copy(forAgent(), $("copy-grades"), "Copied");
  });

  function copy(text, button, done) {
    var label = button.textContent;
    var finish = function () { button.textContent = done; setTimeout(function () { button.textContent = label; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(finish, fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); finish(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  /* ---------- start ---------- */

  readUrl(); writeUrl(); render(); load(); paint(); fill(); poll();
  if (!BACKEND_URL) status("Saved on this laptop only: the shared backend is not set up yet.");
})();
