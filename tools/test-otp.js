/* Tests the SMS verification gate. No network: the relay send is stubbed and the
   code it would have texted is captured, so the whole challenge/token cycle runs
   offline.
   Run: node tools/test-otp.js            (exit 1 on failure)                    */
'use strict';

process.env.OTP_SECRET = 'test-secret-do-not-use-in-production';
process.env.FNSQ_RELAY_SECRET = 'test-relay-secret';

const path = require('path');
const otp = require(path.join(__dirname, '..', 'api', '_otp.js'));

let pass = 0, fail = 0;
const failures = [];
const check = (name, cond, detail) => {
  if (cond) { pass++; return; }
  fail++; failures.push(name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''));
};

/* Capture what would have been texted. */
const realFetch = global.fetch;
let lastSms = null;
global.fetch = async (url, opts) => {
  lastSms = { url, body: JSON.parse(opts.body) };
  return { ok: true, status: 200, text: async () => '{"ok":true,"sid":"SMtest"}' };
};

(async () => {
  console.log('=== phone normalisation: only Australian mobiles ===');
  const good = [
    ['0491570016', '+61491570016'], ['0491 570 016', '+61491570016'],
    ['+61491570016', '+61491570016'], ['61491570016', '+61491570016'],
    ['0491-570-016', '+61491570016'], ['(0491) 570 016', '+61491570016']
  ];
  for (const [raw, want] of good) check('accepts ' + raw, otp.normalisePhone(raw) === want, otp.normalisePhone(raw));
  const bad = ['0391234567', '1300123456', '049157001', '04915700161', '', null, 'not a phone',
    '+15551234567', '0291234567', '+6149157001'];
  for (const raw of bad) check('rejects ' + JSON.stringify(raw), otp.normalisePhone(raw) === null, otp.normalisePhone(raw));

  console.log('=== the happy path ===');
  const phone = '+61491570016';
  const { code, challenge } = otp.makeChallenge(phone);
  check('code is 6 digits', /^\d{6}$/.test(code), code);
  check('challenge never contains the code', !challenge.includes(code), challenge);
  const ok = otp.checkChallenge(challenge, code, phone);
  check('correct code verifies', ok.ok === true, ok);
  const token = otp.issueToken(phone);
  check('token verifies for that number', otp.verifyToken(token, phone) === true);

  console.log('=== the attacks that matter ===');
  check('wrong code rejected', otp.checkChallenge(challenge, '000000', phone).ok === false);
  check('empty code rejected', otp.checkChallenge(challenge, '', phone).ok === false);
  check('short code rejected', otp.checkChallenge(challenge, '12345', phone).ok === false);
  check('token for one number does not verify another',
    otp.verifyToken(token, '+61491570017') === false);
  check('challenge bound to its number',
    otp.checkChallenge(challenge, code, '+61491570017').ok === false);

  // forge attempts
  check('garbage challenge rejected', otp.checkChallenge('nonsense', code, phone).ok === false);
  check('challenge with no signature rejected',
    otp.checkChallenge(challenge.split('.')[0], code, phone).ok === false);
  const tampered = challenge.split('.')[0].slice(0, -2) + 'AA.' + challenge.split('.')[1];
  check('tampered payload rejected', otp.checkChallenge(tampered, code, phone).ok === false);
  const badSig = challenge.split('.')[0] + '.' + 'x'.repeat(challenge.split('.')[1].length);
  check('forged signature rejected', otp.checkChallenge(badSig, code, phone).ok === false);
  check('garbage token rejected', otp.verifyToken('nonsense', phone) === false);
  check('token payload cannot be swapped', (() => {
    const parts = otp.issueToken('+61491570099').split('.');
    const other = otp.issueToken(phone).split('.');
    return otp.verifyToken(parts[0] + '.' + other[1], '+61491570099') === false;
  })());

  console.log('=== a challenge signed with a different secret is worthless ===');
  {
    const forgedElsewhere = (() => {
      process.env.OTP_SECRET = 'attacker-secret';
      delete require.cache[require.resolve(path.join(__dirname, '..', 'api', '_otp.js'))];
      const evil = require(path.join(__dirname, '..', 'api', '_otp.js'));
      const made = evil.makeChallenge(phone);
      const evilToken = evil.issueToken(phone);
      process.env.OTP_SECRET = 'test-secret-do-not-use-in-production';
      delete require.cache[require.resolve(path.join(__dirname, '..', 'api', '_otp.js'))];
      return { made, evilToken };
    })();
    const ours = require(path.join(__dirname, '..', 'api', '_otp.js'));
    check('challenge from another secret rejected',
      ours.checkChallenge(forgedElsewhere.made.challenge, forgedElsewhere.made.code, phone).ok === false);
    check('token from another secret rejected',
      ours.verifyToken(forgedElsewhere.evilToken, phone) === false);
  }

  console.log('=== expiry ===');
  {
    const realNow = Date.now;
    const fresh = otp.makeChallenge(phone);
    Date.now = () => realNow() + otp.CHALLENGE_TTL_MS + 1000;
    check('expired challenge rejected', otp.checkChallenge(fresh.challenge, fresh.code, phone).reason === 'expired');
    const tok = (() => { Date.now = realNow; const t = otp.issueToken(phone); Date.now = () => realNow() + otp.TOKEN_TTL_MS + 1000; return t; })();
    check('expired token rejected', otp.verifyToken(tok, phone) === false);
    Date.now = realNow;
  }

  console.log('=== codes are unpredictable ===');
  {
    const seen = new Set();
    for (let i = 0; i < 400; i++) seen.add(otp.makeChallenge(phone).code);
    check('400 codes are near-all distinct', seen.size > 380, seen.size);
  }

  console.log('=== the SMS itself ===');
  {
    const c = otp.makeChallenge(phone);
    const sent = await otp.sendCode(phone, c.code);
    check('send reports ok', sent.ok === true, sent);
    check('goes to the right number', lastSms.body.to === phone, lastSms.body.to);
    check('carries the relay secret from the environment', lastSms.body.secret === 'test-relay-secret');
    check('message contains the code', lastSms.body.body.includes(c.code));
    check('message warns it will never be asked for', /never ask you for this code/i.test(lastSms.body.body));
    check('relay secret is not in the challenge', !c.challenge.includes('test-relay-secret'));
  }

  console.log('=== switched off unless configured ===');
  {
    const saved = process.env.OTP_SECRET;
    delete process.env.OTP_SECRET;
    delete require.cache[require.resolve(path.join(__dirname, '..', 'api', '_otp.js'))];
    const off = require(path.join(__dirname, '..', 'api', '_otp.js'));
    check('enabled() false with no secret', off.enabled() === false);
    process.env.OTP_SECRET = saved;
    delete require.cache[require.resolve(path.join(__dirname, '..', 'api', '_otp.js'))];
    const on = require(path.join(__dirname, '..', 'api', '_otp.js'));
    check('enabled() true with a secret', on.enabled() === true);
  }

  global.fetch = realFetch;
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log('\nFAILURES:'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('ALL GREEN');
})();
