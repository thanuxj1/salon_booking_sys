import { Router } from 'express';
import { handleIncomingMessage, verifyWebhook } from '../controllers/whatsappCloudController.js';

const router = Router();

/**
 * Meta WhatsApp Cloud API Webhook
 * GET: Webhook verification challenge
 * POST: Incoming messages
 */
router.get('/', verifyWebhook);
router.post('/', handleIncomingMessage);

export default router;
