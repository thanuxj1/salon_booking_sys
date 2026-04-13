import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

import whatsappRoutes     from './routes/whatsapp.js';
import appointmentRoutes  from './routes/appointments.js';
import voiceRoutes        from './routes/voice.js';

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────

// Request Logger (The Doorbell)
app.use((req, res, next) => {
  console.log(`[Server] ${new Date().toLocaleTimeString()} - ${req.method} ${req.path}`);
  next();
});

// CORS
app.use(cors());

// Parse JSON and URL-encoded bodies for everyone
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Routes ───────────────────────────────────────────────────────────────────

app.use('/webhook/whatsapp', whatsappRoutes);
app.use('/webhook/voice',    voiceRoutes);
app.use('/api/appointments',  appointmentRoutes);

// Root route
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
      <h1>💇‍♀️ Salon Booking AI is Live!</h1>
      <p>Your backend is running perfectly.</p>
      <div style="margin-top: 20px;">
        <code style="background: #f4f4f4; padding: 5px 10px; border-radius: 4px;">WhatsApp Webhook: /webhook/whatsapp</code>
      </div>
      <div style="margin-top: 10px;">
        <code style="background: #f4f4f4; padding: 5px 10px; border-radius: 4px;">Dashboard API: /api/appointments</code>
      </div>
    </div>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    salon:   process.env.SALON_NAME || 'Glamour Salon',
    time:    new Date().toISOString(),
    version: '1.0.0',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[App] Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  💇‍♀️  ${(process.env.SALON_NAME || 'Salon Booking AI').padEnd(32)}║`);
  console.log(`║  🚀  Server running on port ${String(PORT).padEnd(11)}║`);
  console.log(`║  📱  WhatsApp: POST /webhook/whatsapp  ║`);
  console.log(`║  📋  API:      GET  /api/appointments  ║`);
  console.log(`║  💾  Export:   GET  /api/appointments/export ║`);
  console.log(`╚════════════════════════════════════════╝\n`);
});

export default app;
