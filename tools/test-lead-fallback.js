/* Proves api/lead.js delivers a lead through the GHL REST API when the inbound
   webhook refuses it - the 2026-09-11 empty-wallet incident, where every website
   lead got a 422 "Billing failure" and was dropped.
   Network is fully stubbed: nothing here touches GHL.
   Run: node tools/test-lead-fallback.js           (exit 1 on failure)          */
'use strict';

const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const failures = [];
const check = (name, cond, detail) => {
  if (cond) { pass++; return; }
  fail++; failures.push(name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''));
};

function fresh(env) {
  for (const k of ['OTP_SECRET', 'GHL_API_KEY', 'GHL_LOCATION_ID']) delete process.env[k];
  Object.assign(process.env, env);
  for (const f of ['lead.js', '_ghl-direct.js', '_otp.js']) {
    delete require.cache[require.resolve(path.join(ROOT, 'api', f))];
  }
  return require(path.join(ROOT, 'api', 'lead.js'));
}

/* A scripted GHL. `webhook` is the status the inbound webhook answers with;
   `api` lets individual REST calls be made to fail. Every call is recorded. */
function stubGhl({ webhook = 200, api = {} } = {}) {
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ url, method: opts.method || 'GET', body, auth: (opts.headers || {}).Authorization });
    if (/webhook-trigger/.test(url)) {
      const ok = webhook >= 200 && webhook < 300;
      const text = ok ? '{"status":"Success"}'
        : '{"status":"Error: Billing failure","message":"COMPANY does not have enough funds"}';
      return { ok, status: webhook, text: async () => text };
    }
    let status = 200, json = {};
    if (/\/contacts\/upsert$/.test(url)) { status = api.upsert || 200; json = { contact: { id: 'CONTACT123' } }; }
    else if (/\/notes$/.test(url)) { status = api.note || 201; json = { note: {} }; }
    else if (/\/workflow\//.test(url)) { status = api.enrol || 201; json = { succeded: true }; }
    const ok = status >= 200 && status < 300;
    return { ok, status, text: async () => ok ? JSON.stringify(json) : '{"message":"forced failure"}' };
  };
  return calls;
}

function res() {
  const r = { statusCode: 0, payload: null, setHeader() {}, status(c) { r.statusCode = c; return r; },
    json(o) { r.payload = o; return r; }, end() { return r; } };
  return r;
}
async function post(handler, body) { const r = res(); await handler({ method: 'POST', headers: {}, body }, r); return r; }

const LEAD = {
  full_name: 'Sam Rivera', email: 'sam@example.com', phone: '0491570016',
  lead_source: 'Website Contact Form', goal: 'Home loan: refinance', timing: 'ASAP',
  message: 'Refinancing, 20% equity.'
};

// silence the module's own logging during the run
const quiet = { error: console.error, warn: console.warn };
console.error = () => {}; console.warn = () => {};

