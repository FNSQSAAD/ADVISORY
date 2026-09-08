/* Footer behaviour: copyright year + back-to-top.
   Its own file so the funnel and quiz pages, which do not load site.js,
   get the same footer without pulling in the rest of the site engine. */
(function () {
  'use strict';
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  var top = document.getElementById('toTop');
  if (!top) return;
  top.hidden = false;
  var toggle = function () { top.classList.toggle('show', window.scrollY > 600); };
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();
  top.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
