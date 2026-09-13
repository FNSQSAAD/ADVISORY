/* Finance Square Group - Get Started funnel.
   Chooser -> 3 sliders + 1 chip step -> contact capture -> indicative snapshot.
   Submissions relay through /api/lead. Figures are illustrations only. */
(function(){
'use strict';

var root = document.getElementById('fsq-start');
if (!root) return;

/* ------------------------------------------------------------- helpers */
function fmt$(n){ return '$' + Math.round(n).toLocaleString('en-AU'); }
function fmtK(n){ return n >= 1000000 ? '$' + (n/1000000).toFixed(n%1000000?2:0).replace(/\.00$/,'') + 'm' : '$' + Math.round(n/1000) + 'k'; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function monthly(P, annualPct){ var r = annualPct/100/12, n = 360; return P*r/(1-Math.pow(1+r,-n)); }
function invMonthly(M, annualPct){ var r = annualPct/100/12, n = 360; return M*(1-Math.pow(1+r,-n))/r; }
function round10k(n){ return Math.round(n/10000)*10000; }

/* --------------------------------------------------------------- paths */
var PATHS = {
  buy: {
    label: 'Buying a home',
    steps: [
      { id:'income', kind:'slider', title:'Roughly what does your household earn each year?',
        sub:'Before tax, across everyone who’d be on the loan. A rough figure is fine.',
        min:40000, max:400000, step:5000, start:120000, format:fmt$, maxPlus:true },
      { id:'deposit', kind:'slider', title:'How much could you put toward the purchase?',
        sub:'Savings, gifts and any equity you could use all count.',
        min:10000, max:500000, step:5000, start:80000, format:fmt$, maxPlus:true },
      { id:'expenses', kind:'slider', title:'What does your household spend in a typical month?',
        sub:'Living costs only, not rent or loan repayments.',
        min:1500, max:10000, step:250, start:3500, format:fmt$, maxPlus:true },
      { id:'timeframe', kind:'chips', title:'When are you hoping to buy?',
        options:['As soon as possible','Within 3 months','3–6 months','6–12 months','Just planning ahead'] }
    ],
    captureTitle: 'Your buying snapshot is ready.',
    captureSub: 'Tell us where to send it and a broker will sense-check the numbers with you, no cost, no obligation.'
  },
  loan: {
    label: 'Reviewing a loan',
    steps: [
      { id:'value', kind:'slider', title:'Roughly what’s your property worth today?',
        sub:'Your best guess is fine, nothing here is a valuation.',
        min:300000, max:3000000, step:25000, start:850000, format:fmtK, maxPlus:true },
      { id:'balance', kind:'slider', title:'What’s left on the loan?',
        sub:'The approximate balance still owing.',
        min:50000, max:2000000, step:25000, start:500000, format:fmtK, maxPlus:true },
      { id:'rate', kind:'slider', title:'What interest rate are you paying now?',
        sub:'It’s on your statement or banking app, or tick “I’m not sure”.',
        min:3, max:9.5, step:0.05, start:6.2, format:function(v){ return v.toFixed(2) + '% p.a.'; }, unsure:true },
      { id:'goal', kind:'chips', title:'What would you most like out of a review?',
        options:['Lower repayments','Access equity','More flexibility','Certainty on my rate','Just checking I’m not overpaying'] }
    ],
    captureTitle: 'Your loan check is ready.',
    captureSub: 'Tell us where to send it and a broker will look over your numbers, no cost, no obligation.'
  }
};

var state = { path:null, step:-1, values:{}, unsure:{} };

/* ---------------------------------------------------------- transitions */
function swap(el){
  el.classList.add('st-enter');
  Array.prototype.slice.call(root.children).forEach(function(old){
    if (old.classList.contains('st-leave')) return;
    old.classList.add('st-leave');
    setTimeout(function(){ if (old.parentNode) old.parentNode.removeChild(old); }, 230);
  });
  root.appendChild(el);
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.remove('st-enter'); }); });
  window.scrollTo({ top:0, behavior:'smooth' });
}
function h(cls, html){ var el = document.createElement('section'); el.className = 'st-screen ' + cls; el.innerHTML = html; return el; }

