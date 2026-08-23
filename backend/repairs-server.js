/**
 * Repairs intake + price-feedback — tiny zero-dep server.
 * Listens on 127.0.0.1 only; Tailscale Serve proxies /api/* to it (see `tailscale serve status`).
 * POST /api/repairs { name, email, phone, device, description, hp } -> emails Cody via Resend.
 * `hp` is a honeypot field: real users never fill it, bots usually do.
 * GET/POST /api/price-feedback -> anonymous "too high / fair / too low" tallies per package,
 * stored as plain counts in a JSON file. One vote per package per device, enforced server-side
 * by hashed IP (see voted-ips.json) so clearing localStorage/incognito can't re-vote. Run
 * `node reset-votes.js` after a real price change to archive the tallies and open voting back up.
 * GET /api/resume -> serves backend/private/Cody-Noah-Resume.pdf, one download per device
 * (same hashed-IP gate as price-feedback). The PDF is outside the public docroot - this
 * route is the only way to reach it.
 */
'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Zero-dep .env loader — just KEY=VALUE lines, no quoting/escaping support needed here.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}

const PORT = process.env.REPAIRS_PORT || 8091;
const TO_EMAIL = process.env.REPAIRS_TO_EMAIL || 'cnoah538191@gmail.com';
const FROM_EMAIL = process.env.EMAIL_FROM || 'GrimForge Repairs <notifications@summitgamingofwilkes.com>';

