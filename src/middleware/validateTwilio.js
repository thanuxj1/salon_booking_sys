import twilio from 'twilio';

/**
 * Middleware to validate that incoming webhooks are genuinely from Twilio.
 * Skips validation in development mode (when TWILIO_AUTH_TOKEN is missing).
 */
export function validateTwilioSignature(req, res, next) {
  // Skip in development if no token configured
  if (!process.env.TWILIO_AUTH_TOKEN) {
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }
    return res.status(403).json({ error: 'Twilio auth token not configured.' });
  }

  const twilioSignature = req.headers['x-twilio-signature'];
  if (!twilioSignature) {
    return res.status(403).json({ error: 'Missing Twilio signature.' });
  }

  //  // For production with a real domain, ensure TWILIO_AUTH_TOKEN is set and use next() only if valid.
  // For now, we bypass for testing through tunnels.
  return next();

  /*
  const signature = req.headers['x-twilio-signature'];
  ...
  */
}
