/* Builds chat.html, the chat-first landing page paid traffic arrives on.

   It reuses contact.html's <head> verbatim (fonts, perf CSS, GA4 and the GHL
   attribution script) and the shared footer, so the page cannot drift from the
   rest of the site as those change. Only the body between them is authored here.

   Run: node tools/build-chat-page.js                                          */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const src = fs.readFileSync(path.join(ROOT, 'contact.html'), 'utf8');
const head = src.slice(0, src.indexOf('</head>'));
const footer = src.slice(src.indexOf('<footer'), src.indexOf('</footer>') + '</footer>'.length);

/* Swap the page-specific meta for this page's own. */
const chatHead = head
  .replace(/<title>[\s\S]*?<\/title>/,
    '<title>Chat with a Broker | Finance Square Group</title>')
  .replace(/<meta name="description"[\s\S]*?>/,
    '<meta name="description" content="Ask a question about your home loan, refinance, first home purchase or business finance and get a straight answer in seconds. No credit check, no obligation.">')
  .replace(/<meta name="keywords"[\s\S]*?>/,
    '<meta name="keywords" content="mortgage broker chat, home loan questions, borrowing power Australia, refinance chat">')
  // a paid landing page should not compete with itself in search
  + '\n<meta name="robots" content="noindex, follow">\n';

const body = `
<a class="skip" href="#chat">Skip to the chat</a>

<!-- Deliberately thin: a paid visitor has one job here. The logo goes home and
     the phone number is a conversion path, not a leak, so they are the only two
     links above the fold. -->
<header class="ch-top">
  <div class="wrap">
    <a class="ch-logo" href="index.html" aria-label="Finance Square Group home">
      <img src="assets/brand/fnsq-logo.svg" alt="Finance Square Group" width="150" height="34" fetchpriority="high">
    </a>
    <a class="ch-call" href="tel:0495040500">
      <span aria-hidden="true">&#9742;</span> 0495 040 500
    </a>
  </div>
</header>

<main>
  <section class="ch-hero">
    <div class="wrap">
      <p class="ch-eyebrow">Melbourne based &middot; working with clients Australia-wide</p>
      <h1>Ask us anything about your finance.</h1>
      <p class="ch-lede">
        Get a straight answer in seconds on borrowing power, repayments, stamp duty
        or your deposit. No credit check, no obligation, and a real broker whenever
        you want one.
      </p>

      <div id="chat" class="ch-panel">
        <!-- js/chat.js renders the conversation in here instead of as a
             corner bubble, because on this page the chat is the page. -->
        <div id="fnsq-chat-inline"></div>
        <noscript>
          <div class="ch-noscript">
            <p>The chat needs JavaScript. You can still reach us:</p>
            <p><a href="tel:0495040500">0495 040 500</a> &middot;
               <a href="mailto:info@fnsq.com.au">info@fnsq.com.au</a> &middot;
               <a href="contact.html">contact form</a></p>
          </div>
        </noscript>
      </div>

      <ul class="ch-trust">
        <li><strong>Free</strong> to you, paid by the lender on settlement</li>
        <li><strong>No credit check</strong> to ask a question or get a figure</li>
        <li><strong>MFAA</strong> member, ACL 391237</li>
      </ul>

      <p class="ch-fine">
        This chat gives general information and estimates only, not credit advice.
        Normal lending criteria apply. Rates are subject to change and apply to
        approved applicants only. Your details are handled under our
        <a href="/privacy-policy/">Privacy Policy</a> and
        <a href="/privacy-disclosure-consent/">Privacy Disclosure &amp; Consent</a>.
        Priya Dey, Credit Representative 543438 of BLSSA Pty Ltd,
        Australian Credit Licence 391237.
      </p>
    </div>
  </section>

  <section class="ch-what">
    <div class="wrap">
      <h2>What we can help with</h2>
      <div class="ch-grid">
        <a class="ch-card" href="home-loans.html"><span aria-hidden="true">&#127968;</span><b>Home loans</b><em>Buy your next home, or refinance the one you have.</em></a>
        <a class="ch-card" href="first-home-buyers.html"><span aria-hidden="true">&#128273;</span><b>First home</b><em>Deposit, schemes and what is actually realistic.</em></a>
        <a class="ch-card" href="business-commercial-loans.html"><span aria-hidden="true">&#128188;</span><b>Business &amp; commercial</b><em>Property, acquisition, working capital.</em></a>
        <a class="ch-card" href="asset-equipment-finance.html"><span aria-hidden="true">&#128663;</span><b>Asset &amp; equipment</b><em>Vehicles, trucks, plant and fit-outs.</em></a>
        <a class="ch-card" href="personal-loans.html"><span aria-hidden="true">&#128176;</span><b>Personal loans</b><em>Renovations, consolidation, one-offs.</em></a>
        <a class="ch-card" href="calculators.html"><span aria-hidden="true">&#128202;</span><b>Calculators</b><em>The same numbers the chat quotes you.</em></a>
      </div>
    </div>
  </section>
</main>

${footer}

<button class="to-top" id="toTop" aria-label="Back to top" hidden><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 15l6-6 6 6"/></svg></button>

<script defer src="js/footer.js"></script>
<script defer src="js/chat.js"></script>
</body>
</html>`;

const page = chatHead + '</head>\n<body class="ch-body">\n' + body + '\n';
fs.writeFileSync(path.join(ROOT, 'chat.html'), page);
console.log('chat.html written (' + Math.round(page.length / 1024) + 'KB)');
