'use strict';

const crypto = require('node:crypto');

const FORM_SECRET = process.env.FORM_SECRET || 'squared-away-keynote-token-secret-2026';

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const payloadObj = {
    iat: Date.now(),
    nonce: crypto.randomBytes(12).toString('hex'),
  };

  const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', FORM_SECRET).update(payload).digest('base64url');
  const token = `${payload}.${sig}`;

  return res.status(200).json({ token });
};
