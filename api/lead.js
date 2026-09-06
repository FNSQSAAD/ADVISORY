// Vercel serverless relay: validates the funnel submission and forwards one
// normalised payload to the existing GHL inbound webhook (New Lead Intake).
const HOOK = 'https://services.leadconnectorhq.com/hooks/JECqHy0cJP2aT9gJyo8q/webhook-trigger/afa2d705-3d71-495d-81c7-88b8f7167b29';

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

  const payload = JSON.stringify({
    full_name: name,
    email: email,
    phone: phone.replace(/^0/, '+61'),
    message: (message ? message + ' ' : '') + 'Mobile: ' + phone.replace(/^\+61/, '0') + '.',
    lead_source: source
  });

  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(HOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      lastStatus = r.status;
      if (r.ok) return res.status(200).json({ ok: true });
    } catch (e) {
      lastStatus = -1;
    }
    await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }
  return res.status(502).json({ ok: false, error: 'upstream', status: lastStatus });
};
