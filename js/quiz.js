/* Finance Square Group - Find Your Home Loan Starting Point
   Self-contained quiz engine. No tracking, no lead capture, no network calls.
   General information only - not credit advice. */
(function(){
'use strict';

/* ---------------------------------------------------------------- icons */
var I = function(paths){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';};
var ICONS = {
  home:    I('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>'),
  key:     I('<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2m-4.5 4.5 3 3M13.5 9.5l2.5 2.5"/>'),
  refresh: I('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>'),
  chart:   I('<path d="M3 21h18"/><path d="M6 17v-5m5 5V8m5 9v-3m5 3V5"/>'),
  unlock:  I('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-.9"/>'),
  compass: I('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
  clock:   I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
  wallet:  I('<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2Z"/><path d="M16.5 14.5h.01"/>'),
  coins:   I('<circle cx="9" cy="9" r="6"/><path d="M14.6 5.1a6 6 0 1 1-6.9 9.4"/><path d="M9 6.5v5M7 9h4"/>'),
  users:   I('<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.5 3.5 0 0 1 0 5.9M21 20c0-2.6-1.6-4.8-3.9-5.7"/>'),
  shield:  I('<path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6Z"/><path d="m9.2 12 2 2 3.6-4"/>'),
  doc:     I('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5m-5 4h5"/>'),
  brief:   I('<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>'),
  star:    I('<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.3 7.2 18.9l.9-5.4L4.2 9.7l5.4-.8Z"/>'),
  bank:    I('<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8m4.7-8v8m4.6-8v8M19 10v8"/><path d="M3 20h18"/>'),
  tools:   I('<path d="M14.7 6.3a4 4 0 0 0-5.4 5L4 16.6V20h3.4l5.3-5.3a4 4 0 0 0 5-5.4l-2.6 2.6-2.4-2.4Z"/>'),
  quest:   I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5.1.7c0 1.7-2.6 2-2.6 3.5"/><path d="M12 17h.01"/>'),
  cal:     I('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/>'),
  build:   I('<rect x="5" y="4" width="9" height="17"/><path d="M14 9h5v12H5"/><path d="M8 8h1m2 0h1M8 12h1m2 0h1m-4 4h1m2 0h1"/>'),
  heart:   I('<path d="M12 20s-7-4.3-7-9.5A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.5C19 15.7 12 20 12 20Z"/>'),
  arrow:   I('<path d="M5 12h14m-6-6 6 6-6 6"/>'),
  card:    I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18M7 15h4"/>'),
  scale:   I('<path d="M12 4v16m-7 0h14"/><path d="m7 7-3 6a3.5 3.5 0 0 0 6 0L7 7Zm10 0-3 6a3.5 3.5 0 0 0 6 0l-3-6Z"/><path d="M4 7h16"/>'),
  leaf:    I('<path d="M5 19C5 9 12 4 20 4c0 8-5 15-15 15Z"/><path d="M5 19c3-5 7-8 10-9.5"/>')
};

/* ---------------------------------------------------- shared option sets */
var TIMING = [
  {v:'asap', t:'As soon as possible', i:'arrow'},
  {v:'m3', t:'Within 3 months', i:'clock'},
  {v:'m36', t:'3–6 months', i:'clock'},
  {v:'m612', t:'6–12 months', i:'cal'},
  {v:'m12p', t:'More than 12 months', i:'cal'},
  {v:'research', t:'Just researching for now', i:'compass'}
];
var VALUE_RANGES = [
  {v:'v1', t:'Under $500k'}, {v:'v2', t:'$500k – $750k'}, {v:'v3', t:'$750k – $1m'},
  {v:'v4', t:'$1m – $1.5m'}, {v:'v5', t:'Over $1.5m'}, {v:'ns', t:'Not sure'}
];

/* ------------------------------------------------------------- questions */
var Q = {
  goal: {
    eyebrow: 'Let’s get started',
    title: 'What are you looking to do?',
    help: 'Your answer shapes the questions that follow, you’ll only be asked what’s relevant.',
    options: [
      {v:'first', t:'Buy my first home', i:'key'},
      {v:'next', t:'Buy my next home', i:'home'},
      {v:'refi', t:'Refinance my current loan', i:'refresh'},
      {v:'invest', t:'Buy an investment property', i:'chart'},
      {v:'equity', t:'Access equity in my home', i:'unlock'},
      {v:'unsure', t:'I’m not sure yet', i:'compass'}
    ]
  },
  timing: {
    eyebrow: 'Timing',
    title: function(a){
      return {first:'When are you hoping to buy your first home?',
              next:'When are you hoping to make your move?',
              refi:'When would you consider making a change?',
              invest:'When are you looking to purchase?',
              equity:'When would you ideally want to access the funds?',
              unsure:'Is there a timeframe on your mind?'}[a.goal];
    },
    help: 'A rough idea is fine, there’s no wrong answer.',
    options: TIMING
  },
  current_home: {
    eyebrow: 'Your current home',
    title: 'What’s happening with your current home?',
    options: [
      {v:'sell', t:'Selling it', i:'home'},
      {v:'keep', t:'Keeping it', i:'shield'},
      {v:'sold', t:'Already sold', i:'key'},
      {v:'ns', t:'Not sure yet', i:'quest'}
    ]
  },
  prop_type: {
    eyebrow: 'The property',
    title: 'What type of property are you considering?',
    options: [
      {v:'house', t:'House', i:'home'},
      {v:'apt', t:'Apartment or unit', i:'build'},
      {v:'town', t:'Townhouse', i:'bank'},
      {v:'land', t:'Land and build', i:'tools'},
      {v:'ns', t:'Not sure yet', i:'compass'}
    ]
  },
  budget: {
    eyebrow: 'Price range',
    title: 'Roughly what price range are you considering?',
    help: 'No need to be exact, a ballpark is plenty.',
    options: VALUE_RANGES.map(function(o){return {v:o.v, t:o.t};})
  },
  deposit_fhb: {
    eyebrow: 'Your deposit',
    title: 'How much have you set aside for your first-home deposit?',
    help: 'Savings, gifts and anything else you could put toward it all count.',
    options: [
      {v:'d1', t:'Under $30k'}, {v:'d2', t:'$30k – $60k'}, {v:'d3', t:'$60k – $100k'},
      {v:'d4', t:'$100k – $150k'}, {v:'d5', t:'Over $150k'}, {v:'saving', t:'Still saving'}
    ]
  },
  deposit_next: {
    eyebrow: 'Deposit & equity',
    title: 'Roughly how much deposit or equity would you have for the purchase?',
    help: 'Sale proceeds and equity in your current home count too.',
    options: [
      {v:'n1', t:'Under $50k'}, {v:'n2', t:'$50k – $100k'}, {v:'n3', t:'$100k – $200k'},
      {v:'n4', t:'$200k – $400k'}, {v:'n5', t:'Over $400k'}, {v:'ns', t:'Not sure yet'}
    ]
  },
  income: {
    eyebrow: 'Your income',
    title: 'How do you earn your income?',
    help: 'This helps show how a lender may look at your situation.',
    assume: 'ft',
    options: [
      {v:'ft', t:'Full-time employee', i:'brief'},
      {v:'pt', t:'Part-time employee', i:'brief'},
      {v:'cas', t:'Casual employee', i:'clock'},
      {v:'se', t:'Self-employed or business owner', i:'tools'},
      {v:'con', t:'Contractor', i:'doc'},
      {v:'multi', t:'Multiple income sources', i:'coins'},
      {v:'oth', t:'Something else', i:'quest'}
    ]
  },
  se_years: {
    eyebrow: 'Your business',
    title: 'How long have you been self-employed?',
    help: 'Lenders often look at how long a business has been trading.',
    options: [
      {v:'y1', t:'Less than a year'}, {v:'y12', t:'1 – 2 years'},
      {v:'y25', t:'2 – 5 years'}, {v:'y5', t:'More than 5 years'}
    ]
  },
  se_pay: {
    eyebrow: 'Your business',
    title: 'How do you pay yourself?',
    help: 'Not sure? That’s completely fine.',
    options: [
      {v:'sal', t:'A regular salary from my business'},
      {v:'draw', t:'Drawings as I need them'},
      {v:'mix', t:'A mix of salary and dividends'},
      {v:'varies', t:'It varies'},
      {v:'ns', t:'Not sure'}
    ]
  },
  commitments: {
    eyebrow: 'Commitments',
    title: 'Do you have any existing loans or credit commitments?',
    help: 'Select all that apply, then continue.',
    type: 'multi',
    options: function(a){
      var o = [];
      if (a.goal === 'next') o.push({v:'home', t:'A home loan', i:'home'});
      return o.concat([
        {v:'car', t:'Car loan', i:'key'},
        {v:'per', t:'Personal loan', i:'wallet'},
        {v:'cc', t:'Credit cards', i:'card'},
        {v:'hecs', t:'HECS/HELP', i:'doc'},
        {v:'bnpl', t:'Buy Now Pay Later', i:'clock'},
        {v:'none', t:'None of these', i:'shield', solo:true},
        {v:'disc', t:'I’d prefer to discuss', i:'quest', solo:true}
      ]);
    }
  },
  applicants: {
    eyebrow: 'Applying',
    title: 'Who would be applying for the loan?',
    options: [
      {v:'solo', t:'Just me', i:'star'},
      {v:'partner', t:'Me and my partner', i:'users'},
      {v:'joint', t:'Another joint applicant', i:'users'},
      {v:'ns', t:'Not sure yet', i:'quest'}
    ]
  },
  schemes: {
    eyebrow: 'Support',
    title: 'Would you like to explore first-home-buyer support that may apply to you?',
    help: 'Things like the Home Guarantee Scheme, stamp-duty concessions or the First Home Super Saver Scheme. Eligibility varies by state and circumstances.',
    options: [
      {v:'yes', t:'Yes, show me what may apply', i:'star'},
      {v:'already', t:'I’ve already looked into them', i:'shield'},
      {v:'later', t:'Maybe later', i:'clock'},
      {v:'ns', t:'I don’t know what’s available', i:'quest'}
    ]
  },
  credit: {
    eyebrow: 'Credit history',
    title: 'Has anything affected your credit history?',
    help: 'There’s no judgement here, it simply helps point you in the right direction.',
    assume: 'none',
    options: [
      {v:'none', t:'Nothing I’m aware of', i:'shield'},
      {v:'late', t:'Some late payments', i:'clock'},
      {v:'def', t:'A previous default', i:'doc'},
      {v:'dec', t:'A declined application', i:'refresh'},
      {v:'ns', t:'I’m not sure', i:'quest'},
      {v:'disc', t:'I’d prefer to discuss it', i:'heart'}
    ]
  },
  credit_when: {
    eyebrow: 'Credit history',
    title: 'When did that happen?',
    help: 'Timing can matter, many lenders view older, resolved issues differently.',
    options: [
      {v:'y1', t:'Within the last year'},
      {v:'y12', t:'1 – 2 years ago'},
      {v:'y2', t:'More than 2 years ago'},
      {v:'res', t:'It’s resolved now'},
      {v:'disc', t:'I’d prefer to discuss it'}
    ]
  },
  priority: {
    eyebrow: 'Almost there',
    title: function(a){
      return a.goal === 'refi' || a.goal === 'equity'
        ? 'What would matter most in a new loan?'
        : 'What matters most to you in a home loan?';
    },
    help: 'Almost there, this is the last question.',
    options: [
      {v:'repay', t:'Competitive repayments', i:'coins'},
      {v:'flex', t:'Flexibility to make changes', i:'refresh'},
      {v:'offset', t:'An offset account', i:'wallet'},
      {v:'fixed', t:'Fixed-rate certainty', i:'shield'},
      {v:'faster', t:'Paying it off faster', i:'arrow'},
      {v:'fit', t:'A loan that fits my circumstances', i:'star'},
      {v:'ns', t:'I’m not sure yet', i:'quest'}
    ]
  },
  /* refinance branch */
  reason: {
    eyebrow: 'Your goal',
    title: 'Why are you considering refinancing?',
    options: [
      {v:'lower', t:'Lower my repayments', i:'coins'},
      {v:'rate', t:'Check my rate is still competitive', i:'scale'},
      {v:'equity', t:'Access equity', i:'unlock'},
      {v:'fixedend', t:'My fixed rate is ending', i:'cal'},
      {v:'cons', t:'Consolidate debts', i:'refresh'},
      {v:'fit', t:'My loan no longer fits my life', i:'quest'},
      {v:'compare', t:'Just comparing options', i:'compass'}
    ]
  },
  prop_value: {
    eyebrow: 'Your property',
    title: 'Roughly what’s your property worth today?',
    help: 'Your best guess is fine, a formal valuation comes much later.',
    options: VALUE_RANGES
  },
  balance: {
    eyebrow: 'Your loan',
    title: 'Roughly how much is left on your current loan?',
    options: [
      {v:'l1', t:'Under $300k'}, {v:'l2', t:'$300k – $500k'},
      {v:'l3', t:'$500k – $750k'}, {v:'l4', t:'Over $750k'}, {v:'ns', t:'Not sure'}
    ]
  },
  rate_type: {
    eyebrow: 'Your loan',
    title: 'Is your current rate fixed or variable?',
    options: [
      {v:'fixed', t:'Fixed', i:'shield'},
      {v:'variable', t:'Variable', i:'chart'},
      {v:'split', t:'A split of both', i:'scale'},
      {v:'ns', t:'Not sure', i:'quest'}
    ]
  },
  loan_age: {
    eyebrow: 'Your loan',
    title: 'How long have you had this loan?',
    options: [
      {v:'a2', t:'Less than 2 years', i:'clock'},
      {v:'a25', t:'2 – 5 years', i:'cal'},
      {v:'a5', t:'More than 5 years', i:'cal'},
      {v:'ns', t:'Not sure', i:'quest'}
    ]
  },
  /* investor branch */
  inv_count: {
    eyebrow: 'Your portfolio',
    title: 'Where are you at with property investing?',
    options: [
      {v:'firstinv', t:'This would be my first investment property', i:'star'},
      {v:'one', t:'I own one investment property', i:'home'},
      {v:'few', t:'I own two or three', i:'build'},
      {v:'many', t:'I own four or more', i:'bank'}
    ]
  },
  inv_price: {
    eyebrow: 'The purchase',
    title: 'Roughly what purchase price are you considering?',
    help: 'A ballpark is plenty.',
    options: VALUE_RANGES.map(function(o){return {v:o.v, t:o.t};})
  },
  inv_amount: {
    eyebrow: 'Deposit & equity',
    title: 'Roughly how much deposit or usable equity could you put toward it?',
    help: 'Savings and equity in existing property both count.',
    options: [
      {v:'i1', t:'Under $50k'}, {v:'i2', t:'$50k – $100k'},
      {v:'i3', t:'$100k – $250k'}, {v:'i4', t:'Over $250k'}, {v:'ns', t:'Not sure yet'}
    ]
  },
  own_home_loan: {
    eyebrow: 'Commitments',
    title: 'Do you currently have a loan on your own home?',
    options: [
      {v:'yes', t:'Yes', i:'home'},
      {v:'no', t:'No, it’s paid off', i:'shield'},
      {v:'rent', t:'I’m renting', i:'key'},
      {v:'disc', t:'I’d prefer to discuss', i:'quest'}
    ]
  },
  inv_objective: {
    eyebrow: 'Your objective',
    title: 'What’s the main objective for this purchase?',
    options: [
      {v:'growth', t:'Long-term capital growth', i:'chart'},
      {v:'income', t:'Rental income', i:'coins'},
      {v:'portfolio', t:'Building a portfolio', i:'build'},
      {v:'both', t:'A bit of both', i:'scale'},
      {v:'ns', t:'Still working it out', i:'compass'}
    ]
  },
  /* equity branch */
  eq_purpose: {
    eyebrow: 'Your plans',
    title: 'What would the equity be for?',
    options: [
      {v:'reno', t:'Renovations', i:'tools'},
      {v:'invest', t:'An investment property', i:'chart'},
      {v:'buy', t:'A deposit for another purchase', i:'key'},
      {v:'cons', t:'Consolidating debts', i:'refresh'},
      {v:'other', t:'Something else', i:'star'},
      {v:'ns', t:'Not sure yet', i:'compass'}
    ]
  },
  /* not-sure branch */
  unsure_pick: {
    eyebrow: 'No rush',
    title: 'Which of these sounds most like you?',
    help: 'Choose the option that fits best, there’s no wrong answer.',
    options: [
      {v:'first', t:'Thinking about buying a first home', i:'key'},
      {v:'move', t:'Wondering about my next move', i:'home'},
      {v:'loan', t:'Wondering if my current loan is still right', i:'scale'},
      {v:'invest', t:'Curious about property investing', i:'chart'},
      {v:'learn', t:'Just building my knowledge', i:'leaf'}
    ]
  },
  saving_status: {
    eyebrow: 'Where you’re at',
    title: 'Have you started building a deposit or equity?',
    options: [
      {v:'start', t:'Just getting started', i:'leaf'},
      {v:'some', t:'I have some savings', i:'wallet'},
      {v:'solid', t:'I have a solid deposit or equity', i:'shield'},
      {v:'ns', t:'Not sure how to think about it', i:'quest'}
    ]
  },
  unsure_help: {
    eyebrow: 'Last one',
    title: 'What would help you most right now?',
    options: [
      {v:'borrow', t:'Understanding what I could borrow', i:'coins'},
      {v:'deposit', t:'How deposits and costs work', i:'wallet'},
      {v:'schemes', t:'What government support exists', i:'star'},
      {v:'compare', t:'Whether my current loan stacks up', i:'scale'},
      {v:'where', t:'Just knowing where to start', i:'compass'}
    ]
  }
};

/* ------------------------------------------------------------- branching */
function isSE(a){ return a.income === 'se'; }
function creditConcern(a){ return a.credit === 'late' || a.credit === 'def' || a.credit === 'dec'; }
function val(a, id){ return a[id] !== undefined ? a[id] : (Q[id] && Q[id].assume); }

function buildPath(a){
  var g = a.goal;
  var p = ['goal'];
  if (!g) return p.concat(['timing','prop_type','budget','income','commitments','credit','priority']); /* neutral estimate pre-answer */
  var se = val(a,'income') === 'se';
  var cw = ['late','def','dec'].indexOf(val(a,'credit')) !== -1;
  if (g === 'first'){
    p = p.concat(['timing','prop_type','budget','deposit_fhb','income']);
    if (se) p.push('se_years');
    p = p.concat(['commitments','applicants','schemes','credit']);
    if (cw) p.push('credit_when');
    p.push('priority');
  } else if (g === 'next'){
    p = p.concat(['timing','current_home','prop_type','budget','deposit_next','income']);
    if (se) p.push('se_years');
    p = p.concat(['commitments','credit']);
    if (cw) p.push('credit_when');
    p.push('priority');
  } else if (g === 'refi'){
    p = p.concat(['reason','prop_value','balance','rate_type','loan_age','income']);
    if (se) p = p.concat(['se_years','se_pay']);
    p = p.concat(['timing','credit']);
    if (cw) p.push('credit_when');
    p.push('priority');
  } else if (g === 'invest'){
    p = p.concat(['inv_count','timing','inv_price','inv_amount','own_home_loan','income']);
    if (se) p = p.concat(['se_years','se_pay']);
    p = p.concat(['inv_objective','credit']);
    if (cw) p.push('credit_when');
    p.push('priority');
  } else if (g === 'equity'){
    p = p.concat(['eq_purpose','prop_value','balance','timing','income']);
    if (se) p = p.concat(['se_years','se_pay']);
    p.push('credit');
    if (cw) p.push('credit_when');
    p.push('priority');
  } else { /* unsure */
    p = p.concat(['unsure_pick','timing','saving_status','income','credit']);
    if (cw) p.push('credit_when');
    p.push('unsure_help');
  }
  return p;
}

/* Interstitial shown when leaving question `from` having just answered `v`. */
function interstitial(from, v, a){
  if (from === 'goal'){
    return {
      first:'Great, buying your first home is a big step. Let’s look at where you’re starting from.',
      next:'Let’s look at how your next move is shaping up.',
      refi:'Let’s see what you’re hoping to improve with your current loan.',
      invest:'Let’s look at your finance from an investment point of view.',
      equity:'Let’s understand the equity you may be able to work with.',
      unsure:'No worries, plenty of people start here. We’ll keep it simple.'
    }[v];
  }
  if (from === 'income' && v === 'se'){
    return 'Let’s look at the factors that can matter when your income comes from a business.';
  }
  if (from === 'credit' && (v === 'late' || v === 'def' || v === 'dec')){
    return 'Thanks for sharing that. Every situation is different, let’s understand a little more about yours.';
  }
  return null;
}

/* --------------------------------------------------------------- results */
function optLabel(id, v){
  var opts = Q[id].options;
  if (typeof opts === 'function') opts = opts(state.answers);
  for (var i = 0; i < opts.length; i++) if (opts[i].v === v) return opts[i].t;
  return '';
}
function labelList(id, arr){
  return arr.map(function(v){ return optLabel(id, v); }).join(', ');
}

var CATS = {
  ready: { badge:'Ready to Explore', lead:'Based on your answers, you appear well placed to start looking at your home-loan options in earnest.' },
  prep: { badge:'Preparing to Buy', lead:'Based on your answers, a little preparation now could put you in a stronger position when you’re ready to move.' },
  refi: { badge:'Refinance Review', lead:'Your answers suggest that reviewing your current loan may be worth considering.' },
  equity: { badge:'Equity Review', lead:'Your answers suggest it may be worth exploring what your equity could support.' },
  investor: { badge:'Investor Profile', lead:'You’re approaching finance from an investment perspective, and that changes what’s worth weighing up.' },
  se: { badge:'Self-Employed Pathway', lead:'Because your income comes from a business, the way lenders assess it may be an important part of your journey.' },
  early: { badge:'Early Stage', lead:'You’re in research mode, which is a smart place to be. Here’s what’s worth understanding first.' },
  specialist: { badge:'A Tailored Conversation', lead:'Your circumstances have a few moving parts, so a tailored conversation is likely to serve you better than a generic checklist.' }
};

function pickCategory(a){
  if (creditConcern(a)) return 'specialist';
  if (isSE(a) && a.goal !== 'unsure') return 'se';
  var g = a.goal;
  if (g === 'unsure') return 'early';
  if (g === 'refi') return 'refi';
  if (g === 'equity') return 'equity';
  if (g === 'invest') return 'investor';
  /* first / next */
  if (a.timing === 'research' || a.timing === 'm12p' || a.deposit_fhb === 'saving') return 'prep';
  return 'ready';
}

/* midpoints for rough deposit-vs-price signal (never shown as figures) */
var MID = {
  v1:400000, v2:625000, v3:875000, v4:1250000, v5:1700000,
  d1:20000, d2:45000, d3:80000, d4:125000, d5:180000,
  n1:35000, n2:75000, n3:150000, n4:300000, n5:450000,
  i1:35000, i2:75000, i3:175000, i4:300000,
  l1:200000, l2:400000, l3:625000, l4:850000
};

function meaningParas(a, cat){
  var out = [];
  var g = a.goal;
  /* category base line */
  if (cat === 'specialist'){
    out.push('A past credit event doesn’t necessarily rule anything out. Some lenders take a case-by-case view, particularly where the situation has been resolved' + (a.credit_when === 'res' ? ', and you’ve indicated yours has been' : '') + '. Timing, the details of what happened and lender choice can all matter, which is why a conversation tends to help more than a calculator here.');
    var goalCtx = {
      first:'That doesn’t change your goal, plenty of first-home buyers start from exactly this position. It mostly shapes which lenders are worth approaching first.',
      next:'Your next move is still very much on the table, it mostly shapes which lenders are worth approaching first.',
      refi:'People refinance with a credit event on file regularly, it simply narrows the field to lenders whose policy suits your situation.',
      invest:'Investment lending is still possible in many of these situations, the right lender fit just becomes the first question rather than the last.',
      equity:'Accessing equity may still be possible, the starting point is understanding how different lenders would view your file.',
      unsure:'There’s no need to have it all worked out, understanding where you stand is a solid first step.'
    }[g];
    if (goalCtx) out.push(goalCtx);
  } else if (cat === 'se'){
    out.push('Different lenders read business income very differently, some want two full years of tax returns, others take a more flexible view of recent figures. For self-employed borrowers, lender selection can matter as much as the rate.');
    if (a.se_years === 'y1' || a.se_years === 'y12'){
      out.push('With under two years of trading, your options may be narrower but they’re rarely zero, the way your income is documented becomes the key question to work through.');
    }
  } else if (cat === 'refi' || cat === 'equity'){
    var vm = MID[a.prop_value], lm = MID[a.balance];
    if (vm && lm && (vm - lm) > vm * 0.2){
      out.push('Your figures suggest you may have meaningful equity in the property, which could open up options, from better pricing to ' + (cat === 'equity' ? 'releasing funds for your plans' : 'restructuring the loan around your goals') + '. A formal valuation would confirm the real position.');
    } else {
      out.push('The gap between your property’s value and your loan balance shapes what a refinance could achieve, so getting a clearer read on your equity position is a sensible first step.');
    }
    if (a.reason === 'fixedend') out.push('With a fixed rate ending, it’s worth comparing the rate you’d roll onto against the wider market before it happens, the revert rate is often not the most competitive one available.');
    if (a.loan_age === 'a5') out.push('Loans set up more than five years ago were priced for a different market, so a review is often worthwhile even if you end up staying put.');
  } else if (cat === 'investor'){
    out.push('Investment lending brings its own considerations, how rental income is assessed, how the loan is structured against your other property, and whether interest-only repayments fit your strategy. These are worth settling before you fall in love with a property.');
    if (a.inv_count === 'firstinv') out.push('As a first-time investor, the structure you choose now can affect how easily you can borrow for the next property, so it’s worth thinking one step ahead.');
    if (a.inv_count === 'few' || a.inv_count === 'many') out.push('With multiple properties already, how lenders view your overall position, not just this purchase, will likely drive the outcome.');
  } else if (cat === 'early'){
    out.push('There’s no pressure to move quickly. Understanding how deposits, borrowing capacity and loan features work now means that when you’re ready, the decisions will feel much smaller.');
  } else if (cat === 'prep'){
    out.push(g === 'first'
      ? 'You’re on the path, and the time between now and buying is genuinely useful. Growing your deposit, keeping your accounts tidy and understanding your borrowing capacity all strengthen your position before you apply.'
      : 'With some time before your move, you can approach it on your terms, clarifying your equity, your borrowing capacity and what needs to happen with your current home first.');
  } else { /* ready */
    out.push(g === 'first'
      ? 'You appear to have the key pieces coming together. The next step is usually understanding your borrowing capacity and getting a clear view of the full cost of buying, deposit, stamp duty and the loan itself.'
      : 'You appear well positioned to start comparing options. Lining up your borrowing capacity and how your current home fits into the plan are the usual next steps.');
  }
  /* cross-cutting modifiers */
  var priceMid = MID[a.budget] || MID[a.inv_price];
  var depMid = MID[a.deposit_fhb] || MID[a.deposit_next] || MID[a.inv_amount];
  if (cat !== 'specialist' && priceMid && depMid && depMid < priceMid * 0.15){
    out.push('With your deposit relative to your price range, lenders mortgage insurance or low-deposit options may be part of the picture, that’s common, and there are ways to approach it.');
  }
  if (g === 'first' && (a.schemes === 'yes' || a.schemes === 'ns')){
    out.push('Government support such as the Home Guarantee Scheme, state grants or stamp-duty concessions may be worth exploring, eligibility depends on your income, the property’s price and your state, so it needs to be checked against your specific numbers.');
  }
  if ((a.commitments || []).indexOf('hecs') !== -1){
    out.push('HECS/HELP repayments reduce the income lenders count, so they’re worth factoring into any borrowing-capacity estimate early.');
  }
  if ((a.commitments || []).indexOf('bnpl') !== -1 || (a.commitments || []).indexOf('cc') !== -1){
    out.push('Credit limits and Buy Now Pay Later accounts can affect how lenders assess you even when the balances are small, tidying these up before applying sometimes improves the picture.');
  }
  if (a.credit === 'disc'){
    out.push('You mentioned you’d prefer to discuss your credit history, that’s a perfectly good way to handle it, and nothing you’ve answered here commits you to anything.');
  }
  if (a.timing === 'asap' && cat !== 'early'){
    out.push('Given your timeframe, having your documents and a clear picture of your position ready early may help you move quickly when it counts.');
  }
  return out.slice(0, 4);
}

var CONS = {
  deposit: {t:'Deposit position', d:'How your deposit compares with your target price range, and what that means for the loans available to you.'},
  capacity: {t:'Borrowing capacity', d:'What lenders may be willing to lend on your income and commitments, before you set your heart on a price.'},
  lmi: {t:'Low-deposit options', d:'Lenders mortgage insurance, guarantor arrangements and scheme places, and what each could mean for you.'},
  schemes: {t:'Government support', d:'The Home Guarantee Scheme, grants and concessions that may apply, subject to eligibility.'},
  docs: {t:'Income documentation', d:'What lenders may want to see from your business, and which lenders suit how your income actually works.'},
  commitments: {t:'Existing commitments', d:'How loans, cards, HECS/HELP and other commitments shape your borrowing capacity.'},
  policy: {t:'Lender policy fit', d:'Different lenders assess the same situation differently, finding the right fit can matter more than the advertised rate.'},
  features: {t:'Loan features', d:'Offset, redraw, fixed and variable options, and which are worth paying for in your situation.'},
  equity: {t:'Equity and valuation', d:'What your property may be worth, what’s owed, and how much of the difference is usable.'},
  compare: {t:'Rate and cost comparison', d:'Whether your current loan still stacks up once rates, fees and switching costs are all counted.'},
  structure: {t:'Loan structure', d:'How the lending is set up across properties, including repayment type and what supports your next step.'},
  rental: {t:'Rental assessment', d:'How lenders may treat the expected rent, vacancy and costs when assessing the loan.'},
  timing: {t:'Timing your move', d:'What to line up first so the finance is ready when the right property appears.'},
  credit: {t:'Your credit file', d:'Understanding exactly what’s on your file and how different lenders may view it.'},
  costs: {t:'The full cost of buying', d:'Stamp duty, legal costs and the other expenses that sit alongside the deposit.'}
};

function pickConsiderations(a, cat){
  var keys = [];
  var g = a.goal;
  if (cat === 'specialist'){
    keys = ['credit','policy','commitments'];
    if (g === 'refi' || g === 'equity') keys.push('equity'); else keys.push('deposit');
    keys.push('timing');
  } else if (cat === 'se'){
    keys = ['docs','policy','capacity'];
    keys.push(g === 'refi' || g === 'equity' ? 'equity' : 'deposit');
    keys.push('features');
  } else if (cat === 'refi'){
    keys = ['compare','equity','policy','features','commitments'];
  } else if (cat === 'equity'){
    keys = ['equity','capacity','structure','compare','policy'];
  } else if (cat === 'investor'){
    keys = ['structure','rental','equity','capacity','policy'];
  } else if (cat === 'early'){
    keys = ['deposit','capacity','costs'];
    if (a.unsure_help === 'schemes' || a.unsure_pick === 'first') keys.push('schemes');
    if (a.unsure_pick === 'loan') keys.splice(0, 3, 'compare','equity','capacity');
    keys.push('timing');
  } else { /* ready / prep */
    keys = ['capacity','deposit','costs'];
    if (g === 'first' && a.schemes !== 'later') keys.push('schemes');
    if ((a.commitments || []).length && (a.commitments || []).indexOf('none') === -1) keys.push('commitments');
    keys.push('features');
  }
  /* de-dup, cap 5 */
  var seen = {}, out = [];
  for (var i = 0; i < keys.length && out.length < 5; i++){
    if (!seen[keys[i]]){ seen[keys[i]] = 1; out.push(CONS[keys[i]]); }
  }
  return out;
}

function profileRows(a){
  var rows = [];
  var g = a.goal;
  rows.push(['Your goal', optLabel('goal', g)]);
  if (a.timing) rows.push(['Timeframe', optLabel('timing', a.timing)]);
  if (a.prop_type && a.prop_type !== 'ns') rows.push(['Property type', optLabel('prop_type', a.prop_type)]);
  if (a.budget && a.budget !== 'ns') rows.push(['Price range', optLabel('budget', a.budget)]);
  if (a.inv_price && a.inv_price !== 'ns') rows.push(['Price range', optLabel('inv_price', a.inv_price)]);
  if (a.prop_value && a.prop_value !== 'ns') rows.push(['Property value', optLabel('prop_value', a.prop_value)]);
  if (a.balance && a.balance !== 'ns') rows.push(['Loan balance', optLabel('balance', a.balance)]);
  if (a.deposit_fhb) rows.push(['Deposit', optLabel('deposit_fhb', a.deposit_fhb)]);
  if (a.deposit_next && a.deposit_next !== 'ns') rows.push(['Deposit / equity', optLabel('deposit_next', a.deposit_next)]);
  if (a.inv_amount && a.inv_amount !== 'ns') rows.push(['Deposit / equity', optLabel('inv_amount', a.inv_amount)]);
  if (a.income){
    var inc = optLabel('income', a.income);
    if (a.se_years) inc += ' · ' + optLabel('se_years', a.se_years).toLowerCase();
    rows.push(['Income', inc]);
  }
  if (a.rate_type && a.rate_type !== 'ns') rows.push(['Current rate', optLabel('rate_type', a.rate_type)]);
  if (a.inv_count) rows.push(['Portfolio', optLabel('inv_count', a.inv_count)]);
  if (a.commitments && a.commitments.length && a.commitments.indexOf('none') === -1 && a.commitments.indexOf('disc') === -1){
    rows.push(['Commitments', labelList('commitments', a.commitments)]);
  }
  if (a.priority && a.priority !== 'ns') rows.push(['Matters most', optLabel('priority', a.priority)]);
  if (a.unsure_help) rows.push(['Most useful next', optLabel('unsure_help', a.unsure_help)]);
  return rows.slice(0, 7);
}

/* ------------------------------------------------------------------- app */
var root = document.getElementById('fsq-quiz');
var state = { screen:'intro', answers:{}, stack:[], timer:null };

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function h(tag, cls, html){ var el = document.createElement(tag); if (cls) el.className = cls; if (html !== undefined) el.innerHTML = html; return el; }

function currentId(){ return state.stack.length ? state.stack[state.stack.length - 1] : null; }

function swap(el){
  if (state.timer){ clearTimeout(state.timer); state.timer = null; }
  el.classList.add('qz-enter');
  Array.prototype.slice.call(root.children).forEach(function(old){
    if (old.classList.contains('qz-leave')) return;
    old.classList.add('qz-leave');
    setTimeout(function(){ if (old.parentNode) old.parentNode.removeChild(old); }, 230);
  });
  root.appendChild(el);
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.remove('qz-enter'); }); });
  var f = el.querySelector('[data-focus]');
  if (f) f.focus({ preventScroll:true });
  window.scrollTo({ top:0, behavior:'smooth' });
}

