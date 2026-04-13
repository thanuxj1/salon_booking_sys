# 💇‍♀️ WhatsApp Salon Booking AI System

An AI-powered WhatsApp chatbot that acts as a salon receptionist — books appointments, manages scheduling, prevents double-booking, and exports data to Excel.

---

## 🏗️ Project Structure

```
chatbot/
├── backend/              # Node.js/Express API + WhatsApp webhook
│   ├── src/
│   │   ├── app.js        # Express entry point
│   │   ├── config/       # PostgreSQL pool
│   │   ├── routes/       # WhatsApp + REST API routes
│   │   ├── controllers/  # Route handlers
│   │   ├── services/     # AI, booking, Excel logic
│   │   └── middleware/   # Twilio signature validation
│   ├── db/
│   │   ├── schema.sql    # Database schema
│   │   └── init.js       # Run once to create tables
│   ├── .env.example      # Copy to .env and fill in
│   └── package.json
│
└── admin-dashboard/      # Browser-based admin panel
    ├── index.html
    ├── style.css
    └── app.js
```

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
cd e:\chatbot\backend
npm install
```

### 2. Configure Environment

```bash
copy .env.example .env
# Now open .env and fill in your keys
```

### 3. Set Up the Database

You need PostgreSQL. Options:
- **Local**: Install PostgreSQL and create a database called `salon_booking`
- **Cloud (free)**: [neon.tech](https://neon.tech) — create a project and copy the connection string

Then run:
```bash
npm run db:init
```

### 4. Configure Twilio WhatsApp

1. Sign up at [twilio.com](https://twilio.com)
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. Note your sandbox number (e.g. `+14155238886`)
4. Use [ngrok](https://ngrok.com) to expose your local server:
   ```bash
   ngrok http 3000
   ```
5. Set the WhatsApp webhook URL in Twilio to:
   ```
   https://your-ngrok-url.ngrok.io/webhook/whatsapp
   ```

### 5. Start the Server

```bash
npm run dev
```

### 6. Open Admin Dashboard

Open `admin-dashboard/index.html` in your browser. It connects to `http://localhost:3000`.

---

## 📱 How the Chatbot Works

```
Customer sends WhatsApp message
         ↓
Twilio webhook → POST /webhook/whatsapp
         ↓
Load customer session from DB
         ↓
Send message + session to OpenAI (Bella the receptionist)
         ↓
Bella extracts: name, service, date, time
         ↓
All 4 fields collected? → Check double-booking
         ↓
Save appointment to PostgreSQL
         ↓
Reply to customer via Twilio
```

**Example conversation:**

```
You:   "Hi I need a haircut"
Bella: "Hi! I'm Bella from Glamour Salon. What's your name? 😊"
You:   "Sarah"
Bella: "Great, Sarah! When would you like your haircut?"
You:   "Tomorrow at 3pm"
Bella: "Perfect! Here's your booking:
        👤 Sarah | ✂️ Haircut | 📅 Apr 14 | ⏰ 15:00
        Reply YES to confirm or NO to change something."
You:   "Yes"
Bella: "✅ You're all set! See you tomorrow at 3pm 💇‍♀️"
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/whatsapp` | Twilio webhook |
| GET | `/api/appointments` | List all appointments |
| GET | `/api/appointments?date=2026-04-15` | Filter by date |
| GET | `/api/appointments?status=booked` | Filter by status |
| GET | `/api/appointments/:id` | Get single |
| POST | `/api/appointments` | Create (admin) |
| PUT | `/api/appointments/:id` | Update |
| DELETE | `/api/appointments/:id` | Cancel |
| GET | `/api/appointments/export` | Download Excel |
| GET | `/health` | Health check |

---

## 🤖 Special Customer Commands

| Message | Action |
|---------|--------|
| `Hi` / `Hello` | Start a new booking |
| `CANCEL` | Cancel their most upcoming appointment |
| `YES` | Confirm the booking summary |
| `NO` | Decline and re-enter details |

---

## 📊 Admin Dashboard Features

- **Stats cards**: Total, Today, Cancelled, Top Service
- **Appointments table**: Sortable, searchable, filterable by date/status
- **Calendar view**: Visual monthly overview with booking dots
- **Add booking**: Form to manually create appointments
- **Excel export**: One-click `.xlsx` download

**Keyboard shortcuts:**
- `Ctrl+E` — Export Excel
- `Ctrl+R` — Refresh data
- `Esc` — Close modal

---

## 🔑 Required API Keys

| Service | Purpose | Get key |
|---------|---------|---------|
| OpenAI | AI conversation (Bella) | [platform.openai.com](https://platform.openai.com) |
| Twilio | WhatsApp messaging | [twilio.com/console](https://www.twilio.com/console) |
| PostgreSQL | Database | Local or [neon.tech](https://neon.tech) |

---

## 📞 Voice Calls (Phase 2)

Voice calling will be added as a separate module using:
- **Twilio Voice** — Receive phone calls
- **Whisper** — Speech-to-text
- **ElevenLabs** — Text-to-speech (Bella's voice)

---

## 🛡️ Security Features

- Twilio webhook signature validation (prevents spoofed requests)
- Double-booking prevention (DB-level check)
- Environment variables for all secrets
- CORS configured for your dashboard origin
- Input validation on all API endpoints

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `express` | Web server |
| `openai` | AI conversation |
| `twilio` | WhatsApp + signature validation |
| `pg` | PostgreSQL client |
| `exceljs` | Excel export |
| `date-fns` | Date formatting |
| `dotenv` | Environment variables |
