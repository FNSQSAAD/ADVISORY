/* Stateless SMS verification for the lead forms.

   No database. A Vercel function has nowhere durable to keep a pending code, and
   two requests can land on different instances, so the code is never stored
   server-side. Instead:

     send  -> generate a 6-digit code, SMS it, and hand the browser a signed
              "challenge": {phone, expiry, nonce, sha256(code+nonce+secret)}.
              The challenge is HMAC-signed, so the browser cannot forge or read
              a valid one, and the code itself is never in it.
     check -> re-hash the submitted code against the challenge and compare.
              On success, issue a short-lived signed "verified" token bound to
              that phone number.

   /api/lead then refuses a submission whose phone is not covered by a valid
   token. Everything is verified with HMAC, so any instance can validate what
   any other instance issued.

   Requires two environment variables. If OTP_SECRET is absent, verification is
   OFF and the site behaves exactly as it did before - deploying this code alone
   changes nothing until the secrets are set.
     OTP_SECRET          any long random string; signs challenges and tokens
     FNSQ_RELAY_SECRET   the shared secret the Twilio relay already expects
     FNSQ_RELAY_URL      optional; defaults to the relay already in use         */
'use strict';

const crypto = require('crypto');

const RELAY_URL = process.env.FNSQ_RELAY_URL || 'https://fnsq-ghl-relay-3510-prod.twil.io/send-sms';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;    // a code is usable for 5 minutes
const TOKEN_TTL_MS = 30 * 60 * 1000;       // a verified number stays verified for 30

function secret() { return process.env.OTP_SECRET || ''; }
function enabled() { return !!secret(); }

/* Australian mobiles only, in the forms people type them. Returns E.164 or null. */
function normalisePhone(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  const m = digits.match(/^(?:\+?61|0)?(4\d{8})$/);
  return m ? '+61' + m[1] : null;
}

const b64u = buf => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function sign(payloadB64) {
  return b64u(crypto.createHmac('sha256', secret()).update(payloadB64).digest());
}

/* Constant-time compare so a signature cannot be discovered a byte at a time. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function pack(obj) {
  const body = b64u(JSON.stringify(obj));
  return body + '.' + sign(body);
}

function unpack(str) {
  const parts = String(str || '').split('.');
  if (parts.length !== 2) return null;
  if (!safeEqual(parts[1], sign(parts[0]))) return null;
  try { return JSON.parse(unb64u(parts[0]).toString('utf8')); } catch (e) { return null; }
}

function hashCode(code, nonce) {
  return crypto.createHash('sha256').update(code + '|' + nonce + '|' + secret()).digest('hex');
}

/* A 6-digit code from a cryptographic source. Math.random() is predictable
   enough that a determined attacker could narrow the search space. */
function newCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function makeChallenge(phone) {
  const code = newCode();
  const nonce = crypto.randomBytes(9).toString('hex');
  const challenge = pack({
    p: phone,
    n: nonce,
    c: hashCode(code, nonce),
    e: Date.now() + CHALLENGE_TTL_MS
  });
  return { code, challenge };
}

function checkChallenge(challenge, code, phone) {
  const data = unpack(challenge);
  if (!data) return { ok: false, reason: 'invalid' };
  if (Date.now() > data.e) return { ok: false, reason: 'expired' };
  if (phone && data.p !== phone) return { ok: false, reason: 'mismatch' };
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== 6) return { ok: false, reason: 'format' };
  if (!safeEqual(hashCode(clean, data.n), data.c)) return { ok: false, reason: 'wrong' };
  return { ok: true, phone: data.p };
}

function issueToken(phone) {
  return pack({ p: phone, e: Date.now() + TOKEN_TTL_MS, v: 1 });
}

function verifyToken(token, phone) {
  const data = unpack(token);
  if (!data || data.v !== 1) return false;
  if (Date.now() > data.e) return false;
  return data.p === phone;
}

/* Send through the Twilio relay the GHL workflows already use. The relay takes
   a shared secret; it is read from the environment and never lives in this file. */
async function sendCode(phone, code) {
  const relaySecret = process.env.FNSQ_RELAY_SECRET;
  if (!relaySecret) return { ok: false, reason: 'relay_not_configured' };
  const body = 'Your Finance Square verification code is ' + code +
    '. It expires in 5 minutes. We will never ask you for this code.';
  try {
    const r = await fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: relaySecret, to: phone, body: body })
    });
    const text = await r.text().catch(() => '');
    if (!r.ok) return { ok: false, reason: 'relay_' + r.status, detail: text.slice(0, 200) };
    return { ok: true, detail: text.slice(0, 200) };
  } catch (e) {
    return { ok: false, reason: 'relay_unreachable' };
  }
}

module.exports = {
  enabled, normalisePhone, makeChallenge, checkChallenge,
  issueToken, verifyToken, sendCode,
  CHALLENGE_TTL_MS, TOKEN_TTL_MS
};
