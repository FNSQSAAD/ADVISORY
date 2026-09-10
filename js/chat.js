/* ============================================================
   FINANCE SQUARE - CHAT WIDGET

   Talks to /api/chat, which holds the whole brain. This file is only the
   surface: render blocks, keep the conversation state, and stay out of the way
   of the page's performance budget.

   Performance notes, because the site scores 98 on mobile and must keep doing so:
     - nothing here runs until the browser is idle
     - the panel's markup is built on first open, not on page load
     - the GoHighLevel booking iframe is only created when a booking block is
       actually rendered, so no third-party frame is loaded for a visitor who
       never asks to book
   ============================================================ */
(function () {
  'use strict';

  var API = '/api/chat';
  var STORE = 'fnsqChat';           // sessionStorage: survives page navigation
  var PHONE_TEL = 'tel:0450355604';

  var els = {};
  var state = null;                  // engine state, echoed back each turn
  var history = [];                  // [{who:'you'|'bot', blocks|text, estimate}]
  var busy = false;
  var built = false;
  var opened = false;

  /* ------------------------------------------------------------ helpers */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;      // textContent everywhere: no HTML from the server is ever parsed
    return n;
  }
  function svg(paths, extra) {
    var s = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
    var d = document.createElement('span');
    d.innerHTML = s;                              // our own literal markup, not user or server data
    if (extra) d.firstChild.setAttribute('class', extra);
    return d.firstChild;
  }
  var ICON = {
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    spark: '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
  };

  /* Read the UTM parameters off the landing URL once and keep them for the visit.
     Saved the first time we see them so attribution survives navigation: someone
     can arrive on an ad link, read two pages, then open the chat, and the lead
     still records which ad brought them. */
  var CAMP_KEY = 'fsqCampaign';
  function campaign() {
    try {
      var saved = sessionStorage.getItem(CAMP_KEY);
      if (saved) return JSON.parse(saved);
      var q = new URLSearchParams(location.search);
      var utm = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
        var v = q.get(k);
        if (v) utm[k.replace('utm_', '')] = v.slice(0, 200);
      });
      var click = q.get('fbclid') || q.get('gclid');
      if (click) utm.fbclid = click.slice(0, 200);
      if (!Object.keys(utm).length) return null;
      var rec = { utm: utm, landingPage: (location.pathname + location.search).slice(0, 300) };
      sessionStorage.setItem(CAMP_KEY, JSON.stringify(rec));
      return rec;
    } catch (e) { return null; }
  }

  function save() {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ state: state, history: history.slice(-40), opened: opened }));
    } catch (e) { /* private mode, or storage full: the widget still works, it just forgets */ }
  }
  function load() {
    try {
      var raw = sessionStorage.getItem(STORE);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  /* --------------------------------------------------------- rendering */

  /* The three disclaimers, behind a per-message affordance. The licence and the
     free-service line are also always visible in the footer strip below. */
  function disclosure(compliance, withEstimates) {
    var wrap = el('div', 'fq-disc');
    var btn = el('button');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.appendChild(svg(ICON.info));
    btn.appendChild(el('span', null, withEstimates ? 'Estimates only, important information' : 'Important information'));
    var pop = el('div', 'fq-pop');
    pop.setAttribute('role', 'note');

    var c = compliance || {};
    if (withEstimates && c.estimates) {
      var p0 = el('p'); p0.appendChild(el('b', null, 'About these figures'));
      p0.appendChild(document.createTextNode(c.estimates));
      pop.appendChild(p0);
    }
    if (c.service) pop.appendChild(el('p', null, c.service));
    if (c.licence) pop.appendChild(el('p', null, c.licence));

    btn.addEventListener('click', function () {
      var on = wrap.classList.toggle('fq-show');
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    wrap.appendChild(btn);
    wrap.appendChild(pop);
    return wrap;
  }

  function renderBlock(b) {
    if (b.type === 'text') {
      var d = el('div', 'fq-bubble', b.text);
      return d;
    }
    if (b.type === 'hint') return el('div', 'fq-hint', b.text);

    if (b.type === 'calc') {
      var box = el('div', 'fq-calc');
      box.appendChild(el('h3', null, b.title));
      var dl = el('dl');
      (b.rows || []).forEach(function (r) {
        dl.appendChild(el('dt', null, r[0]));
        dl.appendChild(el('dd', null, r[1]));
      });
      box.appendChild(dl);
      if (b.notes && b.notes.length) {
        var nb = el('div', 'fq-notes');
        b.notes.forEach(function (n) { nb.appendChild(el('p', null, n)); });
        box.appendChild(nb);
      }
      if (b.href) {
        var a = el('a', 'fq-more', 'Open the full calculator');
        a.href = b.href;
        box.appendChild(a);
      }
      return box;
    }

    if (b.type === 'card') {
      var c = el('div', 'fq-card');
      c.appendChild(el('h3', null, b.title));
      var ul = el('ul');
      (b.items || []).forEach(function (i) { ul.appendChild(el('li', null, i)); });
      c.appendChild(ul);
      return c;
    }

    if (b.type === 'link') {
      var row = el('div', 'fq-linkrow');
      var la = el('a', null, b.label || 'Read more');
      la.href = b.href;
      row.appendChild(la);
      return row;
    }

    if (b.type === 'booking') {
      /* Only reached when the visitor has asked to book, so the third-party
         frame never loads for anyone else. */
      var bk = el('div', 'fq-booking');
      bk.appendChild(el('h3', null, b.title || 'Book a call'));
      var f = document.createElement('iframe');
      f.src = b.url;
      f.title = 'Finance Square booking calendar';
      f.loading = 'lazy';
      f.setAttribute('scrolling', 'no');
      bk.appendChild(f);
      var nt = el('a', 'fq-newtab', 'Trouble with the calendar? Open it in a new tab');
      nt.href = b.url; nt.target = '_blank'; nt.rel = 'noopener';
      bk.appendChild(nt);
      return bk;
    }
    return null;
  }

  function addYou(text) {
    var m = el('div', 'fq-msg fq-you');
    m.appendChild(el('div', 'fq-bubble', text));
    els.log.appendChild(m);
    scroll();
  }

  function addBot(blocks, compliance, estimate) {
    var m = el('div', 'fq-msg fq-bot');
    (blocks || []).forEach(function (b) {
      var n = renderBlock(b);
      if (n) m.appendChild(n);
    });
    m.appendChild(disclosure(compliance, !!estimate));
    els.log.appendChild(m);
    scroll();
  }

  /* A chip is either a plain string, or {icon,label,send} so the button can stay
     short while the message it sends is a full sentence the router can read. */
  function setChips(list) {
    els.chips.textContent = '';
    (list || []).forEach(function (c) {
      var isObj = c && typeof c === 'object';
      var label = isObj ? c.label : c;
      var payload = isObj ? (c.send || c.label) : c;

      var b = el('button', isObj && c.icon ? 'fq-chip-icon' : null);
      b.type = 'button';
      if (isObj && c.icon) {
        var ic = el('span', 'fq-ico', c.icon);
        ic.setAttribute('aria-hidden', 'true');
        b.appendChild(ic);
      }
      b.appendChild(el('span', 'fq-lab', label));
      b.addEventListener('click', function () {
        if (busy) return;
        // A phone-number chip should dial, not be sent as a message.
        if (/^Call 0450/.test(payload)) { window.location.href = PHONE_TEL; return; }
        send(payload);
      });
      els.chips.appendChild(b);
    });
  }

  function scroll() {
    // rAF so the browser has laid the new node out before we measure.
    requestAnimationFrame(function () { els.log.scrollTop = els.log.scrollHeight; });
  }

  function typing(on) {
    if (on) {
      var t = el('div', 'fq-msg fq-bot fq-typing-wrap');
      var d = el('div', 'fq-typing');
      d.appendChild(el('span')); d.appendChild(el('span')); d.appendChild(el('span'));
      d.setAttribute('aria-label', 'Assistant is typing');
      t.appendChild(d);
      els.log.appendChild(t);
      els.typingNode = t;
      scroll();
    } else if (els.typingNode) {
      els.typingNode.remove();
      els.typingNode = null;
    }
  }

  /* ------------------------------------------------------------ network */
  /* `silent` opens the conversation without putting words in the visitor's
     mouth: the engine returns its greeting for an empty message, and nothing is
     rendered as something they said. */
  function send(text, silent) {
    text = String(text || '').trim();
    if ((!text && !silent) || busy) return;
    busy = true;
    els.send.disabled = true;
    els.input.value = '';
    autoGrow();
    if (!silent) {
      addYou(text);
      history.push({ who: 'you', text: text });
    }
    setChips([]);
    typing(true);

    /* Campaign context rides along with the state. It is captured once per visit
       and kept, so a lead that started from an ad still carries the ad's UTMs
       even if the visitor wandered onto three other pages first. */
    var outState = state;
    var camp = campaign();
    if (camp) {
      outState = Object.assign({}, state || {}, { utm: camp.utm, landingPage: camp.landingPage });
    }

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, state: outState })
    }).then(function (r) {
      return r.json();
    }).then(function (d) {
      typing(false);
      state = d.state || state;
      addBot(d.blocks, d.compliance, d.estimate);
      setChips(d.chips);
      history.push({ who: 'bot', blocks: d.blocks, compliance: d.compliance, estimate: d.estimate, chips: d.chips });

      if (d.action && d.action.type === 'lead_captured') {
        // Same analytics event the contact form and funnel fire, so chatbot leads
        // show up alongside them in GA4 rather than as an untracked channel.
        try { if (window.gtag) gtag('event', 'generate_lead', { lead_source: 'Website Chatbot' }); } catch (e) {}
      }
      save();
    }).catch(function () {
      typing(false);
      addBot([
        { type: 'text', text: 'I lost the connection there, sorry. Try that again in a moment, or call Priya on 0450 355 604.' }
      ], lastCompliance, false);
      setChips(['Try again']);
    }).then(function () {
      busy = false;
      els.send.disabled = false;
      /* Never focus after the silent opening greeting. Focusing scrolls the
         window to the input, which on the inline landing page drags a visitor
         past the headline they just clicked an ad to read. */
      if (opened && !silent) els.input.focus();
    });
  }

  /* Kept so an offline failure can still render the disclaimers. */
  var lastCompliance = {
    licence: 'Priya Dey, Credit Representative 543438 of BLSSA Pty Ltd, Australian Credit Licence 391237.',
    service: 'Our service to you is free, but other fees and lender charges may apply.',
    estimates: 'Estimates only. Normal lending criteria apply. Rates subject to change. Approved applicants only.'
  };

  /* --------------------------------------------------------------- UI */
  function autoGrow() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(110, els.input.scrollHeight) + 'px';
  }

  function build() {
    if (built) return;
    built = true;

    var panel = el('div');
    panel.id = 'fnsq-chat';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', 'Finance Square assistant');
    panel.hidden = true;

    /* header */
    var head = el('div', 'fq-head');
    var av = el('div', 'fq-avatar');
    av.appendChild(svg(ICON.spark));
    head.appendChild(av);
    var htx = el('div', 'fq-htx');
    htx.appendChild(el('h2', null, 'Finance Square assistant'));
    htx.appendChild(el('p', null, 'Questions, calculators and bookings'));
    head.appendChild(htx);
    var x = el('button', 'fq-x');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close chat');
    x.appendChild(svg(ICON.close));
    x.addEventListener('click', close);
    head.appendChild(x);
    panel.appendChild(head);

    els.log = el('div', 'fq-log');
    els.log.setAttribute('role', 'log');
    els.log.setAttribute('aria-live', 'polite');
    els.log.setAttribute('aria-relevant', 'additions');
    panel.appendChild(els.log);

    els.chips = el('div', 'fq-chips');
    panel.appendChild(els.chips);

    /* Deliberately a <div>, NOT a <form>.

       The GoHighLevel attribution script (link.msgsndr.com/js/external-tracking.js)
       is loaded on every page and creates a CRM contact from any form submission
       it observes. With a <form> here, every chat message the visitor sent
       produced an empty "external_form" ghost contact that then ran the whole
       New Lead Intake workflow - tags, consent stamp, broker alert, follow-up
       ladder - for a lead with nobody in it. Verified in production data: three
       ghosts appeared from localhost within four minutes of testing.

       No form element means no submit event means nothing for that script to
       capture. The real lead still reaches GHL, through /api/chat -> /api/lead. */
    var form = el('div', 'fq-form');
    els.input = el('textarea');
    els.input.rows = 1;
    els.input.placeholder = 'Ask me anything about your finance';
    els.input.setAttribute('aria-label', 'Type your question');
    els.input.addEventListener('input', autoGrow);
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(els.input.value); }
    });
    form.appendChild(els.input);

    els.send = el('button', 'fq-send');
    els.send.type = 'button';                 // never "submit": see the note above
    els.send.setAttribute('aria-label', 'Send');
    els.send.appendChild(svg(ICON.send));
    els.send.addEventListener('click', function () { send(els.input.value); });
    form.appendChild(els.send);
    panel.appendChild(form);

    var foot = el('div', 'fq-foot');
    var fp = el('p');
    fp.appendChild(document.createTextNode('Priya Dey, Credit Representative 543438 of BLSSA Pty Ltd, Australian Credit Licence 391237. Our service to you is free, but other fees and lender charges may apply. General information only, not credit advice. '));
    var pl = el('a', null, 'Privacy');
    pl.href = '/privacy-policy/';
    fp.appendChild(pl);
    foot.appendChild(fp);
    panel.appendChild(foot);

    document.body.appendChild(panel);
    els.panel = panel;

    // Replay anything from earlier in this browsing session.
    var saved = load();
    if (saved && saved.history && saved.history.length) {
      state = saved.state;
      history = saved.history;
      history.forEach(function (h) {
        if (h.who === 'you') addYou(h.text);
        else addBot(h.blocks, h.compliance, h.estimate);
      });
      var last = history[history.length - 1];
      if (last && last.who === 'bot') setChips(last.chips);
    }
  }

  function open() {
    build();
    opened = true;
    els.panel.hidden = false;
    // next frame so the transition has a start state to animate from
    requestAnimationFrame(function () { els.panel.classList.add('fq-open'); });
    els.launch.hidden = true;
    document.addEventListener('keydown', onEsc);
    if (!history.length) send('', true);
    else els.input.focus();
    save();
  }

  function close() {
    opened = false;
    els.panel.classList.remove('fq-open');
    document.removeEventListener('keydown', onEsc);
    var p = els.panel;
    setTimeout(function () { if (!opened) p.hidden = true; }, 220);
    els.launch.hidden = false;
    els.launch.focus();
    save();
  }

  function onEsc(e) { if (e.key === 'Escape') close(); }

  function launcher() {
    var b = el('button', 'fq-launch');
    b.type = 'button';
    b.setAttribute('aria-label', 'Open the Finance Square assistant');
    b.appendChild(svg(ICON.chat));
    b.appendChild(el('span', 'fq-launch-tx', 'Ask a question'));
    b.appendChild(el('span', 'fq-pip'));
    b.style.position = 'fixed';
    b.addEventListener('click', open);
    document.body.appendChild(b);
    els.launch = b;
    document.body.classList.add('fq-has-chat');
  }

  /* Inline mode. A page can host the conversation as its main content instead of
     a corner bubble by providing <div id="fnsq-chat-inline">. Used by chat.html,
     the landing page paid traffic arrives on, where the chat IS the page and a
     floating launcher would be absurd. */
  function inline(mount) {
    build();
    els.panel.classList.add('fq-inline', 'fq-open');
    els.panel.hidden = false;
    els.panel.removeAttribute('aria-modal');
    mount.appendChild(els.panel);
    // no launcher, no close button: there is nothing to close back to
    var x = els.panel.querySelector('.fq-x');
    if (x) x.remove();
    opened = true;
    if (!history.length) send('', true);
    save();
  }

  function boot() {
    if (document.getElementById('fnsq-chat') || document.querySelector('.fq-launch')) return;
    var mount = document.getElementById('fnsq-chat-inline');
    if (mount) return inline(mount);
    launcher();
    // Re-open automatically if the visitor was mid-conversation and navigated.
    var saved = load();
    if (saved && saved.opened && saved.history && saved.history.length) open();
  }

  /* Wait for idle so the widget never competes with the page's own paint. */
  function start() {
    if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 2500 });
    else setTimeout(boot, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
