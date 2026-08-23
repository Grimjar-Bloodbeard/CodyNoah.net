/**
 * Reads price-votes.log and breaks down the "how does this price feel" votes
 * by package, with an optional date range so you can compare sentiment before
 * and after a price change.
 *
 * Usage:
 *   node analyze-votes.js
 *   node analyze-votes.js --since=2026-09-01
 *   node analyze-votes.js --since=2026-09-01 --until=2026-09-15
 *
 * Target is 80% fair, aiming for 100% - flags any package under that line.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FAIR_TARGET = 0.80;
const LOG_PATH = path.join(__dirname, 'price-votes.log');

function arg(name) {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? new Date(hit.split('=')[1]).getTime() : null;
}
const since = arg('since');
const until = arg('until');

if (!fs.existsSync(LOG_PATH)) {
  console.log('No votes logged yet at', LOG_PATH);
  process.exit(0);
}

const lines = fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean);
const totals = {};
for (const line of lines) {
  let v;
  try { v = JSON.parse(line); } catch { continue; }
  if (since && v.ts < since) continue;
  if (until && v.ts > until) continue;
  if (!totals[v.pkg]) totals[v.pkg] = { low: 0, fair: 0, high: 0 };
  totals[v.pkg][v.reaction]++;
}

const range = (since ? new Date(since).toDateString() : 'the start') + ' → ' + (until ? new Date(until).toDateString() : 'now');
console.log('\nPrice feedback: ' + range + '\n');

const pkgs = Object.keys(totals);
if (!pkgs.length) { console.log('No votes in that range.\n'); process.exit(0); }

for (const pkg of pkgs) {
  const t = totals[pkg];
  const total = t.low + t.fair + t.high;
  const fairPct = total ? t.fair / total : 0;
  const flag = fairPct < FAIR_TARGET ? '  <-- below the 80% target' : '';
  console.log(pkg.padEnd(10) + total + ' votes  |  '
    + Math.round(t.low / total * 100 || 0) + '% low  '
    + Math.round(fairPct * 100) + '% fair  '
    + Math.round(t.high / total * 100 || 0) + '% high' + flag);
}
console.log('');
