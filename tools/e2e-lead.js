/* End-to-end lead test: drives a full conversation through /api/chat and lets it
   POST into the real GoHighLevel intake, then prints what was sent.

   Phone numbers come from the ACMA drama range (0491 570 006 - 0491 570 016),
   which is reserved for fiction and cannot reach a real handset. That matters
   because the GHL intake workflow fires a Twilio SMS to whatever number arrives,
   and GHL upserts contacts by PHONE as well as email, so a made-up number risks
   both texting a stranger and overwriting a real contact record.

   Usage:
     node tools/e2e-lead.js                       # against localhost:8830
     node tools/e2e-lead.js https://fnsq.com.au   # against production
     node tools/e2e-lead.js <base> --dry          # stop before consent, send nothing
*/
'use strict';

const BASE = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2].replace(/\/$/, '') : 'http://localhost:8830';
const DRY = process.argv.includes('--dry');
const PHONE = process.env.E2E_PHONE || '0491570006';
const STAMP = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');
const EMAIL = process.env.E2E_EMAIL || `chatbot.test.${STAMP}@example.com`;
const NAME = process.env.E2E_NAME || 'CHATBOT TEST Delete Me';

const SCRIPT = [
  'how much can I borrow if I earn 145k, spend 3200 a month and have a 130k deposit',
  'what is LMI',
  'take my details',
  'Refinancing',
  'ASAP',
  '20% or more',
  'Full-time PAYG',
  NAME,
  EMAIL,
  PHONE,
  'yes that is fine'
];

function render(blocks) {
  return (blocks || []).map(b => {
    if (b.type === 'text' || b.type === 'hint') return b.text;
    if (b.type === 'calc') return '[' + b.title + '] ' + b.rows.map(r => r[0] + ': ' + r[1]).join(' | ');
    if (b.type === 'card') return '[' + b.title + '] ' + b.items.join(' / ');
    if (b.type === 'booking') return '[booking calendar: ' + b.url + ']';
    if (b.type === 'link') return '[link ' + b.href + ']';
    return '[' + b.type + ']';
  }).join('\n     ');
}

(async () => {
  console.log('e2e lead against ' + BASE + (DRY ? '  (DRY: stops before consent)' : ''));
  console.log('identity: ' + NAME + ' / ' + EMAIL + ' / ' + PHONE + '\n');

  let state = null;
  const steps = DRY ? SCRIPT.slice(0, -1) : SCRIPT;

  for (const msg of steps) {
    const r = await fetch(BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, state })
    });
    if (!r.ok) { console.log('HTTP ' + r.status + ' on "' + msg + '"'); process.exit(1); }
    const d = await r.json();
    state = d.state;

    console.log('YOU  ' + msg);
    console.log('BOT  ' + render(d.blocks));
    if (d.chips && d.chips.length) console.log('     chips: ' + d.chips.join(' | '));
    if (d.action) console.log('     action: ' + JSON.stringify(d.action));
    if (!d.compliance || !d.compliance.licence.includes('391237')) {
      console.log('     !! COMPLIANCE MISSING');
      process.exitCode = 1;
    }
    console.log('');

    if (d.action && d.action.type === 'lead_captured') {
      console.log('LEAD ACCEPTED by /api/lead -> GHL webhook afa2d705 (high intent: ' + d.action.highIntent + ')');
      console.log('Check GoHighLevel for the contact, then DELETE it.');
      return;
    }
    if (d.action && d.action.type === 'lead_failed') {
      console.log('LEAD FAILED - the bot correctly told the visitor rather than faking success.');
      process.exit(1);
    }
  }
  if (DRY) console.log('Dry run complete: stopped at the consent question, nothing sent.');
})();
