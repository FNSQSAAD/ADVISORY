#!/usr/bin/env node
/* One command to switch SMS verification on, end to end.

     node tools/enable-verification.js

   It generates OTP_SECRET itself (the value is never printed, so it cannot leak
   into a terminal history or a chat log), asks once for the Twilio relay secret,
   sets both on Vercel, redeploys, then proves the whole thing works against the
   live site and tells you exactly what it found.

   Needs the Vercel CLI logged in, or VERCEL_TOKEN in the environment.
   Safe to re-run: it replaces the variables and redeploys again.              */
'use strict';

const { execSync, spawnSync } = require('child_process');
const crypto = require('crypto');
const readline = require('readline');

const SITE = process.env.SITE || 'https://fnsq.com.au';
const TOKEN = process.env.VERCEL_TOKEN ? ['--token', process.env.VERCEL_TOKEN] : [];
const ENVS = ['production', 'preview', 'development'];

const say = (...a) => console.log(...a);
const die = m => { console.error('\n✗ ' + m); process.exit(1); };

function vercel(args, input) {
  const r = spawnSync('npx', ['vercel', ...args, ...TOKEN], {
    input: input === undefined ? undefined : input,
    encoding: 'utf8', shell: true
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function ask(question, { hidden = false } = {}) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // stop the secret being echoed to the screen
      const onData = () => { rl.output.write('\x1B[2K\x1B[200D' + question); };
      rl.input.on('data', onData);
      rl.question(question, answer => { rl.input.off('data', onData); rl.close(); say(''); resolve(answer.trim()); });
    } else {
      rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
    }
  });
}

async function setVar(name, value) {
  for (const env of ENVS) {
    vercel(['env', 'rm', name, env, '--yes'], '');           // ignore "not found"
    const r = vercel(['env', 'add', name, env], value + '\n');
    if (r.code !== 0 && !/already exists/i.test(r.out)) {
      die('could not set ' + name + ' for ' + env + '\n' + r.out.slice(0, 400));
    }
  }
  say('  ✓ ' + name + ' set for ' + ENVS.join(', '));
}

async function post(path, body) {
  const r = await fetch(SITE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json = null;
  try { json = await r.json(); } catch (e) {}
  return { status: r.status, json };
}

(async () => {
  say('\nSwitching on SMS verification for ' + SITE + '\n');

  // 1. the signing secret, generated here and never shown
  say('1. Generating the signing secret');
  await setVar('OTP_SECRET', crypto.randomBytes(32).toString('hex'));

  // 2. the relay secret, from the operator
  say('\n2. The Twilio relay secret');
  say('   GHL -> Automation -> New Lead Intake -> "#1 Twilio SMS - Intake Confirm"');
  say('   -> the JSON body -> the "secret" field (it starts fnsq_)\n');
  const relay = await ask('   Paste it (input is hidden): ', { hidden: true });
  if (!relay) die('nothing entered, aborted. Nothing was changed except OTP_SECRET.');
  if (!/^fnsq_/.test(relay)) {
    const go = await ask('   That does not start "fnsq_". Continue anyway? (y/N) ');
    if (!/^y/i.test(go)) die('aborted at your request.');
  }
  await setVar('FNSQ_RELAY_SECRET', relay);

  // 3. redeploy so the functions pick the variables up
  say('\n3. Redeploying (environment changes only apply to a new deployment)');
  const dep = vercel(['deploy', '--prod', '--yes']);
  if (dep.code !== 0) die('deploy failed\n' + dep.out.slice(0, 600));
  say('  ✓ deployed');

  // 4. wait for the new deployment to actually serve
  say('\n4. Waiting for it to go live');
  let live = false;
  for (let i = 0; i < 40; i++) {
    const r = await post('/api/verify', { action: 'send', phone: 'not-a-phone' });
    // 400 "phone" means the function is running and configured;
    // 503 "not_configured" means the old build is still serving.
    if (r.status === 400) { live = true; break; }
    await new Promise(s => setTimeout(s, 5000));
  }
  if (!live) die('the new deployment did not come up within ~3 minutes. Check the Vercel dashboard.');
  say('  ✓ verification is live');

  // 5. prove the gate actually blocks
  say('\n5. Checking the gate');
  const unverified = await post('/api/lead', {
    full_name: 'Gate Check', email: 'gate.check@example.com', phone: '0491570016',
    lead_source: 'Website Contact Form'
  });
  if (unverified.status === 403 && unverified.json && unverified.json.error === 'unverified') {
    say('  ✓ an unverified lead is refused (403) and never reaches GoHighLevel');
  } else {
    die('THE GATE IS NOT WORKING: an unverified lead returned ' + unverified.status +
        ' ' + JSON.stringify(unverified.json) + '\n     Investigate before relying on this.');
  }

  const badPhone = await post('/api/verify', { action: 'send', phone: '0391234567' });
  say(badPhone.status === 400 ? '  ✓ landlines are rejected' : '  ! landline check returned ' + badPhone.status);

  // 6. a real code to a number that cannot reach anyone
  say('\n6. Sending a real code to the ACMA drama number 0491 570 016');
  say('   (that range is reserved for fiction, so no member of the public is texted)');
  const sent = await post('/api/verify', { action: 'send', phone: '0491570016' });
  if (sent.status === 200 && sent.json && sent.json.challenge) {
    say('  ✓ the relay accepted it and a challenge came back');
    const wrong = await post('/api/verify', {
      action: 'check', phone: '0491570016', code: '000000', challenge: sent.json.challenge
    });
    say(wrong.status === 400 ? '  ✓ a wrong code is rejected' : '  ! wrong-code check returned ' + wrong.status);
  } else {
    say('  ✗ the send failed: ' + sent.status + ' ' + JSON.stringify(sent.json));
    say('    Almost always the relay secret. Re-run this script with the right value.');
    process.exit(1);
  }

  say('\nDone. Verification is on for the contact form, the Get Started funnel');
  say('and the chatbot. To switch it off again:\n');
  say('  npx vercel env rm OTP_SECRET production --yes && npx vercel deploy --prod --yes\n');
})();
