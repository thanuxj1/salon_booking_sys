import pool from '../config/database.js';
import { format } from 'date-fns';

/**
 * Check if a time slot is already booked (double-booking prevention).
 */
export async function isSlotTaken(date, time, excludeId = null) {
  let query = `SELECT id FROM appointments WHERE date = $1 AND time = $2 AND status = 'booked'`;
  const params = [date, time];

  if (excludeId) {
    query += ` AND id != $3`;
    params.push(excludeId);
  }

  query += ` LIMIT 1`;
  const result = await pool.query(query, params);
  return result.rows.length > 0;
}

/**
 * Find available times near a requested time on the same date.
 */
export async function findAlternativeSlots(date, requestedTime) {
  const openHour  = parseInt(process.env.SALON_OPENING_HOUR  || '9');
  const closeHour = parseInt(process.env.SALON_CLOSING_HOUR  || '19');

  // Get all booked times for that date
  const result = await pool.query(
    `SELECT time FROM appointments
     WHERE date = $1 AND status = 'booked'`,
    [date]
  );
  const bookedTimes = new Set(result.rows.map(r => r.time.slice(0, 5)));

  // Generate slots every 30 minutes
  const alternatives = [];
  for (let h = openHour; h < closeHour && alternatives.length < 3; h++) {
    for (const m of ['00', '30']) {
      const slot = `${String(h).padStart(2, '0')}:${m}`;
      if (!bookedTimes.has(slot)) alternatives.push(slot);
      if (alternatives.length >= 3) break;
    }
  }
  return alternatives;
}

/**
 * Validate booking data before inserting.
 */
export function validateBookingData(data) {
  const errors = [];

  if (!data.name?.trim())    errors.push('Name is required.');
  if (!data.service?.trim()) errors.push('Service is required.');
  if (!data.date)            errors.push('Date is required.');
  if (!data.time)            errors.push('Time is required.');

  // Date format check
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push(`Invalid date format: "${data.date}". Expected YYYY-MM-DD.`);
  }

  // Time format check
  if (data.time && !/^\d{2}:\d{2}$/.test(data.time)) {
    errors.push(`Invalid time format: "${data.time}". Expected HH:MM.`);
  }

  // Business hours check
  if (data.time) {
    const hour = parseInt(data.time.split(':')[0]);
    const open  = parseInt(process.env.SALON_OPENING_HOUR  || '9');
    const close = parseInt(process.env.SALON_CLOSING_HOUR  || '19');
    if (hour < open || hour >= close) {
      errors.push(`Time ${data.time} is outside business hours (${open}:00 – ${close}:00).`);
    }
  }

  // Date in the past check
  if (data.date) {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (data.date < today) {
      errors.push('Appointment date cannot be in the past.');
    }
  }

  return errors;
}

/**
 * Create a new appointment in the database.
 */
export async function createAppointment({ name, phone, service, date, time, notes }) {
  const result = await pool.query(
    `INSERT INTO appointments (name, phone, service, date, time, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'booked')
     RETURNING *`,
    [name.trim(), phone, service.trim(), date, time, notes || null]
  );
  return result.rows[0];
}

/**
 * Get all appointments with optional filters.
 */
export async function getAppointments({ date, status, phone, search } = {}) {
  const conditions = [];
  const values     = [];
  let   vi         = 1;

  if (date)   { conditions.push(`date = $${vi++}`);                         values.push(date); }
  if (status) { conditions.push(`status = $${vi++}`);                       values.push(status); }
  if (phone)  { conditions.push(`phone = $${vi++}`);                        values.push(phone); }
  if (search) { conditions.push(`name ILIKE $${vi++}`);                     values.push(`%${search}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT * FROM appointments ${where} ORDER BY date ASC, time ASC`,
    values
  );
  return result.rows;
}

/**
 * Get a single appointment by ID.
 */
export async function getAppointmentById(id) {
  const result = await pool.query(
    'SELECT * FROM appointments WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Update an appointment.
 */
export async function updateAppointment(id, updates) {
  const allowed = ['name', 'service', 'date', 'time', 'status', 'notes'];
  const fields  = Object.keys(updates).filter(k => allowed.includes(k) && updates[k] !== undefined);
  if (!fields.length) return null;

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values    = [id, ...fields.map(f => updates[f])];

  const result = await pool.query(
    `UPDATE appointments SET ${setClause}, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Cancel an appointment (soft delete).
 */
export async function cancelAppointment(id) {
  const result = await pool.query(
    `UPDATE appointments SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Load a session for a phone number.
 */
export async function loadSession(phone) {
  const result = await pool.query(
    'SELECT state FROM sessions WHERE phone = $1',
    [phone]
  );
  return result.rows[0]?.state || { data: {}, history: [] };
}

/**
 * Save a session for a phone number.
 */
export async function saveSession(phone, state) {
  await pool.query(
    `INSERT INTO sessions (phone, state, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (phone) DO UPDATE SET state = $2, updated_at = NOW()`,
    [phone, JSON.stringify(state)]
  );
}

/**
 * Clear a session (after booking completed or cancelled).
 */
export async function clearSession(phone) {
  await pool.query(
    'DELETE FROM sessions WHERE phone = $1',
    [phone]
  );
}
