import { Router } from 'express';
import { createOrder, getOrders,assignElectrician, orderCompleted } from '../controllers/orderController';

const router = Router();

router.get('/orders', getOrders);
router.post('/orders', createOrder);
router.patch(
  '/orders/:orderId/assign',
  assignElectrician,
);
router.patch('/orders/complete/:orderId',orderCompleted);
export default router;