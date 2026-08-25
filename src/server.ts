import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';

import orderRoutes from './routes/orderRoutes';
import electricianRoutes from './routes/electricianRoutes';
import adminRoutes from './routes/adminRoutes';
import {
  forgotPassword,
  loginUser,
  validateToken,
} from './controllers/authController';
import { deleteExpiredOrderPhotos } from './helpers/deleteExpiredOrderPhotos';

const app = express();

app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json());

app.post('/api/auth/login', loginUser);
app.post('/api/auth/forgot-password', forgotPassword);
app.get('/api/auth/validate-token', validateToken);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'BlueEye Backend is running',
  });
});

app.use('/api', orderRoutes);
app.use('/api', electricianRoutes);
app.use('/api', adminRoutes);

const PORT = process.env.PORT || 4000;

cron.schedule('0 2 * * *', () => {
  deleteExpiredOrderPhotos();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`Server running on port ${PORT}`);
// });
