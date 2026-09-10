/* The Finance Square assistant's brain.

   Deterministic by design: an ordered intent router, a slot-filling calculator
   layer over the site's own math, BM25 retrieval over the knowledge base, and a
   lead-capture state machine that ends at the one GHL path the site already uses.
   No model call, so every answer is reproducible and testable, and the widget
   cannot invent a rate, a fee or an approval.

   Conversation state lives with the caller and is echoed back each turn, which
   keeps the function stateless and safe to run on any instance. */
'use strict';

const F = require('../js/finance-core.js');
const R = require('./_retrieve.js');
const S = require('./_slots.js');

/* ------------------------------------------------------------------ compliance
   Rendered by the widget on every single response. The estimate line is attached
   to anything containing a number. */
const COMPLIANCE = {
  licence: 'Priya Dey, Credit Representative 543438 of BLSSA Pty Ltd, Australian Credit Licence 391237.',
  service: 'Our service to you is free, but other fees and lender charges may apply.',
  estimates: 'Estimates only. Normal lending criteria apply. Rates subject to change. Approved applicants only.'
};

const BOOKING_URL = 'https://api.leadconnectorhq.com/widget/booking/jjntJeKyOuid8eFZkm7W';
const PHONE = '0450 355 604';
const EMAIL = 'info@fnsq.com.au';

/* A default only used to demonstrate a calculation when the visitor has not given
   a rate. Deliberately described as an assumption everywhere it appears, never as
   a rate Finance Square is offering. */
const DEMO_RATE = 6.24;

const t = text => ({ type: 'text', text });

/* ============================================================ calculators
   Each entry declares the slots it needs, how to ask for a missing one, and how
   to render the result. The router fills what it can from the message and then
   asks for the rest one question at a time. */

function fmt(n) { return F.money(n); }

