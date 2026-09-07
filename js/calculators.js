/* ============================================================
   FINANCE SQUARE GROUP — CALCULATOR SUITE
   Vanilla JS, no dependencies. Every figure is an estimate for
   illustration and discussion only — not a quote, not credit
   advice, and not a credit assessment.

   Mechanics follow the way Australian lenders and brokers
   actually model these numbers:
     · Repayments      — standard amortising annuity, plus
                         interest-only, and a real amortisation run.
     · Borrowing power — ATO resident tax scale + 2% Medicare,
                         HEM-style living expenses floor, credit
                         card limits assessed at 3.8%/month, and
                         APRA's 3.00 percentage point serviceability
                         buffer added to the product rate.
                         (APRA confirmed the 3pp buffer stays in 2026.)
     · Stamp duty      — current state transfer/land-transfer duty
                         scales, with first home buyer concessions
                         for VIC, NSW and QLD.
   ============================================================ */
(function () {
'use strict';

/* ---------------------------------------------------------- utilities */
var $  = function (s, c) { return (c || document).querySelector(s); };
var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

function money(n)  { return '$' + Math.round(n || 0).toLocaleString('en-AU'); }
function money2(n) { return '$' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(n)    { return (Math.round((n || 0) * 100) / 100).toFixed(2) + '%'; }
function num(id)   { var el = $(id); if (!el) return 0; var v = parseFloat(String(el.value).replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : 0; }
function val(id)   { var el = $(id); return el ? el.value : ''; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* Amortising repayment for principal P, annual rate %, n periods, k periods/yr */
function repayment(P, annualPct, periods, perYear) {
  var r = annualPct / 100 / perYear;
  if (r <= 0) return P / periods;
  return P * r / (1 - Math.pow(1 + r, -periods));
}
/* Maximum principal supportable by payment M */
function principalFor(M, annualPct, periods, perYear) {
  var r = annualPct / 100 / perYear;
  if (r <= 0) return M * periods;
  return M * (1 - Math.pow(1 + r, -periods)) / r;
}
/* Months to clear a balance given a monthly payment */
function monthsToClear(P, annualPct, pay) {
  var r = annualPct / 100 / 12;
  if (r <= 0) return P / pay;
  if (pay <= P * r) return Infinity;
  return -Math.log(1 - P * r / pay) / Math.log(1 + r);
}
function termText(months) {
  if (!isFinite(months)) return 'never';
  var y = Math.floor(months / 12), m = Math.round(months % 12);
  if (m === 12) { y++; m = 0; }
  return (y ? y + (y === 1 ? ' year' : ' years') : '') + (y && m ? ' ' : '') + (m ? m + (m === 1 ? ' month' : ' months') : (y ? '' : '0 months'));
}

/* -------------------------------------------------- ATO resident tax
   2025-26 resident rates. Medicare levy applied as a flat 2% —
   low-income thresholds and offsets are ignored, so tax is slightly
   over-stated for low incomes. Good enough for an indication. */
function incomeTax(gross) {
  var t = 0;
  if (gross <= 18200) t = 0;
  else if (gross <= 45000)  t = (gross - 18200) * 0.16;
  else if (gross <= 135000) t = 4288  + (gross - 45000)  * 0.30;
  else if (gross <= 190000) t = 31288 + (gross - 135000) * 0.37;
  else                      t = 51638 + (gross - 190000) * 0.45;
  var medicare = gross > 27222 ? gross * 0.02 : 0;
  return t + medicare;
}
function netMonthly(gross) { return Math.max(0, gross - incomeTax(gross)) / 12; }

/* ------------------------------------------------------------- LMI
   Indicative premium as a percentage of the loan, by LVR band and
   loan size. Real premiums vary by insurer, lender, loan purpose
   and borrower type — this is a planning figure only. */
function lmiEstimate(loan, lvr) {
  if (lvr <= 80.0001) return 0;
  var band = lvr <= 85 ? 0 : lvr <= 90 ? 1 : lvr <= 95 ? 2 : 3;
  var size = loan <= 500000 ? 0 : loan <= 750000 ? 1 : 2;
  var table = [
    [0.90, 1.30, 1.65],   /* 80–85 */
    [1.90, 2.40, 2.85],   /* 85–90 */
    [3.30, 3.90, 4.45],   /* 90–95 */
    [4.60, 5.20, 5.80]    /* 95+   */
  ];
  return loan * table[band][size] / 100;
}

/* ====================================================================
   STAMP DUTY / TRANSFER DUTY
   VIC, NSW and QLD scales verified against the State Revenue Office,
   Revenue NSW and the Queensland Revenue Office. WA, SA, TAS, ACT and
   NT use their published general scales. Duty rules change often —
   always confirm with the relevant state revenue office.
   ==================================================================== */
function scaleDuty(v, rows) {
  /* rows: [threshold, base, rate, over] — duty = base + rate*(v-over) */
  for (var i = rows.length - 1; i >= 0; i--) {
    if (v > rows[i][0]) return rows[i][1] + (v - rows[i][3]) * rows[i][2];
  }
  return v * rows[0][2];
}

var DUTY = {
  VIC: function (v, opt) {
    var ppr = opt.use !== 'investment';
    var general;
    if (v <= 25000) general = v * 0.014;
    else if (v <= 130000)  general = 350 + (v - 25000) * 0.024;
    else if (v <= 960000)  general = 2870 + (v - 130000) * 0.06;
    else if (v <= 2000000) general = v * 0.055;
    else                   general = 110000 + (v - 2000000) * 0.065;
    var duty = general;
    if (ppr && v <= 550000) {
      /* PPR concessional scale applies to homes of $550,000 or less */
      if (v <= 25000) duty = v * 0.014;
      else if (v <= 130000) duty = 350 + (v - 25000) * 0.024;
      else if (v <= 440000) duty = 2870 + (v - 130000) * 0.05;
      else duty = 18370 + (v - 440000) * 0.06;
    }
    if (opt.fhb) {
      if (v <= 600000) return { duty: 0, note: 'First home buyers pay no duty on homes up to $600,000 in Victoria.' };
      if (v <= 750000) return { duty: duty * (v - 600000) / 150000, note: 'Victorian first home buyer concession phases out between $600,000 and $750,000.' };
      return { duty: duty, note: 'Above $750,000 the Victorian first home buyer concession no longer applies.' };
    }
    return { duty: duty, note: ppr ? 'Principal place of residence rates applied where eligible.' : 'General (non-PPR) rates applied.' };
  },

  NSW: function (v, opt) {
    var d;
    if (v <= 18000) d = Math.max(20, v * 0.0125);
    else if (v <= 38000)   d = 225 + (v - 18000) * 0.015;
    else if (v <= 103000)  d = 525 + (v - 38000) * 0.0175;
    else if (v <= 387000)  d = 1662 + (v - 103000) * 0.035;
    else if (v <= 1290000) d = 11602 + (v - 387000) * 0.045;
    else if (v <= 3870000) d = 52237 + (v - 1290000) * 0.055;
    else                   d = 194137 + (v - 3870000) * 0.07;
    if (opt.fhb && opt.use !== 'investment') {
      if (v <= 800000) return { duty: 0, note: 'NSW First Home Buyers Assistance Scheme: no duty on homes up to $800,000.' };
      if (v <= 1000000) return { duty: d * (v - 800000) / 200000, note: 'NSW first home buyer concession phases out between $800,000 and $1,000,000.' };
      return { duty: d, note: 'Above $1,000,000 the NSW first home buyer concession no longer applies.' };
    }
    return { duty: d, note: v > 3870000 ? 'NSW premium property duty applies above the premium threshold.' : 'NSW general transfer duty scale applied.' };
  },

  QLD: function (v, opt) {
    var d;
    if (v <= 5000) d = 0;
    else if (v <= 75000)   d = (v - 5000) * 0.015;
    else if (v <= 540000)  d = 1050 + (v - 75000) * 0.035;
    else if (v <= 1000000) d = 17325 + (v - 540000) * 0.045;
    else                   d = 38025 + (v - 1000000) * 0.0575;
    if (opt.use !== 'investment') {
      /* home concession: 1% on the first $350,000 of a home you live in */
      var homeConc = Math.min(v, 350000) * 0.035 - Math.min(v, 350000) * 0.01;
      var homeDuty = Math.max(0, d - Math.max(0, homeConc));
      if (opt.fhb) {
        if (opt.build === 'new') return { duty: 0, note: 'Queensland first home buyers pay no transfer duty on a new home or vacant land build (from 1 May 2025).' };
        if (v <= 700000) return { duty: 0, note: 'Queensland first home concession: no duty on an existing first home up to $700,000.' };
        if (v <= 800000) return { duty: homeDuty * (v - 700000) / 100000, note: 'Queensland first home concession phases out between $700,000 and $800,000.' };
        return { duty: homeDuty, note: 'Above $800,000 only the standard home concession applies.' };
      }
      return { duty: homeDuty, note: 'Queensland home concession applied to the first $350,000.' };
    }
    return { duty: d, note: 'Queensland general transfer duty scale applied (investment purchase).' };
  },

  WA: function (v, opt) {
    var d;
    if (v <= 120000) d = v * 0.019;
    else if (v <= 150000) d = 2280 + (v - 120000) * 0.0285;
    else if (v <= 360000) d = 3135 + (v - 150000) * 0.038;
    else if (v <= 725000) d = 11115 + (v - 360000) * 0.0475;
    else d = 28453 + (v - 725000) * 0.0515;
    return { duty: d, note: 'WA residential rate of duty. First home owner rate concessions may apply — confirm with RevenueWA.' };
  },

  SA: function (v) {
    var d;
    if (v <= 12000) d = v * 0.01;
    else if (v <= 30000)  d = 120 + (v - 12000) * 0.02;
    else if (v <= 50000)  d = 480 + (v - 30000) * 0.03;
    else if (v <= 100000) d = 1080 + (v - 50000) * 0.035;
    else if (v <= 200000) d = 2830 + (v - 100000) * 0.04;
    else if (v <= 250000) d = 6830 + (v - 200000) * 0.0425;
    else if (v <= 300000) d = 8955 + (v - 250000) * 0.0475;
    else if (v <= 500000) d = 11330 + (v - 300000) * 0.05;
    else d = 21330 + (v - 500000) * 0.055;
    return { duty: d, note: 'SA conveyance duty scale. South Australia has abolished duty for eligible first home buyers on new homes — confirm with RevenueSA.' };
  },

  TAS: function (v) {
    var d;
    if (v <= 3000) d = 50;
    else if (v <= 25000)  d = 50 + (v - 3000) * 0.0175;
    else if (v <= 75000)  d = 435 + (v - 25000) * 0.0225;
    else if (v <= 200000) d = 1560 + (v - 75000) * 0.035;
    else if (v <= 375000) d = 5935 + (v - 200000) * 0.04;
    else if (v <= 725000) d = 12935 + (v - 375000) * 0.0425;
    else d = 27810 + (v - 725000) * 0.045;
    return { duty: d, note: 'Tasmanian property transfer duty scale. First home buyer concessions may apply — confirm with the State Revenue Office of Tasmania.' };
  },

  ACT: function (v, opt) {
    var d;
    if (v <= 260000) d = v * 0.0049;
    else if (v <= 300000)  d = 1274 + (v - 260000) * 0.022;
    else if (v <= 500000)  d = 2154 + (v - 300000) * 0.034;
    else if (v <= 750000)  d = 8954 + (v - 500000) * 0.0432;
    else if (v <= 1000000) d = 19754 + (v - 750000) * 0.059;
    else if (v <= 1455000) d = 34504 + (v - 1000000) * 0.064;
    else d = v * 0.0454;
    return { duty: d, note: 'ACT residential conveyance duty. The ACT Home Buyer Concession Scheme can remove duty entirely for eligible buyers under an income threshold — confirm with the ACT Revenue Office.' };
  },

  NT: function (v) {
    var d;
    if (v < 525000) { var V = v / 1000; d = (0.06571441 * V * V) + 15 * V; }
    else if (v <= 3000000) d = v * 0.0495;
    else if (v <= 5000000) d = v * 0.0575;
    else d = v * 0.0595;
    return { duty: d, note: 'Northern Territory conveyance duty. House and land packages and first home owner concessions may apply — confirm with the Territory Revenue Office.' };
  }
};

/* ====================================================================
   1. LOAN REPAYMENTS
   ==================================================================== */
function calcRepayment() {
  var root = $('#p-repayment');
  if (!root) return;
  var P = num('#r-amount');
  var rate = num('#r-rate');
  var years = clamp(num('#r-term'), 1, 40);
  var perYear = { monthly: 12, fortnightly: 26, weekly: 52 }[val('#r-freq')] || 12;
  var type = root.getAttribute('data-type') || 'pi';
  var ioYears = clamp(num('#r-io'), 0, Math.min(10, years));
  var extra = num('#r-extra');
  var freqWord = { 12: 'month', 26: 'fortnight', 52: 'week' }[perYear];

  var pay, totalInterest, totalPaid, ioPay = 0;
  if (type === 'io') {
    ioPay = P * rate / 100 / perYear;
    var piPeriods = (years - ioYears) * perYear;
    pay = piPeriods > 0 ? repayment(P, rate, piPeriods, perYear) : ioPay;
    totalPaid = ioPay * ioYears * perYear + pay * piPeriods;
    totalInterest = totalPaid - P;
  } else {
    var periods = years * perYear;
    pay = repayment(P, rate, periods, perYear);
    totalPaid = pay * periods;
    totalInterest = totalPaid - P;
  }

  /* effect of extra repayments (P&I only) */
  var saveMsg = '';
  if (extra > 0 && type !== 'io') {
    var monthlyBase = repayment(P, rate, years * 12, 12);
    var extraMonthly = extra * perYear / 12;
    var baseInterest = monthlyBase * years * 12 - P;
    var mNew = monthsToClear(P, rate, monthlyBase + extraMonthly);
    var newInterest = (monthlyBase + extraMonthly) * mNew - P;
    if (isFinite(mNew)) {
      saveMsg = 'Adding ' + money(extra) + ' a ' + freqWord + ' could save about <b>' + money(baseInterest - newInterest) +
                '</b> in interest and clear the loan roughly <b>' + termText(years * 12 - mNew) + '</b> sooner.';
    }
  }

  $('#r-out-pay').innerHTML = money(pay);
  $('#r-out-cap').textContent = 'per ' + freqWord + (type === 'io' ? ', once the interest-only period ends' : ', principal and interest');
  $('#r-out-io').parentNode.style.display = type === 'io' ? 'flex' : 'none';
  $('#r-out-io').textContent = money(ioPay) + ' per ' + freqWord;
  $('#r-out-monthly').textContent = money(pay * perYear / 12);
  $('#r-out-total').textContent = money(totalPaid);
  $('#r-out-interest').textContent = money(totalInterest);
  $('#r-out-ratio').textContent = P > 0 ? Math.round(totalInterest / P * 100) + '% of the amount borrowed' : '—';
  var flag = $('#r-out-flag');
  flag.innerHTML = saveMsg;
  flag.style.display = saveMsg ? 'block' : 'none';

  /* amortisation — first five years, monthly compounding */
  var rows = '', bal = P, rM = rate / 100 / 12, payM = type === 'io' ? P * rM : repayment(P, rate, years * 12, 12);
  for (var y = 1; y <= Math.min(5, years); y++) {
    var yi = 0, yp = 0;
    for (var m = 0; m < 12; m++) {
      var i = bal * rM;
      var pr = (type === 'io' && y <= ioYears) ? 0 : payM - i;
      if (pr > bal) pr = bal;
      bal -= pr; yi += i; yp += pr;
    }
    rows += '<tr><td>Year ' + y + '</td><td>' + money(yp) + '</td><td>' + money(yi) + '</td><td>' + money(Math.max(0, bal)) + '</td></tr>';
  }
  $('#r-amort').innerHTML = rows;
}

/* ====================================================================
   2. BORROWING CAPACITY
   ==================================================================== */
function calcBorrowing() {
  var root = $('#p-borrowing');
  if (!root) return;
  var applicants = root.getAttribute('data-applicants') === '2' ? 2 : 1;
  var purpose = root.getAttribute('data-purpose') || 'owner';

  var inc1 = num('#b-income1');
  var inc2 = applicants === 2 ? num('#b-income2') : 0;
  var otherAnnual = num('#b-other');           /* other income, e.g. bonus */
  var rentWeekly  = num('#b-rent');            /* expected rent, investors */
  var deps = clamp(num('#b-deps'), 0, 8);
  var expenses = num('#b-expenses');
  var cards = num('#b-cards');
  var repayments = num('#b-repayments');
  var deposit = num('#b-deposit');
  var rate = num('#b-rate');
  var years = clamp(num('#b-term'), 5, 30);

  $('#b-income2').closest('.cf').style.display = applicants === 2 ? '' : 'none';
  $('#b-rent').closest('.cf').style.display = purpose === 'investment' ? '' : 'none';

  var assessRate = rate + 3.00;   /* APRA serviceability buffer */
  var netInc = netMonthly(inc1) + netMonthly(inc2) + netMonthly(otherAnnual);
  /* rental income is shaded — lenders typically count 70–80% */
  var rentMonthly = purpose === 'investment' ? rentWeekly * 52 / 12 * 0.80 : 0;

  var hem = (applicants === 2 ? 3100 : 2100) + deps * 500;
  var usedExpenses = Math.max(expenses, hem);
  var cardCommit = cards * 0.038;

  var surplus = netInc + rentMonthly - usedExpenses - cardCommit - repayments;
  var maxLoan = surplus > 0 ? principalFor(surplus, assessRate, years * 12, 12) : 0;
  maxLoan = Math.max(0, Math.min(maxLoan, 8000000));

  /* purchase price: deposit has to cover duty + costs too, so we solve
     roughly by assuming ~5% of price goes to duty and acquisition costs */
  var price = maxLoan + deposit;
  for (var k = 0; k < 6; k++) {
    var costs = price * 0.05;
    price = maxLoan + deposit - costs;
    if (price < 0) { price = 0; break; }
  }
  var loanUsed = Math.max(0, Math.min(maxLoan, price - Math.max(0, deposit - price * 0.05)));
  var lvr = price > 0 ? clamp(loanUsed / price * 100, 0, 100) : 0;
  var lmi = lmiEstimate(loanUsed, lvr);

  var lo = Math.round(maxLoan * 0.95 / 5000) * 5000;
  var hi = Math.round(maxLoan * 1.05 / 5000) * 5000;

  $('#b-out-range').textContent = maxLoan > 0 ? money(lo) + ' – ' + money(hi) : '$0';
  $('#b-out-price').textContent = money(Math.max(0, price));
  $('#b-out-surplus').textContent = money(Math.max(0, surplus)) + ' /mo';
  $('#b-out-assess').textContent = pct(assessRate) + ' p.a.';
  $('#b-out-repay').textContent = maxLoan > 0 ? money(repayment(maxLoan, rate, years * 12, 12)) + ' /mo' : '$0';
  $('#b-out-lvr').textContent = Math.round(lvr) + '%';
  $('#b-out-lvrbar').style.width = clamp(lvr, 0, 100) + '%';
  $('#b-out-lmi').textContent = lmi > 0 ? '~' + money(lmi) : 'Not payable at this LVR';
  $('#b-out-hem').textContent = money(usedExpenses) + ' /mo';

  var flag = $('#b-out-flag'), msg = '';
  if (surplus <= 0) {
    msg = 'On these figures the numbers look tight at today’s assessment rate. Rough inputs often miss things that help — a second income, lower real expenses, or family support. That is exactly what a 15-minute call sorts out.';
  } else if (usedExpenses > expenses) {
    msg = 'We’ve used a benchmark living expense figure of ' + money(usedExpenses) + ' a month, because lenders apply a minimum benchmark (HEM) even when your declared spending is lower.';
  } else if (lvr > 80) {
    msg = 'At ' + Math.round(lvr) + '% LVR, Lenders Mortgage Insurance would usually apply. Some lenders waive it for specific professions — worth asking about.';
  }
  flag.innerHTML = msg;
  flag.style.display = msg ? 'block' : 'none';
}

/* ====================================================================
   3. BUDGET PLANNER
   ==================================================================== */
var BUDGET_FIELDS = ['g-housing', 'g-utilities', 'g-groceries', 'g-transport', 'g-insurance', 'g-health',
                     'g-education', 'g-childcare', 'g-subs', 'g-leisure', 'g-debts', 'g-other'];
function calcBudget() {
  var root = $('#p-budget');
  if (!root) return;
  var per = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1, annually: 1 / 12 }[val('#g-freq')] || 1;
  var income = num('#g-income') * per;
  var income2 = num('#g-income2') * per;
  var totalIn = income + income2;

  var totalOut = 0;
  BUDGET_FIELDS.forEach(function (f) { totalOut += num('#' + f); });

  var surplus = totalIn - totalOut;
  $('#g-out-surplus').textContent = money(surplus);
  $('#g-out-cap').textContent = surplus >= 0 ? 'left over each month' : 'short each month';
  $('#g-out-in').textContent = money(totalIn) + ' /mo';
  $('#g-out-out').textContent = money(totalOut) + ' /mo';
  $('#g-out-year').textContent = money(surplus * 12);
  $('#g-out-rate').textContent = totalIn > 0 ? Math.round(surplus / totalIn * 100) + '% of income' : '—';
  $('#g-out-bar').style.width = clamp(totalIn > 0 ? totalOut / totalIn * 100 : 0, 0, 100) + '%';

  var flag = $('#g-out-flag'), msg = '';
  if (totalIn > 0 && surplus > 0) {
    var support = principalFor(surplus * 0.9, num('#g-rate') + 3, 360, 12);
    msg = 'A surplus of ' + money(surplus) + ' a month could support roughly <b>' + money(Math.round(support / 10000) * 10000) +
          '</b> of home lending at a buffered assessment rate — before a lender looks at your full position.';
  } else if (totalIn > 0) {
    msg = 'Your listed expenses exceed your income. Worth a conversation before any new lending.';
  }
  flag.innerHTML = msg;
  flag.style.display = msg ? 'block' : 'none';
}

/* ====================================================================
   4. LUMP SUM / EXTRA REPAYMENT
   ==================================================================== */
function calcLump() {
  var root = $('#p-lumpsum');
  if (!root) return;
  var P = num('#l-balance');
  var rate = num('#l-rate');
  var years = clamp(num('#l-term'), 1, 40);
  var lump = num('#l-lump');
  var extra = num('#l-extra');

  var basePay = repayment(P, rate, years * 12, 12);
  var baseMonths = years * 12;
  var baseInterest = basePay * baseMonths - P;

  var newP = Math.max(0, P - lump);
  var newMonths = monthsToClear(newP, rate, basePay + extra);
  var newInterest = isFinite(newMonths) ? (basePay + extra) * newMonths - newP : Infinity;

  var saved = isFinite(newInterest) ? baseInterest - newInterest : 0;
  var timeSaved = isFinite(newMonths) ? baseMonths - newMonths : 0;

  $('#l-out-saved').textContent = money(Math.max(0, saved));
  $('#l-out-time').textContent = timeSaved > 0 ? termText(timeSaved) : 'No change';
  $('#l-out-pay').textContent = money(basePay + extra) + ' /mo';
  $('#l-out-basei').textContent = money(baseInterest);
  $('#l-out-newi').textContent = isFinite(newInterest) ? money(newInterest) : '—';
  $('#l-out-newterm').textContent = isFinite(newMonths) ? termText(newMonths) : 'Repayment too low';

  var flag = $('#l-out-flag'), msg = '';
  if (lump > 0 || extra > 0) {
    msg = 'Check your loan allows extra repayments without penalty — fixed-rate loans often cap them. If your loan has an offset account, parking the ' +
          (lump > 0 ? money(lump) : 'money') + ' there can achieve a similar result while keeping the funds available.';
  }
  flag.innerHTML = msg;
  flag.style.display = msg ? 'block' : 'none';
}

/* ====================================================================
   5. CAR AND TRUCK LOAN
   ==================================================================== */
function calcCar() {
  var root = $('#p-car');
  if (!root) return;
  var price = num('#c-price');
  var deposit = num('#c-deposit');
  var trade = num('#c-trade');
  var rate = num('#c-rate');
  var years = clamp(num('#c-term'), 1, 7);
  var balloonPct = clamp(num('#c-balloon'), 0, 60);
  var fees = num('#c-fees');
  var perYear = { monthly: 12, fortnightly: 26, weekly: 52 }[val('#c-freq')] || 12;
  var freqWord = { 12: 'month', 26: 'fortnight', 52: 'week' }[perYear];

  var financed = Math.max(0, price - deposit - trade + fees);
  var balloon = price * balloonPct / 100;
  var n = years * perYear;
  var r = rate / 100 / perYear;

  /* amortise to a residual (balloon) balance */
  var pay;
  if (r <= 0) pay = (financed - balloon) / n;
  else pay = (financed - balloon * Math.pow(1 + r, -n)) * r / (1 - Math.pow(1 + r, -n));
  if (!isFinite(pay) || pay < 0) pay = 0;

  var totalPaid = pay * n + balloon;
  var interest = totalPaid - financed;

  $('#c-out-pay').textContent = money(pay);
  $('#c-out-cap').textContent = 'per ' + freqWord + ' over ' + years + (years === 1 ? ' year' : ' years');
  $('#c-out-financed').textContent = money(financed);
  $('#c-out-balloon').textContent = balloon > 0 ? money(balloon) : 'None';
  $('#c-out-interest').textContent = money(Math.max(0, interest));
  $('#c-out-total').textContent = money(totalPaid);
  $('#c-out-monthly').textContent = money(pay * perYear / 12) + ' /mo';

  var flag = $('#c-out-flag'), msg = '';
  if (balloonPct > 0) {
    msg = 'A ' + balloonPct + '% balloon lowers the ' + freqWord + 'ly repayment, but <b>' + money(balloon) +
          '</b> falls due at the end of the term. You would need to pay it, refinance it, or sell the asset to cover it.';
  } else if (years >= 6) {
    msg = 'Longer terms reduce the repayment but increase total interest. On a depreciating asset, that can leave you owing more than it is worth.';
  }
  flag.innerHTML = msg;
  flag.style.display = msg ? 'block' : 'none';
}

/* ====================================================================
   6. STAMP DUTY
   ==================================================================== */
function calcDuty() {
  var root = $('#p-stampduty');
  if (!root) return;
  var state = val('#d-state');
  var v = num('#d-value');
  var use = root.getAttribute('data-use') || 'home';
  var fhb = root.getAttribute('data-fhb') === '1';
  var build = val('#d-build');

  if (use === 'investment' && fhb) { root.setAttribute('data-fhb', '0'); fhb = false; syncSeg(); }

  var res = DUTY[state](v, { use: use, fhb: fhb, build: build });
  var duty = Math.max(0, res.duty);

  var loan = Math.max(0, v - num('#d-deposit'));
  var lvr = v > 0 ? loan / v * 100 : 0;
  var lmi = lmiEstimate(loan, lvr);
  var legals = 2000;   /* indicative conveyancing + searches */
  var upfront = duty + lmi + legals;

  $('#d-out-duty').textContent = money(duty);
  $('#d-out-note').textContent = res.note;
  $('#d-out-eff').textContent = v > 0 ? pct(duty / v * 100) + ' of the purchase price' : '—';
  $('#d-out-lmi').textContent = lmi > 0 ? '~' + money(lmi) : 'Not payable';
  $('#d-out-legals').textContent = '~' + money(legals);
  $('#d-out-total').textContent = money(upfront);
  $('#d-out-cash').textContent = money(num('#d-deposit') + duty + legals);

  var flag = $('#d-out-flag');
  flag.innerHTML = 'Duty rules, thresholds and first home buyer concessions change regularly and vary by state. Treat this as a planning figure and confirm the exact amount with the relevant state revenue office or your conveyancer. Excludes transfer and mortgage registration fees, and any foreign purchaser surcharge.';
  flag.style.display = 'block';
}

/* ====================================================================
   7. PERSONAL LOAN
   ==================================================================== */
function calcPersonal() {
  var root = $('#p-personal');
  if (!root) return;
  var P = num('#n-amount');
  var rate = num('#n-rate');
  var years = clamp(num('#n-term'), 1, 7);
  var estFee = num('#n-fee');
  var monthlyFee = num('#n-monthly');
  var perYear = { monthly: 12, fortnightly: 26, weekly: 52 }[val('#n-freq')] || 12;
  var freqWord = { 12: 'month', 26: 'fortnight', 52: 'week' }[perYear];

  var financed = P + estFee;
  var n = years * perYear;
  var pay = repayment(financed, rate, n, perYear);
  var feePer = monthlyFee * 12 / perYear;
  var payAll = pay + feePer;
  var totalPaid = payAll * n;
  var interest = pay * n - financed;
  var cost = totalPaid - P;

  $('#n-out-pay').textContent = money(payAll);
  $('#n-out-cap').textContent = 'per ' + freqWord + ', including fees';
  $('#n-out-monthly').textContent = money(payAll * perYear / 12) + ' /mo';
  $('#n-out-interest').textContent = money(Math.max(0, interest));
  $('#n-out-fees').textContent = money(estFee + monthlyFee * years * 12);
  $('#n-out-total').textContent = money(totalPaid);
  $('#n-out-cost').textContent = P > 0 ? Math.round(cost / P * 100) + '% of the amount borrowed' : '—';

  var flag = $('#n-out-flag');
  flag.innerHTML = 'A personal loan repayment reduces your borrowing capacity for a future home or business loan by roughly <b>' +
    money(Math.round(principalFor(payAll * perYear / 12, rate > 0 ? 9 : 9, 360, 12) / 1000) * 1000) +
    '</b> of home lending while it runs. Worth checking the sequence before you apply.';
  flag.style.display = 'block';
}

/* ---------------------------------------------------------- wiring */
function runAll() {
  try { calcRepayment(); } catch (e) {}
  try { calcBorrowing(); } catch (e) {}
  try { calcBudget(); } catch (e) {}
  try { calcLump(); } catch (e) {}
  try { calcCar(); } catch (e) {}
  try { calcDuty(); } catch (e) {}
  try { calcPersonal(); } catch (e) {}
}

function syncSeg() {
  $$('.seg').forEach(function (seg) {
    var target = $('#' + seg.getAttribute('data-target'));
    var attr = seg.getAttribute('data-attr');
    if (!target) return;
    $$('button', seg).forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-val') === target.getAttribute(attr));
    });
  });
}

function boot() {
  /* tabs */
  var tabs = $$('.calc-tabs button');
  var panels = $$('.calc-panel');
  function show(id, push) {
    tabs.forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-tab') === id); });
    panels.forEach(function (p) { p.classList.toggle('on', p.id === 'p-' + id); });
    if (push && history.replaceState) history.replaceState(null, '', '#' + id);
    runAll();
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { show(t.getAttribute('data-tab'), true); });
  });

  /* segmented controls set a data attribute on their panel */
  $$('.seg').forEach(function (seg) {
    var target = $('#' + seg.getAttribute('data-target'));
    var attr = seg.getAttribute('data-attr');
    $$('button', seg).forEach(function (b) {
      b.addEventListener('click', function () {
        if (target) target.setAttribute(attr, b.getAttribute('data-val'));
        syncSeg();
        runAll();
      });
    });
  });

  /* live recalculation */
  $$('.calc-form input, .calc-form select').forEach(function (el) {
    el.addEventListener('input', runAll);
    el.addEventListener('change', runAll);
  });

  syncSeg();
  var hash = (location.hash || '').replace('#', '');
  var valid = tabs.some(function (t) { return t.getAttribute('data-tab') === hash; });
  show(valid ? hash : 'borrowing', false);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