(async () => {
  const out = [];

  /* 1. healthy webhook: the fallback must not run at all */
  {
    const h = fresh({ GHL_API_KEY: 'pit-test', GHL_LOCATION_ID: 'LOC1' });
    const calls = stubGhl({ webhook: 200 });
    const r = await post(h, LEAD);
    check('healthy webhook -> 200', r.statusCode === 200);
    check('healthy webhook -> delivered via webhook', r.payload.via === 'webhook', r.payload);
    check('healthy webhook -> REST API never touched', calls.every(c => /webhook-trigger/.test(c.url)), calls.map(c => c.url));
  }

  /* 2. THE INCIDENT: 422 billing failure, fallback configured */
  {
    const h = fresh({ GHL_API_KEY: 'pit-test', GHL_LOCATION_ID: 'LOC1' });
    const calls = stubGhl({ webhook: 422 });
    const r = await post(h, LEAD);
    check('422 -> visitor still gets 200', r.statusCode === 200, r.statusCode);
    check('422 -> delivered via API', r.payload.via === 'api', r.payload);

    const hooks = calls.filter(c => /webhook-trigger/.test(c.url));
    check('422 is not retried (a billing refusal will not change)', hooks.length === 1, hooks.length);

    const up = calls.find(c => /\/contacts\/upsert$/.test(c.url));
    check('contact upserted', !!up);
    check('upsert carries the location', up && up.body.locationId === 'LOC1');
    check('upsert carries first name', up && up.body.firstName === 'Sam', up && up.body.firstName);
    check('upsert carries last name', up && up.body.lastName === 'Rivera', up && up.body.lastName);
    check('upsert carries email and E.164 phone', up && up.body.email === 'sam@example.com' && up.body.phone === '+61491570016');
    check('upsert carries the lead source', up && up.body.source === 'Website Contact Form');
    const cf = (up && up.body.customFields) || [];
    check('timing lands in the funds-timing field', cf.some(f => f.id === '8bkAWljOdPSjMdbPeZ3y' && f.value === 'ASAP'), cf);
    check('goal lands in the finance-for field', cf.some(f => f.id === 'OGFSjP0wxo36YxwWuCMj' && f.value === 'Refinance'), cf);
    check('API calls use the bearer token', up && up.auth === 'Bearer pit-test');

    const note = calls.find(c => /\/notes$/.test(c.url));
    check('the enquiry text is kept as a note', note && /Refinancing, 20% equity/.test(note.body.body));

    const enrol = calls.find(c => /\/workflow\//.test(c.url));
    check('contact enrolled in New Lead Intake',
      enrol && /\/contacts\/CONTACT123\/workflow\/3482058f-746c-447a-b273-8b92c7f9ac65$/.test(enrol.url), enrol && enrol.url);
    check('enrolment is a POST', enrol && enrol.method === 'POST');
  }

  /* 3. webhook down AND no token configured: old behaviour, honest failure */
  {
    const h = fresh({});
    const calls = stubGhl({ webhook: 422 });
    const r = await post(h, LEAD);
    check('no token -> 502, not a false success', r.statusCode === 502, r.statusCode);
    check('no token -> REST API never attempted', !calls.some(c => /\/contacts\//.test(c.url)));
  }

  /* 4. contact created but enrolment fails: the lead is still in the CRM */
  {
    const h = fresh({ GHL_API_KEY: 'pit-test', GHL_LOCATION_ID: 'LOC1' });
    const calls = stubGhl({ webhook: 422, api: { enrol: 500 } });
    const r = await post(h, LEAD);
    check('enrol failure -> still 200 (contact exists)', r.statusCode === 200, r.statusCode);
    check('enrol failure -> reported as unenrolled', r.payload.via === 'api-unenrolled', r.payload);
    check('enrolment retried 3 times', calls.filter(c => /\/workflow\//.test(c.url)).length === 3);
  }

  /* 5. the whole API is down too: fail honestly */
  {
    const h = fresh({ GHL_API_KEY: 'pit-test', GHL_LOCATION_ID: 'LOC1' });
    stubGhl({ webhook: 422, api: { upsert: 401 } });
    const r = await post(h, LEAD);
    check('webhook AND API down -> 502', r.statusCode === 502, r.statusCode);
  }

  /* 6. a 5xx from the webhook is transient: it IS retried before falling back */
  {
    const h = fresh({ GHL_API_KEY: 'pit-test', GHL_LOCATION_ID: 'LOC1' });
    const calls = stubGhl({ webhook: 503 });
    const r = await post(h, LEAD);
    check('5xx -> retried 3 times before fallback', calls.filter(c => /webhook-trigger/.test(c.url)).length === 3);
    check('5xx -> then delivered via API', r.payload.via === 'api', r.payload);
  }

  /* 7. the fallback never bypasses verification */
  {
    const h = fresh({ OTP_SECRET: 'x'.repeat(40), GHL_API_KEY: 'pit-test', GHL_LOCATION_ID: 'LOC1' });
    const calls = stubGhl({ webhook: 422 });
    const r = await post(h, LEAD);  // no verification token
    check('unverified lead still refused with the fallback on', r.statusCode === 403, r.statusCode);
    check('unverified lead reaches neither path', calls.length === 0, calls.map(c => c.url));
  }

  console.error = quiet.error; console.warn = quiet.warn;
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log('\nFAILURES:'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('ALL GREEN');
})();