function renderIntro(){
  state.screen = 'intro';
  var el = h('section', 'qz-screen qz-intro');
  el.innerHTML =
    '<p class="qz-eyebrow">Finance Square Group</p>' +
    '<h1>Find Your Home Loan <em>Starting Point</em></h1>' +
    '<p class="qz-sub">Answer a few quick questions about your goals and circumstances to get a clearer idea of what to consider next.</p>' +
    '<ul class="qz-ticks">' +
      '<li>Takes about 2–3 minutes</li>' +
      '<li>No contact details asked for</li>' +
      '<li>No credit check, nothing is recorded</li>' +
    '</ul>' +
    '<button type="button" class="qz-btn qz-btn-primary" data-focus data-start>Start<span class="qz-btn-arrow">' + ICONS.arrow + '</span></button>' +
    '<p class="qz-fine">General information only, this isn’t credit advice or an offer of credit.</p>';
  el.querySelector('[data-start]').addEventListener('click', function(){ go('goal'); });
  swap(el);
}

function progressInfo(id){
  var path = buildPath(state.answers);
  var i = path.indexOf(id);
  if (i === -1){ i = 0; }
  return { n: i + 1, total: path.length };
}

function renderQuestion(id){
  state.screen = 'q';
  var q = Q[id];
  var a = state.answers;
  var opts = typeof q.options === 'function' ? q.options(a) : q.options;
  var title = typeof q.title === 'function' ? q.title(a) : q.title;
  var eyebrow = typeof q.eyebrow === 'function' ? q.eyebrow(a) : q.eyebrow;
  var multi = q.type === 'multi';
  var prev = a[id];
  var pi = progressInfo(id);
  var pct = Math.round((pi.n - 1) / pi.total * 100);

  var el = h('section', 'qz-screen qz-q');
  var html =
    '<div class="qz-top">' +
      '<button type="button" class="qz-back" data-back>' + I('<path d="M19 12H5m6 6-6-6 6-6"/>') + '<span>Back</span></button>' +
      '<span class="qz-count">Question ' + pi.n + ' of ' + pi.total + '</span>' +
    '</div>' +
    '<div class="qz-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
    '<p class="qz-eyebrow">' + esc(eyebrow) + '</p>' +
    '<h2>' + esc(title) + '</h2>' +
    (q.help ? '<p class="qz-help">' + esc(q.help) + '</p>' : '') +
    '<div class="qz-opts' + (opts.length > 5 && !opts[0].i ? ' qz-opts-compact' : '') + '" role="' + (multi ? 'group' : 'listbox') + '">';
  opts.forEach(function(o){
    var sel = multi ? (prev || []).indexOf(o.v) !== -1 : prev === o.v;
    html += '<button type="button" class="qz-opt' + (sel ? ' sel' : '') + '" data-v="' + o.v + '"' + (multi ? ' aria-pressed="' + sel + '"' : ' role="option" aria-selected="' + sel + '"') + '>' +
      (o.i ? '<span class="qz-ico">' + ICONS[o.i] + '</span>' : '') +
      '<span class="qz-opt-t">' + esc(o.t) + (o.s ? '<small>' + esc(o.s) + '</small>' : '') + '</span>' +
      '<span class="qz-check">' + I('<path d="m5 12.5 4.5 4.5L19 7.5"/>') + '</span>' +
    '</button>';
  });
  html += '</div>';
  if (multi){
    html += '<button type="button" class="qz-btn qz-btn-primary qz-continue" data-continue' + ((prev || []).length ? '' : ' disabled') + '>Continue<span class="qz-btn-arrow">' + ICONS.arrow + '</span></button>';
  }
  el.innerHTML = html;

  el.querySelector('[data-back]').addEventListener('click', back);
  var btns = el.querySelectorAll('.qz-opt');
  var contBtn = el.querySelector('[data-continue]');
  Array.prototype.forEach.call(btns, function(b){
    b.addEventListener('click', function(){
      var v = b.getAttribute('data-v');
      if (multi){
        var cur = (state.answers[id] || []).slice();
        var solo = opts.filter(function(o){return o.solo;}).map(function(o){return o.v;});
        if (solo.indexOf(v) !== -1){
          cur = cur.indexOf(v) !== -1 ? [] : [v];
        } else {
          cur = cur.filter(function(x){ return solo.indexOf(x) === -1; });
          var ix = cur.indexOf(v);
          if (ix === -1) cur.push(v); else cur.splice(ix, 1);
        }
        state.answers[id] = cur;
        Array.prototype.forEach.call(btns, function(bb){
          var on = cur.indexOf(bb.getAttribute('data-v')) !== -1;
          bb.classList.toggle('sel', on);
          bb.setAttribute('aria-pressed', on);
        });
        if (contBtn) contBtn.disabled = !cur.length;
      } else {
        answer(id, v, b);
      }
    });
  });
  if (contBtn) contBtn.addEventListener('click', function(){ advance(id, null); });
  swap(el);
}

