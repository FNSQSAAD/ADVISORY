/* ============================================================
   FINANCE SQUARE GROUP - CALCULATOR SUITE (v2, 2026-09-07)

   Modelled on how Australian broker and comparison sites actually
   build these tools. Reference set:
     · Loan Market / LMG - the aggregator FNSQ operates under.
       Numbered input steps, income frequency + pre-tax toggles,
       "use average Australian expenses", dependants chips,
       balance-over-time graph with a Graph/Table switch, and a
       stamp duty breakdown of duty + transfer fee + mortgage
       registration fee.
     · Aussie Home Loans - applicants / dependants / total income
       before tax / itemised liabilities, result shown as a RANGE.
     · Canstar - borrowing power, stamp duty, split loan.
     · Lendi - borrowing power, repayments, LMI, duty.
     · Comparethemarket - borrowing power.

   Australian mechanics applied here:
     · ATO resident tax scale (2025-26) + 2% Medicare levy.
     · HEM-style living expense floor a lender will substitute in.
     · Credit card limits assessed at 3.8% of the LIMIT per month.
     · Rental income shaded to 80%.
     · APRA's 3.00 percentage point serviceability buffer added to
       the product rate (APRA confirmed the 3pp buffer holds in 2026).
     · State transfer duty scales with VIC/NSW/QLD first home buyer
       concessions, plus indicative land registry fees.

   Everything here is an estimate for illustration and discussion.
   It is not a quote, not credit advice and not a credit assessment.
   ============================================================ */
