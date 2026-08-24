import { Router } from 'express';
import {
  findDistance,
} from '../controllers/adminController';
import { loginAs } from '../controllers/authController';

const router = Router();

router.post(
  '/admin/login',
  loginAs('admin')
);
router.get(
  '/admin/findDistance',
  findDistance
);

export default router;