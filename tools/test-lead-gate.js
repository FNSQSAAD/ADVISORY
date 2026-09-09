/* Proves /api/lead refuses a lead whose mobile has not been verified, and that
   nothing reaches GoHighLevel when it does. The upstream fetch is stubbed, so a
   forwarded payload here would be a real leak in production.
   Run: node tools/test-lead-gate.js                                            */
'use strict';

process.env.OTP_SECRET = 'test-secret-do-not-use-in-production';
process.env.FNSQ_RELAY_SECRET = 'test-relay-secret';

const path = require('path');
const otp = require(path.join(__dirname, '..', 'api', '_otp.js'));
const handler = require(path.join(__dirname, '..', 'api', 'lead.js'));

let pass = 0, fail = 0;
const failures = [];
const check = (name, cond, detail) => {
  if (cond) { pass++; return; }
  fail++; failures.push(name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''));
};

let forwarded = null;
global.fetch = async (url, opts) => {
  forwarded = { url, body: JSON.parse(opts.body) };
  return { ok: true, status: 200 };
};

function res() {
  const r = {
    statusCode: 0, payload: null,
    setHeader() {}, status(c) { r.statusCode = c; return r; },
    json(o) { r.payload = o; return r; }, end() { return r; }
  };
  return r;
}
async function post(body) {
  forwarded = null;
  const r = res();
  await handler({ method: 'POST', headers: {}, body }, r);
  return { res: r, forwarded };
}

const BASE = {
  full_name: 'Test Person',
  email: 'test@example.com',
  phone: '0491570016',
  lead_source: 'Website Contact Form',
  goal: 'Home loan: refinance',
  timing: 'ASAP'
};

(async () => {
  console.log('=== unverified leads are refused, and never forwarded ===');
  {
    let r = await post(BASE);
    check('no token -> 403', r.res.statusCode === 403, r.res.statusCode);
    check('no token -> error is "unverified"', r.res.payload.error === 'unverified');
    check('no token -> NOTHING sent to GHL', r.forwarded === null, r.forwarded && r.forwarded.url);

    r = await post(Object.assign({}, BASE, { verification: 'garbage' }));
    check('forged token -> 403', r.res.statusCode === 403);
    check('forged token -> nothing sent to GHL', r.forwarded === null);

    // a real token, but for a different number
    const other = otp.issueToken('+61491570099');
    r = await post(Object.assign({}, BASE, { verification: other }));
    check('token for another number -> 403', r.res.statusCode === 403);
    check('token for another number -> nothing sent', r.forwarded === null);

    // an expired token
    const realNow = Date.now;
    const stale = otp.issueToken('+61491570016');
    Date.now = () => realNow() + otp.TOKEN_TTL_MS + 5000;
    r = await post(Object.assign({}, BASE, { verification: stale }));
    Date.now = realNow;
    check('expired token -> 403', r.res.statusCode === 403);
    check('expired token -> nothing sent', r.forwarded === null);
  }

  console.log('=== a verified lead goes through unchanged ===');
  {
    const token = otp.issueToken('+61491570016');
    const r = await post(Object.assign({}, BASE, { verification: token }));
    check('verified -> 200', r.res.statusCode === 200, r.res.statusCode);
    check('verified -> forwarded to the GHL webhook',
      r.forwarded && /afa2d705-3d71-495d-81c7-88b8f7167b29/.test(r.forwarded.url));
    check('phone normalised for GHL', r.forwarded.body.phone === '+61491570016', r.forwarded.body.phone);
    check('goal still mapped', r.forwarded.body.goal === 'Refinance', r.forwarded.body.goal);
    check('timing still mapped', r.forwarded.body.timing === 'ASAP');
    check('first/last name still split', r.forwarded.body.first_name === 'Test' && r.forwarded.body.last_name === 'Person');
    check('the token itself is NOT forwarded to GHL', !('verification' in r.forwarded.body), Object.keys(r.forwarded.body));
  }

  console.log('=== the token accepts either phone format for the same number ===');
  {
    const token = otp.issueToken('+61491570016');
    const r = await post(Object.assign({}, BASE, { phone: '+61491570016', verification: token }));
    check('E.164 input accepted with the same token', r.res.statusCode === 200, r.res.statusCode);
  }

  console.log('=== honeypot still wins before anything else ===');
  {
    const r = await post(Object.assign({}, BASE, { website: 'spam' }));
    check('bot submission accepted silently', r.res.statusCode === 200);
    check('bot submission not forwarded', r.forwarded === null);
  }

  console.log('=== with verification switched off, behaviour is exactly as before ===');
  {
    delete process.env.OTP_SECRET;
    delete require.cache[require.resolve(path.join(__dirname, '..', 'api', '_otp.js'))];
    delete require.cache[require.resolve(path.join(__dirname, '..', 'api', 'lead.js'))];
    const h2 = require(path.join(__dirname, '..', 'api', 'lead.js'));
    forwarded = null;
    const r = res();
    await h2({ method: 'POST', headers: {}, body: BASE }, r);
    check('no secret -> unverified lead still accepted', r.statusCode === 200, r.statusCode);
    check('no secret -> still forwarded to GHL', forwarded !== null);
    process.env.OTP_SECRET = 'test-secret-do-not-use-in-production';
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log('\nFAILURES:'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('ALL GREEN');
})();