function answer(id, v, btn){
  /* changing an earlier answer clears everything answered after it */
  var pos = state.stack.indexOf(id);
  if (pos !== -1 && pos < state.stack.length - 1){ /* shouldn't happen: stack top is current */ }
  if (state.answers[id] !== undefined && state.answers[id] !== v){
    var path = buildPath(state.answers);
    var i = path.indexOf(id);
    path.slice(i + 1).forEach(function(qid){ delete state.answers[qid]; });
  }
  state.answers[id] = v;
  if (btn){
    btn.classList.add('sel');
    var sib = btn.parentNode.querySelectorAll('.qz-opt');
    Array.prototype.forEach.call(sib, function(bb){ if (bb !== btn) bb.classList.remove('sel'); });
  }
  setTimeout(function(){ advance(id, v); }, 260);
}

function advance(fromId, v){
  var msg = v !== null ? interstitial(fromId, v, state.answers) : null;
  var path = buildPath(state.answers);
  var i = path.indexOf(fromId);
  var nextId = i !== -1 && i + 1 < path.length ? path[i + 1] : null;
  var proceed = function(){
    if (nextId) go(nextId); else renderResult();
  };
  if (msg) renderInter(msg, proceed); else proceed();
}

function go(id){
  var ix = state.stack.indexOf(id);
  if (ix === -1) state.stack.push(id); else state.stack = state.stack.slice(0, ix + 1);
  renderQuestion(id);
}

