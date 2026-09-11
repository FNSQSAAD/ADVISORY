/* Direct GoHighLevel API path for website leads - the fallback that keeps leads
   alive when the inbound webhook is refused.

   WHY THIS EXISTS. The site posts every lead to a GHL "inbound webhook" trigger.
   That trigger is a GHL *premium action*, billed per execution against the
   agency wallet. On 2026-09-11 the wallet ran dry and the webhook began answering
   every request with:

       422 "Billing failure ... COMPANY does not have enough funds"

   so every contact-form, funnel and chatbot lead was rejected - after the visitor
   had already verified their mobile - for roughly 35 hours before anyone noticed.

   GHL's REST API is NOT a premium action. Upserting a contact and enrolling it
   in a workflow through the API succeeds with an empty wallet; the voice agent
   (fnsq-voice) has used exactly this path the whole time and kept working. So
   when the webhook fails, api/lead.js hands the lead here instead of dropping it.

   The webhook stays the PRIMARY path: when it works, nothing about the tested
   Receiver -> New Lead Intake chain changes. This only runs when it does not.

   Needs GHL_API_KEY (a Private Integration Token) and GHL_LOCATION_ID. Without
   them this module reports itself disabled and api/lead.js behaves as before. */
'use strict';

const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

// The same destinations the Website Form Receiver's "Create contact" action uses.
const FIELD = {
  timing: '8bkAWljOdPSjMdbPeZ3y',   // "How quickly do you need the funds?"
  goal: 'OGFSjP0wxo36YxwWuCMj'      // "What do you need finance for?"
};
const NEW_LEAD_INTAKE = '3482058f-746c-447a-b273-8b92c7f9ac65';

function enabled() {
  return !!(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

async function ghl(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + process.env.GHL_API_KEY,
      Version: VERSION,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error('GHL ' + method + ' ' + path + ' -> ' + res.status + ': ' + text.slice(0, 300));
    err.status = res.status;
    throw err;
  }
  return data;
}

/* Create or update the contact, add the enquiry as a note, and enrol it in New
   Lead Intake. `lead` is the same normalised body api/lead.js would have posted
   to the webhook. Returns { ok, contactId } or { ok:false, stage, error }. */
async function deliver(lead) {
  if (!enabled()) return { ok: false, stage: 'config', error: 'GHL_API_KEY / GHL_LOCATION_ID not set' };

  const customFields = [];
  if (lead.timing) customFields.push({ id: FIELD.timing, value: lead.timing });
  if (lead.goal) customFields.push({ id: FIELD.goal, value: lead.goal });

  let contactId;
  try {
    const up = await ghl('/contacts/upsert', {
      method: 'POST',
      body: {
        locationId: process.env.GHL_LOCATION_ID,
        firstName: lead.first_name,
        lastName: lead.last_name || undefined,
        email: lead.email,
        phone: lead.phone,
        source: lead.lead_source,
        customFields
      }
    });
    contactId = up && up.contact && up.contact.id;
    if (!contactId) return { ok: false, stage: 'upsert', error: 'no contact id returned' };
  } catch (e) {
    return { ok: false, stage: 'upsert', error: e.message };
  }

  /* The message carries the visitor's own words, the qualifying answers and any
     campaign attribution. The webhook path never stored it anywhere visible;
     here it becomes a note so the broker has the context before calling. */
  if (lead.message) {
    await ghl('/contacts/' + contactId + '/notes', {
      method: 'POST',
      body: { body: 'Website enquiry (captured via the API fallback because the inbound webhook was refused).\n\n' + lead.message }
    }).catch(e => console.warn('lead note failed', contactId, e.message));
  }

  /* Enrolment is what makes the lead actionable: welcome email, consent stamp,
     broker alert, opportunity, tags and the follow-up ladder all hang off New
     Lead Intake. Retried, because a contact that exists but is not enrolled is
     the silent failure this whole module exists to prevent. */
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await ghl('/contacts/' + contactId + '/workflow/' + NEW_LEAD_INTAKE, { method: 'POST', body: {} });
      return { ok: true, contactId };
    } catch (e) {
      if (attempt === 2) return { ok: false, stage: 'enrol', contactId, error: e.message };
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

module.exports = { enabled, deliver, NEW_LEAD_INTAKE, FIELD };
