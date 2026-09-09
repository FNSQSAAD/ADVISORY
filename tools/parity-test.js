/* Proves js/finance-core.js still produces exactly what the live calculators page
   produces. calculators.js is evaluated in a stub-DOM sandbox and its internal
   symbols are compared against finance-core across a grid of inputs.
   Run: node tools/parity-test.js       (exit code 1 on any mismatch)          */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const F = require('../js/finance-core.js');
let src = fs.readFileSync(path.join(__dirname, '..', 'js', 'calculators.js'), 'utf8');

/* calculators.js is an IIFE, so its symbols are private. Splice an export onto the
   end of the closure - the file on disk is not touched. */
const EXPORTS = 'repayment, principalFor, termText, simulate, incomeTax, netMonthly, ' +
  'hemMonthly, lmiEstimate, DUTY, REGISTRY';
const close = src.lastIndexOf('})();');
if (close < 0) throw new Error('parity-test: calculators.js is no longer an IIFE - update the splice');
src = src.slice(0, close) +
  `\n__page = { ${EXPORTS.split(', ').map(n => n + ': ' + n).join(', ')} };\n` +
  src.slice(close);

/* Minimal DOM so the file parses and its top-level declarations run. Nothing in
   calculators.js touches the DOM at load time except the boot listener. */
const noop = () => {};
const stubEl = new Proxy({}, {
  get: (_, k) => (k === 'style' || k === 'classList' || k === 'dataset' ? stubEl
    : k === 'value' || k === 'textContent' || k === 'innerHTML' ? ''
      : typeof k === 'string' ? noop : undefined),
  set: () => true
});
const sandbox = {
  document: {
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: noop, readyState: 'loading', createElement: () => stubEl
  },
  window: { addEventListener: noop, location: { hash: '' }, history: { pushState: noop } },
  location: { hash: '' }, history: { pushState: noop },
  console, Math, Date, parseFloat, parseInt, isFinite, String, Number, Object, Array, JSON,
  __page: null
};
sandbox.self = sandbox.globalThis = sandbox;
vm.createContext(sandbox);
// Expose the internals: the file is an IIFE-free script, so its `var`/`function`
// declarations land straight on the sandbox global.
vm.runInContext(src, sandbox, { filename: 'calculators.js' });

const P = sandbox.__page;                // the page's own copies
if (!P) throw new Error('parity-test: the export splice did not run');
let checks = 0, fails = 0;

function eq(label, a, b, tol) {
  checks++;
  const ok = Math.abs((a || 0) - (b || 0)) <= (tol == null ? 0.005 : tol);
  if (!ok) { fails++; console.log('  MISMATCH ' + label + ': page=' + a + ' core=' + b); }
}
function eqStr(label, a, b) {
  checks++;
  if (a !== b) { fails++; console.log('  MISMATCH ' + label + ': page="' + a + '" core="' + b + '"'); }
}

console.log('parity: js/calculators.js  vs  js/finance-core.js');

/* 1. repayment / principalFor across rates, terms and frequencies */
for (const amt of [250000, 600000, 1250000]) {
  for (const rate of [0, 2.5, 5.75, 6.24, 9.24, 13]) {
    for (const [yrs, per] of [[30, 12], [25, 26], [10, 52], [5, 12]]) {
      const n = yrs * per;
      eq(`repayment(${amt},${rate},${n},${per})`, P.repayment(amt, rate, n, per), F.repayment(amt, rate, n, per), 1e-6);
      eq(`principalFor(3000,${rate},${n},${per})`, P.principalFor(3000, rate, n, per), F.principalFor(3000, rate, n, per), 1e-6);
    }
  }
}

/* 2. tax, HEM and LMI */
for (const g of [0, 18200, 45000, 90000, 135000, 190000, 400000, 27222, 27223]) {
  eq(`incomeTax(${g})`, P.incomeTax(g), F.incomeTax(g), 1e-6);
  eq(`netMonthly(${g})`, P.netMonthly(g), F.netMonthly(g), 1e-6);
}
for (const a of [1, 2]) for (const d of [0, 1, 2, 4]) eq(`hem(${a},${d})`, P.hemMonthly(a, d), F.hemMonthly(a, d));
for (const loan of [200000, 480000, 600000, 740000, 900000, 1500000]) {
  for (const lvr of [75, 80, 80.0001, 84.9, 85, 88, 90, 94.9, 95, 97]) {
    eq(`lmi(${loan},${lvr})`, P.lmiEstimate(loan, lvr), F.lmiEstimate(loan, lvr), 1e-6);
  }
}

/* 3. simulate - the amortisation engine, including offset and lump sums */
const simCases = [
  [600000, 6.24, 3690, {}],
  [600000, 6.24, 3690, { extraMonthly: 300 }],
  [600000, 6.24, 3690, { lumpAmount: 50000, lumpAfterMonths: 24 }],
  [600000, 6.24, 3690, { offsetStart: 20000, offsetMonthly: 500 }],
  [450000, 5.5, 2600, { ioMonths: 24 }],
  [800000, 7.1, 5000, { extraMonthly: 1000, lumpAmount: 100000, lumpAfterMonths: 12 }]
];
for (const [p, r, m, o] of simCases) {
  const a = P.simulate(p, r, m, o), b = F.simulate(p, r, m, o);
  eq(`simulate months ${p}/${r}/${JSON.stringify(o)}`, a.months, b.months);
  eq(`simulate interest ${p}/${r}/${JSON.stringify(o)}`, a.totalInterest, b.totalInterest, 1e-6);
  eq(`simulate rows ${p}/${r}`, a.yearly.length, b.yearly.length);
}

/* 4. stamp duty - every state, both uses, FHB on/off, all build types */
const VALUES = [0, 200000, 350000, 500000, 550000, 600000, 601000, 700000, 750000,
  800000, 960000, 1000000, 1290000, 1500000, 2000000, 3000000, 3870000, 5000000];
for (const st of F.STATES) {
  for (const v of VALUES) {
    for (const use of ['home', 'investment']) {
      for (const fhb of [true, false]) {
        for (const build of ['existing', 'new', 'land']) {
          const opt = { use, fhb: use === 'investment' ? false : fhb, build };
          const a = P.DUTY[st](v, opt);
          const b = F.DUTY[st](v, opt);
          eq(`DUTY.${st}(${v},${use},fhb=${opt.fhb},${build})`, a.duty, b.duty, 1e-6);
          eqStr(`DUTY.${st} note (${v},${use},fhb=${opt.fhb},${build})`, a.note, b.note);
        }
      }
    }
    eq(`REGISTRY.${st}.transfer(${v})`, P.REGISTRY[st].transfer(v), F.REGISTRY[st].transfer(v), 1e-9);
  }
  eq(`REGISTRY.${st}.mortgage`, P.REGISTRY[st].mortgage, F.REGISTRY[st].mortgage, 1e-9);
}

/* 5. termText formatting */
for (const m of [0, 1, 11, 12, 13, 23, 24, 359, 360, Infinity, -1]) {
  eqStr(`termText(${m})`, P.termText(m), F.termText(m));
}

console.log(`\n${checks} checks, ${fails} mismatches`);
if (fails) { console.log('PARITY FAILED - regenerate with: node tools/build-finance-core.js'); process.exit(1); }
console.log('PARITY OK - the bot quotes the same numbers as the calculators page.');
