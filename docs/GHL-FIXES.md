# GoHighLevel fix brief — Finance Square Group

Everything below was observed in the live account on 2026-09-09, not inferred.
Paste the block in `## The prompt` into a new session to have it worked through.

Location `JECqHy0cJP2aT9gJyo8q`. Key workflows:

| Workflow | ID |
|---|---|
| Website Form Receiver — Create Contact & Welcome-Back SMS | `3f3bf0fa-690c-45de-9550-82fae94621fb` |
| Website Contact Router — New Contact to Lead Intake | `cc203751-6122-4dc2-b38b-64a9fba73d57` |
| New Lead Intake — Welcome, Consent Stamp & Broker Alert | `3482058f-746c-447a-b273-8b92c7f9ac65` |
| Lead Follow-Up Ladder — 6 Calls, 5 Emails, 3 SMS over 30 Days | `b11bac05-…` |

Inbound webhook every website lead arrives on:
`https://services.leadconnectorhq.com/hooks/JECqHy0cJP2aT9gJyo8q/webhook-trigger/afa2d705-3d71-495d-81c7-88b8f7167b29`

---

## The prompt

```
You are working in the Finance Square Group GoHighLevel account
(location JECqHy0cJP2aT9gJyo8q) to fix a set of confirmed defects in the
website lead pipeline. Work through them in priority order. After each fix,
verify it with a real test lead and report the evidence, not the intention.

HOW TO WORK IN THIS ACCOUNT
- GHL deep links hard-404. Enter at https://app.gohighlevel.com/ and click
  through the SPA (sidebar ids are #sb_contacts, #sb_automation).
- The workflow list and builder render inside a cross-origin iframe.
  contentDocument does not reach it; Playwright's accessibility-tree find does.
- In the workflow builder, "Save action" only stages a change. You must then
  press the workflow-level Save (the button flips "Saved" -> "Save") or the
  server keeps the old version.
- The custom-value picker only lists keys from the trigger's captured sample,
  so timing/goal will not be offered. Type {{inboundWebhookRequest.<key>}} by
  hand; it resolves correctly at runtime.
- The contacts search index lags 3-5 minutes. Do not conclude a lead failed
  because it is not in search yet. Diff the workflow's "Total enrolled" counter
  instead, which is immediate.
- Test with mobile numbers from the ACMA drama range 0491 570 006-016 only.
  They cannot reach a real handset. This matters because GHL upserts contacts
  by PHONE as well as email, and the intake fires a real Twilio SMS.
  006, 007, 008, 009, 011, 012, 013 are already used; start at 014.
- Delete every test contact you create when you are done.

============================================================
P0 - LEADS CAN BE LOST
============================================================

1. THE ROUTER DEPENDS ON BROWSER TRACKING
   "Website Contact Router" has a single condition:
   Medium (Last Attribution) Is "External Form" -> add to New Lead Intake.
   None branch -> END.
   That medium is set by the GHL browser tracking script, not by the webhook.
   Any visitor whose browser blocks the script (ad blocker, privacy mode,
   script failure) creates a contact that hits None -> END: no tags, no consent
   record, no welcome email, no broker alert, no follow-up. Proven with two
   leads minutes apart: a server-side POST was dropped, a browser submission
   ran the full chain.
   Today this is only survivable because "Website Form Receiver" has an
   "Add to New Lead Intake" action that fires regardless. That single action is
   load-bearing for every lead in the business.
   FIX: make the Router key on something the webhook itself guarantees, not on
   attribution. Options, in order of preference:
     a) delete the Router entirely and rely on the Receiver's direct
        "Add to New Lead Intake" action (simplest, one path, no duplication);
     b) change the condition to contact Source is "external_form"; or
     c) have the Receiver set a tag or custom field and branch on that.
   Whichever you choose, verify BOTH a browser submission and a server-side
   curl to the webhook produce exactly one welcome email and one opportunity.

2. GHOST CONTACTS FROM THE TRACKING SCRIPT
   link.msgsndr.com/js/external-tracking.js creates a CRM contact from ANY form
   submission it observes on the site. When the form's fields have no name
   attributes it extracts nothing, producing an EMPTY contact (no name, email
   or phone, source "external_form", mediumId "Unidentified Form") that then
   runs the entire New Lead Intake chain: consent stamp, tags, broker alert,
   opportunity, follow-up ladder. Four appeared in four minutes during chatbot
   testing on 2026-09-09 and have since been deleted.
   The website side is fixed (the chat input is no longer a form element, and
   contact.html's fields were given name attributes on 2026-09-08), but GHL has
   no guard of its own.
   FIX: add a condition at the very top of "New Lead Intake":
   if Email is empty AND Phone is empty -> exit the workflow.
   Nothing downstream can act on a contact with no way to reach it, so this
   costs nothing and stops the pipeline being polluted the next time any form
   anywhere on the site is misconfigured.
   Then check for older ghosts: filter contacts on source "external_form" with
   a blank email, and delete what you find.

3. PHONE IS NEVER UPDATED ON A RETURNING CONTACT
   Proven 2026-09-09: a lead submitted 0450 355 604, the contact kept its old
   +61400000920, and the confirmation SMS went to that dead number. A lead who
   changes their number silently never gets contacted again by SMS.
   FIX: in "Website Form Receiver" -> "Create contact", confirm the Phone field
   maps to {{inboundWebhookRequest.phone}} and that the action is set to
   overwrite existing values rather than only fill blanks. Same check for Email
   and Name. Verify by submitting twice with the same email and a changed
   drama-range number, then confirming the contact shows the new number.

============================================================
P1 - FOLLOW-UP GAPS
============================================================

4. RETURNING LEADS NEVER RE-ENTER THE FOLLOW-UP LADDER
   "Lead Follow-Up Ladder" triggers on Tag Added: lead-new. A returning lead
   already carries lead-new, so adding it again fires no event and the ladder
   never runs. Verified: 3 live leads, ladder enrolment +0.
   Consequence: a past enquiry who comes back is never called or emailed again.
   FIX: either have New Lead Intake remove lead-new immediately before adding
   it, or give the ladder a second trigger that a returning lead does fire
   (for example the opportunity being created, or a "re-enquiry" tag).
   Make sure Allow Re-entry is ON, and verify a returning lead enrols.

4A. THE WELCOME EMAIL CALLS EVERY LEAD A FIRST HOME BUYER
   The automated welcome email (New Lead Intake) opens with:
     "thanks for reaching out to Finance Square about your first home"
   That sentence is hardcoded. It goes to refinancers, investors, commercial
   clients and people buying their fifth property, all of whom told you
   otherwise thirty seconds earlier. Confirmed live 2026-09-09: a lead who
   selected "Buying my next home" (goal field correctly recorded as
   "Home Loan") was emailed about "your first home".
   This matters more now than it did, because the chatbot captures a specific
   goal on every lead, so the contradiction is visible in the same record.
   FIX: branch the email on {{contact.what_do_you_need_finance_for}}
   (OGFSjP0wxo36YxwWuCMj), or make the line goal-neutral, e.g. "thanks for
   reaching out about your finance plans". Verify by running one lead per goal
   and reading the email each receives.

4B. THE EMAIL GREETS PEOPLE BY THEIR FULL NAME
   Subject: "Thanks for reaching out, Marcus Webb". Body: "Hi Marcus Webb,".
   The website posts a single full_name field, which the Receiver maps into
   First Name, so {{contact.first_name}} renders the whole name. Reads like a
   mail merge rather than a person.
   FIX: in "Website Form Receiver" -> "Create contact", split the incoming name
   (First Name = the first word of {{inboundWebhookRequest.full_name}}, Last
   Name = the remainder), or change the email to a neutral greeting. Note the
   contact form and the Get Started funnel post the same shape, so fixing it in
   the Receiver fixes all three entry points at once.

5. THE ROUTER ALSO ONLY FIRES ON "CONTACT CREATED"
   So it does nothing at all for returning leads (verified 0 of 3). This is
   subsumed by fix 1 if you take option (a).

============================================================
P2 - MESSAGING AND DELIVERABILITY
============================================================

6. OUTBOUND SMS IS INVISIBLE INSIDE GHL
   The intake sends SMS via a Custom Webhook to your own Twilio relay, not
   through GHL. So nothing appears in the contact's conversation thread, and
   GHL shows no delivery status. The only evidence a message was sent is the
   execution log's response body, and that is Twilio ACCEPTING the message
   ({"ok":true,"sid":"SM...","status":"queued"}), not the handset receiving it.
   Priya cannot see what a lead was told, and nobody notices failures.
   Re-confirmed 2026-09-09 on a live chatbot lead: the contact's conversation
   contains the welcome email and the opportunity activity, and nothing else.
   The SMS the workflow "sent" leaves no trace in the CRM at all.
   FIX: either connect the Twilio number to GHL and use the native SMS action,
   or have the relay post the message back into the contact's conversation so
   there is a record. State which you chose and show a message appearing in a
   conversation thread.

7. PRIYA'S OWN MOBILE HAS OPTED OUT OF SMS AT THE CARRIER
   +61450355604 texted STOP to the FNSQ Twilio number on 2026-08-31 05:21.
   Twilio now silently drops every outbound message to it. The workflow step
   still logs "Executed" and GHL's dndSettings still read "inactive", so the
   CRM gives no hint anything is wrong.
   FIX: text START or UNSTOP from that handset to 0495 040 500. This cannot be
   done from the CRM. Confirm by sending a test SMS to it afterwards.

8. SPF DOES NOT COVER GOOGLE WORKSPACE
   fnsq.com.au publishes:
     v=spf1 include:spf.leadconnectorhq.com include:mailgun.org ~all
   Mail is on Google Workspace, but _spf.google.com is missing, so staff mail
   sent from Gmail can fail SPF and land in spam.
   FIX: add include:_spf.google.com. Then re-check the record and send a test
   message to a Gmail address, confirming SPF=pass in the headers.

9. THE PUBLISHED COMPLAINTS ADDRESS BOUNCES
   info@fnsq.com.au returns 550. It is the complaints address in the site
   footer, in terms.html, and now in the chatbot's complaints answer. A
   regulated complaints channel that does not receive mail is a compliance
   problem, not just an inconvenience.
   FIX: restore the mailbox, or change the published address everywhere it
   appears (site footer, terms.html #complaints, GHL email templates, and
   tools/kb-faq.js in the website repo). Verify by sending mail to it and
   confirming receipt.

============================================================
P3 - DATA QUALITY
============================================================

10. CHATBOT LEADS CANNOT BE SEGMENTED
    The website chatbot classifies every lead it captures as chatbot-lead plus
    one of intent:purchase / intent:refinance / intent:commercial /
    intent:asset / intent:personal, but an inbound webhook cannot add tags, so
    those land as free text inside the message body. You cannot filter, report
    on, or automate against chatbot leads.
    FIX: in "Website Form Receiver", add an Add Tag action that sets
    "chatbot-lead" when {{inboundWebhookRequest.lead_source}} is
    "Website Chatbot", and map the intent from
    {{inboundWebhookRequest.goal}}. Verify by running a chat lead on
    fnsq.com.au and confirming real tags appear.

11. HOT LEAD TASK COPY CONTRADICTS ITS CONDITION
    The "HOT LEAD — call now" task body says "ASAP/within 1 month" but the
    branch that creates it matches only "ASAP". A "Within 1 month" lead is
    treated as warm while the task text implies otherwise.
    FIX: pick one. Either widen the branch to include "Within 1 month" or
    change the task wording to say ASAP only.

12. TWO REAL RECORDS WERE CLOBBERED BY PAST TESTING - RESTORE THEM
    a) dWNmqYClMpAJeHRgS2Af is a genuine quiz lead from 10 June 2025
       (quiz.fnsq.com.au, Keysborough VIC, PAYG, $75-100k income, $10-25k
       deposit, excellent credit, buying within 30 days). Test runs renamed it
       "GHL-VERIFY TaskFix Integration Test" and changed its email to
       financesqaure100+ghlverify4@gmail.com.
       RESTORE the email to financesqaure100@gmail.com. The original NAME is
       not recorded anywhere - ask the account owner what it should be.
       It also carries lead-new, lead-warm AND lead-hot simultaneously and a
       lead score of 85, all from testing. Clean those up.
    b) 63uP3bnXFd7zO0Ida61o holds the real address saad@fnsq.com.au but is
       named "GHL-TEST-C Noattribution" and carries the fake phone
       +61400000920 and all three lead tags. Give it the correct name and
       phone, or delete it if the address belongs on another record.
    Note: the GHL MCP contact-update tool is blocked by the auto-mode
    classifier in this environment, so these two need doing by hand in the UI.

13. DELETE THE REMAINING TEST CONTACTS
    Twenty-five left over from earlier sessions. All are safe to delete; none
    is a real enquiry. GHL keeps deleted contacts restorable for 2 months.
      yxvbnDhNRR3vp8wQIqtz  TEST LiveDomain Repro
      K3HbnN7vbKPkwBv4Fjkw  TEST LiveDomain Api
      R9AgmsBjBoShm6dmG6IO  TEST ApiHealth
      VjMqf66XmiCzuig3avge  TEST Footer Regression
      P38sxIfYbFS0uLkuLPtm  TEST WF Fix E Final
      LSWcvPExRyB6czAFJCa3  TEST WF Fix D Browser
      agbQ18naWOmKwSlN4CSb  TEST WF Fix C NoTracking
      eXCVUVnKYhUw7VqopLMP  TEST WF Chain B Browser
      cg2gAoANRgCPlPogJiUN  TEST WF Chain A
      DjErw0kZGnVGk00b3JSc  TEST LiveFunnel Please Ignore
      zOuov8vfEfWOEoOYHrS8  TEST LiveForm Please Ignore
      0M5KpjoEDiTqRZySEdjU  TEST Integration Check Please Ignore
      0RMoBwYfi9c4yxFgxPFD  TEST PhoneFix Final
      7IQoaZ1RqeIMHrDZtBPn  TEST Round3 C1Final
      GHshe8uwntVcK7WwQJCN  TEST Round3 AdvFinal
      tXejDBFAHWgqwLfUFkbk  TEST PhoneProbe Direct
      8VO508LNLRT3IeWuZFyN  TEST Round2 C1CTA
      S5zdV39aX1viCmyoCMjm  TEST Round2 AdvCTA
      lrai3NyyAu3F5UQiLDLd  TEST Lead C1Loan
      xF58Il5Q1W0iKGfYJld1  TEST Lead C1Buy
      zVIm1hdV4pLJg1PHrU38  WORKFLOW AUDIT Lead
      GQ1x0JLh74xhASCknqWX  Audit Two
      iPJI2OvIzRkyFgSfGX4U  Audit One
      PjFr9G3JOuuOIgFg8gBF  ghost contact, no email or phone
    Also remove any of these still sitting in the Lead Follow-Up Ladder, or
    they keep generating fake call tasks for Priya. The only reliable way to
    remove one is workflow -> Enrollment history tab -> the row's Actions
    column -> the "remove contact" button. Wait ~2.5s between clicks; the
    table re-renders slowly.
    Leave alone: "saad bashir", "saad and zoha", "saad and zoha integration
    test" - those are the owner's own records.

============================================================
ALREADY RESOLVED - DO NOT REDO
============================================================
- "LEGACY — Old Contact Form Webhook (superseded)" was set to Draft on
  2026-09-08. Its webhook 81c47238 was the old WordPress FHB form. Correct.
- The timing/goal branch works. /api/lead sends discrete timing and goal, the
  Receiver maps them into 8bkAWljOdPSjMdbPeZ3y and OGFSjP0wxo36YxwWuCMj, and
  ASAP correctly takes the hot branch. Verified again 2026-09-09 with a
  chatbot lead (hot) and a 1-3 months lead (warm).
- The "HOT LEAD — call now" task now fires; its ASSIGN TO was empty and is now
  set to priya D (fOpMlOk5W12XwjAMmeup).

WHEN YOU ARE DONE
Report each fix with the evidence that proves it: enrolment counter deltas,
the contact record after a test lead, execution-log entries, or the DNS record.
Say plainly if something could not be fixed and why.
```

---

## Why these and not others

Items 1, 2, 3, 4, 5 all cost real leads. 6, 7, 8, 9 mean a lead or a
complainant does not receive something they were told they would receive.
10, 11, 12, 13 are data quality, which matters mainly because it makes the
first nine harder to diagnose next time.

The chatbot itself is not implicated in any of them except item 2, whose
website-side cause was fixed before deploy (see `docs/CHATBOT.md`).
