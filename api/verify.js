/* POST /api/verify - SMS verification for the lead forms.

     { action: "send",  phone }                  -> { ok, challenge }
     { action: "check", phone, code, challenge } -> { ok, token }

   Every code costs a real SMS, so "send" is rate limited hard: an unthrottled
   endpoint is a way for a bot to spend the client's Twilio balance. "check" is
   limited separately because that is the brute-force surface.

   The limits are per-instance, which is a speed bump rather than a global
   quota - the honest ceiling for a stateless function with no shared store. It
   is combined with a 5-minute code lifetime and a 6-digit code, which is what
   actually makes guessing impractical. */
'use strict';

const otp = require('./_otp.js');

/* Two independent buckets. Keyed by IP and by phone, because a bot rotating IPs
   against one number and a bot hammering many numbers from one IP are different
   attacks and both matter. */
const buckets = new Map();
function hit(key, limit, windowMs) {
  const now = Date.now();
  const rec = buckets.get(key);
  if (!rec || now - rec.start > windowMs) { buckets.set(key, { start: now, n: 1 }); return false; }
  rec.n++;
  if (buckets.size > 8000) {                       // bound memory on a long-lived instance
    for (const [k, v] of buckets) if (now - v.start > windowMs) buckets.delete(k);
  }
  return rec.n > limit;
}

const MIN = 60000;
const LIMITS = {
  sendPerPhone: [3, 15 * MIN],   // 3 codes per number per 15 min
  sendPerIp: [6, 15 * MIN],      // 6 codes per IP per 15 min
  checkPerIp: [12, 10 * MIN],    // 12 guesses per IP per 10 min
  checkPerPhone: [6, 10 * MIN]   // 6 guesses per number per 10 min
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  if (!otp.enabled()) {
    return res.status(503).json({ ok: false, error: 'not_configured',
      message: 'Phone verification is not switched on yet.' });
  }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  const phone = otp.normalisePhone(b.phone);
  if (!phone) {
    return res.status(400).json({ ok: false, error: 'phone',
      message: 'Enter an Australian mobile number, starting 04.' });
  }

  /* ---------------------------------------------------------------- send */
  if (b.action === 'send') {
    if (hit('sp:' + phone, LIMITS.sendPerPhone[0], LIMITS.sendPerPhone[1]) ||
        hit('si:' + ip, LIMITS.sendPerIp[0], LIMITS.sendPerIp[1])) {
      return res.status(429).json({ ok: false, error: 'rate',
        message: 'Too many codes requested. Wait a few minutes, or call us on 0495 040 500.' });
    }

    const { code, challenge } = otp.makeChallenge(phone);
    const sent = await otp.sendCode(phone, code);
    if (!sent.ok) {
      console.error('otp send failed:', sent.reason, sent.detail || '');
      return res.status(502).json({ ok: false, error: 'send_failed',
        message: 'We could not send your code just now. Please try again, or call us on 0495 040 500.' });
    }
    // The code is never returned to the browser.
    return res.status(200).json({ ok: true, challenge, expiresIn: otp.CHALLENGE_TTL_MS / 1000 });
  }

  /* --------------------------------------------------------------- check */
  if (b.action === 'check') {
    if (hit('cp:' + phone, LIMITS.checkPerPhone[0], LIMITS.checkPerPhone[1]) ||
        hit('ci:' + ip, LIMITS.checkPerIp[0], LIMITS.checkPerIp[1])) {
      return res.status(429).json({ ok: false, error: 'rate',
        message: 'Too many attempts. Request a new code in a few minutes.' });
    }

    const result = otp.checkChallenge(b.challenge, b.code, phone);
    if (!result.ok) {
      const message = result.reason === 'expired'
        ? 'That code has expired. Send yourself a new one.'
        : 'That code is not right. Check the message and try again.';
      return res.status(400).json({ ok: false, error: result.reason, message });
    }
    return res.status(200).json({ ok: true, token: otp.issueToken(phone) });
  }

  return res.status(400).json({ ok: false, error: 'action' });
};
