/* Vercel serverless receiver for Google Ads lead form assets ("Lead form - Submit").
   Google hosts the form inside the ad, so these leads never touch the website:
   Google POSTs them here (lead delivery > webhook on the asset), and this relay
   reshapes each one into the same payload /api/lead sends, so the GHL Website
   Form Receiver -> New Lead Intake chain runs unchanged. Docs call the shape
   "webhook integration, API version 1.0": user_column_data rows keyed by
   column_id, plus lead_id / campaign_id / gcl_id and a shared google_key. */
const HOOK = 'https://services.leadconnectorhq.com/hooks/JECqHy0cJP2aT9gJyo8q/webhook-trigger/afa2d705-3d71-495d-81c7-88b8f7167b29';

/* Pasted into the asset's lead-delivery settings in Google Ads. Anything arriving
   without it is not Google and is refused. Env var wins so it can be rotated
   without a deploy; the constant keeps the endpoint working with zero setup. */
const KEY = process.env.GOOGLE_LEAD_FORM_KEY || 'cd6bad1818c3a0cb3eafbeac37bad7e6eac911b177b65274';

const lead = require('./lead.js');
const direct = require('./_ghl-direct.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const b = req.body || {};
  if (String(b.google_key || '') !== KEY) {
    console.error('google-lead-form: bad key', JSON.stringify({ got: String(b.google_key || '').slice(0, 8) }));
    return res.status(401).json({ ok: false, error: 'key' });
  }

  /* Column ids are fixed by Google for the standard questions; any custom
     question arrives under its own id and is kept for the message text. */
  const cols = {};
  (Array.isArray(b.user_column_data) ? b.user_column_data : []).forEach(c => {
    if (c && c.column_id) cols[c.column_id] = String(c.string_value || '').trim();
  });

  const name = (cols.FULL_NAME || ((cols.FIRST_NAME || '') + ' ' + (cols.LAST_NAME || '')).trim()).slice(0, 120);
  const email = (cols.EMAIL || '').slice(0, 160);
  /* Google sends E.164 (+614...); GHL stores E.164 too, so pass it through and
     only rewrite a leading 0 the way /api/lead does. No AU-mobile gate here: a
     paid lead with an odd number is still worth a phone call, not a 400. */
  const phone = (cols.PHONE_NUMBER || '').replace(/[\s()-]/g, '').replace(/^0/, '+61');
  const isTest = b.is_test === true || b.is_test === 'true';

  if (!name && !email && !phone) return res.status(400).json({ ok: false, error: 'empty' });

  const nameParts = name.split(/\s+/).filter(Boolean);
  const gclid = String(b.gcl_id || '').slice(0, 200);

  const bits = ['Google Ads lead form (in-ad, no website visit).'];
  if (isTest) bits.push('TEST DELIVERY from the Google Ads webhook checker - not a real person.');
  Object.keys(cols).forEach(k => {
    if (k !== 'FULL_NAME' && k !== 'FIRST_NAME' && k !== 'LAST_NAME' && k !== 'EMAIL' && k !== 'PHONE_NUMBER' && cols[k]) {
      bits.push(k.replace(/_/g, ' ').toLowerCase() + ': ' + cols[k].slice(0, 200) + '.');
    }
  });
  bits.push('Lead id: ' + String(b.lead_id || '').slice(0, 80) + '.');
  if (b.campaign_id) bits.push('Campaign id: ' + String(b.campaign_id).slice(0, 30) + '.');
  if (gclid) bits.push('Google Ads click: gclid=' + gclid + '.');

  /* Same keys the Receiver's "Create contact" step maps for website leads. The
     campaign only runs on first home buyers, so the goal is known; no timing
     question is asked, so none is sent and intake settles on lead-warm. */
  const body = {
    full_name: isTest ? 'ZZ GoogleAds Webhooktest' : (name || email || phone),
    first_name: isTest ? 'ZZ' : (nameParts[0] || name || email || phone),
    last_name: isTest ? 'GoogleAds Webhooktest' : nameParts.slice(1).join(' '),
    email: email,
    phone: phone,
    message: bits.join(' '),
    lead_source: 'Google Ads Lead Form',
    lead_source_detail: 'Google Ads Lead Form | google',
    utm_source: 'google',
    utm_medium: 'cpc',
    goal: 'Home Loan',
    finance_type: 'Home Loan'
  };
  if (gclid) body.gclid = gclid;
  const fit = lead.fitScore({ goal: 'Home Loan' });
  body.fit_score = fit.score;
  body.lead_temperature = fit.band;

  const payload = JSON.stringify(body);
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      lastStatus = r.status;
      if (r.ok) return res.status(200).json({ ok: true, via: 'webhook' });
      if (r.status >= 400 && r.status < 500) break; // GHL refusing on purpose; retry can't fix it
    } catch (e) { lastStatus = -1; }
    await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }

  /* Same billing-outage fallback as /api/lead: the REST API is not billed per
     execution. A non-2xx makes Google retry the delivery and flag it in the UI,
     and the lead stays downloadable from Ads for 30 days either way. */
  console.error('google-lead-form: webhook refused', JSON.stringify({ status: lastStatus }));
  if (direct.enabled()) {
    const d = await direct.deliver(body);
    if (d.ok || d.contactId) return res.status(200).json({ ok: true, via: 'api' });
  }
  return res.status(502).json({ ok: false, error: 'upstream', status: lastStatus });
};