/* --------------------------------------------------------------- chooser */
function renderChooser(){
  state.path = null; state.step = -1;
  var el = h('st-chooser',
    '<p class="st-eyebrow">Finance Square Group</p>' +
    '<h1>Good finance starts with a <em>clear picture.</em></h1>' +
    '<p class="st-sub">Answer a handful of quick questions and we’ll put together a personal snapshot, then a broker will walk you through it. About 60 seconds.</p>' +
    '<div class="st-choose">' +
      '<button type="button" class="st-choice" data-path="buy"><span class="st-choice-t">I’m looking to buy</span><span class="st-choice-s">First home, next home or an investment</span><span class="st-choice-arr">→</span></button>' +
      '<button type="button" class="st-choice" data-path="loan"><span class="st-choice-t">I want a better deal on my loan</span><span class="st-choice-s">Check the loan you already have</span><span class="st-choice-arr">→</span></button>' +
    '</div>' +
    '<p class="st-fine">No credit check. General information only, not credit advice; any loan is subject to lender assessment.</p>');
  Array.prototype.forEach.call(el.querySelectorAll('[data-path]'), function(b){
    b.addEventListener('click', function(){ startPath(b.getAttribute('data-path')); });
  });
  swap(el);
}

function startPath(p){
  state.path = p; state.step = 0; state.values = {}; state.unsure = {};
  renderStep();
}

/* ----------------------------------------------------------------- steps */
function renderStep(){
  var path = PATHS[state.path];
  var s = path.steps[state.step];
  var total = path.steps.length + 1; /* + capture */
  var dots = '';
  for (var i = 0; i < total; i++) dots += '<i class="' + (i < state.step ? 'done' : i === state.step ? 'on' : '') + '"></i>';

  var body;
  if (s.kind === 'slider'){
    var cur = state.values[s.id] !== undefined ? state.values[s.id] : s.start;
    body =
      '<div class="st-readout" data-readout>' + esc(s.format(cur)) + (s.maxPlus && cur >= s.max ? '+' : '') + '</div>' +
      '<input class="st-range" data-range type="range" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + cur + '" aria-label="' + esc(s.title) + '">' +
      '<div class="st-scale"><span>' + esc(s.format(s.min)) + '</span><span>' + esc(s.format(s.max)) + (s.maxPlus ? '+' : '') + '</span></div>' +
      (s.unsure ? '<label class="st-unsure"><input type="checkbox" data-unsure' + (state.unsure[s.id] ? ' checked' : '') + '><span>I’m not sure of my rate</span></label>' : '') +
      '<button type="button" class="st-btn st-btn-primary st-next" data-next>Continue</button>';
  } else {
    body = '<div class="st-chips">' + s.options.map(function(o, ix){
      return '<button type="button" class="st-chip' + (state.values[s.id] === o ? ' sel' : '') + '" data-chip="' + ix + '">' + esc(o) + '</button>';
    }).join('') + '</div>';
  }

  var el = h('st-step',
    '<div class="st-top">' +
      '<button type="button" class="st-back" data-back>← Back</button>' +
      '<span class="st-dots">' + dots + '</span>' +
      '<span class="st-count">' + (state.step + 1) + ' / ' + total + '</span>' +
    '</div>' +
    '<p class="st-eyebrow">' + esc(path.label) + '</p>' +
    '<h2>' + esc(s.title) + '</h2>' +
    (s.sub ? '<p class="st-help">' + esc(s.sub) + '</p>' : '') +
    body);

  el.querySelector('[data-back]').addEventListener('click', function(){
    if (state.step === 0) renderChooser();
    else { state.step--; renderStep(); }
  });

  var range = el.querySelector('[data-range]');
  if (range){
    var readout = el.querySelector('[data-readout]');
    var paint = function(){
      var v = parseFloat(range.value);
      state.values[s.id] = v;
      readout.textContent = s.format(v) + (s.maxPlus && v >= s.max ? '+' : '');
      var pct = (v - s.min) / (s.max - s.min) * 100;
      range.style.setProperty('--fill', pct + '%');
    };
    range.addEventListener('input', paint);
    paint();
    var unsure = el.querySelector('[data-unsure]');
    if (unsure){
      unsure.addEventListener('change', function(){
        state.unsure[s.id] = unsure.checked;
        range.disabled = unsure.checked;
        el.querySelector('.st-readout').style.opacity = unsure.checked ? .35 : 1;
      });
      if (state.unsure[s.id]){ range.disabled = true; el.querySelector('.st-readout').style.opacity = .35; }
    }
    el.querySelector('[data-next]').addEventListener('click', next);
  } else {
    Array.prototype.forEach.call(el.querySelectorAll('[data-chip]'), function(b){
      b.addEventListener('click', function(){
        state.values[s.id] = s.options[parseInt(b.getAttribute('data-chip'), 10)];
        b.classList.add('sel');
        setTimeout(next, 220);
      });
    });
  }
  swap(el);
}

function next(){
  var path = PATHS[state.path];
  if (state.step + 1 < path.steps.length){ state.step++; renderStep(); }
  else renderCapture();
}

