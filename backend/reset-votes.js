/**
 * Run this after a real price change: archives the current price-feedback tallies
 * and the voted-IP ledger, then zeroes both out so everyone can vote again on the
 * renegotiated prices. price-votes.log is never touched - full history stays intact,
 * and analyze-votes.js can still slice any date range across a reset boundary.
 *
 * Usage: node reset-votes.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FEEDBACK_PATH = path.join(__dirname, 'price-feedback.json');
const VOTED_IPS_PATH = path.join(__dirname, 'voted-ips.json');
const ARCHIVE_DIR = path.join(__dirname, 'archive');
const PACKAGES = ['starter', 'local', 'custom'];

if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');

if (fs.existsSync(FEEDBACK_PATH)) {
  fs.copyFileSync(FEEDBACK_PATH, path.join(ARCHIVE_DIR, `price-feedback-${stamp}.json`));
}
if (fs.existsSync(VOTED_IPS_PATH)) {
  fs.copyFileSync(VOTED_IPS_PATH, path.join(ARCHIVE_DIR, `voted-ips-${stamp}.json`));
}

const freshFeedback = {};
const freshVoted = {};
for (const pkg of PACKAGES) {
  freshFeedback[pkg] = { low: 0, fair: 0, high: 0 };
  freshVoted[pkg] = {};
}
fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(freshFeedback));
fs.writeFileSync(VOTED_IPS_PATH, JSON.stringify(freshVoted));

console.log(`Archived prior tallies + voter ledger to backend/archive/ (stamp ${stamp}).`);
console.log('Live price-feedback and voted-ips reset to zero - everyone can vote again.');
console.log('price-votes.log left untouched; analyze-votes.js can still report on any date range.');
