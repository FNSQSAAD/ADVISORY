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

  var client = null;      // RetellWebClient instance, created on first call
  var live = false;       // a call is currently connected
  var starting = false;   // guard against double-clicks while connecting
  var els = {};

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
    idle: 'Talk to us now',
    connecting: 'Connecting…',
    live: 'End call',
    denied: 'Microphone blocked',
    error: 'Call unavailable'
  };

  function setState(state, detail) {
    if (!els.panel) return;
    els.panel.setAttribute('data-state', state);
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
      body: JSON.stringify({ page: location.pathname, referrer: document.referrer || '' })
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
          client.on('call_ended', function () { live = false; starting = false; setState('idle'); });
          client.on('error', function () { stop(); setState('error'); });
        }
        var cfg = { accessToken: data.access_token, transport: data.transport || 'gateway' };
        if (data.call_id) cfg.callId = data.call_id;
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
    head.appendChild(el('span', 'fv-dot'));
    head.appendChild(el('strong', null, 'Talk to Frank'));
    panel.appendChild(head);

    panel.appendChild(el('p', 'fv-lede',
      'Ask Frank anything about home loans and personal loans: first home buyer schemes, '
      + 'deposits and LMI, refinancing and how lenders assess you. Then book a free 15-minute '
      + 'strategy call with Priya, or ask her to call you back.'));

    var action = el('button', 'fv-action', COPY.idle);
    action.type = 'button';
    action.addEventListener('click', start);
    ['pointerenter', 'focus', 'touchstart'].forEach(function (ev) {
      action.addEventListener(ev, warm, { once: true, passive: true });
    });
    panel.appendChild(action);

    panel.appendChild(el('p', 'fv-status'));

    /* The disclosure is on screen BEFORE the visitor clicks, not only spoken after the
       call connects. Consent to an AI and to recording should be informed, and on the
       web we can show it rather than rely on them catching a spoken sentence. */
    panel.appendChild(el('p', 'fv-fineprint',
      'You will be speaking with an AI assistant and the call is recorded. Frank cannot give '
      + 'credit advice, quote rates or estimate borrowing capacity. Priya does that. '
      + 'Prefer a person? Call 0495 040 500.'));

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
