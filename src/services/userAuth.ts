import {
  supabaseAdmin,
  supabaseAuth,
} from '../config/supabase';

export type UserRole = 'admin' | 'electrician';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const signInUser = async (
  email: string,
  password: string,
  role: UserRole,
) => {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', normalizedEmail)
    .eq('role', role)
    .maybeSingle();

  if (userError || !user) {
    console.error('Find user for login error:', userError);
    return { user: null, session: null, error: userError };
  }

  const { data: authUserData, error: authUserError } =
    await supabaseAdmin.auth.admin.getUserById(user.id);

  if (authUserError || !authUserData.user?.email) {
    console.error('Find Supabase Auth user error:', authUserError);
    return {
      user: null,
      session: null,
      error: authUserError ?? new Error('Supabase Auth email not found'),
    };
  }

  const { data: authData, error: authError } =
    await supabaseAuth.auth.signInWithPassword({
      email: authUserData.user.email,
      password,
    });

  if (authError || !authData.user || !authData.session) {
    console.error('Supabase Auth login error:', authError);
    return { user: null, session: null, error: authError };
  }

  if (authData.user.id !== user.id) {
    console.error('Auth user does not match users profile:', {
      authUserId: authData.user.id,
      profileUserId: user.id,
    });
    return { user: null, session: null, error: userError };
  }

  return {
    user,
    session: authData.session,
    error: null,
  };
};

export const saveLatestPushSubscription = async (
  userId: string,
  subscription: PushSubscriptionInput,
) => {
  if (
    !subscription?.endpoint ||
    !subscription.keys?.p256dh ||
    !subscription.keys?.auth
  ) {
    return {
      data: null,
      error: new Error('Invalid push subscription'),
    };
  }

  const { data, error } = await supabaseAdmin
    .from('push_notification')
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  return { data, error };
};
