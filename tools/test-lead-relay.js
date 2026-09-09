/* Tests api/lead.js without hitting GoHighLevel: the upstream fetch is stubbed and
   the payload it WOULD have sent is captured and asserted.
   Run: node tools/test-lead-relay.js            (exit 1 on failure)            */
'use strict';

const path = require('path');
const handler = require(path.join(__dirname, '..', 'api', 'lead.js'));

let pass = 0, fail = 0;
const failures = [];
const check = (name, cond, detail) => {
  if (cond) { pass++; return; }
  fail++; failures.push(name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''));
};

/* Capture the outbound payload instead of sending it. */
const realFetch = global.fetch;
let sent = null;
global.fetch = async (url, opts) => {
  sent = { url, body: JSON.parse(opts.body) };
  return { ok: true, status: 200 };
};

function res() {
  const r = {
    statusCode: 0, payload: null, headers: {},
    setHeader(k, v) { r.headers[k] = v; },
    status(c) { r.statusCode = c; return r; },
    json(o) { r.payload = o; return r; },
    end() { return r; }
  };
  return r;
}

async function post(body) {
  sent = null;
  const r = res();
  await handler({ method: 'POST', headers: {}, body }, r);
  return { res: r, sent };
}

const VALID = {
  full_name: 'Marcus Webb',
  email: 'marcus@example.com',
  phone: '0491570014',
  lead_source: 'Website Chatbot',
  goal: 'Home loan: buy my next home',
  timing: 'ASAP'
};

(async () => {
  console.log('=== name splitting (the 4B fix) ===');
  const names = [
    ['Marcus Webb', 'Marcus', 'Webb'],
    ['Priya', 'Priya', ''],                                  // single name, no last name
    ['Mary Jane Watson', 'Mary', 'Jane Watson'],             // middle name goes to last
    ['  Sarah   Chen  ', 'Sarah', 'Chen'],                   // stray whitespace
    ['Anne-Marie O\'Brien', 'Anne-Marie', 'O\'Brien'],       // hyphen and apostrophe survive
    ['Nguyen Van Minh', 'Nguyen', 'Van Minh']
  ];
  for (const [full, first, last] of names) {
    const { sent } = await post(Object.assign({}, VALID, { full_name: full }));
    check(`"${full}" -> first`, sent.body.first_name === first, sent.body.first_name);
    check(`"${full}" -> last`, sent.body.last_name === last, sent.body.last_name);
    // full_name must survive untouched: the Receiver still maps it today.
    check(`"${full}" -> full_name preserved`, sent.body.full_name === full.trim().replace(/\s+/g, ' ') || sent.body.full_name === full.trim(), sent.body.full_name);
  }

  console.log('=== nothing else about the payload changed ===');
  {
    const { res: r, sent } = await post(VALID);
    check('returns 200', r.statusCode === 200, r.statusCode);
    check('posts to the same GHL webhook', /afa2d705-3d71-495d-81c7-88b8f7167b29/.test(sent.url), sent.url);
    check('phone normalised to +61', sent.body.phone === '+61491570014', sent.body.phone);
    check('email passed through', sent.body.email === 'marcus@example.com');
    check('lead_source passed through', sent.body.lead_source === 'Website Chatbot');
    check('goal still mapped', sent.body.goal === 'Home Loan', sent.body.goal);
    check('timing still mapped', sent.body.timing === 'ASAP', sent.body.timing);
    check('mobile still appended to message', /Mobile: 0491570014\./.test(sent.body.message), sent.body.message);
    // The exact key set the Receiver may read. Two added, none removed.
    check('payload keys', JSON.stringify(Object.keys(sent.body).sort()) ===
      JSON.stringify(['email', 'first_name', 'full_name', 'last_name', 'lead_source', 'message', 'phone', 'timing', 'goal'].sort()),
      Object.keys(sent.body));
  }

  console.log('=== validation unchanged ===');
  {
    let r = (await post(Object.assign({}, VALID, { full_name: 'X' }))).res;
    check('rejects a 1-character name', r.statusCode === 400 && r.payload.error === 'name');
    r = (await post(Object.assign({}, VALID, { email: 'nope' }))).res;
    check('rejects a bad email', r.statusCode === 400 && r.payload.error === 'email');
    r = (await post(Object.assign({}, VALID, { phone: '0391234567' }))).res;
    check('rejects a landline', r.statusCode === 400 && r.payload.error === 'phone');
    const hp = await post(Object.assign({}, VALID, { website: 'spam' }));
    check('honeypot accepted but not forwarded', hp.res.statusCode === 200 && hp.sent === null);
  }

  console.log('=== unmapped goal/timing are omitted, not guessed ===');
  {
    const { sent } = await post(Object.assign({}, VALID, { goal: 'Something else', timing: 'whenever' }));
    check('unknown goal omitted', !('goal' in sent.body), sent.body.goal);
    check('unknown timing omitted', !('timing' in sent.body), sent.body.timing);
    check('name split still present', sent.body.first_name === 'Marcus' && sent.body.last_name === 'Webb');
  }

  global.fetch = realFetch;
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log('\nFAILURES:'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('ALL GREEN');
})();
