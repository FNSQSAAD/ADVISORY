// Vercel serverless relay: validates the funnel submission and forwards one
// normalised payload to the existing GHL inbound webhook (New Lead Intake).
const HOOK = 'https://services.leadconnectorhq.com/hooks/JECqHy0cJP2aT9gJyo8q/webhook-trigger/afa2d705-3d71-495d-81c7-88b8f7167b29';
const otp = require('./_otp.js');
const direct = require('./_ghl-direct.js');

/* The GHL contact fields these map onto are RADIO/SINGLE_OPTIONS pickers, so a value
   that isn't spelled exactly like an option is silently dropped by GHL. Normalise here
   — one place, both callers — and send nothing at all rather than a value we can't
   vouch for. "How quickly do you need the funds?" (8bkAWljOdPSjMdbPeZ3y) is what the
   New Lead Intake branch tests for "ASAP" to decide lead-hot vs lead-warm. */
const TIMING = {
  // contact.html already speaks GHL's vocabulary exactly
  'ASAP': 'ASAP',
  'Within 1 month': 'Within 1 month',
  '1–3 months': '1–3 months',
  '3+ months': '3+ months',
  'Just researching': 'Just researching',
  // get-started.html (buy path) asks the same question in its own words
  'As soon as possible': 'ASAP',
  'Within 3 months': '1–3 months',
  '3–6 months': '3+ months',
  '6–12 months': '3+ months',
  'Just planning ahead': 'Just researching'
};

// "What do you need finance for?" (OGFSjP0wxo36YxwWuCMj)
const GOAL = {
  'Home loan: buy my first home': 'Home Loan',
  'Home loan: buy my next home': 'Home Loan',
  'Home loan: refinance': 'Refinance',
  'Home loan: invest in property': 'Home Loan',
  'Self-employed lending': 'Home Loan',
  'Business & Commercial finance': 'Business Loan',
  'Asset & Equipment finance': 'Equipment Finance',
  'Personal loan': 'Personal Loan',
  'Not sure yet': 'Other',
  // get-started.html sends the funnel path rather than a dropdown label
  'buy': 'Home Loan',
  'loan': 'Refinance'
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const b = req.body || {};
  // honeypot: silently accept bot submissions without forwarding
  if (b.website) return res.status(200).json({ ok: true });

  const name = String(b.full_name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().slice(0, 160);
  const phone = String(b.phone || '').replace(/[\s()-]/g, '');
  const message = String(b.message || '').trim().slice(0, 2000);
  const source = String(b.lead_source || 'Website Get Started').trim().slice(0, 120);

  if (name.length < 2) return res.status(400).json({ ok: false, error: 'name' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: 'email' });
  if (!/^(04\d{8}|\+614\d{8})$/.test(phone)) return res.status(400).json({ ok: false, error: 'phone' });

  /* SMS verification gate. Only enforced once OTP_SECRET is set, so deploying
     this ahead of the secrets changes nothing; setting them switches it on for
     every caller at once (contact form, Get Started funnel and the chatbot all
     land here). A lead that reaches this point without a token covering its own
     number is refused rather than forwarded to GHL. */
  if (otp.enabled()) {
    const e164 = otp.normalisePhone(phone);
    if (!e164 || !otp.verifyToken(b.verification, e164)) {
      return res.status(403).json({ ok: false, error: 'unverified',
        message: 'Please verify your mobile number before submitting.' });
    }
  }

  /* Split the name so GoHighLevel can greet people properly.

     Every caller here posts a single `full_name`, which the GHL "Create contact"
     action maps straight into First Name, so {{contact.first_name}} rendered the
     whole thing and the welcome email opened "Hi Marcus Webb,". GHL's workflow
     builder has no string functions, so the split has to happen here.

     `full_name` is still sent unchanged, so this is additive: until the Receiver
     is remapped, GHL ignores the two new keys and nothing changes. */
  const nameParts = name.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || name;
  const lastName = nameParts.slice(1).join(' ');

  const body = {
    full_name: name,
    first_name: firstName,
    last_name: lastName,
    email: email,
    phone: phone.replace(/^0/, '+61'),
    message: (message ? message + ' ' : '') + 'Mobile: ' + phone.replace(/^\+61/, '0') + '.',
    lead_source: source
  };

  // Only ever send a recognised option; an unmapped answer is omitted, which leaves the
  // intake branch to fall through to lead-warm rather than mislabel the lead.
  const timing = TIMING[String(b.timing || '').trim()];
  const goal = GOAL[String(b.goal || '').trim()];
  if (timing) body.timing = timing;
  if (goal) body.goal = goal;

  const payload = JSON.stringify(body);

  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(HOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      lastStatus = r.status;
      if (r.ok) return res.status(200).json({ ok: true, via: 'webhook' });
      lastBody = await r.text().catch(() => '');
      /* A 4xx is GHL refusing the request on purpose (a billing failure is a
         422), and retrying the same thing will be refused the same way. Stop and
         go straight to the fallback rather than burning the visitor's time. */
      if (r.status >= 400 && r.status < 500) break;
    } catch (e) {
      lastStatus = -1;
    }
    await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }

  /* The webhook would not take it. Before telling a visitor who has already
     verified their mobile that something went wrong, deliver the lead through
     GHL's REST API, which is not billed per execution and so survives an empty
     wallet. See api/_ghl-direct.js for the incident that made this necessary. */
  console.error('lead webhook refused', JSON.stringify({ status: lastStatus, body: lastBody.slice(0, 200) }));
  if (direct.enabled()) {
    const d = await direct.deliver(body);
    if (d.ok) {
      console.warn('lead delivered via API fallback', JSON.stringify({ contactId: d.contactId, webhookStatus: lastStatus }));
      return res.status(200).json({ ok: true, via: 'api' });
    }
    console.error('lead API fallback FAILED', JSON.stringify(d));
    // Created but not enrolled still means the lead is in the CRM; say so.
    if (d.contactId) return res.status(200).json({ ok: true, via: 'api-unenrolled' });
  }
  return res.status(502).json({ ok: false, error: 'upstream', status: lastStatus });
};
