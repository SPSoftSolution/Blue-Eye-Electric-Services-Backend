import { Request, Response } from 'express';
import {
  PushSubscriptionInput,
  saveLatestPushSubscription,
  signInUser,
  UserRole,
} from '../services/userAuth';
import {
  supabaseAdmin,
  supabaseAuth,
} from '../config/supabase';

const login = async (
  req: Request,
  res: Response,
  role: UserRole,
) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const { user, session, error } = await signInUser(
      email,
      password,
      role,
    );

    if (error || !user || !session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (role === 'electrician' && user.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${user.status}, Contact Admin`,
        status: user.status,
      });
    }

    const subscription = req.body.pushSubscription ?? req.body.subscription;
    let notificationRegistered = false;

    if (subscription) {
      const { error: subscriptionError, data: savedSubscription } =
        await saveLatestPushSubscription(
          user.id,
          subscription as PushSubscriptionInput,
        );

      if (subscriptionError) {
        console.error('Save push subscription error:', subscriptionError);
      } else {
        notificationRegistered = Boolean(savedSubscription);
      }
    }

    const notification = {
      registered: notificationRegistered,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    };

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobile_number,
    };

    // if (role === 'electrician') {
    //   return res.status(200).json({
    //     success: true,
    //     message: 'Login successful',
    //     token: session.access_token,
    //     notification,
    //     electrician: {
    //       ...profile,
    //       status: user.status,
    //     },
    //   });
    // }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: session.access_token,
      notification,
      name: profile.name,
      // admin: profile,
    });
  } catch (error) {
    console.error(`${role} login error:`, error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const loginAs = (role: UserRole) => (
  req: Request,
  res: Response,
) => login(req, res, role);

export const loginUser = async (
  req: Request,
  res: Response,
) => {
  const { role } = req.body as { role?: UserRole };

  if (role !== 'admin' && role !== 'electrician') {
    return res.status(400).json({
      success: false,
      message: 'Role must be admin or electrician',
    });
  }

  return login(req, res, role);
};

export const validateToken = async (
  req: Request,
  res: Response,
) => {
  const authHeader = req.headers.authorization;
  const [scheme, token] = authHeader?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(200).json({
      valid: false,
      role: null,
    });
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  const userId = data.user?.id;

  if (error || !userId) {
    return res.status(200).json({
      valid: false,
      role: null,
    });
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  return res.status(200).json({
    valid: !userError && Boolean(user),
    role: user?.role ?? null,
  });
};
