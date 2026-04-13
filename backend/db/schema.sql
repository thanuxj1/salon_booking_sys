-- ==========================================
-- Salon Booking AI — Database Schema
-- ==========================================

-- Conversation sessions (one per WhatsApp phone number)
CREATE TABLE IF NOT EXISTS sessions (
  phone        VARCHAR(30) PRIMARY KEY,
  state        JSONB       NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id           SERIAL      PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  phone        VARCHAR(30)  NOT NULL,
  service      VARCHAR(100) NOT NULL,
  date         DATE         NOT NULL,
  time         TIME         NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'booked',  -- booked | cancelled | completed
  notes        TEXT,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Index for double-booking checks
CREATE INDEX IF NOT EXISTS idx_appointments_date_time
  ON appointments(date, time)
  WHERE status = 'booked';

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_appointments_phone
  ON appointments(phone);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