function back(){
  if (state.stack.length <= 1){ state.stack = []; renderIntro(); return; }
  state.stack.pop();
  renderQuestion(currentId());
}

function renderInter(msg, proceed){
  state.screen = 'inter';
  var el = h('section', 'qz-screen qz-inter');
  el.innerHTML =
    '<div class="qz-inter-mark">' + ICONS.star + '</div>' +
    '<p class="qz-inter-msg">' + esc(msg) + '</p>' +
    '<span class="qz-inter-dots"><i></i><i></i><i></i></span>' +
    '<button type="button" class="qz-skip" data-skip>Continue</button>';
  var done = false;
  var fire = function(){ if (done) return; done = true; proceed(); };
  el.querySelector('[data-skip]').addEventListener('click', fire);
  el.addEventListener('click', fire);
  swap(el);
  state.timer = setTimeout(fire, 1900);
}

function renderResult(){
  state.screen = 'result';
  var a = state.answers;
  var cat = pickCategory(a);
  var c = CATS[cat];
  var rows = profileRows(a);
  var paras = meaningParas(a, cat);
  var cons = pickConsiderations(a, cat);

  var el = h('section', 'qz-screen qz-result');
  var html =
    '<p class="qz-eyebrow">Your result</p>' +
    '<div class="qz-badge">' + esc(c.badge) + '</div>' +
    '<h2>Your Home Loan Starting Point</h2>' +
    '<p class="qz-sub">' + esc(c.lead) + '</p>' +
    '<div class="qz-card qz-profile"><h3>Your profile</h3><dl>';
  rows.forEach(function(r){ html += '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; });
  html += '</dl></div>' +
    '<div class="qz-card qz-meaning"><h3>What this could mean</h3>';
  paras.forEach(function(p){ html += '<p>' + esc(p) + '</p>'; });
  html += '</div>' +
    '<div class="qz-card qz-consider"><h3>What to consider next</h3><ol>';
  cons.forEach(function(x){ html += '<li><strong>' + esc(x.t) + '</strong><span>' + esc(x.d) + '</span></li>'; });
  html += '</ol></div>' +
    '<div class="qz-ctas">' +
      '<a class="qz-btn qz-btn-primary" href="contact.html">Talk it through and book a 15-minute chat</a>' +
      '<a class="qz-btn qz-btn-ghost" href="calculators.html">Try our calculators</a>' +
      '<button type="button" class="qz-restart" data-restart>' + ICONS.refresh + '<span>Start again</span></button>' +
    '</div>' +
    '<p class="qz-fine">This result is general information based only on the answers you provided. It doesn’t consider all of your circumstances, isn’t credit advice or an offer of credit, and any loan is subject to lender assessment and approval. Nothing you entered has been stored or sent anywhere.</p>';
  el.innerHTML = html;
  el.querySelector('[data-restart]').addEventListener('click', function(){
    state.answers = {}; state.stack = []; renderIntro();
  });
  swap(el);
}

/* expose for testing */
window.FSQ_QUIZ = { buildPath: buildPath, pickCategory: pickCategory, meaningParas: meaningParas, pickConsiderations: pickConsiderations, Q: Q, state: state, go: go, interstitial: interstitial };

renderIntro();
})();