const CALCS = {
  borrowing: {
    label: 'Borrowing capacity',
    href: '/calculators.html#borrowing',
    slots: ['income1', 'expenses'],
    ask: {
      income1: { q: 'What is your total household income before tax, per year?', hint: 'e.g. $120,000, or "we earn 95k and 70k"', chips: ['$80,000', '$120,000', '$180,000'] },
      expenses: { q: 'Roughly what do you spend a month on living costs, not counting rent or your mortgage?', hint: 'Groceries, bills, transport, insurance, everything else.', chips: ['$2,000', '$3,000', '$4,500'] }
    },
    run(s) {
      const r = F.borrowingCapacity({
        income1: s.income1, income2: s.income2 || 0, applicants: s.income2 ? 2 : (s.applicants || 1),
        dependants: s.dependants || 0, expenses: s.expenses, cardLimits: s.cardLimits || 0,
        carLoan: s.carLoan || 0, otherRepayments: s.otherRepayments || 0,
        deposit: s.deposit || 0, rate: s.rate || DEMO_RATE, years: s.years || 30,
        purpose: s.purpose || 'owner', rentWeekly: s.rentWeekly || 0
      });
      if (r.maxLoan <= 0) {
        return {
          blocks: [t('On those figures the numbers look tight once the lender adds its assessment buffer. That is genuinely common, and rough inputs usually miss things that help: a second income, lower real expenses than you guessed, or family support. It is exactly what a 15-minute call sorts out.')],
          chips: ['Book a call', 'Try different numbers'], estimate: true
        };
      }
      const rows = [
        ['You could borrow roughly', fmt(r.low) + ' to ' + fmt(r.high)],
        ['Indicative purchase price', fmt(r.price)],
        ['Monthly repayment on that loan', fmt(r.monthlyRepayment)],
        ['Assessed at', F.pct(r.assessRate) + ' (the ' + F.pct(r.rate) + ' rate plus APRA\'s 3.00% buffer)'],
        ['Monthly surplus used', fmt(r.surplus)]
      ];
      if (r.lmi > 0 && s.deposit > 0) rows.push(['LMI at ' + Math.round(r.lvr) + '% LVR', 'about ' + fmt(r.lmi)]);
      const notes = [];
      if (r.hemApplied) notes.push('We used a benchmark living expense figure of ' + fmt(r.benchmarkExpenses) + ' a month, because lenders substitute a minimum benchmark when declared spending looks lower than a household would realistically spend.');
      if (r.cardCommitment > 0) notes.push('Your card limits are assessed as ' + fmt(r.cardCommitment) + ' a month whether you use them or not. Reducing unused limits is often the fastest way to lift this number.');
      return {
        blocks: [
          t('Here is the estimate, using the same engine as the calculator on our site.'),
          { type: 'calc', title: 'Borrowing capacity', rows, notes, href: '/calculators.html#borrowing' }
        ],
        chips: ['Book a call', 'What are my repayments?', 'What about stamp duty?'],
        estimate: true
      };
    }
  },

  repayment: {
    label: 'Loan repayments',
    href: '/calculators.html#repayment',
    slots: ['amount'],
    ask: {
      amount: { q: 'How much do you want to borrow?', hint: 'e.g. $650,000', chips: ['$500,000', '$650,000', '$850,000'] }
    },
    run(s) {
      const rate = s.rate || DEMO_RATE;
      const years = s.years || 30;
      const r = F.loanRepayments({ amount: s.amount, rate, years });
      const w = F.loanRepayments({ amount: s.amount, rate, years, frequency: 'weekly' });
      const f = F.loanRepayments({ amount: s.amount, rate, years, frequency: 'fortnightly' });
      const rows = [
        ['Monthly', fmt(r.monthly)],
        ['Fortnightly', fmt(f.payment)],
        ['Weekly', fmt(w.payment)],
        ['Total interest over ' + years + ' years', fmt(r.totalInterest)],
        ['Total repaid', fmt(r.totalPaid)]
      ];
      const notes = [];
      if (!s.rate) notes.push('Assumes ' + F.pct(rate) + ' over ' + years + ' years, because you have not given me a rate. That is an assumption for illustration, not a rate we are offering.');
      const extra = F.extraRepayments({ amount: s.amount, rate, years, extraMonthly: 200 });
      notes.push('For context: an extra $200 a month would cut about ' + F.termText(extra.monthsSaved) + ' off the term and save roughly ' + fmt(extra.interestSaved) + ' in interest.');
      return {
        blocks: [
          t('Here are the repayments on ' + fmt(s.amount) + '.'),
          { type: 'calc', title: 'Repayments', rows, notes, href: '/calculators.html#repayment' }
        ],
        chips: ['Book a call', 'How much can I borrow?', 'What if I pay extra?'],
        estimate: true
      };
    }
  },

  duty: {
    label: 'Stamp duty',
    href: '/calculators.html#stampduty',
    slots: ['state', 'value'],
    ask: {
      state: { q: 'Which state or territory are you buying in?', hint: 'Duty is set state by state.', chips: ['VIC', 'NSW', 'QLD', 'WA'] },
      value: { q: 'What is the purchase price?', hint: 'e.g. $750,000', chips: ['$650,000', '$800,000', '$1,000,000'] }
    },
    run(s) {
      const fhb = s.firstHomeBuyer === true;
      const r = F.stampDuty({
        state: s.state, value: s.value, firstHomeBuyer: fhb,
        use: s.purpose === 'investment' ? 'investment' : 'home',
        build: s.build || 'existing', deposit: s.deposit || 0
      });
      if (!r) return { blocks: [t('I did not catch which state that is. I can do VIC, NSW, QLD, WA, SA, TAS, ACT or NT.')], chips: ['VIC', 'NSW', 'QLD', 'WA'] };
      const rows = [
        ['Land transfer (stamp) duty', fmt(r.duty)],
        ['As a share of the price', F.pct(r.effectiveRate)],
        ['Land transfer fee', fmt(r.transferFee)],
        ['Mortgage registration', fmt(r.mortgageFee)],
        ['Total government costs', fmt(r.government)]
      ];
      const notes = [r.note];
      notes.push('Duty rates, thresholds and first home buyer concessions change regularly and differ in every state. Treat this as a planning figure and confirm the exact amount with the state revenue office or your conveyancer. Excludes any foreign purchaser surcharge.');
      const chips = ['Book a call', 'How much can I borrow?'];
      if (s.firstHomeBuyer == null) chips.unshift('I am a first home buyer');
      return {
        blocks: [
          t(fhb ? 'Here it is with the first home buyer concession applied.' : 'Here is the duty on ' + fmt(s.value) + ' in ' + r.state + '.'),
          { type: 'calc', title: 'Stamp duty, ' + r.state, rows, notes, href: '/calculators.html#stampduty' }
        ],
        chips, estimate: true
      };
    }
  },

  extra: {
    label: 'Extra repayments',
    href: '/calculators.html#lumpsum',
    slots: ['amount', 'extraMonthly'],
    ask: {
      amount: { q: 'What is the loan balance?', hint: 'e.g. $600,000', chips: ['$450,000', '$600,000', '$800,000'] },
      extraMonthly: { q: 'How much extra could you put in each month?', hint: 'e.g. $300', chips: ['$100', '$300', '$500'] }
    },
    run(s) {
      const rate = s.rate || DEMO_RATE, years = s.years || 30;
      const r = F.extraRepayments({ amount: s.amount, rate, years, extraMonthly: s.extraMonthly, lumpAmount: s.lumpAmount || 0 });
      const rows = [
        ['Normal repayment', fmt(r.baseMonthly) + ' /mo'],
        ['With your extra ' + fmt(s.extraMonthly), fmt(r.baseMonthly + s.extraMonthly) + ' /mo'],
        ['Time saved', F.termText(r.monthsSaved)],
        ['Interest saved', fmt(r.interestSaved)],
        ['Loan paid off in', F.termText(r.newMonths)]
      ];
      const notes = [];
      if (!s.rate) notes.push('Assumes ' + F.pct(rate) + ' over ' + years + ' years. Change either and the saving changes.');
      notes.push('Fixed loans usually cap how much extra you can repay, so check your loan terms before relying on this.');
      return {
        blocks: [
          t('Every extra dollar comes straight off the balance interest is charged on, so it compounds for the rest of the loan.'),
          { type: 'calc', title: 'Paying extra', rows, notes, href: '/calculators.html#lumpsum' }
        ],
        chips: ['Book a call', 'What about an offset?'],
        estimate: true
      };
    }
  },

  lmi: {
    label: 'LMI estimate',
    href: '/calculators.html#borrowing',
    slots: ['value', 'deposit'],
    ask: {
      value: { q: 'What is the property price?', hint: 'e.g. $700,000', chips: ['$600,000', '$750,000', '$900,000'] },
      deposit: { q: 'How much deposit do you have?', hint: 'e.g. $70,000', chips: ['$50,000', '$80,000', '$150,000'] }
    },
    run(s) {
      const loan = Math.max(0, s.value - s.deposit);
      const lvr = s.value > 0 ? loan / s.value * 100 : 0;
      const lmi = F.lmiEstimate(loan, lvr);
      const rows = [
        ['Loan amount', fmt(loan)],
        ['Loan-to-value ratio', Math.round(lvr) + '%'],
        ['Estimated LMI', lmi > 0 ? 'about ' + fmt(lmi) : 'Not payable at this LVR']
      ];
      const notes = [];
      if (lmi > 0) {
        const need = s.value * 0.2;
        notes.push('LMI normally applies above 80% LVR. A deposit of ' + fmt(need) + ' would take you to 80% and remove it.');
        notes.push('It is usually capitalised, meaning it is added to the loan rather than paid in cash. Eligible first home buyers may avoid it through the federal low-deposit guarantee, and some professions qualify for a waiver.');
      } else {
        notes.push('At or under 80% LVR, LMI does not normally apply.');
      }
      notes.push('Real premiums vary by insurer, lender, purpose and borrower.');
      return {
        blocks: [t('Here is the indicative position.'), { type: 'calc', title: 'Lenders Mortgage Insurance', rows, notes, href: '/calculators.html#borrowing' }],
        chips: ['Book a call', 'Tell me about the 5% deposit scheme', 'How much can I borrow?'],
        estimate: true
      };
    }
  }
};

