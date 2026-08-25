import webpush from './pushNotificationService';
import { supabaseAdmin } from '../config/supabase';

interface SendNewOrderNotificationParams {
  title: string;
  message: string;
  type: string;
  orderId?: string;
}

export const sendNewOrderNotificationToAdmins = async ({
  title,
  message,
  type,
  orderId,
}: SendNewOrderNotificationParams) => {
  try {
    // console.log(
    //   'Sending new order push notification to admins...',
    // );

    const {
      data: admins,
      error: adminsError,
    } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (adminsError) {
      console.error('Get admin users error:', adminsError);
      return false;
    }

    if (!admins?.length) {
      return false;
    }

    const {
      data: subscriptions,
      error,
    } = await supabaseAdmin
      .from('push_notification')
      .select(
        'id, user_id, endpoint, p256dh, auth',
      )
      .in(
        'user_id',
        admins.map((admin) => admin.id),
      );

    if (error) {
      console.error(
        'Get admin push subscriptions error:',
        error,
      );

      return false;
    }

    // console.log(
    //   'Admin subscriptions found:',
    //   subscriptions?.length ?? 0,
    // );

    if (
      !subscriptions ||
      subscriptions.length === 0
    ) {
      // console.log(
      //   'No admin push subscriptions found',
      // );

      return false;
    }

    const payload = JSON.stringify({
      title,
      message,
      type,
      orderId,
      url: orderId
        ? `/admin/orders/${orderId}`
        : '/admin/orders',
    });

    // console.log(
    //   'Push payload:',
    //   payload,
    // );

    for (const subscription of subscriptions) {
      try {
        // console.log(
        //   'Sending notification to admin:',
        //   subscription.user_id,
        // );

        // console.log(
        //   'Sending to endpoint:',
        //   subscription.endpoint,
        // );

        const result =
          await webpush.sendNotification(
            {
              endpoint:
                subscription.endpoint,

              keys: {
                p256dh:
                  subscription.p256dh,

                auth:
                  subscription.auth,
              },
            },
            payload,
          );

        // console.log(
        //   'Admin push notification sent successfully',
        // );

        // console.log(
        //   'Push response:',
        //   result.statusCode,
        // );
      } catch (pushError: any) {
        console.error(
          'Admin push notification failed',
        );

        console.error(
          'Admin ID:',
          subscription.user_id,
        );

        console.error(
          'Status:',
          pushError?.statusCode,
        );

        console.error(
          'Message:',
          pushError?.message,
        );

        console.error(
          'Body:',
          pushError?.body,
        );

        console.error(
          'Headers:',
          pushError?.headers,
        );

        // Remove expired subscriptions
        if (
          pushError?.statusCode === 404 ||
          pushError?.statusCode === 410
        ) {
          const {
            error: deleteError,
          } = await supabaseAdmin
            .from(
              'push_notification',
            )
            .delete()
            .eq(
              'id',
              subscription.id,
            );

          // if (deleteError) {
          //   console.error(
          //     'Failed to delete expired admin subscription:',
          //     deleteError,
          //   );
          // } else {
          //   console.log(
          //     'Removed expired admin push subscription',
          //   );
          // }
        }
      }
    }

    return true;
  } catch (error) {
    console.error(
      'Send admin push notification error:',
      error,
    );

    return false;
  }
};