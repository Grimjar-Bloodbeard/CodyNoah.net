/**
 * Repairs intake — tiny zero-dep server.
 * Listens on 127.0.0.1 only; nginx proxies /api/repairs to it.
 * POST /api/repairs { name, email, phone, device, description, hp } -> emails Cody via Resend.
 * `hp` is a honeypot field: real users never fill it, bots usually do.
 */
'use strict';

const http = require('http');
const https = require('https');
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

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://codynoah.net');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('healthy');
  }

  if (req.method !== 'POST' || req.url !== '/api/repairs') {
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
