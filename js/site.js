/* FNSQ Advisory — site engine. Vanilla, no dependencies. */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var fmt = function (n) { return '$' + Math.round(n).toLocaleString('en-AU'); };

  /* nav */
  var nav = $('.nav');
  window.addEventListener('scroll', function () {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
  var burger = $('.burger');
  if (burger) {
    burger.addEventListener('click', function () {
      document.body.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', document.body.classList.contains('nav-open'));
    });
    $$('.mobile-menu a').forEach(function (a) {
      a.addEventListener('click', function () { document.body.classList.remove('nav-open'); });
    });
  }

  /* reveals */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  $$('.rv').forEach(function (el) { io.observe(el); });

  /* ---------- repayment calculator (shared by home + calculators page) ---------- */
  var repayCalc = function (root) {
    var amt = $('.ci-amount', root), rate = $('.ci-rate', root), term = $('.ci-term', root);
    if (!amt) return;
    var run = function () {
      var P = +amt.value, annual = +rate.value, years = +term.value;
      var r = annual / 100 / 12, n = years * 12;
      var pay = r > 0 ? P * r / (1 - Math.pow(1 + r, -n)) : P / n;
      var total = pay * n;
      $('.co-amount', root).textContent = fmt(P);
      $('.co-rate', root).textContent = annual.toFixed(2) + '% p.a.';
      $('.co-term', root).textContent = years + ' years';
      $('.co-monthly', root).textContent = fmt(pay);
      $('.co-fortnight', root).textContent = fmt(pay * 12 / 26);
      $('.co-total', root).textContent = fmt(total);
      $('.co-interest', root).textContent = fmt(total - P);
    };
    [amt, rate, term].forEach(function (el) { el.addEventListener('input', run); });
    run();
  };
  $$('.js-repay').forEach(repayCalc);

  /* ---------- borrowing power (calculators page) ---------- */
  var borrowCalc = function (root) {
    var inc = $('.bi-income', root), exp = $('.bi-exp', root), dep = $('.bi-dep', root);
    if (!inc) return;
    var run = function () {
      var income = +inc.value, expenses = +exp.value * 12, deposit = +dep.value;
      var surplus = Math.max(income * 0.77 - expenses, 0);
      var monthly = surplus / 12 * 0.95;
      var r = 0.0849 / 12, n = 360;
      var cap = monthly * (1 - Math.pow(1 + r, -n)) / r;
      cap = Math.max(Math.min(cap, 4000000), 0);
      var lo = Math.round(cap * 0.9 / 5000) * 5000;
      var hi = Math.round(cap * 1.05 / 5000) * 5000;
      $('.bo-income', root).textContent = fmt(income);
      $('.bo-exp', root).textContent = fmt(+exp.value) + ' /mo';
      $('.bo-dep', root).textContent = fmt(deposit);
      $('.bo-range', root).textContent = fmt(lo) + ' – ' + fmt(hi);
      $('.bo-price', root).textContent = fmt(hi * 0.92 + deposit);
    };
    [inc, exp, dep].forEach(function (el) { el.addEventListener('input', run); });
    run();
  };
  $$('.js-borrow').forEach(borrowCalc);

  /* ---------- contact form ---------- */
  var cform = $('#cform');
  if (cform) {
    var goal = new URLSearchParams(location.search).get('goal');
    if (goal) {
      var sel = $('#f-goal');
      $$('option', sel).forEach(function (o) { if (o.value === goal) sel.value = goal; });
    }
    cform.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      [['#f-name', function (v) { return v.trim().length >= 2; }],
       ['#f-phone', function (v) { return /^04\d{8}$/.test(v.replace(/\s/g, '')); }],
       ['#f-email', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }]
      ].forEach(function (p) {
        var el = $(p[0]);
        var good = p[1](el.value);
        el.closest('.field').classList.toggle('bad', !good);
        if (!good) ok = false;
      });
      if (!ok) return;
      cform.style.display = 'none';
      $('#form-ok').classList.add('show');
      $('#form-ok').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* ---------- hero arch slider ---------- */
  var arch = $('.arch[data-slider]');
  if (arch) {
    var aSlides = $$('.arch-slide', arch);
    var aDots = $$('.arch-dots button');
    var aIdx = 0, aTimer;
    var aGo = function (n) {
      aIdx = (n + aSlides.length) % aSlides.length;
      aSlides.forEach(function (s, i) { s.classList.toggle('on', i === aIdx); });
      aDots.forEach(function (d, i) { d.classList.toggle('on', i === aIdx); });
    };
    var aRestart = function () { clearInterval(aTimer); aTimer = setInterval(function () { aGo(aIdx + 1); }, 5500); };
    aDots.forEach(function (d, i) { d.addEventListener('click', function () { aGo(i); aRestart(); }); });
    aGo(0);
    aRestart();
  }

  /* ---------- journeys carousel arrows ---------- */
  var jn = $('.jn-scroll');
  if (jn) {
    var step = function () { var c = $('.jn-card'); return c ? c.offsetWidth + 24 : 420; };
    var jp = $('.jn-nav .prev'), jx = $('.jn-nav .next');
    if (jp) jp.addEventListener('click', function () { jn.scrollBy({ left: -step(), behavior: 'smooth' }); });
    if (jx) jx.addEventListener('click', function () { jn.scrollBy({ left: step(), behavior: 'smooth' }); });
  }

  /* ---------- testimonial slider ---------- */
  var ts = $('.tslider');
  if (ts) {
    var tslides = $$('.tslide', ts);
    var tdots = $$('.tdots button', ts);
    var tidx = 0, ttimer;
    var tgo = function (n) {
      tidx = (n + tslides.length) % tslides.length;
      tslides.forEach(function (s, i) { s.classList.toggle('on', i === tidx); });
      tdots.forEach(function (d, i) { d.classList.toggle('on', i === tidx); });
    };
    var trestart = function () { clearInterval(ttimer); ttimer = setInterval(function () { tgo(tidx + 1); }, 6000); };
    tdots.forEach(function (d, i) { d.addEventListener('click', function () { tgo(i); trestart(); }); });
    var tp = $('.tarrows .prev', ts), tn = $('.tarrows .next', ts);
    if (tp) tp.addEventListener('click', function () { tgo(tidx - 1); trestart(); });
    if (tn) tn.addEventListener('click', function () { tgo(tidx + 1); trestart(); });
    tgo(0);
    trestart();
  }

  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
})();
