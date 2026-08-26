import { Router } from 'express';
import {
  findDistance,
} from '../controllers/adminController';
import { loginAs } from '../controllers/authController';
import { requireAdmin } from '../middleware/roleCheckMiddleware';

const router = Router();

router.post(
  '/admin/login',
  loginAs('admin')
);
router.get(
  '/admin/findDistance',
  requireAdmin,
  findDistance
);

export default router;