(function () {
'use strict';

/* ---------------------------------------------------------- utilities */
var $  = function (s, c) { return (c || document).querySelector(s); };
var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

function money(n)  { return '$' + Math.round(n || 0).toLocaleString('en-AU'); }
function pct(n)    { return (Math.round((n || 0) * 100) / 100).toFixed(2) + '%'; }
function shortMoney(n) {
  n = n || 0;
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'm';
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
  return '$' + Math.round(n);
}
function num(id)  { var el = $(id); if (!el) return 0; var v = parseFloat(String(el.value).replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : 0; }
function val(id)  { var el = $(id); return el ? el.value : ''; }
function attr(id, a) { var el = $(id); return el ? el.getAttribute(a) : ''; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function setText(id, t) { var el = $(id); if (el) el.textContent = t; }
function setHTML(id, t) { var el = $(id); if (el) el.innerHTML = t; }
function flag(id, msg) {
  var el = $(id); if (!el) return;
  el.innerHTML = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

var PER_YEAR = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annually: 1 };
var PER_WORD = { 52: 'week', 26: 'fortnight', 12: 'month', 4: 'quarter', 1: 'year' };
function freqOf(id) { return PER_YEAR[val(id)] || 12; }

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
function termText(months) {
  if (!isFinite(months) || months < 0) return ', ';
  var y = Math.floor(months / 12), m = Math.round(months % 12);
  if (m === 12) { y++; m = 0; }
  if (!y && !m) return '0 months';
  return (y ? y + (y === 1 ? ' year' : ' years') : '') + (y && m ? ' ' : '') + (m ? m + (m === 1 ? ' month' : ' months') : '');
}

/* ------------------------------------------------------------ simulator
   One monthly engine drives repayments, extra repayments, lump sums and
   offset accounts. Returns the real month-by-month run, not a formula
   approximation, so "time saved" and "interest saved" are honest. */
function simulate(P, annualPct, scheduledMonthly, opts) {
  opts = opts || {};
  var r = annualPct / 100 / 12;
  var bal = P, offset = opts.offsetStart || 0;
  var totalInterest = 0, m = 0, yearly = [{ month: 0, balance: Math.max(0, P - offset), interest: 0, principal: 0 }];
  var yi = 0, yp = 0;
  var ioMonths = opts.ioMonths || 0;
  var cap = 1200;

  /* The loan is discharged once the offset covers the balance - at that
     point net debt is nil and the borrower simply closes it out. Tracking
     the gross balance past that point would credit an offset with savings
     it cannot produce. */
  while ((bal - offset) > 0.01 && m < cap) {
    m++;
    if (opts.offsetMonthly) offset += opts.offsetMonthly;
    var net = Math.max(0, bal - offset);
    var interest = net * r;
    var pay = scheduledMonthly + (opts.extraMonthly || 0);
    if (m <= ioMonths) pay = interest;                       /* interest-only phase */
    if (opts.lumpAmount && m === (opts.lumpAfterMonths || 0) + 1) pay += opts.lumpAmount;
    var principal = pay - interest;
    if (principal <= 0 && m > ioMonths) { m = Infinity; break; }   /* never repays */
    if (principal > net) principal = net;
    bal -= principal;
    totalInterest += interest;
    yi += interest; yp += principal;
    if (m % 12 === 0 || (bal - offset) <= 0.01) {
      yearly.push({ month: m, balance: Math.max(0, bal - offset), interest: yi, principal: yp });
      yi = 0; yp = 0;
    }
  }
  return { months: isFinite(m) ? m : Infinity, totalInterest: totalInterest, yearly: yearly };
}

/* -------------------------------------------------- ATO resident tax
   2025-26 resident rates plus a flat 2% Medicare levy. Low-income
   thresholds and offsets are ignored, so tax is slightly overstated at
   low incomes - deliberately conservative for a borrowing estimate. */
function incomeTax(gross) {
  var t;
  if (gross <= 18200) t = 0;
  else if (gross <= 45000)  t = (gross - 18200) * 0.16;
  else if (gross <= 135000) t = 4288  + (gross - 45000)  * 0.30;
  else if (gross <= 190000) t = 31288 + (gross - 135000) * 0.37;
  else                      t = 51638 + (gross - 190000) * 0.45;
  return t + (gross > 27222 ? gross * 0.02 : 0);
}
function netMonthly(gross) { return Math.max(0, gross - incomeTax(gross)) / 12; }

/* HEM-style benchmark a lender substitutes in when declared spending
   looks unrealistically low. Indicative monthly figures. */
function hemMonthly(applicants, deps) {
  return (applicants === 2 ? 3100 : 2100) + deps * 500;
}

/* ------------------------------------------------------------- LMI
   Indicative premium as a percentage of the loan, by LVR band and loan
   size. Real premiums vary by insurer, lender, purpose and borrower. */
function lmiEstimate(loan, lvr) {
  if (lvr <= 80.0001 || loan <= 0) return 0;
  var band = lvr <= 85 ? 0 : lvr <= 90 ? 1 : lvr <= 95 ? 2 : 3;
  var size = loan <= 500000 ? 0 : loan <= 750000 ? 1 : 2;
  var table = [
    [0.90, 1.30, 1.65],
    [1.90, 2.40, 2.85],
    [3.30, 3.90, 4.45],
    [4.60, 5.20, 5.80]
  ];
  return loan * table[band][size] / 100;
}

/* ====================================================================
   CHART - inline SVG, no library. Balance over time, one or two series,
   with a Graph / Table switch, the way the broker calculators present it.
   ==================================================================== */
function drawChart(hostId, opts) {
  var host = $(hostId);
  if (!host) return;
  var series = opts.series.filter(function (s) { return s.points && s.points.length > 1; });
  if (!series.length) { host.innerHTML = ''; return; }

  var W = 640, H = 250, L = 56, R = 14, T = 16, B = 34;
  var maxY = 0, maxX = 0;
  series.forEach(function (s) {
    s.points.forEach(function (p) { if (p.y > maxY) maxY = p.y; if (p.x > maxX) maxX = p.x; });
  });
  if (maxY <= 0) maxY = 1;
  if (maxX <= 0) maxX = 1;
  /* round the y axis up to two significant figures so the top gridline
     sits just above the data rather than miles above it */
  var mag = Math.pow(10, Math.floor(Math.log(maxY) / Math.LN10));
  var top = Math.ceil(maxY / (mag / 2)) * (mag / 2);
  var step = top / 4;

  var px = function (x) { return L + (x / maxX) * (W - L - R); };
  var py = function (y) { return T + (1 - y / top) * (H - T - B); };

  var g = '';
  for (var i = 0; i <= 4; i++) {
    var yv = step * i, y = py(yv);
    g += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + (W - R) + '" y2="' + y.toFixed(1) + '" class="cg"/>';
    g += '<text x="' + (L - 10) + '" y="' + (y + 4).toFixed(1) + '" class="cl cly">' + shortMoney(yv) + '</text>';
  }
  var xSteps = Math.min(6, Math.max(2, Math.round(maxX)));
  for (var j = 0; j <= xSteps; j++) {
    var xv = maxX * j / xSteps;
    g += '<text x="' + px(xv).toFixed(1) + '" y="' + (H - 10) + '" class="cl clx">' + Math.round(xv) + '</text>';
  }
  g += '<line x1="' + L + '" y1="' + py(0).toFixed(1) + '" x2="' + (W - R) + '" y2="' + py(0).toFixed(1) + '" class="ca"/>';

  series.forEach(function (s, ix) {
    var d = s.points.map(function (p, k) { return (k ? 'L' : 'M') + px(p.x).toFixed(1) + ' ' + py(Math.min(p.y, top)).toFixed(1); }).join(' ');
    if (ix === 0) {
      g += '<path d="' + d + ' L' + px(s.points[s.points.length - 1].x).toFixed(1) + ' ' + py(0).toFixed(1) +
           ' L' + px(s.points[0].x).toFixed(1) + ' ' + py(0).toFixed(1) + ' Z" class="cfill"/>';
    }
    g += '<path d="' + d + '" class="cline cs' + ix + '"' + (s.dash ? ' stroke-dasharray="5 4"' : '') + '/>';
  });

  var legend = series.map(function (s, ix) {
    return '<span class="ck"><i class="cs' + ix + '"></i>' + s.label + '</span>';
  }).join('');

  host.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Loan balance over time">' + g + '</svg>' +
    '<div class="clegend">' + legend + '<span class="cx">Years</span></div>';
}

function drawTable(hostId, rows, headers) {
  var host = $(hostId);
  if (!host) return;
  host.innerHTML =
    '<table><thead><tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table>';
}

/* ====================================================================
   STAMP DUTY + LAND REGISTRY FEES
   VIC, NSW and QLD duty scales verified against the State Revenue
   Office, Revenue NSW and the Queensland Revenue Office. WA, SA, TAS,
   ACT and NT use their published general scales. Registry fees are
   indicative and are re-set by each land registry annually.
   ==================================================================== */
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
      if (v <= 25000) duty = v * 0.014;
      else if (v <= 130000) duty = 350 + (v - 25000) * 0.024;
      else if (v <= 440000) duty = 2870 + (v - 130000) * 0.05;
      else duty = 18370 + (v - 440000) * 0.06;
    }
    if (opt.fhb && ppr) {
      if (v <= 600000) return { duty: 0, note: 'Victorian first home buyers pay no duty on a home up to $600,000.' };
      if (v <= 750000) return { duty: duty * (v - 600000) / 150000, note: 'The Victorian first home buyer concession phases out between $600,000 and $750,000.' };
      return { duty: duty, note: 'Above $750,000 the Victorian first home buyer concession no longer applies.' };
    }
    return { duty: duty, note: ppr ? 'Victorian principal place of residence rates applied where eligible.' : 'Victorian general (non-PPR) rates applied.' };
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
      var cap = opt.build === 'land' ? 350000 : 800000;
      var out = opt.build === 'land' ? 450000 : 1000000;
      if (v <= cap) return { duty: 0, note: 'NSW First Home Buyers Assistance Scheme: no duty up to ' + money(cap) + '.' };
      if (v <= out) return { duty: d * (v - cap) / (out - cap), note: 'The NSW first home buyer concession phases out between ' + money(cap) + ' and ' + money(out) + '.' };
      return { duty: d, note: 'Above ' + money(out) + ' the NSW first home buyer concession no longer applies.' };
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
      var conc = Math.min(v, 350000) * (0.035 - 0.01);
      var homeDuty = Math.max(0, d - Math.max(0, conc));
      if (opt.fhb) {
        if (opt.build === 'new' || opt.build === 'land') return { duty: 0, note: 'Queensland first home buyers pay no transfer duty on a new home or vacant land build (from 1 May 2025).' };
        if (v <= 700000) return { duty: 0, note: 'Queensland first home concession: no duty on an existing first home up to $700,000.' };
        if (v <= 800000) return { duty: homeDuty * (v - 700000) / 100000, note: 'The Queensland first home concession phases out between $700,000 and $800,000.' };
        return { duty: homeDuty, note: 'Above $800,000 only the standard Queensland home concession applies.' };
      }
      return { duty: homeDuty, note: 'Queensland home concession applied to the first $350,000.' };
    }
    return { duty: d, note: 'Queensland general transfer duty scale applied (investment purchase).' };
  },

  WA: function (v) {
    var d;
    if (v <= 120000) d = v * 0.019;
    else if (v <= 150000) d = 2280 + (v - 120000) * 0.0285;
    else if (v <= 360000) d = 3135 + (v - 150000) * 0.038;
    else if (v <= 725000) d = 11115 + (v - 360000) * 0.0475;
    else d = 28453 + (v - 725000) * 0.0515;
    return { duty: d, note: 'WA residential rate of duty. The first home owner rate of duty may reduce this. Confirm with RevenueWA.' };
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
    return { duty: d, note: 'SA conveyance duty scale. South Australia has abolished duty for eligible first home buyers on new homes. Confirm with RevenueSA.' };
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
    return { duty: d, note: 'Tasmanian property transfer duty scale. First home buyer concessions may apply. Confirm with the State Revenue Office of Tasmania.' };
  },

  ACT: function (v) {
    var d;
    if (v <= 260000) d = v * 0.0049;
    else if (v <= 300000)  d = 1274 + (v - 260000) * 0.022;
    else if (v <= 500000)  d = 2154 + (v - 300000) * 0.034;
    else if (v <= 750000)  d = 8954 + (v - 500000) * 0.0432;
    else if (v <= 1000000) d = 19754 + (v - 750000) * 0.059;
    else if (v <= 1455000) d = 34504 + (v - 1000000) * 0.064;
    else d = v * 0.0454;
    return { duty: d, note: 'ACT residential conveyance duty. The ACT Home Buyer Concession Scheme can remove duty entirely under an income threshold. Confirm with the ACT Revenue Office.' };
  },

  NT: function (v) {
    var d;
    if (v < 525000) { var V = v / 1000; d = (0.06571441 * V * V) + 15 * V; }
    else if (v <= 3000000) d = v * 0.0495;
    else if (v <= 5000000) d = v * 0.0575;
    else d = v * 0.0595;
    return { duty: d, note: 'Northern Territory conveyance duty. House and land and first home owner concessions may apply. Confirm with the Territory Revenue Office.' };
  }
};

