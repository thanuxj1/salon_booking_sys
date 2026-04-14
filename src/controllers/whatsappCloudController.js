import axios from 'axios';
import { processMessage } from '../services/aiService.js';
import {
  loadSession,
  saveSession,
  clearSession,
  createAppointment,
  cancelAppointment,
  getAppointments,
  isSlotTaken,
  findAlternativeSlots,
  validateBookingData,
  updateAppointment,
} from '../services/bookingService.js';

/**
 * Helper to send a message via Meta WhatsApp Cloud API
 */
async function sendMessage(to, text) {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneId = process.env.PHONE_NUMBER_ID?.trim();
  // Using v25.0 as shown in your developer console
  const url = `https://graph.facebook.com/v25.0/${phoneId}/messages`;

  console.log(`[WhatsApp Cloud] 📤 Sending to ${to} via ID ${phoneId}...`);

  try {
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error(`[WhatsApp Cloud] ❌ Error sending message:`, JSON.stringify(err.response?.data || err.message, null, 2));
  }
}

/**
 * GET /webhook/whatsapp
 * Meta's webhook verification challenge
 */
export async function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WhatsApp Cloud] ✅ Webhook verified successfully');
    return res.status(200).send(challenge);
  } else {
    console.warn('[WhatsApp Cloud] ⚠️ Webhook verification failed');
    return res.sendStatus(403);
  }
}

// In-memory deduplication to prevent processing the same message twice
const processedMessageIds = new Set();

/**
 * POST /webhook/whatsapp
 * Handles incoming WhatsApp messages from Meta
 */
export async function handleIncomingMessage(req, res) {
  // ⚡ Send 200 OK IMMEDIATELY so Meta doesn't retry
  res.sendStatus(200);

  // Meta sends messages in a deeply nested structure
  const entry = req.body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) {
    return; // Status update (sent/delivered/read), ignore it
  }

  // Deduplicate — ignore if we already processed this message ID
  const msgId = message.id;
  if (processedMessageIds.has(msgId)) {
    console.log(`[WhatsApp Cloud] 🔁 Skipping duplicate message ${msgId}`);
    return;
  }
  processedMessageIds.add(msgId);
  // Clean up after 5 minutes to avoid memory leaks
  setTimeout(() => processedMessageIds.delete(msgId), 5 * 60 * 1000);

  const from = message.from;
  const body = message.text?.body?.trim();

  if (!body) return;

  console.log(`[WhatsApp Cloud] 📩 ${from}: "${body}"`);

  try {
    // ── Handle CANCEL command ─────────────────────────────────────────────────
    if (/^cancel$/i.test(body)) {
      const appointments = await getAppointments({ phone: from, status: 'booked' });
      if (appointments.length === 0) {
        await sendMessage(from, "I don't see any active bookings for your number. Would you like to make a new appointment? 😊");
      } else {
        const appt = appointments[0];
        await cancelAppointment(appt.id);
        await clearSession(from);
        await sendMessage(from, 
          `✅ Your ${appt.service} appointment on ${appt.date} at ${String(appt.time).slice(0,5)} has been cancelled.\n\n` +
          `We hope to see you again soon! Send "Hi" anytime to make a new booking. 💇‍♀️`
        );
      }
      return;
    }

    // ── Load session & context ────────────────────────────────────────────────
    const session = await loadSession(from);
    const existingAppointments = await getAppointments({ phone: from, status: 'booked' });
    const existingAppt = existingAppointments.length > 0 ? existingAppointments[0] : null;

    // ── Process with AI ───────────────────────────────────────────────────────
    const aiResult = await processMessage(body, session, existingAppt);
    const { reply, updatedSession, readyToBook, wantsCancel } = aiResult;

    if (wantsCancel) {
      await clearSession(from);
      await sendMessage(from, reply + '\n\nTo cancel, just reply CANCEL and I\'ll take care of it! 🙏');
      return;
    }

    if (readyToBook) {
      const data = updatedSession.data;

      const validationErrors = validateBookingData(data);
      if (validationErrors.length > 0) {
        await sendMessage(from, `Hmm, I noticed a small issue: ${validationErrors[0]} Let me help you fix that! Could you clarify?`);
        await saveSession(from, updatedSession);
        return;
      }

      const slotTaken = await isSlotTaken(data.date, data.time, existingAppt ? existingAppt.id : null);
      if (slotTaken) {
        const alternatives = await findAlternativeSlots(data.date, data.time);
        const altStr = alternatives.length
          ? `How about: ${alternatives.join(', ')}?`
          : 'We\'re fully booked that day — please try another date!';
        await sendMessage(from, `Oops! That time slot is already taken 😔 ${altStr}`);
        updatedSession.data.time = null;
        await saveSession(from, updatedSession);
        return;
      }

      if (existingAppt) {
        await updateAppointment(existingAppt.id, {
          name:    data.name,
          service: data.service,
          date:    data.date,
          time:    data.time,
        });
        console.log(`[Booking] ✏️ Updated appointment #${existingAppt.id} for ${data.name}`);
      } else {
        const appointment = await createAppointment({
          name:    data.name,
          phone:   from,
          service: data.service,
          date:    data.date,
          time:    data.time,
        });
        console.log(`[Booking] ✅ Created appointment #${appointment.id} for ${data.name}`);
      }

      await clearSession(from);
      await sendMessage(from, reply);
    } else {
      await saveSession(from, updatedSession);
      await sendMessage(from, reply);
    }

  } catch (err) {
    console.error('[WhatsApp Cloud] ❌ Error processing message:', err);
    await sendMessage(from, 
      "I'm so sorry, I'm having a little technical trouble right now 😔 " +
      "Please try again in a moment or call us directly."
    );
  }
}
