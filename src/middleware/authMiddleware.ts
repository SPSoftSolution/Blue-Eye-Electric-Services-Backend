import {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  supabaseAdmin,
  supabaseAuth,
} from '../config/supabase';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: 'admin' | 'electrician';
    name?: string;
    email?: string;
    mobile_number?: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token is required',
      });
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization token',
      });
    }

    const { data: authData, error: authError } =
      await supabaseAuth.auth.getUser(token);

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role, name, email, mobile_number')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (userError || !user) {
      console.error('Get authenticated user profile error:', userError);
      return res.status(401).json({
        success: false,
        message: 'User profile not found',
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};