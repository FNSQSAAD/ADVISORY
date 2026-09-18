/* Meta Pixel — dataset 1022375500091152 ("Fnsq FB Pixel", Travel Square Business).
   Loaded once from the <head> of every page. This is the ONLY Meta Pixel on the
   site; do not paste a second base snippet anywhere or events will double-count.

   The fbq() stub is defined and init + PageView are queued the moment this file
   runs, so the PageView carries the real landing URL and referrer even though
   fbevents.js is still in flight. fbevents.js is fetched async and never blocks
   parsing or rendering. */
(function (f, b, e, v, n, t, s) {
  if (f.fbq) return;
  n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n;
  n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
  t = b.createElement(e); t.async = !0; t.src = v;
  s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
})(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

var FNSQ_PIXEL_ID = '1022375500091152';

/* Same placeholder value the Google Ads conversions use (see each page's <head>).
   Change both together if a real lead value is ever agreed. */
var FNSQ_LEAD_VALUE = 50, FNSQ_LEAD_CURRENCY = 'AUD';

window.fbq('init', FNSQ_PIXEL_ID);
window.fbq('track', 'PageView');

/* The site is a multi-page app, so each navigation is a real page load with its
   own PageView. This guard covers any client-side route change on top of that
   (history.pushState / replaceState / Back and Forward). It compares path+query
   only, so the hash that js/calculators.js writes with replaceState when you jump
   between calculators does NOT raise a second PageView. */
(function () {
  var last = location.pathname + location.search;
  function onNav() {
    var now = location.pathname + location.search;
    if (now === last) return;
    last = now;
    try { window.fbq('track', 'PageView'); } catch (e) {}
  }
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    if (typeof orig !== 'function') return;
    history[m] = function () {
      var r = orig.apply(this, arguments);
      try { onNav(); } catch (e) {}
      return r;
    };
  });
  window.addEventListener('popstate', onNav);
})();

/* ---------------------------------------------------------------------------
   Conversions.

   Every lead source on the site already reports through one funnel:
   window.fnsqAdsConversion(kind, source, user, done), defined in each page's
   <head> for Google Ads. We wrap that single function instead of editing
   site.js, start.js, chat.js, voice.js and nineteen HTML files — so Meta sees
   every lead path that exists today, and any new one added later, for free.

     kind      Meta event   fires when
     lead      Lead         contact form, Get Started funnel or chatbot, after
                            /api/lead has accepted the lead
     frank     Lead         a Frank browser call that reached the GHL intake.
                            js/voice.js only reports this once the call became a
                            real lead, so it clears the same bar as a form and
                            belongs in the same event
     booking   Schedule     a GoHighLevel calendar booking completed
     call      Contact      a tap on any tel: link

   Everything that captured a person's details lands on Lead, which keeps one
   well populated optimisation event rather than splitting conversion volume
   across several — that matters for getting out of Meta's learning phase.
   Contact therefore means exactly one thing, "tried to phone us", and is sent
   WITHOUT a value so an intent signal can never be mistaken for revenue.

   Everything rides on Meta STANDARD events. This dataset has Meta's "Data
   restrictions - Core setup" applied, and custom events are silently dropped by
   it: verified on 18 Sep 2026 by firing trackCustom PhoneClick and a control
   custom event, both of which left the browser and never arrived, while the
   standard events sent in the same moment all processed. The same regime also
   strips custom parameters and truncates URLs after the domain, so per-path
   detail cannot be carried in parameters either. If that restriction is ever
   lifted, phone taps can move to their own custom event again.

   The Meta event is queued BEFORE the original helper runs, so the beacon is
   away before the helper's redirect can start. Every step is wrapped in
   try/catch: a Meta failure must never break a Google Ads conversion or stall
   the redirect that follows a form submit. */
(function () {
  var VALUED = { value: FNSQ_LEAD_VALUE, currency: FNSQ_LEAD_CURRENCY };
  var EVENTS = {
    lead:    ['Lead',     VALUED],
    frank:   ['Lead',     VALUED],
    booking: ['Schedule', VALUED],
    call:    ['Contact',  {}]
  };

  /* Advanced matching. fbq hashes plaintext with SHA-256 in the browser before
     anything leaves the page, and passes an already-hashed 64-char hex value
     through untouched — which is what js/voice.js supplies, since the voice
     server only ever answers with hashed contact details. */
  function advancedMatch(u) {
    if (!u) return null;
    var am = {}, p, has = false;
    var em = u.sha256_email_address || u.email;
    if (em) { am.em = String(em).trim().toLowerCase(); has = true; }
    if (u.sha256_phone_number) { am.ph = String(u.sha256_phone_number).trim().toLowerCase(); has = true; }
    else if (u.phone) {
      p = String(u.phone).replace(/[^\d+]/g, '');
      if (/^0\d{9}$/.test(p)) p = '61' + p.slice(1);
      else if (p.charAt(0) === '+') p = p.slice(1);
      if (p) { am.ph = p; has = true; }
    }
    return has ? am : null;
  }

  function wrap() {
    var orig = window.fnsqAdsConversion;
    if (typeof orig !== 'function' || orig.__fnsqMetaWrapped) return !!(orig && orig.__fnsqMetaWrapped);
    var wrapped = function (kind, src, user, done) {
      try {
        var ev = EVENTS[kind];
        if (ev) {
          var am = advancedMatch(user);
          if (am) window.fbq('init', FNSQ_PIXEL_ID, am);
          window.fbq('track', ev[0], ev[1]);
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__fnsqMetaWrapped = true;
    window.fnsqAdsConversion = wrapped;
    return true;
  }

  /* The helper is defined by an inline script in the <head>, which the parser
     runs before this async file executes, so the first call almost always wins.
     The later attempts are belt and braces for any change in load order. */
  if (!wrap()) {
    document.addEventListener('DOMContentLoaded', wrap);
    window.addEventListener('load', wrap);
  }
})();