function sendEmail(subject, html, replyTo) {
  return new Promise((resolve, reject) => {
    if (!process.env.RESEND_API_KEY) return reject(new Error('RESEND_API_KEY not set'));
    const body = JSON.stringify({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      reply_to: replyTo || undefined,
      subject,
      html
    });
    const req = https.request({
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) resolve(data);
        else reject(new Error(`Resend ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- price feedback: anonymous vote tallies, plain JSON file on disk ----
// FEEDBACK_PATH is a running total for the fast live display on the page.
// VOTES_LOG_PATH is the real record - one timestamped line per vote, append-only,
// never rewritten. Live totals can be rebuilt from it if they're ever wrong; the
// log is what analyze-votes.js reads to break things down by date range later,
// e.g. to compare sentiment before/after a price change.
const FEEDBACK_PATH = path.join(__dirname, 'price-feedback.json');
const VOTES_LOG_PATH = path.join(__dirname, 'price-votes.log');
const VOTED_IPS_PATH = path.join(__dirname, 'voted-ips.json');
const SALT_PATH = path.join(__dirname, '.vote-salt');
const PACKAGES = ['starter', 'local', 'custom'];
const REACTIONS = ['low', 'fair', 'high'];

function loadFeedback() {
  try {
    const data = JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf8'));
    for (const pkg of PACKAGES) {
      if (!data[pkg]) data[pkg] = { low: 0, fair: 0, high: 0 };
    }
    return data;
  } catch {
    const fresh = {};
    for (const pkg of PACKAGES) fresh[pkg] = { low: 0, fair: 0, high: 0 };
    return fresh;
  }
}

function saveFeedback(data) {
  fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(data));
}

// voted-ips.json: { pkg: { hashedVoterId: timestamp } } — the permanent "already voted" ledger.
// Cleared only by reset-votes.js, which archives it first. Never rewritten otherwise.
function loadVotedIps() {
  try {
    const data = JSON.parse(fs.readFileSync(VOTED_IPS_PATH, 'utf8'));
    for (const pkg of PACKAGES) if (!data[pkg]) data[pkg] = {};
    return data;
  } catch {
    const fresh = {};
    for (const pkg of PACKAGES) fresh[pkg] = {};
    return fresh;
  }
}

function saveVotedIps(data) {
  fs.writeFileSync(VOTED_IPS_PATH, JSON.stringify(data));
}

// Self-generating, never committed (see .gitignore) — lets us hash voter IPs instead of
// storing them raw, without a manual setup step.
function getVoteSalt() {
  try {
    return fs.readFileSync(SALT_PATH, 'utf8').trim();
  } catch {
    const salt = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SALT_PATH, salt);
    return salt;
  }
}
const VOTE_SALT = getVoteSalt();

// Server binds to 127.0.0.1 only, so the sole path in is Tailscale Serve on this same box.
// X-Forwarded-For is an append-only chain - anyone hitting the API directly (curl, a bot,
// not a browser: fetch() blocks scripts from setting this header) can prepend whatever they
// want. Only the LAST entry is the one Tailscale itself appended for the real connecting
// client, so that's the only value worth trusting here.
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw = fwd ? fwd.split(',').pop().trim() : req.socket.remoteAddress;
  if (!raw) return null;
  const ip = raw.replace(/^::ffff:/, ''); // unwrap IPv4-mapped IPv6
  // IPv6 hands out a fresh address per reconnect on most networks (privacy extensions) —
  // collapsing to the /64 prefix stops "toggle wifi, get a new IP, vote again" on those.
  if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':') + '::/64';
  return ip;
}

function hashVoterId(ip) {
  return crypto.createHmac('sha256', VOTE_SALT).update(ip).digest('hex');
}

// ---- résumé download gate: one download per device (Cody, 2026-08-17) ----
// Same hashed-IP pattern as price-feedback voting above, reused rather than
// invented fresh. The PDF still has the phone number in it - fine, since
// downloading it is a deliberate act, unlike it sitting in the page text for
// every casual visitor/scraper. The file lives in backend/private/, which
// codynoah.conf already 404s (location ^~ /backend/) - this route is the
// ONLY way to reach it, so the gate can't be bypassed via the old static URL.
const RESUME_PATH = path.join(__dirname, 'private', 'Cody-Noah-Resume.pdf');
const RESUME_DOWNLOADS_PATH = path.join(__dirname, 'resume-downloads.json');

function loadResumeDownloads() {
  try { return JSON.parse(fs.readFileSync(RESUME_DOWNLOADS_PATH, 'utf8')); }
  catch { return {}; }
}
function saveResumeDownloads(data) {
  fs.writeFileSync(RESUME_DOWNLOADS_PATH, JSON.stringify(data));
}

const ALREADY_DOWNLOADED_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Already downloaded - GrimForge Creations</title>
<style>body{background:#070a12;color:#e8e8ea;font-family:system-ui,sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:2rem;text-align:center}
main{max-width:36ch}h1{font-size:1.25rem;margin-bottom:.8rem}a{color:#5fe0d6}</style>
</head><body><main><h1>You've already got this one</h1>
<p>This device already downloaded the résumé. Need it again, or want to talk directly?
Email <a href="mailto:cnoah538191@gmail.com">cnoah538191@gmail.com</a>.</p>
</main></body></html>`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://codynoah.net');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('healthy');
  }

  // Tailscale Serve mounts this backend at the public path /api and strips that
  // prefix before forwarding, so routes here are unprefixed even though the
  // browser-facing URLs are /api/price-feedback and /api/repairs.
  if (req.method === 'GET' && req.url === '/price-feedback') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(loadFeedback()));
  }

  if (req.method === 'POST' && req.url === '/price-feedback') {
    let fbBody = '';
    req.on('data', chunk => { fbBody += chunk; if (fbBody.length > 1e4) req.destroy(); });
    req.on('end', () => {
      let data;
      try { data = JSON.parse(fbBody || '{}'); } catch { data = {}; }
      const { pkg, reaction } = data;
      if (!PACKAGES.includes(pkg) || !REACTIONS.includes(reaction)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Unrecognized package or reaction.' }));
      }
      const ip = getClientIp(req);
      if (!ip) { // can't identify the voter — fail closed rather than let it through uncounted
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Could not verify request.' }));
      }
      // fs.*Sync below can throw (disk full, permissions, a momentary file lock) -
      // this is a plain req.on('end', ...) listener with no surrounding try/catch,
      // so an uncaught throw here is a synchronous exception that kills the whole
      // process (start-repairs.ps1 restarts it ~5s later, but every in-flight
      // request still drops). Wrapped to match the /repairs handler below, which
      // already gets this right. See Forgeheart's
      // Vault/_reference/http-handler-crash-safety.md for the broader pattern.
      try {
        const voterId = hashVoterId(ip);
        const votedIps = loadVotedIps();
        if (votedIps[pkg][voterId]) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'already-voted', feedback: loadFeedback() }));
        }
        votedIps[pkg][voterId] = Date.now();
        saveVotedIps(votedIps);
        fs.appendFileSync(VOTES_LOG_PATH, JSON.stringify({ ts: Date.now(), pkg, reaction }) + '\n');
        const feedback = loadFeedback();
        feedback[pkg][reaction]++;
        saveFeedback(feedback);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, feedback }));
      } catch (err) {
        console.error('price-feedback error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Something broke on our end — try again.' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/resume') {
    const ip = getClientIp(req);
    if (!ip) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Could not verify request.');
    }
    try {
      const id = hashVoterId(ip);
      const downloads = loadResumeDownloads();
      if (downloads[id]) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(ALREADY_DOWNLOADED_HTML);
      }
      const pdf = fs.readFileSync(RESUME_PATH);
      downloads[id] = Date.now();
      saveResumeDownloads(downloads);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Cody-Noah-Resume.pdf"',
        'Content-Length': pdf.length
      });
      return res.end(pdf);
    } catch (err) {
      console.error('resume download error:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Something broke on our end - email cnoah538191@gmail.com for the résumé directly.');
    }
  }

  if (req.method !== 'POST' || req.url !== '/repairs') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('not found');
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 1e6) req.destroy(); // guard against oversized bodies
  });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body || '{}');
      if (data.hp) { // honeypot tripped — pretend success, drop silently
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true }));
      }
      const { name, email, type, how, device, details } = data;
      if (!name || !email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Name and email are required.' }));
      }
      const html = `
        <h2>New repair request</h2>
        <p><b>Name:</b> ${escapeHtml(name)}</p>
        <p><b>Email:</b> ${escapeHtml(email)}</p>
        <p><b>Need:</b> ${escapeHtml(type)}</p>
        <p><b>Local or mail-in:</b> ${escapeHtml(how)}</p>
        <p><b>Device/subject:</b> ${escapeHtml(device)}</p>
        <p><b>Details:</b><br>${escapeHtml(details).replace(/\n/g, '<br>')}</p>
      `.trim();
      await sendEmail(`GrimForge repair request: ${name}`, html, email);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error('repairs-server error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Something broke on our end — try again or email directly.' }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`Repairs intake server on 127.0.0.1:${PORT}`));
