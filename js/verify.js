/* ============================================================
   FINANCE SQUARE - MOBILE VERIFICATION STEP

   One reusable gate for every lead form on the site. Both callers do the same
   thing: instead of POSTing straight to /api/lead, they await

       FNSQVerify.gate(phone, mountElement)

   which resolves with a verification token to include in the payload, or
   rejects if the visitor abandons or cannot verify. The token is what
   /api/lead checks.

   Deliberately standalone: get-started.html loads neither styles.css nor
   pages.css, so this file carries its own markup and styles, scoped to .fqv-*.
   ============================================================ */
(function () {
  'use strict';

  var API = '/api/verify';

  /* Verified numbers survive a page change inside the same visit, so someone who
     verifies in the chat and then uses the contact form is not asked twice. */
  function remember(phone, token) {
    try { sessionStorage.setItem('fsqVerified:' + phone, token); } catch (e) {}
  }
  function recall(phone) {
    try { return sessionStorage.getItem('fsqVerified:' + phone) || ''; } catch (e) { return ''; }
  }

  function normalise(raw) {
    var d = String(raw || '').replace(/[^\d+]/g, '');
    var m = d.match(/^(?:\+?61|0)?(4\d{8})$/);
    return m ? '+61' + m[1] : null;
  }

  function css() {
    if (document.getElementById('fqv-style')) return;
    var s = document.createElement('style');
    s.id = 'fqv-style';
    s.textContent = [
      '.fqv{--fqv-navy:#282a47;--fqv-gold:#a87c2e;--fqv-ink:#1e1f2d;--fqv-line:rgba(30,31,45,.16);',
      'font-family:"Poppins","Poppins Fallback",system-ui,sans-serif;margin:14px 0 0;padding:16px 18px;',
      'border:1px solid var(--fqv-line);border-left:3px solid var(--fqv-gold);border-radius:10px;background:#fff;color:var(--fqv-ink)}',
      '.fqv h4{margin:0 0 4px;font-size:14.5px;font-weight:600;color:var(--fqv-navy);font-family:inherit;text-transform:none;letter-spacing:normal}',
      '.fqv p{margin:0 0 12px;font-size:13px;line-height:1.5;color:rgba(30,31,45,.72)}',
      '.fqv-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}',
      '.fqv input{flex:1 1 150px;min-width:0;padding:11px 13px;border:1px solid var(--fqv-line);border-radius:9px;',
      'font-family:inherit;font-size:17px;letter-spacing:.28em;text-align:center;font-variant-numeric:tabular-nums;background:#fff;color:var(--fqv-ink)}',
      '.fqv input:focus{outline:0;border-color:var(--fqv-gold);box-shadow:0 0 0 3px rgba(168,124,46,.14)}',
      '.fqv button{flex:none;padding:11px 18px;border:0;border-radius:9px;cursor:pointer;',
      'background:var(--fqv-navy);color:#f4eee0;font-family:inherit;font-size:14px;font-weight:500}',
      '.fqv button:disabled{opacity:.45;cursor:default}',
      '.fqv-alt{margin-top:10px;font-size:12.5px}',
      '.fqv-alt button{background:none;color:var(--fqv-gold);padding:0;font-size:12.5px;text-decoration:underline}',
      '.fqv-msg{margin-top:10px;font-size:12.5px;line-height:1.5}',
      '.fqv-msg.bad{color:#a3261f}.fqv-msg.good{color:#2f6d49}'
    ].join('');
    document.head.appendChild(s);
  }

  function post(body) {
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) { j._status = r.status; return j; });
    });
  }

  /* Resolves with a token. Rejects with {reason} if the visitor gives up or the
     service is unavailable, so the caller can decide what to do. */
  function gate(rawPhone, mount) {
    var phone = normalise(rawPhone);
    if (!phone) return Promise.reject({ reason: 'phone' });

    var existing = recall(phone);
    if (existing) return Promise.resolve(existing);

    css();
    return new Promise(function (resolve, reject) {
      var box = document.createElement('div');
      box.className = 'fqv';
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Verify your mobile number');
      var pretty = phone.replace('+61', '0');
      box.innerHTML =
        '<h4>Confirm your mobile</h4>' +
        '<p>We have sent a 6-digit code to <b>' + pretty + '</b>. Enter it below so we know we can reach you.</p>' +
        '<div class="fqv-row">' +
        '<input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" ' +
        'aria-label="6-digit verification code" placeholder="000000">' +
        '<button type="button" data-go>Verify</button>' +
        '</div>' +
        '<div class="fqv-alt"><button type="button" data-resend>Send a new code</button></div>' +
        '<div class="fqv-msg" role="status"></div>';
      mount.appendChild(box);

      var input = box.querySelector('input');
      var go = box.querySelector('[data-go]');
      var resend = box.querySelector('[data-resend]');
      var msg = box.querySelector('.fqv-msg');

      function say(text, kind) {
        msg.textContent = text || '';
        msg.className = 'fqv-msg' + (kind ? ' ' + kind : '');
      }

      var challenge = '';
      function send(first) {
        go.disabled = true;
        say(first ? 'Sending your code...' : 'Sending a new code...');
        post({ action: 'send', phone: phone }).then(function (j) {
          go.disabled = false;
          if (!j.ok) {
            // Not configured yet: let the lead through rather than block it.
            if (j.error === 'not_configured') { box.remove(); resolve(''); return; }
            say(j.message || 'We could not send a code.', 'bad');
            return;
          }
          challenge = j.challenge;
          say('Code sent. It expires in 5 minutes.', 'good');
          input.focus();
        }).catch(function () {
          go.disabled = false;
          say('Network problem sending your code. Try again.', 'bad');
        });
      }

      function check() {
        var code = (input.value || '').replace(/\D/g, '');
        if (code.length !== 6) { say('Enter the 6 digits from the message.', 'bad'); return; }
        if (!challenge) { say('Send yourself a code first.', 'bad'); return; }
        go.disabled = true;
        say('Checking...');
        post({ action: 'check', phone: phone, code: code, challenge: challenge }).then(function (j) {
          if (!j.ok) {
            go.disabled = false;
            say(j.message || 'That code is not right.', 'bad');
            input.select();
            return;
          }
          remember(phone, j.token);
          say('Mobile confirmed.', 'good');
          setTimeout(function () { box.remove(); resolve(j.token); }, 500);
        }).catch(function () {
          go.disabled = false;
          say('Network problem. Try again.', 'bad');
        });
      }

      go.addEventListener('click', check);
      resend.addEventListener('click', function () { send(false); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); check(); }
      });
      // Paste of a 6-digit code from the SMS: verify without another click.
      input.addEventListener('input', function () {
        if ((input.value || '').replace(/\D/g, '').length === 6) check();
      });

      box.addEventListener('fqv-cancel', function () { box.remove(); reject({ reason: 'cancelled' }); });
      send(true);
    });
  }

  window.FNSQVerify = { gate: gate, normalise: normalise, recall: recall };
})();