/* Indicative land registry fees. Set annually by each registry. */
var REGISTRY = {
  VIC: { transfer: function (v) { return Math.min(3905, 110.9 + Math.ceil(v / 1000) * 2.34); }, mortgage: 120.70 },
  NSW: { transfer: function () { return 182.73; }, mortgage: 182.73 },
  QLD: { transfer: function (v) { return 231 + Math.max(0, Math.ceil((v - 180000) / 10000)) * 43; }, mortgage: 231 },
  WA:  { transfer: function () { return 220.20; }, mortgage: 210.30 },
  SA:  { transfer: function (v) { return v < 50000 ? 210 : v < 100000 ? 265 : v < 200000 ? 330 : v < 500000 ? 420 : v < 1000000 ? 560 : 700; }, mortgage: 198 },
  TAS: { transfer: function () { return 252.53; }, mortgage: 162.68 },
  ACT: { transfer: function () { return 479; }, mortgage: 178 },
  NT:  { transfer: function () { return 165; }, mortgage: 165 }
};

/* ====================================================================
   1. BORROWING CAPACITY
   ==================================================================== */
function calcBorrowing() {
  var root = $('#p-borrowing');
  if (!root) return;
  var applicants = root.getAttribute('data-applicants') === '2' ? 2 : 1;
  var purpose = root.getAttribute('data-purpose') || 'owner';
  var deps = parseInt(root.getAttribute('data-deps') || '0', 10);

  var couple = $('#b-couple-block');
  if (couple) couple.style.display = applicants === 2 ? '' : 'none';
  var rentRow = $('#b-rent') && $('#b-rent').closest('.cf');
  if (rentRow) rentRow.style.display = purpose === 'investment' ? '' : 'none';

  var inc1 = num('#b-income1') * (PER_YEAR[val('#b-freq1')] || 1);
  var inc2 = applicants === 2 ? num('#b-income2') * (PER_YEAR[val('#b-freq2')] || 1) : 0;
  var otherAnnual = num('#b-other');
  var rentWeekly = num('#b-rent');
  var expenses = num('#b-expenses');
  var cards = num('#b-cards');
  var carLoan = num('#b-carloan');
  var otherRepay = num('#b-repayments');
  var deposit = num('#b-deposit');
  var rate = num('#b-rate');
  var years = clamp(num('#b-term'), 5, 30);

  var assessRate = rate + 3.00;
  var netInc = netMonthly(inc1) + netMonthly(inc2) + netMonthly(otherAnnual);
  var rentMonthly = purpose === 'investment' ? rentWeekly * 52 / 12 * 0.80 : 0;

  var hem = hemMonthly(applicants, deps);
  var usedExpenses = Math.max(expenses, hem);
  var cardCommit = cards * 0.038;
  var commitments = cardCommit + carLoan + otherRepay;

  var surplus = netInc + rentMonthly - usedExpenses - commitments;
  var maxLoan = surplus > 0 ? principalFor(surplus, assessRate, years * 12, 12) : 0;
  maxLoan = clamp(maxLoan, 0, 8000000);

  /* purchase price: the deposit also has to cover duty and acquisition
     costs, so solve for a price where ~5% goes to those costs */
  var price = Math.max(0, (maxLoan + deposit) / 1.05);
  var costs = price * 0.05;
  var depositToLoan = Math.max(0, deposit - costs);
  var loanUsed = clamp(price - depositToLoan, 0, maxLoan);
  var lvr = price > 0 ? clamp(loanUsed / price * 100, 0, 100) : 0;
  var lmi = lmiEstimate(loanUsed, lvr);

  var lo = Math.round(maxLoan * 0.95 / 5000) * 5000;
  var hi = Math.round(maxLoan * 1.05 / 5000) * 5000;
  var actualRepay = maxLoan > 0 ? repayment(maxLoan, rate, years * 12, 12) : 0;

  setText('#b-out-range', maxLoan > 0 ? money(lo) + ' – ' + money(hi) : '$0');
  setText('#b-out-price', money(price));
  setText('#b-out-surplus', money(Math.max(0, surplus)) + ' /mo');
  setText('#b-out-assess', pct(assessRate) + ' p.a.');
  setText('#b-out-repay', money(actualRepay) + ' /mo');
  setText('#b-out-lvr', Math.round(lvr) + '%');
  setText('#b-out-lmi', lmi > 0 ? '~' + money(lmi) : 'Not payable at this LVR');
  setText('#b-out-hem', money(usedExpenses) + ' /mo');
  setText('#b-out-commit', money(commitments) + ' /mo');
  var bar = $('#b-out-lvrbar'); if (bar) bar.style.width = clamp(lvr, 0, 100) + '%';

  var msg = '';
  if (surplus <= 0) {
    msg = 'On these figures the numbers look tight at today’s assessment rate. Rough inputs often miss things that help, such as a second income, lower real expenses, or family support. That is exactly what a 15-minute call sorts out.';
  } else if (usedExpenses > expenses) {
    msg = 'We’ve used a benchmark living expense figure of <b>' + money(usedExpenses) + '</b> a month. Lenders substitute a minimum benchmark (HEM) when declared spending looks lower than the household would realistically spend.';
  } else if (cards > 0) {
    msg = 'Your <b>' + money(cards) + '</b> of card limits is assessed as <b>' + money(cardCommit) + '</b> a month whether you use it or not. Reducing or closing unused limits is often the fastest way to lift borrowing power.';
  } else if (lvr > 80) {
    msg = 'At ' + Math.round(lvr) + '% LVR, Lenders Mortgage Insurance would usually apply. Some lenders waive it for specific professions. Worth asking about.';
  }
  flag('#b-out-flag', msg);

  /* chart + table */
  var sim = maxLoan > 0 ? simulate(maxLoan, rate, actualRepay, {}) : { yearly: [] };
  var pts = sim.yearly.map(function (y) { return { x: y.month / 12, y: y.balance }; });
  drawChart('#b-chart', { series: [{ label: 'Loan balance', points: pts }] });
  drawTable('#b-table', sim.yearly.slice(1).map(function (y) {
    return ['Year ' + Math.round(y.month / 12), money(y.principal), money(y.interest), money(y.balance)];
  }), ['Period', 'Principal paid', 'Interest paid', 'Balance']);
}

