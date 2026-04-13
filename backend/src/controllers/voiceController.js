import twilio from 'twilio';
import { processMessage } from '../services/aiService.js';
import { loadSession, saveSession } from '../services/bookingService.js';

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Handles the initial call. Greets the user and starts recording their speech.
 */
export async function handleIncomingCall(req, res) {
  const twiml = new VoiceResponse();
  const salonName = process.env.SALON_NAME || 'Glamour Salon';

  twiml.say(`Hello! Welcome to ${salonName}. I am Bella, your AI assistant. How can I help you today?`);
  
  // Record the response
  twiml.gather({
    input: 'speech',
    action: '/webhook/voice/respond',
    speechTimeout: 'auto',
    language: 'en-US'
  });

  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * Processes the transcribed speech and responds with AI-generated voice.
 */
export async function handleVoiceResponse(req, res) {
  const twiml = new VoiceResponse();
  const userInput = req.body.SpeechResult;
  const from = req.body.From;
  const phone = from.replace('+', ''); // Clean phone number

  if (!userInput) {
    twiml.say("I'm sorry, I didn't catch that. Could you please repeat?");
    twiml.gather({ input: 'speech', action: '/webhook/voice/respond', language: 'en-US' });
  } else {
    try {
      const session = await loadSession(phone);
      const aiResult = await processMessage(userInput, session);
      
      // Save session
      await saveSession(phone, aiResult.updatedSession);

      // Play the AI response
      twiml.say(aiResult.reply);

      if (!aiResult.readyToBook) {
        // Keep the conversation going if not finished
        twiml.gather({
          input: 'speech',
          action: '/webhook/voice/respond',
          speechTimeout: 'auto',
          language: 'en-US'
        });
      } else {
        twiml.say("Thank you for your booking! Goodbye.");
        twiml.hangup();
      }
    } catch (err) {
      console.error('Voice AI Error:', err);
      twiml.say("I'm having some trouble right now. Please call back later.");
    }
  }

  res.type('text/xml');
  res.send(twiml.toString());
}
