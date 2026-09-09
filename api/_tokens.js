/* The tokeniser, shared by the index builder (tools/build-kb.js) and the runtime
   retriever (api/_retrieve.js). It lives in one file because the two must agree
   exactly: any drift and a query term silently stops matching the index. */
'use strict';

const STOP = new Set(('a an the and or but if then than that this these those there here it its ' +
  'is am are was were be been being do does did doing done have has had having ' +
  'i me my mine we us our you your yours he she him her they them their ' +
  'of in on at to for with from by as about into over under after before out up down off ' +
  'so just very really quite too also only even much many more most some any all both each ' +
  'what whats which who whom whose when where why how whether ' +
  'can could will would shall should may might must ' +
  'get gets got go goes going gone come comes ' +
  'need needs want wants like likes know knows think ' +
  'make makes made take takes took give gives gave put puts use uses used using ' +
  'say says said tell tells told ask asks asked look looks ' +
  'work works working thing things way ways lot lots kind sort ' +
  'anything something everything nothing anyone someone everyone nobody ' +
  'please thanks thank hi hello hey yeah yes no not ok okay sure ' +
  'im ive id ill dont doesnt didnt cant wont isnt arent ' +
  'me mr mrs ms').split(/\s+/).filter(Boolean));

/* Light stemmer. Enough to make "refinancing" reach "refinance" and "repayments"
   reach "repayment" without pulling in a stemming library. */
function stem(w) {
  if (w.length <= 3) return w;
  return w
    .replace(/(ies)$/, 'y')
    .replace(/(sses|shes|ches|xes)$/, 'ss')
    .replace(/([^s])s$/, '$1')
    .replace(/(ing|ed)$/, '')
    .replace(/(ation|ings)$/, '')
    .replace(/e$/, '');
}

/* Stopwords are removed BOTH before and after stemming. Without the second pass
   "whats" survives the first filter, stems to "what", and then matches every
   page on the site whose heading is a question. */
function tokenise(s) {
  return String(s).toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9%$. ]+/g, ' ')
    .split(/\s+/)
    .filter(w => w && w.length > 1 && !STOP.has(w))
    .map(stem)
    .filter(w => w && w.length > 1 && !STOP.has(w));
}

function normalise(q) {
  return String(q).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { tokenise, stem, normalise, STOP };