/* ====================================================================
   2. BUDGET PLANNER
   ==================================================================== */
var BUDGET_GROUPS = {
  living: ['g-housing', 'g-utilities', 'g-groceries', 'g-phone', 'g-clothing'],
  insurance: ['g-insurance', 'g-health', 'g-super'],
  debts: ['g-homeloan', 'g-carloan', 'g-personal', 'g-cards'],
  transport: ['g-fuel', 'g-transport', 'g-rego'],
  leisure: ['g-dining', 'g-subs', 'g-holidays', 'g-other']
};
function calcBudget() {
  var root = $('#p-budget');
  if (!root) return;
  var inFreq = PER_YEAR[val('#g-freq')] || 12;
  var outFreq = PER_YEAR[val('#g-expfreq')] || 12;

  var incomeAnnual = (num('#g-salary') + num('#g-salary2') + num('#g-bonus') + num('#g-invest') + num('#g-otherinc')) * inFreq;
  var monthlyIn = incomeAnnual / 12;

  var groupTotals = {}, totalOutPeriod = 0;
  Object.keys(BUDGET_GROUPS).forEach(function (k) {
    var t = 0;
    BUDGET_GROUPS[k].forEach(function (f) { t += num('#' + f); });
    groupTotals[k] = t * outFreq / 12;
    totalOutPeriod += t;
  });
  var monthlyOut = totalOutPeriod * outFreq / 12;
  var surplus = monthlyIn - monthlyOut;

  setText('#g-out-surplus', money(surplus));
  setText('#g-out-cap', surplus >= 0 ? 'left over each month' : 'short each month');
  setText('#g-out-in', money(monthlyIn) + ' /mo');
  setText('#g-out-out', money(monthlyOut) + ' /mo');
  setText('#g-out-year', money(surplus * 12));
  setText('#g-out-rate', monthlyIn > 0 ? Math.round(surplus / monthlyIn * 100) + '% of income' : ', ');
  var bar = $('#g-out-bar');
  if (bar) bar.style.width = clamp(monthlyIn > 0 ? monthlyOut / monthlyIn * 100 : 0, 0, 100) + '%';

  [['living', 'Living'], ['insurance', 'Insurance & super'], ['debts', 'Loans & cards'], ['transport', 'Transport'], ['leisure', 'Leisure']].forEach(function (p) {
    setText('#g-sum-' + p[0], money(groupTotals[p[0]]) + ' /mo');
  });

  var msg = '';
  if (monthlyIn > 0 && surplus > 0) {
    var support = principalFor(surplus * 0.9, num('#g-rate') + 3, 360, 12);
    msg = 'A surplus of ' + money(surplus) + ' a month could support roughly <b>' + money(Math.round(support / 10000) * 10000) +
          '</b> of home lending at a buffered assessment rate, before a lender looks at your full position.';
  } else if (monthlyIn > 0) {
    msg = 'Your listed expenses exceed your income. Worth a conversation before taking on any new lending.';
  }
  flag('#g-out-flag', msg);
}

