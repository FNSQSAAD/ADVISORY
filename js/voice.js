/* Finance Square, voice widget.
   Lets a visitor talk to Frank, the AI receptionist, from the browser. Same agent and
   same compliance rails as the phone line on 0495 040 500.

   Mirrors js/chat.js: a corner launcher by default, or inline as page content when a
   page provides <div id="fnsq-voice-inline">.

   Nothing here runs until the visitor clicks. The Retell SDK is ~200KB and the
   microphone is a permission prompt, so both are deferred until there is intent. */
(function () {
  'use strict';

  var ORIGIN = 'https://fnsq-voice.vercel.app';
  var API = ORIGIN + '/api/web-call';

  /* The SDK's UMD build is unusable in a browser: it reaches for Node's
     events.EventEmitter and dies with "Cannot read properties of undefined".
     jsDelivr's +esm build bundles those shims, so load it as a module instead. */
  var SDK = 'https://cdn.jsdelivr.net/npm/retell-client-js-sdk@3.0.1/+esm';

  var CONSENT_VERSION = 'web-disclaimer-2026-09-14';
  var client = null;      // RetellWebClient instance, created on first call
  var live = false;       // a call is currently connected
  var starting = false;   // guard against double-clicks while connecting
  var callId = null;      // the current/last call, for the lead check below
  var reported = {};      // call ids already sent to analytics
  var els = {};

  /* Frank saves a lead on the server (save_lead tool), which this page never sees. Once a
     call ends, ask the voice server whether it became a real lead (reached the GHL intake or
     booked) and, if so, record the same GA4 + Google Ads conversions a website form does.
     It answers with hashed contact details only. Retried briefly because the call record
     can take a few seconds to settle after hang-up. */
  function reportOutcome(id, attempt) {
    if (!id || reported[id]) return;
    fetch(ORIGIN + '/api/web-call-outcome', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ call_id: id })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (o) {
      if (o && o.lead) {
        reported[id] = true;
        try { if (window.gtag) gtag('event', 'generate_lead', { lead_source: 'Frank voice call' }); } catch (e) {}
        try { if (window.fnsqAdsConversion) fnsqAdsConversion('frank', 'Frank voice call', o.user_data); } catch (e) {}
      } else if (o && o.found && attempt < 3) {
        setTimeout(function () { reportOutcome(id, attempt + 1); }, 5000 * (attempt + 1));
      }
    }).catch(function () {});
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  /* ------------------------------------------------------------------ SDK */

  var ctor = null;

  var sdkPromise = null;

  /* One shared download: warming it on intent and clicking must never fetch it twice.
     A failed download is forgotten so the next attempt can retry. */
  function loadSdk() {
    if (ctor) return Promise.resolve(ctor);
    if (!sdkPromise) {
      sdkPromise = import(SDK).then(function (m) {
        if (!m || typeof m.RetellWebClient !== 'function') throw new Error('sdk');
        ctor = m.RetellWebClient;
        return ctor;
      }).catch(function (err) { sdkPromise = null; throw err; });
    }
    return sdkPromise;
  }

  /* Start the ~200KB SDK download the moment a visitor shows intent (hover, focus or
     touch on the button), so a click has less to wait for. The token request itself is
     never made early, because each one creates a call record at Retell, but its
     connection (DNS, TCP, TLS) is opened now so the click skips that handshake. */
  var warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    loadSdk().catch(function () { /* retried on click */ });
    var hint = document.createElement('link');
    hint.rel = 'preconnect';
    hint.href = ORIGIN;
    hint.crossOrigin = 'anonymous';   // the token fetch is CORS, so warm the CORS connection pool
    document.head.appendChild(hint);
  }

  /* ----------------------------------------------------------------- state */

  var COPY = {
    /* The start button IS the consent: clicking it accepts the Privacy & Disclaimer
       shown directly above it, so its label has to say so. */
    idle: 'I understand, start talking to Frank',
    connecting: 'Connecting…',
    live: 'End call',
    denied: 'Microphone blocked',
    error: 'Call unavailable'
  };

  function setState(state, detail) {
    if (!els.panel) return;
    els.panel.setAttribute('data-state', state);
    /* Mirrored onto <body> so page art outside the panel (Frank's avatar on
       meet-frank.html) can react to the call. */
    document.body.setAttribute('data-fv', state);
    if (state !== 'live') talking(false);
    if (els.action) els.action.textContent = COPY[state] || COPY.idle;
    if (els.status) {
      els.status.textContent =
        state === 'connecting' ? 'Connecting you to Frank…'
        : state === 'live' ? 'Connected. Go ahead, Frank is listening.'
        : state === 'denied' ? 'Your browser blocked the microphone. Allow it, or call 0495 040 500.'
        : state === 'error' ? (detail || 'Could not start the call. Please call 0495 040 500.')
        : '';
    }
    if (els.launch) {
      els.launch.classList.toggle('fv-on', state === 'live' || state === 'connecting');
    }
  }

  /* body[data-fv-talk] is present while Frank is speaking: it animates his mouth. */
  function talking(on) {
    if (on) document.body.setAttribute('data-fv-talk', '');
    else document.body.removeAttribute('data-fv-talk');
  }

  /* ------------------------------------------------------------------ call */

  function stop() {
    try { if (client) client.stopCall(); } catch (e) { /* already gone */ }
    live = false;
    starting = false;
    setState('idle');
  }

  function start() {
    if (live) return stop();
    if (starting) return;
    starting = true;
    setState('connecting');

    /* The SDK download and the call token are independent, so fetch them together:
       doing them one after the other added a whole network round trip to every call. */
    var token = fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      /* consent names the disclaimer version the visitor accepted by clicking. Bump it
         whenever the Privacy & Disclaimer copy in build() changes. */
      body: JSON.stringify({ page: location.pathname, referrer: document.referrer || '', consent: CONSENT_VERSION })
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });

    Promise.all([loadSdk(), token])
      .then(function (both) {
        var data = both[1];
        if (!data.access_token) throw new Error('no token');
        if (!client) {
          /* Retell's v3 web-call tokens use the "gateway" transport, but the SDK defaults to
             "livekit", a mismatch that failed every call with "Error starting call". Pass
             the transport the token came with, and default to gateway if it is missing. */
          client = new ctor({ defaultTransport: 'gateway' });
          client.on('call_started', function () { live = true; starting = false; setState('live'); });
          client.on('call_ended', function () {
            live = false; starting = false; setState('idle');
            var id = callId;
            setTimeout(function () { reportOutcome(id, 0); }, 2500);
          });
          client.on('error', function () { stop(); setState('error'); });
          client.on('agent_start_talking', function () { talking(true); });
          client.on('agent_stop_talking', function () { talking(false); });
        }
        var cfg = { accessToken: data.access_token, transport: data.transport || 'gateway' };
        if (data.call_id) { cfg.callId = data.call_id; callId = data.call_id; }
        if (data.ice_servers) cfg.iceServers = data.ice_servers;
        if (data.url) cfg.url = data.url;
        return client.startCall(cfg);
      })
      .catch(function (err) {
        starting = false;
        live = false;
        // A refused microphone is the common case and deserves its own message.
        var denied = err && (err.name === 'NotAllowedError' || /permission|denied/i.test(err.message || ''));
        setState(denied ? 'denied' : 'error');
      });
  }

  /* ------------------------------------------------------------------ view */

  function build() {
    if (els.panel) return;

    var panel = el('div', 'fv-panel');
    panel.id = 'fnsq-voice';
    panel.setAttribute('data-state', 'idle');

    var head = el('div', 'fv-head');
    /* Frank's face beside the heading. Decorative (alt=""), the heading names him.
       Root-relative so it resolves from the directory pages (/privacy-policy/ etc). */
    var av = el('img', 'fv-av');
    av.src = '/assets/brand/frank-avatar.svg';
    av.alt = '';
    av.width = 40;
    av.height = 40;
    head.appendChild(av);
    var names = el('span', 'fv-names');
    names.appendChild(el('strong', null, 'Talk to Frank'));
    names.appendChild(el('small', null, 'AI assistant'));
    head.appendChild(names);
    panel.appendChild(head);

    panel.appendChild(el('p', 'fv-lede',
      'Ask Frank about home loans and personal loans, then book a free 15-minute '
      + 'strategy call with Priya, or ask her to call you back.'));

    /* Privacy & Disclaimer, shown BEFORE the call and accepted by the start button.
       Consent to an AI, to recording and to collection must be informed, so it is
       on screen to read, not only spoken once the call connects. Static copy only. */
    var consent = el('div', 'fv-consent');
    consent.id = 'fv-consent';
    consent.setAttribute('role', 'region');
    consent.setAttribute('aria-label', 'Privacy and disclaimer');
    consent.setAttribute('tabindex', '0');   // it can scroll in the floating panel
    consent.innerHTML =
        '<h3 class="fv-consent-h">Privacy &amp; Disclaimer</h3>'
      + '<p>Frank is an AI assistant, not a person and not a broker. He provides general '
      + 'information only. He does not assess your eligibility, quote rates or repayments, '
      + 'estimate what you can borrow, or recommend a lender or loan product. Please don&rsquo;t '
      + 'share your income, deposit or credit history with Frank.</p>'
      + '<p>This conversation is recorded and transcribed. By selecting &ldquo;I understand&rdquo; '
      + 'below, you consent to Finance Square Group collecting and processing that recording and '
      + 'transcript, along with your name and mobile number, to respond to your enquiry and '
      + 'arrange a call with our broker.</p>'
      + '<p>We don&rsquo;t sell or rent your information. We share it only with our service '
      + 'providers and where required or permitted by law. Some of these services process '
      + 'information outside Australia. Full detail, including how to access, correct or delete '
      + 'your information, is in our <a href="/privacy-policy/" target="_blank" rel="noopener">'
      + 'Privacy Policy</a>.</p>';
    panel.appendChild(consent);

    var optout = el('p', 'fv-optout');
    optout.innerHTML = 'Prefer not to be recorded? Call <a href="tel:+61495040500">0495 040 500</a> '
      + 'or <a href="/get-started.html">book a call</a> instead.';
    panel.appendChild(optout);

    var action = el('button', 'fv-action', COPY.idle);
    action.setAttribute('aria-describedby', 'fv-consent');
    action.type = 'button';
    action.addEventListener('click', start);
    ['pointerenter', 'focus', 'touchstart'].forEach(function (ev) {
      action.addEventListener(ev, warm, { once: true, passive: true });
    });
    panel.appendChild(action);

    panel.appendChild(el('p', 'fv-status'));

    els.panel = panel;
    els.action = action;
    els.status = panel.querySelector('.fv-status');
  }

  function launcher() {
    build();
    var b = el('button', 'fv-launch');
    b.type = 'button';
    b.setAttribute('aria-label', 'Talk to us now');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>'
      + '<path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/></svg>'
      + '<span class="fv-launch-tx">Talk to us</span>';

    var open = false;
    b.addEventListener('click', function () {
      open = !open;
      els.panel.classList.toggle('fv-open', open);
      els.panel.hidden = !open;
      if (!open && live) stop();
    });

    els.panel.hidden = true;
    document.body.appendChild(els.panel);
    document.body.appendChild(b);
    els.launch = b;
    document.body.classList.add('fv-has-voice');
  }

  function inline(mount) {
    build();
    els.panel.classList.add('fv-inline', 'fv-open');
    els.panel.hidden = false;
    mount.appendChild(els.panel);
  }

  function boot() {
    if (document.getElementById('fnsq-voice')) return;
    var mount = document.getElementById('fnsq-voice-inline');
    if (mount) return inline(mount);
    launcher();
  }

  /* Wait for idle so the widget never competes with the page's own paint. */
  function begin() {
    if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 2500 });
    else setTimeout(boot, 1400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();
