import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import orderRoutes from './routes/orderRoutes';
import electricianRoutes from './routes/electricianRoutes';
import adminRoutes from './routes/adminRoutes';
import { loginUser, validateToken } from './controllers/authController';

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`Server running on port ${PORT}`);
// });