/* --------------------------------------------------------------- capture */
function renderCapture(){
  var path = PATHS[state.path];
  var total = path.steps.length + 1;
  var dots = '';
  for (var i = 0; i < total; i++) dots += '<i class="' + (i < total - 1 ? 'done' : 'on') + '"></i>';
  var el = h('st-capture',
    '<div class="st-top">' +
      '<button type="button" class="st-back" data-back>← Back</button>' +
      '<span class="st-dots">' + dots + '</span>' +
      '<span class="st-count">' + total + ' / ' + total + '</span>' +
    '</div>' +
    '<p class="st-eyebrow">One last step</p>' +
    '<h2>' + esc(path.captureTitle) + '</h2>' +
    '<p class="st-help">' + esc(path.captureSub) + '</p>' +
    '<form class="st-form" novalidate>' +
      '<label>Your name<input type="text" name="name" autocomplete="name" required></label>' +
      '<label>Email<input type="email" name="email" autocomplete="email" required></label>' +
      '<label>Mobile<input type="tel" name="phone" autocomplete="tel" inputmode="tel" placeholder="04xx xxx xxx" required></label>' +
      '<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-5000px">' +
      '<label class="st-consent"><input type="checkbox" name="consent"><span>I’m happy for Finance Square Group to contact me about my enquiry.</span></label>' +
      '<p class="st-err" data-err hidden></p>' +
      '<button type="submit" class="st-btn st-btn-primary" data-submit>See my snapshot</button>' +
    '</form>' +
    '<p class="st-fine">We’ll only use these details to talk to you about this enquiry. No spam, no obligation.</p>');
  el.querySelector('[data-back]').addEventListener('click', function(){ state.step = path.steps.length - 1; renderStep(); });
  var form = el.querySelector('form');
  form.addEventListener('submit', function(ev){
    ev.preventDefault();
    var err = el.querySelector('[data-err]');
    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var phone = form.phone.value.replace(/[\s()-]/g, '');
    var fail = null;
    if (name.length < 2) fail = 'Please enter your name.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail = 'That email doesn’t look right.';
    else if (!/^(04\d{8}|\+614\d{8})$/.test(phone)) fail = 'Please enter an Australian mobile, e.g. 0400 000 000.';
    else if (!form.consent.checked) fail = 'Please tick the consent box so we’re allowed to contact you.';
    if (fail){ err.textContent = fail; err.hidden = false; return; }
    err.hidden = true;
    submitLead({ name:name, email:email, phone:phone, honeypot:form.website.value }, el);
  });
  swap(el);
}

function summaryLine(){
  var v = state.values, u = state.unsure;
  if (state.path === 'buy'){
    return 'Get Started funnel (Buying). Household income ~' + fmt$(v.income) + '/yr; funds available ~' + fmt$(v.deposit) +
      '; monthly spend ~' + fmt$(v.expenses) + '; timeframe: ' + v.timeframe + '.';
  }
  return 'Get Started funnel (Loan review). Property ~' + fmt$(v.value) + '; balance ~' + fmt$(v.balance) +
    '; current rate: ' + (u.rate ? 'not sure' : v.rate.toFixed(2) + '% p.a.') + '; goal: ' + v.goal + '.';
}

function submitLead(c, el){
  var btn = el.querySelector('[data-submit]');
  btn.disabled = true; btn.textContent = 'Sending…';
  var payload = {
    full_name: c.name,
    email: c.email,
    phone: c.phone,
    message: summaryLine() + ' Submitted from ' + location.host + location.pathname,
    lead_source: 'Get Started Funnel: ' + (state.path === 'buy' ? 'Buying' : 'Loan review'),
    website: c.honeypot,
    /* Discrete fields for GHL. The buy path asks a timeframe; the loan path never does,
       so it sends none and the intake branch correctly settles on lead-warm. */
    timing: state.values.timeframe || '',
    goal: state.path || '',
    /* Structured answers so the relay can score fit and GHL can store them as fields
       instead of burying them in the message text. */
    income: state.values.income,
    deposit: state.values.deposit,
    expenses: state.values.expenses,
    property_value: state.values.value,
    loan_balance: state.values.balance,
    current_rate: state.unsure.rate ? '' : state.values.rate,
    review_goal: state.values.goal || ''
  };
  try {
    var camp = JSON.parse(sessionStorage.getItem('fsqCampaign') || 'null');
    if (camp && camp.utm) { payload.utm = camp.utm; payload.landing_page = camp.landingPage; }
  } catch (e) {}
  if (!payload.landing_page) payload.landing_page = location.pathname + location.search;
  var done = function(ok){
    if (ok){
      try { if (window.gtag) gtag('event', 'generate_lead', { lead_source: payload.lead_source }); } catch (e) {}
      renderResult(); return;
    }
    btn.disabled = false; btn.textContent = 'See my snapshot';
    var err = el.querySelector('[data-err]');
    err.textContent = 'Something went wrong sending that. Please try again, or call us on 0495 040 500.';
    err.hidden = false;
  };
  /* Confirm the mobile first. FNSQVerify resolves with a token, or with '' when
     verification is not switched on, so the funnel keeps working either way. */
  var mount = el.querySelector('[data-err]') ? el.querySelector('[data-err]').parentNode : el;
  var gate = (window.FNSQVerify && window.FNSQVerify.gate)
    ? window.FNSQVerify.gate(payload.phone, mount)
    : Promise.resolve('');

  gate.then(function(token){
    if (token) payload.verification = token;
    return fetch('/api/lead', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    }).then(function(r){ done(r.ok); });
  }, function(){
    // visitor abandoned the code step; leave the form usable
    btn.disabled = false;
    btn.textContent = 'See my snapshot';
  }).catch(function(){ done(false); });
}

