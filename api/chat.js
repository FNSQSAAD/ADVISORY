/* POST /api/chat - the chatbot endpoint.

   The engine is pure, so this layer does the three things that touch the outside
   world: rate limiting, the lead POST into GoHighLevel, and shaping the reply.

   Lead submissions are forwarded to this site's own /api/lead relay, which is the
   single tested path into GHL (webhook afa2d705 -> "Website Form Receiver" ->
   "New Lead Intake"). Deliberately not a second capture path. */
'use strict';

const engine = require('./_engine.js');

const MAX_MESSAGE = 1000;
const MAX_TURNS = 120;

/* Per-instance rate limit. Serverless instances are not shared, so this is a
   speed bump against a single abusive client rather than a global quota - which
   is all a public, unauthenticated, no-cost-per-call endpoint needs. */
const seen = new Map();
const WINDOW = 60000, LIMIT = 25;
function limited(ip) {
  const now = Date.now();
  const rec = seen.get(ip);
  if (!rec || now - rec.start > WINDOW) { seen.set(ip, { start: now, n: 1 }); return false; }
  rec.n++;
  if (seen.size > 5000) seen.clear();        // bound memory on a long-lived instance
  return rec.n > LIMIT;
}

function leadEndpoint(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'fnsq.com.au';
  const proto = /localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https';
  return proto + '://' + host + '/api/lead';
}

async function submitLead(req, payload) {
  const body = {
    full_name: payload.full_name,
    email: payload.email,
    phone: payload.phone,
    message: payload.message,
    lead_source: payload.lead_source,
    goal: payload.goal,
    timing: payload.timing
  };
  const url = leadEndpoint(req);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (r.ok) return { ok: true };
      // A 400 is our own validation rejecting the data; retrying cannot fix it.
      if (r.status === 400) return { ok: false, permanent: true, status: 400 };
    } catch (e) { /* fall through to the retry */ }
    await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
  }
  return { ok: false, status: 502 };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  if (limited(ip)) {
    return res.status(429).json({
      ok: true,
      blocks: [{ type: 'text', text: 'You are going a bit fast for me. Give it a moment and try again, or call ' + '0450 355 604' + ' if it is urgent.' }],
      chips: [], compliance: engine.COMPLIANCE
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const message = String(body.message || '').slice(0, MAX_MESSAGE);
  const state = (body.state && typeof body.state === 'object') ? body.state : null;
  if (state && state.turns > MAX_TURNS) {
    return res.status(200).json({
      ok: true,
      blocks: [{ type: 'text', text: 'We have covered a lot here. At this point a 15-minute call with Priya will get you further than I can.' }],
      chips: ['Book a call'], state: engine.freshState(), compliance: engine.COMPLIANCE,
      action: { type: 'booking', url: engine.BOOKING_URL }
    });
  }

  let out;
  try {
    out = engine.respond(message, state);
  } catch (e) {
    console.error('chat engine error:', e && e.stack || e);
    return res.status(200).json({
      ok: true,
      blocks: [{ type: 'text', text: 'Something went wrong on my end, sorry. Priya is on 0450 355 604, or book a 15-minute call and she will pick it up from there.' }],
      chips: ['Book a call'], compliance: engine.COMPLIANCE,
      action: { type: 'booking', url: engine.BOOKING_URL }
    });
  }

  // The engine signals a completed, consented lead by attaching `submit`.
  if (out.submit) {
    const high = out.submit._highIntent;
    const first = (out.state.lead.firstName || 'there');
    const r = await submitLead(req, out.submit);

    if (r.ok) {
      out.state.lead.submitted = true;
      out.state.flow = null;
      out.blocks = [
        { type: 'text', text: 'Done, ' + first + '. That is with Priya now.' },
        {
          type: 'card', title: 'What happens next', items: [
            'A confirmation email and SMS land in the next few minutes.',
            high ? 'You are flagged as a priority callback, so expect to hear from Priya today.'
              : 'Priya will be in touch to arrange your free 15-minute strategy call.',
            'No credit check has been run and nothing has been applied for.'
          ]
        },
        { type: 'text', text: 'If you would rather lock the time in yourself right now, pick a slot here:' },
        { type: 'booking', url: engine.BOOKING_URL, title: 'Free 15-minute strategy call' }
      ];
      out.chips = ['I have another question'];
      out.action = { type: 'lead_captured', highIntent: !!high };
    } else {
      // Never tell someone their enquiry is in when it is not.
      out.state.flow = null; out.state.step = null;
      out.blocks = [
        { type: 'text', text: 'I could not get that through to our system just now, and I am not going to tell you it worked when it did not.' },
        {
          type: 'card', title: 'Please use one of these instead', items: [
            'Call Priya on 0450 355 604',
            'Email info@fnsq.com.au',
            'Book a slot on the calendar below, which goes through a different system'
          ]
        },
        { type: 'booking', url: engine.BOOKING_URL, title: 'Free 15-minute strategy call' }
      ];
      out.chips = [];
      out.action = { type: 'lead_failed' };
    }
    delete out.submit;
  }

  return res.status(200).json({
    ok: true,
    blocks: out.blocks,
    chips: out.chips || [],
    action: out.action || null,
    estimate: !!out.estimate,
    state: out.state,
    compliance: out.compliance
  });
};
