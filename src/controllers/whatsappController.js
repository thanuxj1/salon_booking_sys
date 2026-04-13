import twilio from 'twilio';
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
} from '../services/bookingService.js';

const MessagingResponse = twilio.twiml.MessagingResponse;

/**
 * POST /webhook/whatsapp
 * Handles incoming WhatsApp messages from Twilio.
 */
export async function handleWhatsAppMessage(req, res) {
  const from    = req.body?.From;    // e.g. "whatsapp:+1234567890"
  const body    = req.body?.Body?.trim();

  if (!from || !body) {
    return res.status(400).send('Missing From or Body');
  }

  const startTime = Date.now();
  const phone = from.replace('whatsapp:', '');
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[WhatsApp][${timestamp}] 📩 ${phone}: "${body}"`);

  const twiml = new MessagingResponse();

  try {
    // ── Handle CANCEL command ─────────────────────────────────────────────────
    if (/^cancel$/i.test(body)) {
      const appointments = await getAppointments({ phone, status: 'booked' });
      if (appointments.length === 0) {
        twiml.message("I don't see any active bookings for your number. Would you like to make a new appointment? 😊");
      } else {
        // Cancel the most upcoming booking
        const appt = appointments[0];
        await cancelAppointment(appt.id);
        await clearSession(phone);
        twiml.message(
          `✅ Your ${appt.service} appointment on ${appt.date} at ${String(appt.time).slice(0,5)} has been cancelled.\n\n` +
          `We hope to see you again soon! Send "Hi" anytime to make a new booking. 💇‍♀️`
        );
      }
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    // ── Load session ──────────────────────────────────────────────────────────
    const session = await loadSession(phone);

    // ── Process with AI ───────────────────────────────────────────────────────
    const aiResult = await processMessage(body, session);
    const { reply, updatedSession, readyToBook, wantsCancel } = aiResult;

    if (wantsCancel) {
      // AI detected cancel intent — route to cancel flow
      await clearSession(phone);
      twiml.message(reply + '\n\nTo cancel, just reply CANCEL and I\'ll take care of it! 🙏');
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    if (readyToBook) {
      const data = updatedSession.data;

      // ── Validate booking data ─────────────────────────────────────────────
      const validationErrors = validateBookingData(data);
      if (validationErrors.length > 0) {
        twiml.message(`Hmm, I noticed a small issue: ${validationErrors[0]} Let me help you fix that! Could you clarify?`);
        await saveSession(phone, updatedSession);
        res.type('text/xml');
        return res.send(twiml.toString());
      }

      // ── Double-booking prevention ──────────────────────────────────────────
      const slotTaken = await isSlotTaken(data.date, data.time);
      if (slotTaken) {
        const alternatives = await findAlternativeSlots(data.date, data.time);
        const altStr = alternatives.length
          ? `How about: ${alternatives.join(', ')}?`
          : 'We\'re fully booked that day — please try another date!';
        twiml.message(
          `Oops! That time slot is already taken 😔 ${altStr}`
        );
        // Keep session but clear the time so they re-enter it
        updatedSession.data.time = null;
        await saveSession(phone, updatedSession);
        res.type('text/xml');
        return res.send(twiml.toString());
      }

      // ── Create appointment ────────────────────────────────────────────────
      const appointment = await createAppointment({
        name:    data.name,
        phone,
        service: data.service,
        date:    data.date,
        time:    data.time,
      });

      console.log(`[Booking] ✅ Created appointment #${appointment.id} for ${data.name}`);
      await clearSession(phone);

      twiml.message(reply);
    } else {
      // ── Still in conversation flow ────────────────────────────────────────
      await saveSession(phone, updatedSession);
      twiml.message(reply);
    }

  } catch (err) {
    console.error('[WhatsApp] ❌ Error processing message:', err);
    twiml.message(
      "I'm so sorry, I'm having a little technical trouble right now 😔 " +
      "Please try again in a moment or call us directly."
    );
  }

  res.type('text/xml');
  const responseXml = twiml.toString();
  const duration = Date.now() - startTime;
  console.log(`[WhatsApp][${new Date().toLocaleTimeString()}] ✅ Replied in ${duration}ms`);
  return res.send(responseXml);
}