/* ---------------------------------------------------------------- result */
function buyResult(){
  var v = state.values;
  var taxRate = v.income > 180000 ? 0.34 : v.income > 90000 ? 0.28 : 0.21;
  var net = v.income * (1 - taxRate) / 12;
  var expenses = Math.max(v.expenses, 2600);
  var surplus = Math.max(0, net - expenses - 300);
  var loan = invMonthly(surplus * 0.9, 9.0);
  loan = Math.min(loan, v.income * 7);
  var low = round10k(loan * 0.93), high = round10k(loan * 1.07);
  if (high < 50000){
    return '<p>On these figures the numbers look tight at today’s assessment rates, but rough inputs often miss things that help, like a second income, lower real expenses or family support. It’s exactly the kind of situation a quick conversation sorts out.</p>';
  }
  var bLow = round10k(low + v.deposit), bHigh = round10k(high + v.deposit);
  return '<div class="st-fig"><span>Indicative borrowing range</span><strong>' + fmtK(low) + ' – ' + fmtK(high) + '</strong></div>' +
    '<div class="st-fig"><span>Potential purchase band with your ' + fmtK(v.deposit) + '</span><strong>' + fmtK(bLow) + ' – ' + fmtK(bHigh) + '</strong></div>' +
    '<p>These are broad estimates from three rough inputs; lenders assess much more, and results vary a lot between them. Your broker will firm this up with you' + (v.timeframe === 'As soon as possible' ? ' quickly, given your timeframe' : '') + '.</p>';
}
function loanResult(){
  var v = state.values, u = state.unsure;
  if (u.rate){
    return '<p>Not knowing your rate is common, and often a sign it’s worth checking. On a balance of about ' + fmtK(v.balance) +
      ', each 0.25 percentage points changes repayments by roughly ' + fmt$(monthly(v.balance, 6.25) - monthly(v.balance, 6.0)) +
      ' a month. Your broker will find your actual rate with you and compare it properly.</p>';
  }
  var m = monthly(v.balance, v.rate);
  var d25 = m - monthly(v.balance, Math.max(1, v.rate - 0.25));
  var d50 = m - monthly(v.balance, Math.max(1, v.rate - 0.5));
  return '<div class="st-fig"><span>Approx. current repayment (30-yr basis)</span><strong>' + fmt$(m) + ' /mo</strong></div>' +
    '<div class="st-fig"><span>What a 0.25 / 0.50 point difference means on your balance</span><strong>' + fmt$(d25) + ' / ' + fmt$(d50) + ' per month</strong></div>' +
    '<p>That’s arithmetic, not an offer. Whether a better rate, structure or features are actually available depends on your situation and lender assessment. Sometimes the honest answer is that your current loan stacks up; if so, we’ll tell you.</p>';
}

function renderResult(){
  var isBuy = state.path === 'buy';
  var el = h('st-result',
    '<div class="st-done-mark">✓</div>' +
    '<p class="st-eyebrow">Snapshot sent</p>' +
    '<h2>Thanks, here’s your first look.</h2>' +
    '<div class="st-card">' + (isBuy ? buyResult() : loanResult()) + '</div>' +
    '<p class="st-sub">A broker will be in touch shortly to walk through it. Prefer to pick a time yourself?</p>' +
    '<div class="st-ctas">' +
      '<a class="st-btn st-btn-primary" href="contact.html#book">Book a 15-minute call</a>' +
      '<a class="st-btn st-btn-ghost" href="index.html">Back to the site</a>' +
    '</div>' +
    '<p class="st-fine">Figures are illustrations from the rough numbers you entered. They aren’t credit advice, a quote or an offer of credit, and any loan is subject to lender assessment and approval.</p>');
  swap(el);
}

/* ----------------------------------------------------------------- boot */
window.FSQ_START = { state: state, startPath: startPath, renderChooser: renderChooser, PATHS: PATHS };
var qp = new URLSearchParams(location.search).get('path');
if (qp === 'buy' || qp === 'loan') startPath(qp); else renderChooser();
})();
