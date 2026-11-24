'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.jsonl');

// Ephemeral secret if none supplied via env; set FORM_SECRET in production.
const FORM_SECRET = process.env.FORM_SECRET || 'squared-away-keynote-token-secret-2026';
const MIN_SUBMIT_ELAPSED_MS = 2500;
const MAX_TOKEN_AGE_MS = 4 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;

const rateBuckets = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt; charset=utf-8',
  '.ico': 'image/x-icon',
};

const ALLOWED_ENGAGEMENT_TYPES = new Set([
  'Keynote',
  'Executive Workshop',
  'Podcast / Media Interview',
  'Podcast or interview',
  'Custom Engagement',
  'Other',
]);

function signToken(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', FORM_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return { valid: false, reason: 'missing_token' };
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return { valid: false, reason: 'malformed_token' };
  const expected = crypto.createHmac('sha256', FORM_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: 'invalid_signature' };
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const age = Date.now() - Number(data.iat || 0);
    if (age < 0 || age > MAX_TOKEN_AGE_MS) return { valid: false, reason: 'expired_token' };
    if (age < MIN_SUBMIT_ELAPSED_MS) return { valid: false, reason: 'submitted_too_fast' };
    return { valid: true, data };
  } catch {
    return { valid: false, reason: 'invalid_payload' };
  }
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const timestamps = (rateBuckets.get(ip) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_MAX_REQUESTS) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000);
    rateBuckets.set(ip, timestamps);
    return { allowed: false, retryAfterSec };
  }
  timestamps.push(now);
  rateBuckets.set(ip, timestamps);
  return { allowed: true, remaining: RATE_MAX_REQUESTS - timestamps.length };
}

function sanitizeText(val, maxLen) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

function validateInquiry(body) {
  const errors = {};
  const name = sanitizeText(body.name || body.nameOrg || body.name_org, 140);
  const email = sanitizeText(body.email, 180).toLowerCase();
  const subject = sanitizeText(body.subject || body.engagementType || body.engagement_type, 200);
  const message = sanitizeText(body.message || body.audienceGoals || body.goals, 4000);
  const honeypot = typeof body.company_website === 'string' ? body.company_website.trim() : '';

  if (honeypot.length > 0) {
    return { spam: true, errors: { form: 'Automated submission rejected.' } };
  }

  if (name.length < 2) {
    errors.name = 'Please provide your full name.';
  }
  const emailRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
  if (!emailRegex.test(email)) {
    errors.email = 'Enter a valid corporate or personal email address.';
  }
  if (subject.length < 2) {
    errors.subject = 'Please provide an inquiry subject.';
  }
  if (message.length < 3) {
    errors.message = 'Please share a brief message regarding your event or inquiry.';
  }

  return {
    spam: false,
    valid: Object.keys(errors).length === 0,
    errors,
    cleaned: { name, email, subject, message },
  };
}

function readRequestBody(req, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
}

function sendJson(res, status, data) {
  setSecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function serveStaticFile(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    setSecurityHeaders(res);

    const range = req.headers.range;
    if (range && ext === '.mp4') {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
        if (start >= stat.size || end < start) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
          res.end();
          return;
        }
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    const cacheControl = ext === '.html' || ext === '.css' || ext === '.js' ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(reqUrl.pathname);

  if (req.method === 'GET' && pathname === '/api/form-token') {
    const token = signToken({
      iat: Date.now(),
      nonce: crypto.randomBytes(12).toString('hex'),
    });
    return sendJson(res, 200, { token });
  }

  if (req.method === 'POST' && pathname === '/api/inquire') {
    const ip = getClientIp(req);
    const limit = checkRateLimit(ip);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSec));
      return sendJson(res, 429, {
        ok: false,
        message: 'Too many inquiry attempts from this address. Please wait a few minutes before trying again.',
      });
    }

    try {
      const rawBody = await readRequestBody(req);
      const contentType = String(req.headers['content-type'] || '');
      let parsed = {};
      if (contentType.includes('application/json')) {
        parsed = JSON.parse(rawBody || '{}');
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        parsed = Object.fromEntries(new URLSearchParams(rawBody));
      } else {
        return sendJson(res, 415, { ok: false, message: 'Unsupported content type.' });
      }

      // Verify signed time-gated anti-bot token when present (or enforce when JS token issued)
      const tokenResult = verifyToken(parsed.formToken);
      if (!tokenResult.valid) {
        const msg =
          tokenResult.reason === 'submitted_too_fast'
            ? 'Submission was too rapid. Please take a moment to review your details and submit again.'
            : 'Your form session expired or could not be verified. Please refresh and submit again.';
        return sendJson(res, 400, { ok: false, reason: tokenResult.reason, message: msg });
      }

      const validation = validateInquiry(parsed);
      if (validation.spam) {
        return sendJson(res, 400, { ok: false, message: 'Unable to process this request.' });
      }
      if (!validation.valid) {
        return sendJson(res, 422, {
          ok: false,
          message: 'Please review the highlighted fields below.',
          errors: validation.errors,
        });
      }

      const inquiryId = `SA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const record = {
        id: inquiryId,
        receivedAt: new Date().toISOString(),
        ipHash: crypto.createHash('sha256').update(ip).digest('hex').slice(0, 12),
        ...validation.cleaned,
      };

      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      await fs.promises.appendFile(INQUIRIES_FILE, `${JSON.stringify(record)}\n`, 'utf8');

      if (contentType.includes('application/x-www-form-urlencoded')) {
        setSecurityHeaders(res);
        res.writeHead(303, { Location: '/?submitted=1#inquire' });
        res.end();
        return;
      }

      return sendJson(res, 200, {
        ok: true,
        inquiryId,
        message: 'Thank you. Your availability inquiry has been logged for Michael Graham’s team.',
      });
    } catch (err) {
      if (err && err.message === 'PAYLOAD_TOO_LARGE') {
        return sendJson(res, 413, { ok: false, message: 'Inquiry payload is too large.' });
      }
      return sendJson(res, 400, { ok: false, message: 'Invalid inquiry payload.' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  let targetPath = pathname;
  if (targetPath === '/' || targetPath === '/michaelgraham' || targetPath === '/michaelgraham/') {
    targetPath = '/index.html';
  }

  const safePath = path.normalize(path.join(ROOT_DIR, targetPath));
  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  // Only allow public web files (block data/ or server.js)
  const rel = path.relative(ROOT_DIR, safePath).replace(/\\/g, '/');
  if (rel.startsWith('data/') || rel === 'server.js' || rel === 'package.json' || rel.startsWith('assets/docs/') || rel.startsWith('assets/previews/')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  serveStaticFile(req, res, safePath);
});

server.listen(PORT, HOST, () => {
  console.log(`Michael Graham — Squared Away running at http://${HOST}:${PORT}/`);
});
