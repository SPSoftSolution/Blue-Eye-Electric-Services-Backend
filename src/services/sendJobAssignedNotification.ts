import webpush from './pushNotificationService';
import { supabase } from '../config/supabase';

interface sendJobAssignedNotificationParams {
  electricianId: string;
  title: string;
  message: string;
  type: string;
  orderId?: string;
}

export const sendJobAssignedNotification = async ({
  electricianId,
  title,
  message,
  type,
  orderId,
}: sendJobAssignedNotificationParams) => {
  try {
    console.log(
      'Sending push notification...',
    );

    console.log(
      'Electrician ID:',
      electricianId,
    );

    // Get subscriptions
    const {
      data: subscriptions,
      error,
    } = await supabase
      .from('push_notification')
      .select(
        'id, endpoint, p256dh, auth',
      )
      .eq(
      'user_id',
        electricianId,
      );

    if (error) {
      console.error(
        'Get push subscriptions error:',
        error,
      );

      return false;
    }

    console.log(
      'Subscriptions found:',
      subscriptions?.length ?? 0,
    );

    if (
      !subscriptions ||
      subscriptions.length === 0
    ) {
      console.log(
        'No push subscription found for electrician:',
        electricianId,
      );

      return false;
    }

    const payload = JSON.stringify({
      title,
      message,
      type,
      orderId,
      url: orderId
        ? `/electrician/orders/${orderId}`
        : '/electrician',
    });

    console.log(
      'Push payload:',
      payload,
    );

    for (const subscription of subscriptions) {
      try {
        console.log(
          'Sending to endpoint:',
          subscription.endpoint,
        );

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

        console.log(
          'Push notification sent successfully',
        );

        console.log(
          'Push response:',
          result.statusCode,
        );
      } catch (pushError: any) {
        console.error(
          'Push notification failed',
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
          } = await supabase
            .from(
              'push_notification',
            )
            .delete()
            .eq(
              'id',
              subscription.id,
            );

          if (deleteError) {
            console.error(
              'Failed to delete expired subscription:',
              deleteError,
            );
          } else {
            console.log(
              'Removed expired push subscription',
            );
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error(
      'Send push notification error:',
      error,
    );

    return false;
  }
};