/* Phase 1 (c): merge the scraped site passages and the authored FAQ layer into the
   single artefact the chatbot ships with, api/_kb.json, complete with the BM25
   statistics the retriever needs so no work happens at request time.
   Run: node tools/extract-site.js && node tools/build-kb.js                    */
const fs = require('fs');
const path = require('path');

const site = require('./kb-site.json');
const faq = require('./kb-faq.js');

const { tokenise, normalise } = require('../api/_tokens.js');

const docs = [];

for (const f of faq) {
  docs.push({
    id: 'faq-' + (docs.length + 1),
    kind: 'faq',
    q: f.q,
    a: f.a,
    topic: f.topic || 'general',
    url: f.url || null,
    // The question, its alternate phrasings and the hand tags are what a user
    // types; weight them by repeating them in the indexed text.
    norm: [f.q].concat(f.alt || []).map(normalise),
    // Headline terms: the question, its phrasings and the hand tags. A query that
    // matches only ONE word is only trusted if that word is in here, never if it
    // merely appears somewhere in the answer prose.
    title: [f.q, (f.alt || []).join(' '), (f.tags || []).join(' ')].join(' '),
    index: [f.q, (f.alt || []).join(' '), (f.tags || []).join(' '), f.q, (f.tags || []).join(' '), f.a].join(' ')
  });
}

for (const p of site) {
  docs.push({
    id: p.id,
    // Site FAQ accordions are useful but terser than the authored layer, so they
    // get their own kind and a smaller retrieval boost.
    kind: p.type === 'faq' ? 'sitefaq' : 'page',
    q: p.q,
    a: p.text,
    topic: 'site',
    url: p.url,
    source: p.source,
    norm: [normalise(p.q)],
    title: p.q,
    index: [p.q, p.q, p.text].join(' ')
  });
}

/* ---- BM25 statistics, precomputed ---- */
const df = Object.create(null);
let totalLen = 0;
for (const d of docs) {
  d.tokens = tokenise(d.index);
  d.len = d.tokens.length;
  totalLen += d.len;
  const tf = Object.create(null);
  for (const t of d.tokens) tf[t] = (tf[t] || 0) + 1;
  d.tf = tf;
  for (const t of Object.keys(tf)) df[t] = (df[t] || 0) + 1;
}
const avgLen = totalLen / docs.length;

// Inverted index: term -> [docIndex, termFrequency] pairs. Keeps scoring to the
// documents that share a term instead of walking all 180 every query.
const postings = Object.create(null);
docs.forEach((d, i) => {
  for (const [t, n] of Object.entries(d.tf)) {
    (postings[t] || (postings[t] = [])).push([i, n]);
  }
});

const out = {
  built: new Date().toISOString(),
  avgLen: Math.round(avgLen * 100) / 100,
  N: docs.length,
  df,
  postings,
  docs: docs.map(d => ({
    id: d.id, kind: d.kind, q: d.q, a: d.a, norm: d.norm,
    titleTerms: Array.from(new Set(tokenise(d.title))),
    topic: d.topic, url: d.url, source: d.source || null, len: d.len
  }))
};

const dest = path.join(__dirname, '..', 'api', '_kb.json');
fs.writeFileSync(dest, JSON.stringify(out));
const kb = fs.statSync(dest).size;
console.log(`api/_kb.json: ${out.N} docs (${faq.length} authored FAQ, ${site.length} site passages), ` +
  `${Object.keys(postings).length} terms, ${(kb / 1024).toFixed(0)}KB`);
