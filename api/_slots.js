/* Slot extraction: pulling numbers, states and intent signals out of the way
   Australians actually type them. Shared by the calculator and lead flows.
   Underscore prefix keeps Vercel from routing this file as a function. */
'use strict';

const STATES = {
  VIC: ['vic', 'victoria', 'melbourne', 'geelong', 'ballarat', 'bendigo'],
  NSW: ['nsw', 'new south wales', 'sydney', 'newcastle', 'wollongong'],
  QLD: ['qld', 'queensland', 'brisbane', 'gold coast', 'cairns', 'townsville'],
  WA: ['wa', 'western australia', 'perth'],
  SA: ['sa', 'south australia', 'adelaide'],
  TAS: ['tas', 'tasmania', 'hobart', 'launceston'],
  ACT: ['act', 'canberra', 'australian capital territory'],
  NT: ['nt', 'northern territory', 'darwin', 'alice springs']
};

/* Money: $600k, 600k, 600,000, $1.2m, 1.2 million, 850000.
   Returns every amount found, largest-first context preserved in order. */
function money(text) {
  const out = [];
  const re = /\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million|mil)?\b/gi;
  let m;
  while ((m = re.exec(text))) {
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (!isFinite(n)) continue;
    const unit = (m[2] || '').toLowerCase();
    if (unit === 'k' || unit === 'thousand') n *= 1000;
    else if (unit === 'm' || unit === 'million' || unit === 'mil') n *= 1000000;
    // A bare number under 1000 with no unit is almost never a loan amount; it is
    // a rate, a term or a count. Callers decide, so record the raw form too.
    out.push({ value: n, raw: m[0].trim(), hadUnit: !!unit, hadDollar: /\$/.test(m[0]), index: m.index });
  }
  return out;
}

/* An interest rate: "6.24%", "at 6.2", "rate of 5.99". Percent sign wins; without
   one we only accept a plausible rate range so "30 years" is never read as 30%. */
function rate(text) {
  let m = text.match(/(\d{1,2}(?:\.\d{1,3})?)\s*(?:%|per\s*cent|percent)/i);
  if (m) { const v = parseFloat(m[1]); if (v > 0 && v < 25) return v; }
  m = text.match(/(?:rate|interest|at)\s*(?:of|is|=)?\s*(\d{1,2}\.\d{1,3})\b/i);
  if (m) { const v = parseFloat(m[1]); if (v > 0.5 && v < 25) return v; }
  return null;
}

/* A loan term in years. */
function years(text) {
  const m = text.match(/(\d{1,2})\s*(?:year|yr)s?\b/i);
  if (m) { const v = parseInt(m[1], 10); if (v >= 1 && v <= 40) return v; }
  return null;
}

function state(text) {
  const t = ' ' + text.toLowerCase().replace(/[^a-z ]/g, ' ') + ' ';
  // Longest phrase first so "new south wales" beats a stray "wa".
  const pairs = [];
  for (const [code, names] of Object.entries(STATES)) {
    for (const n of names) pairs.push([code, n]);
  }
  pairs.sort((a, b) => b[1].length - a[1].length);
  for (const [code, n] of pairs) if (t.includes(' ' + n + ' ')) return code;
  return null;
}

const YES = /\b(yes|yep|yeah|yup|sure|ok|okay|correct|right|true|i am|i do|definitely|absolutely|please|go ahead|sounds good|y)\b/i;
const NO = /\b(no|nope|nah|not really|negative|i'?m not|i am not|don'?t|do not|n)\b/i;

function yesNo(text) {
  const t = text.trim();
  if (YES.test(t) && !NO.test(t)) return true;
  if (NO.test(t)) return false;
  return null;
}

function firstHomeBuyer(text) {
  if (/\b(first home|first[- ]time|fhb|never owned|my first (place|house|home|property))\b/i.test(text)) return true;
  if (/\b(not (my|a) first|second home|next home|already own|investment|upgrad)/i.test(text)) return false;
  return null;
}

function investment(text) {
  return /\b(investment|investor|rental|rent it out|ip\b|negative gear)/i.test(text);
}

const EMAIL = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i;
/* Australian mobile, in the forms people type: 0412 345 678, +61 412 345 678,
   0412-345-678, 61412345678. Landlines are rejected because the GHL intake and
   the SMS confirmation both need a mobile. */
function phone(text) {
  const digits = text.replace(/[^\d+]/g, '');
  let m = digits.match(/(?:\+?61|0)(4\d{8})/);
  if (m) return '0' + m[1];
  return null;
}
function email(text) { const m = text.match(EMAIL); return m ? m[0] : null; }

/* A person's name from a free-text reply: strips the polite wrapper people put
   around it ("it's Sarah", "my name is Sarah Chen", "Sarah here"). */
function name(text) {
  let t = String(text).trim()
    .replace(/^(hi|hey|hello)[,! ]+/i, '')
    .replace(/^(my name('?s| is)|i'?m|it'?s|this is|name:?)\s+/i, '')
    .replace(/\s+(here|speaking)$/i, '')
    .replace(/[.!,]+$/, '')
    .trim();
  if (!/^[a-z'’\- ]{2,60}$/i.test(t)) return null;
  const words = t.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 4) return null;
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

module.exports = { money, rate, years, state, yesNo, firstHomeBuyer, investment, phone, email, name, STATES };
