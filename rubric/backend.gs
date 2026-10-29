/* Revibing HCI rubric page: the backend, as a Google Apps Script bound to a
   Google Sheet. Each grade is one row, keyed by paper, table, group, version
   and test, so the latest save for a test wins.

   Set up (about 10 minutes):
   1. Create a Google Sheet. Extensions > Apps Script. Replace Code.gs with this file.
   2. Optional: set CODE below and put the same value in rubric.js.
   3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
   4. Copy the web app URL into BACKEND_URL in rubric.js.
   After editing this file, deploy again (Manage deployments > Edit > New version). */

var CODE = "";          // a workshop code the page must send; empty means none
var SHEET = "grades";
var COLUMNS = ["key", "paper", "table", "group", "version", "test", "grade", "seen", "updated", "client"];
var GRADES = { full: 1, partial: 1, failure: 1, "": 1 };

function sheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sh = book.getSheetByName(SHEET) || book.insertSheet(SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(COLUMNS);
  return sh;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function clip_(value, n) { return String(value == null ? "" : value).slice(0, n); }

/* GET ?paper=misty&table=3 returns every grade at that table, all groups and versions. */
function doGet(e) {
  var p = e.parameter || {};
  if (CODE && p.code !== CODE) return json_({ ok: false, error: "code" });
  var rows = sheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[1]) === p.paper && String(r[2]) === String(p.table)) {
      out.push({ group: String(r[3]), version: String(r[4]), test: String(r[5]),
                 grade: String(r[6]), seen: String(r[7]), updated: Number(r[8]) });
    }
  }
  return json_({ ok: true, rows: out });
}

/* POST {code, items: [{paper, table, group, version, test, grade, seen, updated, client}]}.
   Sent as text/plain so the browser does not need a preflight request. */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "json" }); }
  if (CODE && body.code !== CODE) return json_({ ok: false, error: "code" });
  var items = (body.items || []).slice(0, 100);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    var keys = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return String(r[0]); });
    items.forEach(function (it) {
      if (!(String(it.grade) in GRADES)) return;
      var row = [clip_(it.paper, 20), clip_(it.table, 10), clip_(it.group, 40), clip_(it.version, 4),
                 clip_(it.test, 12), clip_(it.grade, 8), clip_(it.seen, 2000), Number(it.updated) || Date.now(),
                 clip_(it.client, 40)];
      var key = row.slice(0, 5).join("|");
      var at = keys.indexOf(key);
      if (at > 0) {
        var old = Number(sh.getRange(at + 1, 9).getValue()) || 0;
        if (row[7] >= old) sh.getRange(at + 1, 1, 1, COLUMNS.length).setValues([[key].concat(row)]);
      } else {
        sh.appendRow([key].concat(row));
        keys.push(key);
      }
    });
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}
