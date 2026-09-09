/* BM25 retrieval over api/_kb.json.

   No LLM and no embedding service: the index is precomputed at build time, so a
   query is a few hundred multiply-adds and the whole thing answers in well under
   a millisecond with no external call that can fail.

   The interesting part is not the scoring, it is the refusal. A retrieval bot
   that answers everything is worse than useless on a finance site, so answer()
   applies three gates and returns null - meaning "say you do not know" - unless
   the match is genuinely convincing. */
'use strict';

const KB = require('./_kb.json');
const { tokenise, normalise } = require('./_tokens.js');

const K1 = 1.4;
/* Length normalisation. Held well below the usual 0.75 because the authored FAQ
   answers are several times longer than the site's one-line accordions, and a
   stronger penalty let a thin site snippet outrank the compliance-checked
   answer written for exactly that question. */
const B = 0.5;

const WEIGHT = { faq: 1.5, sitefaq: 1.05, page: 1.0 };

function search(query, limit) {
  const terms = tokenise(query);
  if (!terms.length) return [];

  const scores = new Map();
  const hits = new Map();          // doc -> count of distinct query terms matched
  const matchedTerms = new Map();  // doc -> which ones

  /* Only terms the corpus contains can ever be matched, so they are the only
     ones coverage should be measured against. Counting an out-of-vocabulary word
     against a document made "do you charge me anything" unanswerable. */
  const known = terms.filter(t => KB.postings[t]);
  const knownSet = new Set(known);

  for (const t of knownSet) {
    const post = KB.postings[t];
    const n = KB.df[t];
    // Standard BM25 idf, floored so a term present in most docs cannot go negative.
    const idf = Math.max(0.05, Math.log(1 + (KB.N - n + 0.5) / (n + 0.5)));
    for (const [i, tf] of post) {
      const len = KB.docs[i].len;
      const norm = tf * (K1 + 1) / (tf + K1 * (1 - B + B * len / KB.avgLen));
      scores.set(i, (scores.get(i) || 0) + idf * norm);
      hits.set(i, (hits.get(i) || 0) + 1);
      const mt = matchedTerms.get(i) || [];
      mt.push(t);
      matchedTerms.set(i, mt);
    }
  }
  if (!scores.size) return [];

  const distinct = Math.max(1, knownSet.size);
  const out = [];
  for (const [i, s] of scores) {
    const doc = KB.docs[i];
    // Coverage bonus: a doc matching all 3 meaningful words the visitor typed
    // should beat one that matches a single rare word many times.
    const coverage = hits.get(i) / distinct;
    const score = s * (0.55 + 0.45 * coverage) * (WEIGHT[doc.kind] || 1);
    out.push({
      doc, score, coverage,
      matched: hits.get(i), distinct,
      terms: matchedTerms.get(i),
      queryTerms: terms.length
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit || 4);
}

/* Exact-question shortcut. BM25 is weak on short queries made entirely of common
   words: "what loan should i get" reduces to the single term "loan", which is far
   too common to score. But that string is literally one of the FAQ's listed
   phrasings, so match it directly before scoring anything. */
function exact(query) {
  const n = normalise(query);
  if (n.length < 6) return null;
  let best = null;
  for (const doc of KB.docs) {
    if (!doc.norm) continue;
    for (const form of doc.norm) {
      if (!form || form.length < 6) continue;
      if (n !== form && !n.includes(form)) continue;
      const strength = form.length / n.length;       // how much of the query it explains
      if (!best || form.length > best.formLen) best = { doc, formLen: form.length, strength };
    }
  }
  if (!best || best.strength < 0.55) return null;
  return { doc: best.doc, score: 99, coverage: 1, margin: 99, related: [], exact: true };
}

function answer(query) {
  const direct = exact(query);
  if (direct) return direct;

  const r = search(query, 4);
  if (!r.length) return null;
  const top = r[0];

  /* Gate 1. One matched word is only enough when it is a headline word of that
     entry. "Can you write me a poem" matches the free-service FAQ on "writing",
     which appears once in its answer prose - not an answer to anything. */
  if (top.matched < 2 && !(top.doc.titleTerms || []).includes(top.terms[0])) return null;

  /* Gate 2. A question of three or more meaningful words that lands only one of
     them has not been understood. "Who won the grand final" matches "final". */
  if (top.queryTerms >= 3 && top.matched < 2) return null;

  /* Gate 3. Absolute strength, plus coverage. */
  const confident = top.score >= 4.5 && top.coverage >= 0.34;
  const decent = top.score >= 3.2 && top.coverage >= 0.5;
  if (!confident && !decent) return null;

  const runnerUp = r[1] ? r[1].score : 0;
  return {
    doc: top.doc,
    score: top.score,
    coverage: top.coverage,
    margin: runnerUp > 0 ? top.score / runnerUp : 99,
    // Related reading, only where it is still respectable.
    related: r.slice(1, 3).filter(x => x.score >= top.score * 0.45).map(x => x.doc)
  };
}

module.exports = { search, answer, exact, tokenise, meta: { built: KB.built, docs: KB.N } };
