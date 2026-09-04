/* ============================================================
   FINANCE SQUARE GROUP — interactive lending tools
   Borrowing Capacity + Loan Health Check
   Vanilla JS, no dependencies.

   METHODOLOGY (documented so figures are defensible)
   --------------------------------------------------
   1. Amortisation. Monthly repayment on principal P at monthly
      rate r over n months:   M = P*r / (1 - (1+r)^-n)
      Rearranged to solve for the principal a repayment supports:
                              P = M * (1 - (1+r)^-n) / r

   2. Income tax. ATO resident rates (2024-25) plus the 2% Medicare
      levy, applied per earner. Household income is split across up
      to two earners, which is how a couple is actually assessed.

   3. Living expenses. Lenders take the HIGHER of a borrower's
      declared expenses and a Household Expenditure Measure (HEM)
      style floor scaled by household size. Declaring low expenses
      does not increase capacity beyond the floor.

   4. Serviceability buffer. APRA's APG 223 requires lenders to
      assess repayments at the product rate plus a serviceability
      buffer (3.00 percentage points at the time of writing).
      Capacity is therefore calculated at the assessment rate, not
      the rate actually paid.

   5. Prudential haircut. Lenders require a positive net surplus
      after the assessed repayment, so 95% of the monthly surplus
      is treated as available for repayments, and the answer is
      presented as a range because lender policy varies widely.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-AU'); };
  var money2 = function (n) {
    return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  /* ---------- core finance maths ---------- */

  // Monthly repayment for principal P, annual rate % , years
  function repayment(P, annualPct, years) {
    var r = annualPct / 100 / 12, n = years * 12;
    if (r <= 0) return P / n;
    return P * r / (1 - Math.pow(1 + r, -n));
  }

  // Principal supported by a monthly repayment M at annual rate %, years
  function principalFrom(M, annualPct, years) {
    var r = annualPct / 100 / 12, n = years * 12;
    if (r <= 0) return M * n;
    return M * (1 - Math.pow(1 + r, -n)) / r;
  }

  // ATO resident income tax, 2024-25 scale, plus 2% Medicare levy
  function incomeTax(gross) {
    var t = 0;
    if (gross <= 18200) t = 0;
    else if (gross <= 45000) t = (gross - 18200) * 0.16;
    else if (gross <= 135000) t = 4288 + (gross - 45000) * 0.30;
    else if (gross <= 190000) t = 31288 + (gross - 135000) * 0.37;
    else t = 51638 + (gross - 190000) * 0.45;
    var medicare = gross > 27222 ? gross * 0.02 : 0;
    return t + medicare;
  }

  // Net (after tax) household income. Split across up to two earners.
  function netHouseholdIncome(grossHousehold, people) {
    var earners = people >= 2 ? 2 : 1;
    var per = grossHousehold / earners;
    return (per - incomeTax(per)) * earners;
  }

  // Indicative HEM-style monthly expense floor by household size
  function hemFloor(people) {
    if (people <= 1) return 1900;
    if (people === 2) return 3000;
    return 3000 + (people - 2) * 500;
  }

  var BUFFER = 3.00;          // APRA serviceability buffer, percentage points
  var TERM_YEARS = 30;        // standard assessment term
  var SURPLUS_FACTOR = 0.95;  // prudential haircut on available surplus

  /* ============================================================
     BORROWING CAPACITY
     ============================================================ */
  function borrowingCapacity(opts) {
    var gross = opts.income;
    var declaredMonthly = opts.expenses;
    var people = opts.people;
    var productRate = opts.rate;

    var net = netHouseholdIncome(gross, people);
    var netMonthly = net / 12;

    var floor = hemFloor(people);
    var assessedExpenses = Math.max(declaredMonthly, floor);
    var usedFloor = assessedExpenses > declaredMonthly;

    var surplus = Math.max(netMonthly - assessedExpenses, 0);
    var available = surplus * SURPLUS_FACTOR;

    var assessmentRate = productRate + BUFFER;
    var capacity = principalFrom(available, assessmentRate, TERM_YEARS);

    // Lender policy varies, so present a range around the central figure
    var low = Math.floor(capacity * 0.92 / 5000) * 5000;
    var high = Math.ceil(capacity * 1.05 / 5000) * 5000;

    return {
      net: net,
      netMonthly: netMonthly,
      assessedExpenses: assessedExpenses,
      usedFloor: usedFloor,
      floor: floor,
      surplus: surplus,
      available: available,
      assessmentRate: assessmentRate,
      capacity: capacity,
      low: low,
      high: high,
      // repayment on the mid figure at the ACTUAL rate, not the buffered rate
      repayment: repayment(capacity, productRate, TERM_YEARS)
    };
  }

  /* ============================================================
     LOAN HEALTH CHECK
     ============================================================ */
  function healthCheck(opts) {
    var balance = opts.balance;
    var currentRate = opts.currentRate;
    var compareRate = opts.compareRate;
    var years = opts.years;

    var mNow = repayment(balance, currentRate, years);
    var mNew = repayment(balance, compareRate, years);
    var monthlySaving = mNow - mNew;

    var totalNow = mNow * years * 12;
    var totalNew = mNew * years * 12;

    return {
      current: mNow,
      proposed: mNew,
      monthlySaving: monthlySaving,
      annualSaving: monthlySaving * 12,
      totalSaving: totalNow - totalNew,
      interestNow: totalNow - balance,
      interestNew: totalNew - balance,
      rateGap: currentRate - compareRate,
      better: monthlySaving > 0
    };
  }

  /* ============================================================
     WIZARD SHELL (shared by both tools)
     ============================================================ */
  function initWizard(root, onComplete) {
    var steps = $$('.wz-step', root);
    var bar = $('.wz-bar i', root);
    var counter = $('.wz-count', root);
    var idx = 0;

    function show(i) {
      idx = Math.max(0, Math.min(i, steps.length - 1));
      steps.forEach(function (s, j) { s.classList.toggle('on', j === idx); });
      if (bar) bar.style.width = ((idx + 1) / steps.length * 100) + '%';
      if (counter) counter.textContent = 'Step ' + (idx + 1) + ' of ' + steps.length;
      var focusable = steps[idx].querySelector('input, select');
      if (focusable && idx > 0) { try { focusable.focus({ preventScroll: true }); } catch (e) {} }
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function validate(step) {
      var ok = true;
      $$('input[data-required]', step).forEach(function (el) {
        var v = parseFloat(String(el.value).replace(/[^0-9.]/g, ''));
        var bad = isNaN(v) || v <= 0;
        el.closest('.wz-field').classList.toggle('bad', bad);
        if (bad) ok = false;
      });
      return ok;
    }

    $$('.wz-next', root).forEach(function (b) {
      b.addEventListener('click', function () {
        if (!validate(steps[idx])) return;
        if (idx === steps.length - 2) onComplete();
        show(idx + 1);
      });
    });
    $$('.wz-back', root).forEach(function (b) {
      b.addEventListener('click', function () { show(idx - 1); });
    });
    $$('.wz-restart', root).forEach(function (b) {
      b.addEventListener('click', function () { show(0); });
    });

    // choice buttons (property type, household size)
    $$('.wz-choice', root).forEach(function (group) {
      $$('button', group).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('button', group).forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          group.dataset.value = b.dataset.v;
        });
      });
    });

    // Enter key advances
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var nextBtn = steps[idx].querySelector('.wz-next');
        if (nextBtn) nextBtn.click();
      }
    });

    show(0);
    return { show: show };
  }

  // read a numeric input, stripping formatting
  function num(sel, root) {
    var el = $(sel, root);
    if (!el) return 0;
    return parseFloat(String(el.value).replace(/[^0-9.]/g, '')) || 0;
  }

  // live thousands separators on money inputs
  function attachMoneyMask(root) {
    $$('input[data-money]', root).forEach(function (el) {
      el.addEventListener('input', function () {
        var caretEnd = el.selectionStart === el.value.length;
        var v = el.value.replace(/[^0-9]/g, '');
        if (v === '') { el.value = ''; return; }
        el.value = parseInt(v, 10).toLocaleString('en-AU');
        if (caretEnd) { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
      });
    });
  }

  /* ---------- BORROWING CAPACITY PAGE ---------- */
  var bcRoot = $('#bc-tool');
  if (bcRoot) {
    attachMoneyMask(bcRoot);
    var bcRate = $('#bc-rate', bcRoot);
    var bcRateOut = $('#bc-rate-out', bcRoot);

    function bcRun() {
      var people = parseInt($('#bc-people', bcRoot).dataset.value || '2', 10);
      var res = borrowingCapacity({
        income: num('#bc-income', bcRoot),
        expenses: num('#bc-expenses', bcRoot),
        people: people,
        rate: parseFloat(bcRate.value)
      });

      $('#bc-range', bcRoot).textContent = money(res.low) + ' to ' + money(res.high);
      $('#bc-mid', bcRoot).textContent = money(Math.round(res.capacity / 1000) * 1000);
      $('#bc-repay', bcRoot).textContent = money(res.repayment);
      $('#bc-net', bcRoot).textContent = money(res.netMonthly);
      $('#bc-exp', bcRoot).textContent = money(res.assessedExpenses);
      $('#bc-surplus', bcRoot).textContent = money(res.surplus);
      $('#bc-assess', bcRoot).textContent = res.assessmentRate.toFixed(2) + '%';
      $('#bc-people-out', bcRoot).textContent = people + (people === 1 ? ' person' : ' people');

      var note = $('#bc-floor-note', bcRoot);
      if (res.usedFloor) {
        note.style.display = 'block';
        note.textContent = 'Your declared expenses were below the ' + money(res.floor) +
          ' per month benchmark lenders apply for a household of ' + people +
          ', so the benchmark has been used instead. Lenders do the same thing.';
      } else {
        note.style.display = 'none';
      }

      var zero = $('#bc-zero', bcRoot);
      if (zero) zero.style.display = res.surplus <= 0 ? 'block' : 'none';
    }

    if (bcRate) {
      bcRate.addEventListener('input', function () {
        bcRateOut.textContent = parseFloat(bcRate.value).toFixed(2) + '% p.a.';
        if ($('.wz-step.on', bcRoot) === $('#bc-result', bcRoot)) bcRun();
      });
      bcRateOut.textContent = parseFloat(bcRate.value).toFixed(2) + '% p.a.';
    }
    initWizard(bcRoot, bcRun);
  }

  /* ---------- LOAN HEALTH CHECK PAGE ---------- */
  var hcRoot = $('#hc-tool');
  if (hcRoot) {
    attachMoneyMask(hcRoot);
    var hcCompare = $('#hc-compare', hcRoot);
    var hcCompareOut = $('#hc-compare-out', hcRoot);
    var hcTerm = $('#hc-term', hcRoot);
    var hcTermOut = $('#hc-term-out', hcRoot);

    function hcRun() {
      var res = healthCheck({
        balance: num('#hc-balance', hcRoot),
        currentRate: num('#hc-rate', hcRoot),
        compareRate: parseFloat(hcCompare.value),
        years: parseInt(hcTerm.value, 10)
      });

      var type = $('#hc-type', hcRoot).dataset.value || 'Owner Occupied';
      $('#hc-type-out', hcRoot).textContent = type;
      $('#hc-current', hcRoot).textContent = money2(res.current);
      $('#hc-proposed', hcRoot).textContent = money2(res.proposed);
      $('#hc-interest-now', hcRoot).textContent = money(res.interestNow);
      $('#hc-interest-new', hcRoot).textContent = money(res.interestNew);

      var head = $('#hc-headline', hcRoot);
      var sub = $('#hc-sub', hcRoot);
      var band = $('#hc-band', hcRoot);

      if (res.better) {
        head.textContent = money(Math.abs(res.monthlySaving)) + ' a month';
        sub.textContent = 'That is ' + money(Math.abs(res.annualSaving)) + ' a year, or ' +
          money(Math.abs(res.totalSaving)) + ' over the remaining ' + hcTerm.value + ' years.';
        band.className = 'hc-band good';
        $('#hc-verdict', hcRoot).textContent = 'Worth a conversation';
      } else if (Math.abs(res.monthlySaving) < 1) {
        head.textContent = 'Already competitive';
        sub.textContent = 'Your rate is line ball with the comparison rate. Switching for rate alone may not be worth the effort, though structure and features can still be reviewed.';
        band.className = 'hc-band level';
        $('#hc-verdict', hcRoot).textContent = 'Line ball';
      } else {
        head.textContent = 'You are ahead';
        sub.textContent = 'Your current rate is ' + Math.abs(res.rateGap).toFixed(2) +
          ' percentage points better than the comparison rate. Staying put looks like the smarter move, and we will tell you that plainly.';
        band.className = 'hc-band ahead';
        $('#hc-verdict', hcRoot).textContent = 'Stay put';
      }
    }

    if (hcCompare) {
      hcCompare.addEventListener('input', function () {
        hcCompareOut.textContent = parseFloat(hcCompare.value).toFixed(2) + '% p.a.';
        if ($('.wz-step.on', hcRoot) === $('#hc-result', hcRoot)) hcRun();
      });
      hcCompareOut.textContent = parseFloat(hcCompare.value).toFixed(2) + '% p.a.';
    }
    if (hcTerm) {
      hcTerm.addEventListener('input', function () {
        hcTermOut.textContent = hcTerm.value + ' years';
        if ($('.wz-step.on', hcRoot) === $('#hc-result', hcRoot)) hcRun();
      });
      hcTermOut.textContent = hcTerm.value + ' years';
    }
    initWizard(hcRoot, hcRun);
  }

  // expose for testing
  window.FNSQ_TOOLS = {
    repayment: repayment,
    principalFrom: principalFrom,
    incomeTax: incomeTax,
    netHouseholdIncome: netHouseholdIncome,
    hemFloor: hemFloor,
    borrowingCapacity: borrowingCapacity,
    healthCheck: healthCheck
  };
})();