/* Which calculator is the visitor asking for? Ordered so the more specific
   phrases win: "how much extra should I pay" is the extra calculator, not the
   repayment one, even though both contain "pay". */
function detectCalc(m) {
  if (/\b(stamp duty|transfer duty|duty)\b/i.test(m)) return 'duty';
  if (/\b(lmi|mortgage insurance)\b/i.test(m)) return 'lmi';
  if (/\b(extra|lump sum|pay (it |my loan )?off (faster|early|sooner)|additional repayment)\b/i.test(m)) return 'extra';
  if (/\b(repayment|repayments|monthly payment|weekly payment|fortnightly|what would i pay|cost me (a|per) month)\b/i.test(m)) return 'repayment';
  /* Bare "borrow" was here and turned "I'm on a casual contract, can I borrow?"
     into an income interrogation. The trigger now has to look like a request for
     a figure. */
  if (/\b(how much (can|could) (i|we) (borrow|get|afford)|borrowing (power|capacity)|what can (i|we) afford|max(imum)? loan|how much (do|would) (i|we) qualify for)\b/i.test(m)) return 'borrowing';
  return null;
}

/* Pull whatever a calculator needs out of the message. Which number means what is
   decided by the calculator's own slot list plus the words around it, so
   "600k at 6.2% over 25 years" fills three different slots. */