/* ====================================================================
   3. LOAN REPAYMENTS
   ==================================================================== */
function calcRepayment() {
  var root = $('#p-repayment');
  if (!root) return;
  var P = num('#r-amount');
  var rate = num('#r-rate');
  var years = clamp(num('#r-term'), 1, 40);
  var perYear = freqOf('#r-freq');
  var word = PER_WORD[perYear];
  var type = root.getAttribute('data-type') || 'pi';
  var ioYears = clamp(num('#r-io'), 0, Math.min(10, years));
  var extra = num('#r-extra');

  var ioRow = $('#r-io') && $('#r-io').closest('.cf');
  if (ioRow) ioRow.style.display = type === 'io' ? '' : 'none';

  var pay, totalPaid, totalInterest, ioPay = 0;
  if (type === 'io') {
    ioPay = P * rate / 100 / perYear;
    var piPeriods = (years - ioYears) * perYear;
    pay = piPeriods > 0 ? repayment(P, rate, piPeriods, perYear) : ioPay;
    totalPaid = ioPay * ioYears * perYear + pay * piPeriods;
  } else {
    pay = repayment(P, rate, years * perYear, perYear);
    totalPaid = pay * years * perYear;
  }
  totalInterest = totalPaid - P;

  setText('#r-out-pay', money(pay));
  setText('#r-out-cap', 'per ' + word + (type === 'io' ? ', once the interest-only period ends' : ', principal and interest'));
  var ioOut = $('#r-out-io');
  if (ioOut) {
    ioOut.parentNode.style.display = type === 'io' ? 'flex' : 'none';
    ioOut.textContent = money(ioPay) + ' per ' + word;
  }
  setText('#r-out-monthly', money(pay * perYear / 12));
  setText('#r-out-total', money(totalPaid));
  setText('#r-out-interest', money(totalInterest));
  setText('#r-out-ratio', P > 0 ? Math.round(totalInterest / P * 100) + '% of the amount borrowed' : ', ');

  var msg = '';
  if (extra > 0 && type !== 'io') {
    var baseMonthly = repayment(P, rate, years * 12, 12);
    var extraMonthly = extra * perYear / 12;
    var base = simulate(P, rate, baseMonthly, {});
    var withExtra = simulate(P, rate, baseMonthly, { extraMonthly: extraMonthly });
    if (isFinite(withExtra.months)) {
      msg = 'Adding ' + money(extra) + ' a ' + word + ' could save about <b>' + money(base.totalInterest - withExtra.totalInterest) +
            '</b> in interest and clear the loan roughly <b>' + termText(base.months - withExtra.months) + '</b> sooner.';
    }
  } else if (type === 'io') {
    msg = 'Interest-only repayments don’t reduce the balance. When the ' + ioYears + '-year period ends, repayments step up to <b>' +
          money(pay) + '</b> per ' + word + ' because the same principal is repaid over a shorter remaining term.';
  }
  flag('#r-out-flag', msg);

  var monthlyPay = pay * perYear / 12;
  var sim = simulate(P, rate, type === 'io' ? repayment(P, rate, Math.max(1, (years - ioYears) * 12), 12) : monthlyPay,
                     { ioMonths: type === 'io' ? ioYears * 12 : 0 });
  drawChart('#r-chart', { series: [{ label: 'Loan balance', points: sim.yearly.map(function (y) { return { x: y.month / 12, y: y.balance }; }) }] });
  drawTable('#r-table', sim.yearly.slice(1).map(function (y) {
    return ['Year ' + Math.round(y.month / 12), money(y.principal), money(y.interest), money(y.balance)];
  }), ['Period', 'Principal paid', 'Interest paid', 'Balance']);
}

