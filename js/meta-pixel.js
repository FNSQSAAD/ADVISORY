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

window.fbq('init', '1022375500091152');
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