function harvest(kind, msg, slots) {
  const s = Object.assign({}, slots);
  const rate = S.rate(msg); if (rate != null) s.rate = rate;
  const yrs = S.years(msg); if (yrs != null) s.years = yrs;
  const st = S.state(msg); if (st) s.state = st;
  const fhb = S.firstHomeBuyer(msg); if (fhb != null) s.firstHomeBuyer = fhb;
  if (S.investment(msg)) s.purpose = 'investment';

  // Remove the parts already consumed as rate/term so their digits are not also
  // read as dollar amounts.
  const cleaned = msg
    .replace(/\d{1,2}(?:\.\d{1,3})?\s*(?:%|per\s*cent|percent)/gi, ' ')
    .replace(/\d{1,2}\s*(?:year|yr)s?\b/gi, ' ');
  /* A bare number under $1,000 with no unit and no dollar sign is usually a
     count, a year or noise, so it is marked weak: the labelled pass below may
     use it ("an extra 400 a month"), the generic positional fill may not. */
  const amounts = S.money(cleaned).map(a => {
    a.weak = !a.hadUnit && !a.hadDollar && a.value < 1000;
    return a;
  });

  /* Plausible magnitude per slot. Without this, "I earn 95k and my partner earns
     70k, with 2500 a month expenses" drops the partner's 70k into the expenses
     slot simply because it is the next unconsumed number, and the estimate
     collapses to "the numbers look tight". */
  const RANGE = {
    income1: [8000, 5000000], income2: [8000, 5000000],
    expenses: [200, 25000], cardLimits: [100, 500000],
    amount: [5000, 30000000], value: [20000, 50000000],
    deposit: [1000, 20000000], extraMonthly: [10, 50000]
  };
  const fits = (slot, v) => !RANGE[slot] || (v >= RANGE[slot][0] && v <= RANGE[slot][1]);

  const named = {
    deposit: /\b(deposit|saved|savings|put down)\b/i,
    /* Anchored to the end of the preceding text, so "earn 95k" binds but
       "repayments on 650k" does not. An unanchored version of this once read
       every amount that followed the word "on" as an income. */
    income1: /\b(earn|earning|earns|income|salary|wage|wages|make|makes|paid)\b[^a-z0-9]{0,12}$/i,
    expenses: /\b(expense|expenses|spend|spending|living|costs?)\b/i,
    extraMonthly: /\b(extra|additional)\b/i,
    cardLimits: /\b(card|cards|credit limit)\b/i
  };
  // Explicitly labelled amounts first: "deposit of $80,000" is unambiguous.
  for (const [slot, re] of Object.entries(named)) {
    for (const a of amounts) {
      if (a.consumed || !fits(slot, a.value)) continue;
      const before = cleaned.slice(Math.max(0, a.index - 24), a.index);
      const after = cleaned.slice(a.index + a.raw.length, a.index + a.raw.length + 22);
      if (re.test(before) || (slot !== 'income1' && re.test(after))) {
        s[slot] = a.value; a.consumed = true; break;
      }
    }
  }

  /* A second income stated as a pair: "we earn 95k and my partner earns 70k".
     This has to run before the generic fill below, or the partner's salary is
     consumed as living expenses. */
  if (kind === 'borrowing' && s.income1 != null && s.income2 == null &&
      /\b(we|us|partner|wife|husband|spouse|together|both|joint|combined)\b/i.test(msg)) {
    const a = amounts.find(x => !x.consumed && !x.weak && fits('income2', x.value));
    if (a) { s.income2 = a.value; a.consumed = true; }
  }

  // Then this calculator's own slots, in order, from what is left and is the
  // right order of magnitude for that slot.
  const need = CALCS[kind] ? CALCS[kind].slots : [];
  for (const slot of need) {
    if (s[slot] != null) continue;
    const a = amounts.find(x => !x.consumed && !x.weak && fits(slot, x.value));
    if (a) { s[slot] = a.value; a.consumed = true; }
  }
  return s;
}

function missingSlot(kind, s) {
  for (const slot of CALCS[kind].slots) if (s[slot] == null) return slot;
  return null;
}

function runCalc(kind, s) {
  const out = CALCS[kind].run(s);
  return out;
}

/* ========================================================== lead capture
   Four qualifying questions, then contact details, then explicit consent, then
   one POST to /api/lead - the same relay the contact form and the Get Started
   funnel use, so there is exactly one path into GoHighLevel. */

const GOALS = [
  { chip: 'Buying my first home', goal: 'Home loan: buy my first home', tag: 'intent:purchase' },
  { chip: 'Buying my next home', goal: 'Home loan: buy my next home', tag: 'intent:purchase' },
  { chip: 'Refinancing', goal: 'Home loan: refinance', tag: 'intent:refinance' },
  { chip: 'Investment property', goal: 'Home loan: invest in property', tag: 'intent:purchase' },
  { chip: 'Business or commercial', goal: 'Business & Commercial finance', tag: 'intent:commercial' },
  { chip: 'Equipment or vehicle', goal: 'Asset & Equipment finance', tag: 'intent:asset' },
  { chip: 'Personal loan', goal: 'Personal loan', tag: 'intent:personal' },
  { chip: 'Not sure yet', goal: 'Not sure yet', tag: 'intent:unknown' }
];

// Spelled exactly as api/lead.js expects, including the en dash in "1–3 months".
const TIMINGS = [
  { chip: 'ASAP', timing: 'ASAP' },
  { chip: 'Within 1 month', timing: 'Within 1 month' },
  { chip: '1–3 months', timing: '1–3 months' },
  { chip: '3+ months', timing: '3+ months' },
  { chip: 'Just researching', timing: 'Just researching' }
];

const DEPOSITS = ['Under 5%', '5% to 10%', '10% to 20%', '20% or more', 'Using equity', 'Not sure'];
const INCOMES = ['Full-time PAYG', 'Part-time or casual', 'Self-employed', 'Business income', 'Retired or other'];

const LEAD_STEPS = ['goal', 'timing', 'deposit', 'incomeType', 'name', 'email', 'phone', 'consent', 'verify'];

function matchChoice(msg, list, key) {
  const m = msg.toLowerCase().trim();
  for (const item of list) {
    const label = (typeof item === 'string' ? item : item.chip).toLowerCase();
    if (m === label || m.includes(label)) return item;
  }
  return null;
}

