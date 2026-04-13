import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  validateBookingData,
  isSlotTaken,
} from '../services/bookingService.js';
import { exportToExcel } from '../services/excelService.js';

// ── GET /api/appointments ──────────────────────────────────────────────────
export async function listAppointments(req, res) {
  try {
    const { date, status, phone, search } = req.query;
    const appointments = await getAppointments({ date, status, phone, search });
    res.json({ success: true, count: appointments.length, data: appointments });
  } catch (err) {
    console.error('[Appointments] listAppointments error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments.' });
  }
}

// ── GET /api/appointments/export ──────────────────────────────────────────
export async function exportAppointments(req, res) {
  try {
    const { date, status } = req.query;
    const appointments = await getAppointments({ date, status });
    await exportToExcel(appointments, res);
  } catch (err) {
    console.error('[Appointments] exportAppointments error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Export failed.' });
    }
  }
}

// ── GET /api/appointments/:id ─────────────────────────────────────────────
export async function getAppointment(req, res) {
  try {
    const appt = await getAppointmentById(parseInt(req.params.id));
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, data: appt });
  } catch (err) {
    console.error('[Appointments] getAppointment error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch appointment.' });
  }
}

// ── POST /api/appointments ────────────────────────────────────────────────
export async function createAppointmentHandler(req, res) {
  try {
    const { name, phone, service, date, time, notes } = req.body;
    const errors = validateBookingData({ name, phone: phone || 'admin', service, date, time });
    if (errors.length) return res.status(400).json({ success: false, errors });

    if (await isSlotTaken(date, time)) {
      return res.status(409).json({
        success: false,
        message: `The slot ${date} at ${time} is already booked.`,
      });
    }

    const appt = await createAppointment({ name, phone, service, date, time, notes });
    res.status(201).json({ success: true, data: appt });
  } catch (err) {
    console.error('[Appointments] createAppointment error:', err);
    res.status(500).json({ success: false, message: 'Failed to create appointment.' });
  }
}

// ── PUT /api/appointments/:id ─────────────────────────────────────────────
export async function updateAppointmentHandler(req, res) {
  try {
    const { name, service, date, time, status, notes } = req.body;

    // Double-booking check if date/time is changing
    if (date && time && await isSlotTaken(date, time)) {
      return res.status(409).json({
        success: false,
        message: `The slot ${date} at ${time} is already booked.`,
      });
    }

    const appt = await updateAppointment(parseInt(req.params.id), {
      name, service, date, time, status, notes,
    });
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, data: appt });
  } catch (err) {
    console.error('[Appointments] updateAppointment error:', err);
    res.status(500).json({ success: false, message: 'Failed to update appointment.' });
  }
}

// ── DELETE /api/appointments/:id ──────────────────────────────────────────
export async function deleteAppointmentHandler(req, res) {
  try {
    const appt = await cancelAppointment(parseInt(req.params.id));
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, message: 'Appointment cancelled.', data: appt });
  } catch (err) {
    console.error('[Appointments] deleteAppointment error:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel appointment.' });
  }
}
