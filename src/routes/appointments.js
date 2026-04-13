import { Router } from 'express';
import {
  listAppointments,
  getAppointment,
  createAppointmentHandler,
  updateAppointmentHandler,
  deleteAppointmentHandler,
  exportAppointments,
} from '../controllers/appointmentController.js';

const router = Router();

// NOTE: /export must be BEFORE /:id to avoid "export" being treated as an ID
router.get('/export', exportAppointments);

router.get('/',     listAppointments);
router.get('/:id',  getAppointment);
router.post('/',    createAppointmentHandler);
router.put('/:id',  updateAppointmentHandler);
router.delete('/:id', deleteAppointmentHandler);

export default router;