function leadPrompt(step, lead) {
  switch (step) {
    case 'goal':
      return { blocks: [t('Good. Four quick questions so Priya walks into the call already knowing your situation.\n\nFirst, what is the finance for?')], chips: GOALS.map(g => g.chip) };
    case 'timing':
      return { blocks: [t('How soon are you looking to move on it?')], chips: TIMINGS.map(x => x.chip) };
    case 'deposit':
      return { blocks: [t(/refinanc/i.test(lead.goal || '') ? 'Roughly how much equity do you have in the property?' : 'How much deposit do you have, roughly?')], chips: DEPOSITS };
    case 'incomeType':
      return { blocks: [t('And how is your income structured?')], chips: INCOMES };
    case 'name':
      return { blocks: [t('That is everything I need on the situation. What is your name?')], chips: [] };
    case 'email':
      return { blocks: [t('Thanks ' + (lead.firstName || '') + '. What is the best email for you?')], chips: [] };
    case 'phone':
      return { blocks: [t('And your mobile number?')], chips: [] };
    case 'consent':
      return {
        blocks: [t('Last thing, and I have to ask it properly.\n\nAre you happy for Finance Square Group to contact you about your enquiry by phone, SMS and email, and for your details to be handled under our Privacy Policy and Privacy Disclosure and Consent?')],
        chips: ['Yes, that is fine', 'No'],
        links: [{ label: 'Privacy Policy', href: '/privacy-policy/' }, { label: 'Privacy Disclosure & Consent', href: '/privacy-disclosure-consent/' }]
      };
  }
}

/* High-intent signals that should reach a human rather than sit in a nurture
   sequence: a large loan, an urgent settlement, or an explicit request. */
function isHighIntent(lead, transcript) {
  if (lead.timing === 'ASAP' || lead.timing === 'Within 1 month') return true;
  if (/\b(settle|settlement|auction|finance clause|expires?|deadline|urgent|asap)\b/i.test(transcript)) return true;
  const big = S.money(transcript).filter(a => a.hadUnit || a.hadDollar).map(a => a.value);
  if (big.some(v => v >= 1500000)) return true;
  if (/\b(commercial|business)\b/i.test(lead.goal || '')) return true;
  return false;
}

function buildLeadPayload(lead, transcript) {
  const goalEntry = GOALS.find(g => g.goal === lead.goal);
  const high = isHighIntent(lead, transcript);
  const lines = [
    'Website chatbot enquiry.',
    'Goal: ' + (lead.goal || 'not stated') + '.',
    'Timing: ' + (lead.timing || 'not stated') + '.',
    'Deposit or equity: ' + (lead.deposit || 'not stated') + '.',
    'Income type: ' + (lead.incomeType || 'not stated') + '.'
  ];
  if (lead.calcSummary) lines.push('Ran in chat: ' + lead.calcSummary + '.');
  if (high) lines.push('HIGH INTENT: flagged for a same-day call.');
  lines.push('Tags: chatbot-lead, ' + (goalEntry ? goalEntry.tag : 'intent:unknown') + (high ? ', priority-callback' : '') + '.');

  /* Campaign attribution. Without this a lead from a paid ad reaches GHL with no
     record of which ad produced it, which makes the spend unmeasurable. The
     widget passes whatever UTM parameters were on the landing URL. */
  const utm = lead.utm || {};
  const utmBits = ['source', 'medium', 'campaign', 'content', 'term']
    .filter(k => utm[k])
    .map(k => k + '=' + String(utm[k]).slice(0, 120));
  if (utm.fbclid) utmBits.push('fbclid=' + String(utm.fbclid).slice(0, 60));
  if (utmBits.length) lines.push('Campaign: ' + utmBits.join(' ') + '.');
  if (lead.landingPage) lines.push('Landed on: ' + String(lead.landingPage).slice(0, 200) + '.');

  lines.push('Consent given in chat at ' + new Date().toISOString() + '.');

  /* A paid lead is labelled by its source so it is separable in reporting from
     an organic one, without needing a second capture path. */
  const source = utm.source
    ? 'Website Chatbot (' + String(utm.source).slice(0, 40) + ')'
    : 'Website Chatbot';

  return {
    full_name: lead.name,
    email: lead.email,
    phone: lead.phone,
    message: lines.join(' '),
    lead_source: source,
    goal: lead.goal,
    timing: lead.timing,
    // Read by api/chat.js only; api/lead.js ignores unknown keys.
    _highIntent: high
  };
}

/* ================================================================== router */

