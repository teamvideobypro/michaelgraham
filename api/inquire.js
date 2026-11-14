'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const FORM_SECRET = process.env.FORM_SECRET || 'squared-away-keynote-token-secret-2026';
const MIN_SUBMIT_ELAPSED_MS = 2500;
const MAX_TOKEN_AGE_MS = 4 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;

const rateBuckets = new Map();

const ALLOWED_ENGAGEMENT_TYPES = new Set([
  'Keynote',
  'Executive Workshop',
  'Podcast / Media Interview',
  'Podcast or interview',
  'Custom Engagement',
  'Other',
]);

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
  return (req.socket && req.socket.remoteAddress) || 'unknown';
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
  const nameOrg = sanitizeText(body.nameOrg || body.name_org, 140);
  const email = sanitizeText(body.email, 180).toLowerCase();
  const engagementType = sanitizeText(body.engagementType || body.engagement_type, 60);
  const eventDate = sanitizeText(body.eventDate || body.timeframe, 100);
  const location = sanitizeText(body.location, 140);
  const budget = sanitizeText(body.budget, 80);
  const audienceGoals = sanitizeText(body.audienceGoals || body.goals, 2000);
  const honeypot = typeof body.company_website === 'string' ? body.company_website.trim() : '';

  if (honeypot.length > 0) {
    return { spam: true, errors: { form: 'Automated submission rejected.' } };
  }

  if (nameOrg.length < 2) {
    errors.nameOrg = 'Please provide your full name and organization.';
  }
  const emailRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
  if (!emailRegex.test(email)) {
    errors.email = 'Enter a valid corporate or personal email address.';
  }
  if (!ALLOWED_ENGAGEMENT_TYPES.has(engagementType)) {
    errors.engagementType = 'Please choose an engagement format.';
  }
  if (eventDate.length < 2) {
    errors.eventDate = 'Provide a target event date or timeframe.';
  }
  if (location.length < 2) {
    errors.location = 'Specify the event city/venue or Virtual.';
  }
  if (budget.length > 0 && budget.length < 2) {
    errors.budget = 'Please enter an estimated event budget range.';
  }
  if (audienceGoals.length < 5) {
    errors.audienceGoals = 'Share at least a brief note on your audience and event goals.';
  }

  return {
    spam: false,
    valid: Object.keys(errors).length === 0,
    errors,
    cleaned: { nameOrg, email, engagementType, eventDate, location, budget, audienceGoals },
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const ip = getClientIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    return res.status(429).json({
      ok: false,
      message: 'Too many inquiry attempts from this address. Please wait a few minutes before trying again.',
    });
  }

  try {
    let parsed = req.body;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = Object.fromEntries(new URLSearchParams(parsed));
      }
    } else if (!parsed || typeof parsed !== 'object') {
      parsed = {};
    }

    const tokenResult = verifyToken(parsed.formToken);
    if (!tokenResult.valid) {
      const msg =
        tokenResult.reason === 'submitted_too_fast'
          ? 'Submission was too rapid. Please take a moment to review your details and submit again.'
          : 'Your form session expired or could not be verified. Please refresh and submit again.';
      return res.status(400).json({ ok: false, reason: tokenResult.reason, message: msg });
    }

    const validation = validateInquiry(parsed);
    if (validation.spam) {
      return res.status(400).json({ ok: false, message: 'Unable to process this request.' });
    }
    if (!validation.valid) {
      return res.status(422).json({
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

    console.log('[INQUIRY_RECEIVED]', JSON.stringify(record));

    // Persist to tmp or data directory safely
    try {
      const tmpFile = path.join(os.tmpdir(), 'inquiries.jsonl');
      await fs.promises.appendFile(tmpFile, `${JSON.stringify(record)}\n`, 'utf8');
    } catch (e) {
      // Non-fatal if ephemeral tmp filesystem error
    }

    return res.status(200).json({
      ok: true,
      inquiryId,
      message: 'Thank you. Your availability inquiry has been logged for Michael Graham’s team.',
    });
  } catch (err) {
    return res.status(400).json({ ok: false, message: 'Invalid inquiry payload.' });
  }
};
