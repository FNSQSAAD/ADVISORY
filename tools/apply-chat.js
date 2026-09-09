/* Adds the chat widget to every page: css/chat.css before </head>, js/chat.js
   before </body>. Idempotent, so it is safe to re-run after new pages are added.
   Run: node tools/apply-chat.js                                                */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const CSS = '<link rel="stylesheet" href="css/chat.css">';
const JS = '<script defer src="js/chat.js"></script>';

let changed = 0, already = 0;
for (const file of PAGES) {
  const p = path.join(ROOT, file);
  let html = fs.readFileSync(p, 'utf8');
  if (html.includes('css/chat.css') && html.includes('js/chat.js')) { already++; continue; }

  if (!html.includes('css/chat.css')) {
    // After the last stylesheet, so the widget's tokens cannot be overridden by
    // a site stylesheet loading later.
    const lastLink = html.lastIndexOf('<link rel="stylesheet"');
    const end = html.indexOf('>', lastLink) + 1;
    if (lastLink < 0) throw new Error('no stylesheet link in ' + file);
    html = html.slice(0, end) + '\n  ' + CSS + html.slice(end);
  }
  if (!html.includes('js/chat.js')) {
    const close = html.lastIndexOf('</body>');
    if (close < 0) throw new Error('no </body> in ' + file);
    html = html.slice(0, close) + '  ' + JS + '\n' + html.slice(close);
  }
  fs.writeFileSync(p, html);
  changed++;
  console.log('  + ' + file);
}
console.log(`chat widget: ${changed} pages updated, ${already} already had it, ${PAGES.length} total`);
