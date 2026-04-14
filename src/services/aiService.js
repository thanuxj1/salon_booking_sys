import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { format, parse, isValid, parseISO } from 'date-fns';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define the JSON schema for Gemini's output
const schema = {
  type: SchemaType.OBJECT,
  properties: {
    message: { type: SchemaType.STRING, description: "Friendly reply to customer" },
    extracted: {
      type: SchemaType.OBJECT,
      properties: {
        name:    { type: SchemaType.STRING, nullable: true },
        service: { type: SchemaType.STRING, nullable: true },
        date:    { type: SchemaType.STRING, nullable: true, description: "YYYY-MM-DD" },
        time:    { type: SchemaType.STRING, nullable: true, description: "HH:MM" }
      },
      required: ["name", "service", "date", "time"]
    },
    ready_to_book:     { type: SchemaType.BOOLEAN },
    wants_cancel:      { type: SchemaType.BOOLEAN },
    wants_reschedule:  { type: SchemaType.BOOLEAN }
  },
  required: ["message", "extracted", "ready_to_book", "wants_cancel", "wants_reschedule"]
};

// Initialize the model with the schema
const model = genAI.getGenerativeModel({
  model: "gemini-flash-latest",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: schema,
    temperature: 0.4,
  },
});

const SALON_NAME = process.env.SALON_NAME || 'Glamour Salon';

const SERVICES = [
  'Haircut', 'Hair Coloring', 'Highlights', 'Blowout', 'Facial',
  'Manicure', 'Pedicure', 'Eyebrow Threading', 'Waxing', 'Keratin Treatment',
];

const BUSINESS_HOURS = {
  open:  parseInt(process.env.SALON_OPENING_HOUR || '9'),
  close: parseInt(process.env.SALON_CLOSING_HOUR || '19'),
  days:  'Monday – Saturday',
};

function buildSystemPrompt(collectedData, existingAppt) {
  const today = format(new Date(), 'EEEE, MMMM do yyyy');
  const dataStr = Object.entries(collectedData)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `  • ${k}: ${v}`)
    .join('\n') || '  (nothing collected yet)';

  const existingCtx = existingAppt
    ? `\nIMPORTANT: The customer already has an active booking:\n  • Name: ${existingAppt.name}\n  • Service: ${existingAppt.service}\n  • Date: ${existingAppt.date}\n  • Time: ${String(existingAppt.time).slice(0,5)}\nIf they greet you, mention this appointment. If they want to update/reschedule, extract all 4 standard fields (keeping unchanged ones the same) so we can do an update.`
    : '';

  return `You are Bella, a warm, professional receptionist at ${SALON_NAME}.
You help customers book appointments via WhatsApp.${existingCtx}

Today is: ${today}
Business hours: ${BUSINESS_HOURS.days}, ${BUSINESS_HOURS.open}:00 – ${BUSINESS_HOURS.close}:00

Available services:
${SERVICES.join(', ')}

Your goal is to collect:
  1. Full name
  2. Service
  3. Date
  4. Time (within business hours)

Currently collected:
${dataStr}

Rules:
- Ask for ONLY ONE missing piece at a time.
- 2-3 sentences max.
- Once all 4 fields are collected, present a BOOKING SUMMARY and ask for confirmation (YES/NO).
- Set ready_to_book=true ONLY after they explicitly say YES to the summary.`;
}

function mergeData(existing, extracted) {
  return {
    name:    existing.name    || extracted.name    || null,
    service: existing.service || extracted.service || null,
    date:    (existing.date && existing.date !== 'null') ? existing.date : (extracted.date || null),
    time:    (existing.time && existing.time !== 'null') ? existing.time : (extracted.time || null),
  };
}

function normaliseTime(timeStr) {
  if (!timeStr || timeStr === 'null') return null;
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const formats = ['h:mm a', 'h:mma', 'H:mm', 'ha', 'h a'];
  for (const fmt of formats) {
    try {
      const parsed = parse(timeStr, fmt, new Date());
      if (isValid(parsed)) return format(parsed, 'HH:mm');
    } catch { }
  }
  return timeStr;
}

function normaliseDate(dateStr) {
  if (!dateStr || dateStr === 'null') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  try {
    const parsed = parseISO(dateStr);
    if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd');
  } catch { }
  return dateStr;
}

export async function processMessage(userMessage, session, existingAppt = null) {
  const { data = {}, history = [] } = session;

  const collectedData = {
    name:    data.name    || null,
    service: data.service || null,
    date:    data.date    || null,
    time:    data.time    || null,
  };

  // Self-heal corrupted sessions by dropping bad segments
  const validHistory = history.filter(h => typeof h.content === 'string' && h.content.trim());

  const chat = model.startChat({
    history: validHistory.map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    })),
  });

  let result;
  try {
    result = await chat.sendMessage([
      { text: buildSystemPrompt(collectedData, existingAppt) },
      { text: userMessage }
    ]);
  } catch (err) {
    if (err.status === 429 || err.message?.includes('429') || err.message?.includes('exhausted') || err.message?.includes('quota')) {
      console.error('\n🚨 [GEMINI RATE LIMIT REACHED]: You have exceeded your Google Gemini API quota or free-tier limits! 🚨\n');
      return {
        reply: "Sorry, but our booking assistant is currently extremely busy! Please try again in an hour, or call the salon directly. 📞",
        updatedSession: session,
        readyToBook: false,
        wantsCancel: false,
        wantsReschedule: false
      };
    }
    throw err; // Re-throw other unexpected network errors
  }

  const rawText = result.response.text();
  console.log(`[AI Response]: ${rawText}`);
  
  let parsed;
  try {
    const cleanText = rawText.replace(/```(json)?\n?/gi, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleanText);
  } catch (err) {
    console.error('[AI Parse Error]: Failed to parse Gemini JSON output', err, 'Raw text:', rawText);
    // Provide a fallback structured payload to prevent full server crash
    parsed = {
      message: "I'm sorry, I misunderstood that. Could you clarify the details?",
      extracted: {},
      ready_to_book: false,
      wants_cancel: false,
      wants_reschedule: false
    };
  }

  if (parsed.extracted) {
    parsed.extracted.time = normaliseTime(parsed.extracted.time);
    parsed.extracted.date = normaliseDate(parsed.extracted.date);
  }

  const updatedData = mergeData(collectedData, parsed.extracted || {});

  const finalMessage = parsed.message || "I am available to assist you. What do you need?";

  const updatedHistory = [
    ...validHistory,
    { role: 'user',      content: userMessage || ' ' },
    { role: 'assistant', content: finalMessage },
  ].slice(-20);

  return {
    reply:   finalMessage,
    updatedSession: { data: updatedData, history: updatedHistory },
    readyToBook:      parsed.ready_to_book      || false,
    wantsCancel:      parsed.wants_cancel       || false,
    wantsReschedule:  parsed.wants_reschedule   || false,
  };
}

