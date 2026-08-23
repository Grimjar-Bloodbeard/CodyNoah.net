/**
 * scripts/nightly-audit.js — nightly public-liveness check (notify-only)
 * ============================================================================
 * CodyNoah.net has no package.json/test suite - it's a static site + a plain
 * backend script, nothing to "npm test". The real, already-occurred failure
 * mode here (2026-08-03: codynoah.net AND stockforge.codynoah.net both 502'd
 * from stale Cloudflare Tunnel port mappings, see reference-cloudflare-tunnel
 * memory) is a public-liveness problem, not a code-correctness one - so this
 * checks that, across all hostnames on the shared tunnel, not just this repo.
 *
 * Clean pass = true no-op, zero LLM cost. Failure = ask Claude (headless,
 * Edit/Write/NotebookEdit disallowed) for a diagnosis as TEXT, then write a
 * note to Forgeheart's cockpit. Never auto-fixes or auto-commits.
 */

const https = require("https");
const path = require("path");
const { execFileSync } = require("child_process");
const notes = require("D:/Forgeheart/lib/notes.js");
const board = require("D:/Forgeheart/lib/board.js");

const ROOT = path.join(__dirname, "..");
const PROJECT = "CodyNoah.net (shared tunnel)";
const HOSTS = ["codynoah.net", "stockforge.codynoah.net", "summitgamingofwilkes.com"];
const TIMEOUT_MS = 8000;
const MAX_LOG_CHARS = 6000;
const BOARD_PROJECT_NAME = "CodyNoah.net"; // task #37 - no board project by this name yet, so this no-ops for now

function checkHost(host) {
  return new Promise((resolve) => {
    const req = https.get({ host, path: "/", timeout: TIMEOUT_MS }, (res) => {
      resolve({ host, ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
      res.resume();
    });
    req.on("timeout", () => { req.destroy(); resolve({ host, ok: false, status: "timeout" }); });
    req.on("error", (err) => resolve({ host, ok: false, status: err.code || String(err.message) }));
  });
}

async function runVerify() {
  const results = await Promise.all(HOSTS.map(checkHost));
  const failures = results.filter((r) => !r.ok);
  const output = results.map((r) => `${r.host}: ${r.ok ? "OK" : "FAIL (" + r.status + ")"}`).join("\n");
  return { ok: failures.length === 0, output };
}

function askClaude(failureLog) {
  const prompt =
    `A nightly public-liveness check failed for ${PROJECT}.\n` +
    "Cloudflare Tunnel config is at C:\\Users\\cody\\.cloudflared\\config.yml - " +
    "on 2026-08-03 a similar failure was a stale port mapping there (tunnel fine, " +
    "origin port wrong or nothing listening). Diagnose the likely root cause and " +
    "suggest a fix, as plain text only. Do not edit any files - this is analysis only.\n\n" +
    failureLog.slice(0, MAX_LOG_CHARS);

  try {
    const out = execFileSync(
      "C:/Users/cody/.local/bin/claude.exe",
      [
        "-p",
        "--disallowedTools", "Edit Write NotebookEdit",
        "--output-format", "text",
        "--no-session-persistence",
        "--max-budget-usd", "0.50",
        prompt,
      ],
      { encoding: "utf8" }
    );
    return out.trim();
  } catch (err) {
    return "(claude CLI call failed: " + (err.message || err) + ")";
  }
}

// Task #37 (Cody, 2026-08-19): NEVER auto-marks a task done (board.update()
// is never called here) - only proposes, same notify-then-you-confirm
// pattern as the failure alert. See Forgeheart's scripts/nightly-audit.js
// for the full reasoning.
function checkTaskCompletion() {
  const project = board.all().find((p) => p.name === BOARD_PROJECT_NAME);
  const open = (project && project.tasks || []).filter((t) => !t.done);
  if (!open.length) { console.log(`[nightly-audit:${PROJECT}] no open tasks to check.`); return; }

  const prompt =
    `These are the OPEN tasks on the "${BOARD_PROJECT_NAME}" board in ${ROOT}. Check the ACTUAL ` +
    "current code (read files, don't guess) and report ONLY the ones you're genuinely confident are already " +
    "done, one per line as \"DONE: <task text> - <short reason, citing a real file/line>\". Skip anything " +
    "you're not sure about entirely - do not list it, do not speculate. If none are confidently done, output " +
    "nothing.\n\nOpen tasks:\n" + open.map((t) => "- " + t.text).join("\n");

  let out;
  try {
    out = execFileSync(
      "C:/Users/cody/.local/bin/claude.exe",
      ["-p", "--disallowedTools", "Edit Write NotebookEdit", "--output-format", "text",
       "--no-session-persistence", "--max-budget-usd", "0.50", prompt],
      { cwd: ROOT, encoding: "utf8" }
    ).trim();
  } catch (err) {
    console.log(`[nightly-audit:${PROJECT}] task-completion check failed:`, err.message);
    return;
  }

  const hits = out.split("\n").filter((l) => l.trim().startsWith("DONE:"));
  if (!hits.length) { console.log(`[nightly-audit:${PROJECT}] no tasks look confidently done.`); return; }

  notes.add(
    `Nightly audit (${PROJECT}): these board tasks look done on real inspection - ` +
    "confirm and check them off yourself, nothing was auto-marked complete:\n\n" + hits.join("\n"),
    "alert"
  );
  console.log(`[nightly-audit:${PROJECT}] ${hits.length} task(s) flagged as possibly done.`);
}

async function main() {
  const result = await runVerify();

  if (result.ok) {
    console.log(`[nightly-audit:${PROJECT}] clean - no note, no LLM call.`);
  } else {
    console.log(`[nightly-audit:${PROJECT}] a hostname failed - asking Claude for analysis.`);
    const analysis = askClaude(result.output);
    const text =
      `Nightly audit (${PROJECT}): a public hostname failed to respond.\n\n` +
      analysis +
      "\n\n--- check results ---\n" +
      result.output;
    notes.add(text, "alert");
    console.log(`[nightly-audit:${PROJECT}] note written to Forgeheart's notes.json.`);
  }

  checkTaskCompletion();
}

main();
