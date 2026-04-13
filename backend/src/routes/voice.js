import { Router } from 'express';
import { handleIncomingCall, handleVoiceResponse } from '../controllers/voiceController.js';

const router = Router();

// Twilio Voice Webhooks
router.post('/', handleIncomingCall);
router.post('/respond', handleVoiceResponse);

export default router;
