/* Phase 1 (a): turn the live site's own HTML into knowledge-base passages.
   fnsq.com.au serves exactly these files, so reading them from disk is the same
   scrape with none of the flakiness. Output: tools/kb-site.json
   Run: node tools/extract-site.js                                              */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Page -> the human label the bot uses when it cites a source.
const PAGES = {
  'index.html': ['Finance Square Group', '/'],
  'home-loans.html': ['Home loans and refinancing', '/home-loans.html'],
  'first-home-buyers.html': ['First home buyers', '/first-home-buyers.html'],
  'business-commercial-loans.html': ['Business and commercial loans', '/business-commercial-loans.html'],
  'asset-equipment-finance.html': ['Asset and equipment finance', '/asset-equipment-finance.html'],
  'personal-loans.html': ['Personal loans', '/personal-loans.html'],
  'about.html': ['About Finance Square', '/about.html'],
  'contact.html': ['Contact', '/contact.html'],
  'calculators.html': ['Calculators', '/calculators.html'],
  'terms.html': ['Terms, privacy and complaints', '/terms.html']
};

const ENT = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
  '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—', '&hellip;': '…',
  '&times;': '×', '&deg;': '°', '&trade;': '™', '&copy;': '©'
};

function decode(s) {
  return s
    .replace(/&(?:amp|lt|gt|quot|#39|rsquo|lsquo|ldquo|rdquo|nbsp|ndash|mdash|hellip|times|deg|trade|copy);/g, m => ENT[m])
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
}

function text(html) {
  return decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/* Strip everything that is chrome or code so headings from the nav/footer never
   become passages. */
function bodyOnly(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

const passages = [];
let id = 0;

function push(p) {
  const words = p.text.split(/\s+/).length;
  if (words < 8) return;                 // too short to answer anything
  p.id = 'site-' + (++id);
  p.text = p.text.slice(0, 1200);
  passages.push(p);
}

for (const [file, [label, url]] of Object.entries(PAGES)) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const body = bodyOnly(raw);

  // 1. <details class="faq"> pairs are already question/answer shaped: keep them whole.
  const faqRe = /<details[^>]*class="[^"]*faq[^"]*"[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  let m;
  while ((m = faqRe.exec(body))) {
    const q = text(m[1].replace(/<span class="pm">[\s\S]*?<\/span>/gi, ''));
    const a = text(m[2]);
    if (q && a) push({ type: 'faq', q, text: a, source: label, url });
  }

  // 2. Everything else: a heading plus the prose that follows it, up to the next heading.
  const stripped = body.replace(faqRe, ' ');
  const parts = stripped.split(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/i);
  // split() yields [pre, level, heading, chunk, level, heading, chunk, ...]
  for (let i = 1; i < parts.length; i += 3) {
    const heading = text(parts[i + 1]);
    const chunk = parts[i + 2] || '';
    if (!heading) continue;
    const blocks = [];
    const blockRe = /<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let b;
    while ((b = blockRe.exec(chunk))) {
      const t = text(b[2]);
      if (t.length > 25) blocks.push(t);
    }
    if (!blocks.length) continue;
    push({ type: 'section', q: heading, text: blocks.join(' ').slice(0, 1200), source: label, url });
  }
}

fs.writeFileSync(path.join(__dirname, 'kb-site.json'), JSON.stringify(passages, null, 1));
const byType = passages.reduce((a, p) => (a[p.type] = (a[p.type] || 0) + 1, a), {});
console.log('kb-site.json:', passages.length, 'passages', JSON.stringify(byType));