/* ====================================================================
   4. EXTRA & LUMP SUM REPAYMENTS
   ==================================================================== */
function calcExtra() {
  var root = $('#p-lumpsum');
  if (!root) return;
  var P = num('#l-balance');
  var rate = num('#l-rate');
  var years = clamp(num('#l-term'), 1, 40);
  var lump = num('#l-lump');
  var after = clamp(num('#l-after'), 0, years);
  var extra = num('#l-extra');

  var basePay = repayment(P, rate, years * 12, 12);
  var base = simulate(P, rate, basePay, {});
  var improved = simulate(P, rate, basePay, {
    extraMonthly: extra,
    lumpAmount: lump,
    lumpAfterMonths: Math.round(after * 12)
  });

  var saved = isFinite(improved.months) ? base.totalInterest - improved.totalInterest : 0;
  var timeSaved = isFinite(improved.months) ? base.months - improved.months : 0;

  setText('#l-out-saved', money(Math.max(0, saved)));
  setText('#l-out-time', timeSaved > 0 ? termText(timeSaved) : 'No change');
  setText('#l-out-pay', money(basePay + extra) + ' /mo');
  setText('#l-out-basei', money(base.totalInterest));
  setText('#l-out-newi', isFinite(improved.totalInterest) ? money(improved.totalInterest) : ', ');
  setText('#l-out-newterm', isFinite(improved.months) ? termText(improved.months) : 'Repayment too low');

  var msg = '';
  if (lump > 0 || extra > 0) {
    msg = 'Check your loan allows extra repayments without penalty. Fixed-rate loans usually cap them. If you have an offset account, parking the ' +
          (lump > 0 ? money(lump) : 'money') + ' there achieves a similar interest result while keeping the funds available.';
  }
  flag('#l-out-flag', msg);

  drawChart('#l-chart', {
    series: [
      { label: 'Without changes', points: base.yearly.map(function (y) { return { x: y.month / 12, y: y.balance }; }) },
      { label: 'With extra repayments', dash: true, points: improved.yearly.map(function (y) { return { x: y.month / 12, y: y.balance }; }) }
    ]
  });
  drawTable('#l-table', improved.yearly.slice(1).map(function (y) {
    return ['Year ' + Math.round(y.month / 12), money(y.principal), money(y.interest), money(y.balance)];
  }), ['Period', 'Principal paid', 'Interest paid', 'Balance']);
}

/* ====================================================================
   5. OFFSET ACCOUNT
   ==================================================================== */
function calcOffset() {
  var root = $('#p-offset');
  if (!root) return;
  var P = num('#o-balance');
  var rate = num('#o-rate');
  var years = clamp(num('#o-term'), 1, 40);
  var start = num('#o-offset');
  var monthly = num('#o-deposit');

  var pay = repayment(P, rate, years * 12, 12);
  var base = simulate(P, rate, pay, {});
  var withOffset = simulate(P, rate, pay, { offsetStart: start, offsetMonthly: monthly });

  var saved = base.totalInterest - withOffset.totalInterest;
  var timeSaved = base.months - withOffset.months;

  setText('#o-out-saved', money(Math.max(0, saved)));
  setText('#o-out-newterm', termText(withOffset.months));
  setText('#o-out-time', timeSaved > 0 ? termText(timeSaved) : 'No change');
  setText('#o-out-pay', money(pay) + ' /mo');
  setText('#o-out-basei', money(base.totalInterest));
  setText('#o-out-newi', money(withOffset.totalInterest));
  setText('#o-out-first', money(Math.max(0, start) * rate / 100 / 12) + ' /mo');

  flag('#o-out-flag', 'Every dollar sitting in the offset reduces the balance interest is charged on, and unlike an extra repayment you can still withdraw it. ' +
    (start > 0 ? 'Right now that ' + money(start) + ' is worth about <b>' + money(start * rate / 100 / 12) + '</b> a month in interest you don’t pay. ' : '') +
    'Offset accounts often carry a package or annual fee, so the balance needs to be big enough to be worth it.');

  drawChart('#o-chart', {
    series: [
      { label: 'Without offset', points: base.yearly.map(function (y) { return { x: y.month / 12, y: y.balance }; }) },
      { label: 'With offset', dash: true, points: withOffset.yearly.map(function (y) { return { x: y.month / 12, y: y.balance }; }) }
    ]
  });
  drawTable('#o-table', withOffset.yearly.slice(1).map(function (y) {
    return ['Year ' + Math.round(y.month / 12), money(y.principal), money(y.interest), money(y.balance)];
  }), ['Period', 'Principal paid', 'Interest paid', 'Balance']);
}

/* ====================================================================
   6. SPLIT LOAN - FIXED vs VARIABLE
   ==================================================================== */