const GREETING = /^(hi|hey|hello|good (morning|afternoon|evening)|g'?day|yo|hiya)\b/i;
const THANKS = /\b(thanks|thank you|cheers|ta|appreciate it|legend)\b/i;
const BYE = /\b(bye|goodbye|see ya|that'?s all|nothing else|no thanks)\b/i;
const BOOK = /\b(book|booking|appointment|strategy call|15[- ]min|calendar|schedule|speak to (priya|someone)|talk to (priya|someone|a human|a person)|call me)\b/i;
const HANDOFF = /\b(human|real person|agent|someone real|speak to a broker|talk to a broker)\b/i;
/* "help me" alone was here and hijacked "can my parents help me buy", so the
   phrases now have to be unambiguous requests to begin. */
const START_LEAD = /\b(get started|sign me up|i'?m interested|help me (get started|out)|work with you|next steps?|what do i do next)\b/i;
const RESET = /\b(start over|reset|restart|cancel|never ?mind|forget it|stop)\b/i;
const DEFINITIONAL = /^\s*(what('|’)?s|what is|what are|what does|explain|define|tell me about|meaning of|how does|how do|how is)\b/i;

function freshState() {
  return { flow: null, step: null, lead: {}, calc: null, slots: {}, turns: 0, transcript: '' };
}

/* Opening chips. A blank chat box is the single biggest drop-off point, so the
   first thing a visitor sees is four things they can press. Each carries an icon
   and a short label but SENDS a full sentence, which gives the intent router
   something unambiguous to work with. */
const ENTRY_CHIPS = [
  { icon: '🏡', label: 'Home loan', send: 'I want to talk about a home loan' },
  { icon: '🔁', label: 'Refinance', send: 'I want to refinance my home loan' },
  { icon: '🔑', label: 'First home', send: 'I am buying my first home' },
  { icon: '💼', label: 'Business', send: 'I need business or commercial finance' },
  { icon: '🚗', label: 'Car or asset', send: 'I need car or equipment finance' },
  { icon: '📅', label: 'Book a call', send: 'Book a call' }
];

function greetingBlocks() {
  return {
    blocks: [t('Hi, I am the Finance Square assistant. I can answer questions about home loans, refinancing, first home buying, business and asset finance, run the numbers on borrowing power, repayments and stamp duty, and book you a free 15-minute strategy call with Priya.\n\nWhat brings you here?')],
    chips: ENTRY_CHIPS
  };
}

function bookingBlocks(lead) {
  const blocks = [
    t('Here is Priya\'s live calendar. Pick any 15-minute slot that suits you and it is booked, you will get a confirmation by email and SMS.'),
    { type: 'booking', url: BOOKING_URL, title: 'Free 15-minute strategy call' }
  ];
  if (!lead || !lead.submitted) {
    blocks.push(t('If you would rather I took your details and had Priya call you instead, just say "call me back".'));
  }
  return { blocks, chips: ['Call me back instead', 'I have another question'] };
}

function handoffBlocks() {
  return {
    blocks: [t('Of course. The fastest routes to a human are:\n\n• Book a 15-minute call with Priya, any slot on her calendar\n• Call ' + PHONE + '\n• Email ' + EMAIL + '\n\nOr I can take your details now and have her come back to you.')],
    chips: ['Show me the calendar', 'Take my details', 'Call ' + PHONE],
    action: { type: 'handoff' }
  };
}

/* The single entry point. Returns the blocks to render, the chips to offer, and
   the state to send back next turn. */
function respond(message, stateIn) {
  const state = Object.assign(freshState(), stateIn || {});
  state.lead = state.lead || {};
  state.slots = state.slots || {};
  const msg = String(message || '').trim().slice(0, 1000);
  state.turns = (state.turns || 0) + 1;
  state.transcript = (state.transcript || '').slice(-1500) + ' ' + msg;

  /* Campaign context arrives once, on the first turn, and is kept on the lead
     so buildLeadPayload can attribute it. */
  if (stateIn && stateIn.utm && !state.lead.utm) state.lead.utm = stateIn.utm;
  if (stateIn && stateIn.landingPage && !state.lead.landingPage) state.lead.landingPage = stateIn.landingPage;

  const reply = out => {
    const r = Object.assign({ blocks: [], chips: [], action: null, estimate: false }, out);
    // A calculator offered but not yet accepted survives exactly one turn, so
    // "yes" or "work it out" on the next message knows what it refers to.
    state.offerCalc = r.offerCalc || null;
    delete r.offerCalc;
    r.state = state;
    r.compliance = COMPLIANCE;
    return r;
  };

  if (!msg) return reply(greetingBlocks());

  // 0. Escape hatches always win, even mid-flow.
  if (RESET.test(msg)) {
    const keep = state.lead.submitted;
    Object.assign(state, freshState());
    state.lead.submitted = keep;
    return reply({ blocks: [t('No problem, cleared. What would you like to know?')], chips: ['How much can I borrow?', 'Stamp duty', 'Book a call'] });
  }

  // 1. Mid lead-capture: this message is an answer to the question just asked.
  if (state.flow === 'lead') {
    const step = state.step;
    const lead = state.lead;

    if (step === 'goal') {
      const hit = matchChoice(msg, GOALS) || GOALS.find(g => new RegExp(g.chip.split(' ')[0], 'i').test(msg));
      if (!hit) return reply(Object.assign(leadPrompt('goal', lead), { blocks: [t('Pick whichever is closest, or tell me in your own words.')] }));
      lead.goal = hit.goal;
      state.step = 'timing';
      return reply(leadPrompt('timing', lead));
    }
    if (step === 'timing') {
      const hit = matchChoice(msg, TIMINGS);
      if (!hit) {
        if (/\b(asap|now|immediately|urgent|straight away)\b/i.test(msg)) lead.timing = 'ASAP';
        else if (/\b(research|looking|browsing|early|just curious)\b/i.test(msg)) lead.timing = 'Just researching';
        else if (/\b(month|weeks?)\b/i.test(msg)) lead.timing = 'Within 1 month';
        else return reply(Object.assign(leadPrompt('timing', lead), { blocks: [t('Roughly is fine.')] }));
      } else lead.timing = hit.timing;
      state.step = 'deposit';
      return reply(leadPrompt('deposit', lead));
    }
    if (step === 'deposit') {
      const hit = matchChoice(msg, DEPOSITS);
      lead.deposit = hit || msg.slice(0, 60);
      state.step = 'incomeType';
      return reply(leadPrompt('incomeType', lead));
    }
    if (step === 'incomeType') {
      const hit = matchChoice(msg, INCOMES);
      lead.incomeType = hit || msg.slice(0, 60);
      state.step = 'name';
      return reply(leadPrompt('name', lead));
    }
    if (step === 'name') {
      const n = S.name(msg);
      if (!n) return reply({ blocks: [t('Sorry, I did not catch that. What name should Priya use?')], chips: [] });
      lead.name = n;
      lead.firstName = n.split(' ')[0];
      state.step = 'email';
      return reply(leadPrompt('email', lead));
    }
    if (step === 'email') {
      const e = S.email(msg);
      if (!e) return reply({ blocks: [t('That does not look like an email address. Could you type it again?')], chips: [] });
      lead.email = e;
      state.step = 'phone';
      return reply(leadPrompt('phone', lead));
    }
    if (step === 'phone') {
      const p = S.phone(msg);
      if (!p) return reply({ blocks: [t('I need an Australian mobile, starting 04. That is where the confirmation SMS goes.')], chips: [] });
      lead.phone = p;
      state.step = 'consent';
      return reply(leadPrompt('consent', lead));
    }
    if (step === 'consent') {
      const yn = S.yesNo(msg);
      if (yn === false) {
        state.flow = null; state.step = null;
        return reply({
          blocks: [t('That is completely fine, and nothing has been sent. I have not stored what you typed.\n\nYou are welcome to keep asking me questions, or call ' + PHONE + ' directly whenever you like.')],
          chips: ['How much can I borrow?', 'Stamp duty', 'What does a broker cost?']
        });
      }
      if (yn !== true) return reply(Object.assign(leadPrompt('consent', lead), { blocks: [t('I need a clear yes or no on this one before I can pass anything on.')] }));
      lead.consent = true;
      /* Verify the mobile before anything reaches GHL, the same gate the contact
         form and the funnel use. The engine stays side-effect free: it asks the
         HTTP layer to send the code, and that layer decides whether verification
         is switched on at all. */
      state.step = 'verify';
      return reply({ blocks: [], sendCode: lead.phone, chips: [] });
    }
    if (step === 'verify') {
      if (/\b(resend|new code|send.*again|didn'?t get|not received|nothing)\b/i.test(msg)) {
        return reply({ blocks: [], sendCode: lead.phone, resend: true, chips: [] });
      }
      const code = (msg.match(/\d/g) || []).join('');
      if (code.length !== 6) {
        return reply({
          blocks: [t('I need the 6 digits from the text message. If it has not arrived, say "resend".')],
          chips: ['Resend the code']
        });
      }
      return reply({ blocks: [], checkCode: code, chips: [] });
    }
  }

  // 2. Mid calculator: the message should be the slot we asked for.
  if (state.flow === 'calc' && state.calc) {
    const kind = state.calc;
    if (detectCalc(msg) && detectCalc(msg) !== kind) {
      state.calc = detectCalc(msg); state.slots = {};   // they switched tools
    }
    const slots = harvest(state.calc, msg, state.slots);
    // A bare number answering "how much deposit?" has no unit; take it anyway.
    const want = missingSlot(state.calc, slots);
    if (want && slots[want] == null) {
      const bare = msg.match(/^\s*\$?\s*([\d,.]+)\s*(k|m)?\s*$/i);
      if (bare) {
        let v = parseFloat(bare[1].replace(/,/g, ''));
        if (/k/i.test(bare[2] || '')) v *= 1000;
        else if (/m/i.test(bare[2] || '')) v *= 1000000;
        // "600" answering a price question means $600k, not $600.
        if (!bare[2] && v < 1000 && (want === 'value' || want === 'amount' || want === 'deposit' || want === 'income1')) v *= 1000;
        if (isFinite(v)) slots[want] = v;
      } else if (want === 'state') {
        const st = S.state(msg); if (st) slots.state = st;
      }
    }
    state.slots = slots;
    const still = missingSlot(state.calc, slots);
    if (still) {
      const a = CALCS[state.calc].ask[still];
      return reply({ blocks: [t(a.q), a.hint ? { type: 'hint', text: a.hint } : null].filter(Boolean), chips: a.chips || [] });
    }
    const res = runCalc(state.calc, slots);
    state.lead.calcSummary = CALCS[state.calc].label;
    state.flow = null; state.calc = null;
    return reply(res);
  }

  // 3. Explicit intents. Handoff is tested before booking, because "talk to a
  // human" matches both and the person asked for a person, not a calendar.
  if (HANDOFF.test(msg)) return reply(handoffBlocks());

  if (BOOK.test(msg) && !/\b(call me back|take my details)\b/i.test(msg)) {
    return reply(Object.assign(bookingBlocks(state.lead), { action: { type: 'booking', url: BOOKING_URL } }));
  }
  if (/\b(call me back|take my details|have her call|get priya to call)\b/i.test(msg)) {
    state.flow = 'lead'; state.step = 'goal';
    return reply(leadPrompt('goal', state.lead));
  }
  if (START_LEAD.test(msg)) {
    state.flow = 'lead'; state.step = 'goal';
    return reply(leadPrompt('goal', state.lead));
  }

  // 4. A calculator, either fully specified or needing one more answer.
  const kind = detectCalc(msg);

  /* "What is LMI" and "do credit cards affect borrowing power" want an
     explanation; "what is my LMI on a $700k place" wants the tool. So a
     calculator trigger carrying no figures defers to the knowledge base first,
     and only the entries that exist purely to launch a calculator (topic
     "calculator") fall through to the slot-filling flow. */
  if (kind && !S.money(msg).some(a => a.hadUnit || a.hadDollar || a.value >= 1000)) {
    const explain = R.answer(msg);
    if (explain && explain.doc.topic !== 'calculator') {
      const blocks = [t(explain.doc.a)];
      if (explain.doc.url) blocks.push({ type: 'link', href: explain.doc.url, label: 'More on this' });
      return reply({
        blocks,
        chips: ['Work it out for me', 'Book a call'],
        offerCalc: kind
      });
    }
  }
  /* The chip offered above, and the natural way people follow up. */
  if (!kind && state.offerCalc && /\b(work it out|calculate|run the numbers|do the math|show me|yes)\b/i.test(msg)) {
    const k = state.offerCalc;
    state.flow = 'calc'; state.calc = k; state.slots = {};
    const a = CALCS[k].ask[CALCS[k].slots[0]];
    return reply({ blocks: [t(a.q), { type: 'hint', text: a.hint }], chips: a.chips || [] });
  }

  if (kind) {
    const slots = harvest(kind, msg, {});
    const want = missingSlot(kind, slots);
    if (!want) {
      state.lead.calcSummary = CALCS[kind].label;
      return reply(runCalc(kind, slots));
    }
    state.flow = 'calc'; state.calc = kind; state.slots = slots;
    const a = CALCS[kind].ask[want];
    const intro = 'I can work that out. ';
    return reply({ blocks: [t(intro + a.q), a.hint ? { type: 'hint', text: a.hint } : null].filter(Boolean), chips: a.chips || [] });
  }

  // 5. Social.
  if (GREETING.test(msg) && msg.length < 30) return reply(greetingBlocks());
  if (BYE.test(msg)) {
    return reply({
      blocks: [t('No worries. If anything comes up later, Priya is on ' + PHONE + ' or you can book a 15-minute call any time. Good luck with it.')],
      chips: ['Book a call']
    });
  }
  if (THANKS.test(msg) && msg.length < 40) {
    return reply({ blocks: [t('Any time. Anything else you want to run through?')], chips: ['Book a call', 'How much can I borrow?'] });
  }

  // 6. Knowledge base.
  const hit = R.answer(msg);
  if (hit) {
    const blocks = [t(hit.doc.a)];
    if (hit.doc.url) blocks.push({ type: 'link', href: hit.doc.url, label: hit.doc.kind === 'page' ? 'Read more: ' + (hit.doc.source || 'on our site') : 'More on this' });
    const chips = ['Book a call'];
    for (const rel of hit.related.slice(0, 2)) if (rel.kind === 'faq' && rel.q.length < 52) chips.push(rel.q);
    return reply({ blocks, chips: chips.slice(0, 3) });
  }

  // 7. Nothing confident enough. Say so rather than guessing.
  const near = R.search(msg, 3).filter(x => x.doc.kind === 'faq' && x.doc.q.length < 60);
  const chips = near.map(x => x.doc.q).slice(0, 3);
  chips.push('Book a call');
  return reply({
    blocks: [t('I am not confident I have a good answer to that one, and I would rather say so than guess at something that affects your finances.\n\nPriya can answer it properly on a free 15-minute call. Or try me on something else, I am best on borrowing power, repayments, stamp duty, LMI, deposits, refinancing and how the process works.')],
    chips: chips.slice(0, 4)
  });
}

module.exports = { respond, COMPLIANCE, CALCS, GOALS, TIMINGS, BOOKING_URL, freshState, buildLeadPayload, detectCalc, harvest };
