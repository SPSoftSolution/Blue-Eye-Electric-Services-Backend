import { Router } from 'express';
import { createOrder, getOrders,assignElectrician, orderCompleted } from '../controllers/orderController';
import { authenticate } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/roleCheckMiddleware';
import upload from '../middleware/uploadMiddleware';

const router = Router();

router.post(
  '/orders',
  upload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'orderPhotos', maxCount: 5 },
  ]),
  createOrder,
);

router.get('/orders', authenticate, getOrders);
router.patch(
  '/orders/:orderId/assign',
  authenticate,
  requireAdmin,
  assignElectrician,
);
router.patch(
  '/orders/complete/:orderId',
  authenticate,
  orderCompleted,
);
export default router;