function calcSplit() {
  var root = $('#p-split');
  if (!root) return;
  var P = num('#s-amount');
  var years = clamp(num('#s-term'), 1, 40);
  var fixedPct = clamp(num('#s-fixedpct'), 0, 100);
  var fixedRate = num('#s-fixedrate');
  var varRate = num('#s-varrate');
  var moveBp = num('#s-move');

  var fixedP = P * fixedPct / 100;
  var varP = P - fixedP;
  var n = years * 12;

  var fixedPay = fixedP > 0 ? repayment(fixedP, fixedRate, n, 12) : 0;
  var varPay = varP > 0 ? repayment(varP, varRate, n, 12) : 0;
  var total = fixedPay + varPay;
  var blended = P > 0 ? (fixedRate * fixedP + varRate * varP) / P : 0;

  var upPay = fixedPay + (varP > 0 ? repayment(varP, varRate + moveBp / 100, n, 12) : 0);
  var downPay = fixedPay + (varP > 0 ? repayment(varP, Math.max(0.5, varRate - moveBp / 100), n, 12) : 0);
  var allVar = repayment(P, varRate + moveBp / 100, n, 12);

  setText('#s-out-pay', money(total));
  setText('#s-out-blend', pct(blended) + ' p.a. blended');
  setText('#s-out-fixed', money(fixedP) + ' at ' + pct(fixedRate));
  setText('#s-out-var', money(varP) + ' at ' + pct(varRate));
  setText('#s-out-fixedpay', money(fixedPay) + ' /mo');
  setText('#s-out-varpay', money(varPay) + ' /mo');
  setText('#s-out-up', money(upPay) + ' /mo');
  setText('#s-out-down', money(downPay) + ' /mo');

  var exposure = upPay - total;
  flag('#s-out-flag', 'If variable rates rose ' + (moveBp / 100).toFixed(2) + ' percentage points, this split adds <b>' + money(exposure) +
    '</b> a month. Fully variable, the same rise would cost <b>' + money(allVar - repayment(P, varRate, n, 12)) +
    '</b> a month. Fixed portions usually limit extra repayments and can carry break costs if you exit early.');

  var bar = $('#s-out-bar');
  if (bar) bar.style.width = fixedPct + '%';
  setText('#s-out-mix', Math.round(fixedPct) + '% fixed / ' + Math.round(100 - fixedPct) + '% variable');
}

/* ====================================================================
   7. CAR AND TRUCK LOAN
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
  var perYear = freqOf('#c-freq');
  var word = PER_WORD[perYear];

  var financed = Math.max(0, price - deposit - trade + fees);
  var balloon = price * balloonPct / 100;
  var n = years * perYear;
  var r = rate / 100 / perYear;

  var pay;
  if (r <= 0) pay = (financed - balloon) / n;
  else pay = (financed - balloon * Math.pow(1 + r, -n)) * r / (1 - Math.pow(1 + r, -n));
  if (!isFinite(pay) || pay < 0) pay = 0;

  var totalPaid = pay * n + balloon;
  var interest = totalPaid - financed;

  setText('#c-out-pay', money(pay));
  setText('#c-out-cap', 'per ' + word + ' over ' + years + (years === 1 ? ' year' : ' years'));
  setText('#c-out-financed', money(financed));
  setText('#c-out-balloon', balloon > 0 ? money(balloon) : 'None');
  setText('#c-out-interest', money(Math.max(0, interest)));
  setText('#c-out-total', money(totalPaid));
  setText('#c-out-monthly', money(pay * perYear / 12) + ' /mo');

  var msg = '';
  if (balloonPct > 0) {
    msg = 'A ' + balloonPct + '% balloon lowers the ' + word + 'ly repayment, but <b>' + money(balloon) +
          '</b> falls due at the end of the term. You would need to pay it, refinance it, or sell the asset to cover it.';
  } else if (years >= 6) {
    msg = 'Longer terms reduce the repayment but increase total interest. On a depreciating asset, that can leave you owing more than it is worth.';
  }
  flag('#c-out-flag', msg);

  /* balance run including the residual */
  var pts = [], bal = financed, monthlyPay = pay * perYear / 12, rm = rate / 100 / 12;
  pts.push({ x: 0, y: financed });
  for (var m = 1; m <= years * 12; m++) {
    bal = bal + bal * rm - monthlyPay;
    if (bal < 0) bal = 0;
    if (m % 6 === 0 || m === years * 12) pts.push({ x: m / 12, y: Math.max(0, bal) });
  }
  drawChart('#c-chart', { series: [{ label: 'Amount owing', points: pts }] });
  drawTable('#c-table', pts.filter(function (p) { return p.x % 1 === 0 && p.x > 0; }).map(function (p) {
    return ['Year ' + p.x, money(p.y)];
  }), ['Period', 'Amount owing']);
}

/* ====================================================================
   8. STAMP DUTY
   ==================================================================== */
function calcDuty() {
  var root = $('#p-stampduty');
  if (!root) return;
  var state = val('#d-state') || 'VIC';
  var v = num('#d-value');
  var use = root.getAttribute('data-use') || 'home';
  var fhb = root.getAttribute('data-fhb') === '1';
  var build = val('#d-build');

  var fhbSeg = $('.seg[data-attr="data-fhb"]');
  if (fhbSeg) fhbSeg.classList.toggle('disabled', use === 'investment');
  if (use === 'investment') fhb = false;

  var res = DUTY[state](v, { use: use, fhb: fhb, build: build });
  var duty = Math.max(0, res.duty);

  var reg = REGISTRY[state];
  var transferFee = reg.transfer(v);
  var mortgageFee = reg.mortgage;

  var deposit = num('#d-deposit');
  var loan = Math.max(0, v - deposit);
  var lvr = v > 0 ? loan / v * 100 : 0;
  var lmi = lmiEstimate(loan, lvr);
  var legals = num('#d-legals');
  var govt = duty + transferFee + mortgageFee;
  var upfront = govt + lmi + legals;

  setText('#d-out-duty', money(duty));
  setText('#d-out-note', res.note);
  setText('#d-out-eff', v > 0 ? pct(duty / v * 100) + ' of the purchase price' : ', ');
  setText('#d-out-transfer', money(transferFee));
  setText('#d-out-mortgage', money(mortgageFee));
  setText('#d-out-govt', money(govt));
  setText('#d-out-lmi', lmi > 0 ? '~' + money(lmi) : 'Not payable');
  setText('#d-out-total', money(upfront));
  setText('#d-out-cash', money(deposit + govt + legals));
  setText('#d-out-lvr', Math.round(lvr) + '% LVR on a ' + money(loan) + ' loan');

  flag('#d-out-flag', 'Duty rates, thresholds and first home buyer concessions change regularly and differ in every state. Registry fees are indicative and re-set annually. ' +
    'Treat this as a planning figure and confirm the exact amount with the relevant state revenue office or your conveyancer. Excludes any foreign purchaser surcharge.');
}

/* ====================================================================
   9. PERSONAL LOAN
   ==================================================================== */
function calcPersonal() {
  var root = $('#p-personal');
  if (!root) return;
  var P = num('#n-amount');
  var rate = num('#n-rate');
  var years = clamp(num('#n-term'), 1, 7);
  var estFee = num('#n-fee');
  var monthlyFee = num('#n-monthly');
  var perYear = freqOf('#n-freq');
  var word = PER_WORD[perYear];

  var financed = P + estFee;
  var n = years * perYear;
  var pay = repayment(financed, rate, n, perYear);
  var feePer = monthlyFee * 12 / perYear;
  var payAll = pay + feePer;
  var totalPaid = payAll * n;
  var interest = pay * n - financed;
  var cost = totalPaid - P;

  setText('#n-out-pay', money(payAll));
  setText('#n-out-cap', 'per ' + word + ', including fees');
  setText('#n-out-monthly', money(payAll * perYear / 12) + ' /mo');
  setText('#n-out-interest', money(Math.max(0, interest)));
  setText('#n-out-fees', money(estFee + monthlyFee * years * 12));
  setText('#n-out-total', money(totalPaid));
  setText('#n-out-cost', P > 0 ? Math.round(cost / P * 100) + '% of the amount borrowed' : ', ');

  var impact = principalFor(payAll * perYear / 12, 9, 360, 12);
  setText('#n-out-impact', money(Math.round(impact / 1000) * 1000));
  flag('#n-out-flag', 'While this loan runs, the repayment reduces the home or business lending you could service by roughly <b>' +
    money(Math.round(impact / 1000) * 1000) + '</b>. If a mortgage is on your horizon, the order you do things in matters.');

  var sim = simulate(financed, rate, pay * perYear / 12, {});
  drawChart('#n-chart', { series: [{ label: 'Amount owing', points: sim.yearly.map(function (y) { return { x: y.month / 12, y: y.balance }; }) }] });
  drawTable('#n-table', sim.yearly.slice(1).map(function (y) {
    return ['Year ' + Math.round(y.month / 12), money(y.principal), money(y.interest), money(y.balance)];
  }), ['Period', 'Principal paid', 'Interest paid', 'Balance']);
}

/* ---------------------------------------------------------- wiring */
function runAll() {
  [calcBorrowing, calcBudget, calcRepayment, calcExtra, calcOffset, calcSplit, calcCar, calcDuty, calcPersonal]
    .forEach(function (fn) { try { fn(); } catch (e) { if (window.console && console.warn) console.warn(fn.name, e); } });
}

function syncSeg() {
  $$('.seg').forEach(function (seg) {
    var target = $('#' + seg.getAttribute('data-target'));
    var a = seg.getAttribute('data-attr');
    if (!target) return;
    $$('button', seg).forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-val') === target.getAttribute(a));
    });
  });
}

function boot() {
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

  /* segmented controls write a data attribute onto their panel */
  $$('.seg').forEach(function (seg) {
    var target = $('#' + seg.getAttribute('data-target'));
    var a = seg.getAttribute('data-attr');
    $$('button', seg).forEach(function (b) {
      b.addEventListener('click', function () {
        if (seg.classList.contains('disabled')) return;
        if (target) target.setAttribute(a, b.getAttribute('data-val'));
        syncSeg();
        runAll();
      });
    });
  });

  /* graph / table switches */
  $$('.viz-tabs').forEach(function (vt) {
    var wrap = vt.closest('.viz');
    $$('button', vt).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('button', vt).forEach(function (o) { o.classList.toggle('on', o === b); });
        var mode = b.getAttribute('data-viz');
        $$('.viz-graph, .viz-table', wrap).forEach(function (pane) {
          pane.hidden = !pane.classList.contains(mode === 'graph' ? 'viz-graph' : 'viz-table');
        });
      });
    });
  });

  /* "use average Australian expenses" */
  var hemBtn = $('#b-usehem');
  if (hemBtn) {
    hemBtn.addEventListener('click', function () {
      var root = $('#p-borrowing');
      var a = root.getAttribute('data-applicants') === '2' ? 2 : 1;
      var d = parseInt(root.getAttribute('data-deps') || '0', 10);
      $('#b-expenses').value = hemMonthly(a, d);
      runAll();
    });
  }

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
