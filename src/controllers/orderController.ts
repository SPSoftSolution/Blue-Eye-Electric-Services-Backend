import crypto from 'crypto';
import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/authMiddleware';
import { sendJobAssignedNotification } from '../services/sendJobAssignedNotification';
import { sendNewOrderNotificationToAdmins } from '../services/sendNewOrderNotificationToAdmins';

export const createOrder = async (
  req: Request,
  res: Response,
) => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      latitude,
      longitude,
      inspection,
      service,
      serviceDate,
      serviceTime,
      description,
    } = req.body;

    // Validate required fields
    if (
      !customerName ||
      !customerPhone ||
      !customerAddress
    ) {
      return res.status(400).json({
        success: false,
        message: 'Required fields are missing',
      });
    }

    /*
     * Get uploaded photos
     */
    const uploadedFiles = req.files as
      | Express.Multer.File[]
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    const photos = Array.isArray(uploadedFiles)
      ? uploadedFiles
      : [
          ...(uploadedFiles?.photos ?? []),
          ...(uploadedFiles?.orderPhotos ?? []),
        ];

    /*
     * 1. Create order first
     * This gives us the order ID.
     */
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        latitude,
        longitude,
        service_date: serviceDate,
        service_time: serviceTime,
        description,
        status: 'pending',
        electrician_id: null,
        inspection,
        service_type: service,
        photo_urls: [],
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('Supabase order error:', orderError);

      return res.status(500).json({
        success: false,
        message: 'Failed to create order',
      });
    }

    const orderId = order.id;

    /*
     * 2. Upload photos using orderId in the path
     *
    * {orderId}/
    *   photo-uuid.jpg
    *   photo-uuid.png
     */
    const photoPaths: string[] = [];
    const photoUrls: string[] = [];

    for (const photo of photos) {
      const extension =
        photo.originalname
          .split('.')
          .pop()
          ?.toLowerCase() || 'jpg';

      const photoPath = `${orderId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('orderPhotos')
        .upload(photoPath, photo.buffer, {
          contentType: photo.mimetype,
          upsert: false,
        });


      if (uploadError) {
        console.error(
          'Order photo upload error:',
          uploadError,
        );

        /*
         * Delete already uploaded photos
         */
        if (photoPaths.length > 0) {
          await supabase.storage
            .from('orderPhotos')
            .remove(photoPaths);
        }

        /*
         * Delete order because photo upload failed
         */
        await supabase
          .from('orders')
          .delete()
          .eq('id', orderId);

        return res.status(500).json({
          success: false,
          message: 'Failed to upload order photos',
        });
      }

      photoPaths.push(photoPath);

      const { data: publicUrlData } =
        supabase.storage
          .from('orderPhotos')
          .getPublicUrl(photoPath);

      photoUrls.push(publicUrlData.publicUrl);
    }

    /*
     * 3. Update order with photo URLs
     */
    if (photoUrls.length > 0) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          photo_urls: photoUrls,
        })
        .eq('id', orderId);

      if (updateError) {
        console.error(
          'Order photo URL update error:',
          updateError,
        );

        /*
         * Remove uploaded photos
         */
        if (photoPaths.length > 0) {
          await supabase.storage
            .from('orderPhotos')
            .remove(photoPaths);
        }

        /*
         * Remove order
         */
        await supabase
          .from('orders')
          .delete()
          .eq('id', orderId);

        return res.status(500).json({
          success: false,
          message: 'Failed to save order photos',
        });
      }
    }

    /*
     * 4. Notify admins
     */
    sendNewOrderNotificationToAdmins({
      title: 'New Order Received',
      message: `New order received from ${customerName}`,
      type: 'NEW_ORDER',
      orderId,
    }).catch((error) => {
      console.error(
        'Background admin notification error:',
        error,
      );
    });

    return res.status(201).json({
      success: true,
      orderId,
      photoUrls,
    });
  } catch (error) {
    console.error('Create order error:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrders = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const {
      electricianId,
      status,
    } = req.query;

    let query = supabase
      .from('orders')
      .select(`
        id,
        electrician_id,
        customer_name,
        customer_phone,
        customer_address,
        latitude,
        longitude,
        service_date,
        service_time,
        service_type,
        description,
        photo_urls,
        status,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (req.user?.role === 'electrician') {
      query = query.eq('electrician_id', req.user.id);
    } else if (electricianId) {
      query = query.eq('electrician_id', electricianId);
    }

    // Filter by order status
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase get orders error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch orders',
      });
    }

    return res.status(200).json({
      success: true,
      orders: data,
    });
  } catch (error) {
    console.error('Get orders error:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const assignElectrician = async (
  req: Request,
  res: Response,
) => {
  try {
    const { orderId } = req.params;
    const { electricianId } = req.body;

    if (typeof orderId !== 'string' || !orderId) {
  return res.status(400).json({
    success: false,
    message: 'Invalid order ID',
  });
}
    if (typeof electricianId !== 'string' || !electricianId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid electrician ID',
      });
    }

    // Check order
    const {
      data: order,
      error: orderError,
    } = await supabase
      .from('orders')
      .select(
        'id, electrician_id, status, customer_name',
      )
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check electrician
    const {
      data: electrician,
      error: electricianError,
    } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', electricianId)
      .eq('role', 'electrician')
      .single();

    if (electricianError || !electrician) {
      return res.status(404).json({
        success: false,
        message: 'Electrician not found',
      });
    }

    // Assign electrician
    const {
      error: updateError,
    } = await supabase
      .from('orders')
      .update({
        electrician_id: electricianId,
        status: 'assigned',
      })
      .eq('id', orderId);

    if (updateError) {
      console.error(
        'Assign electrician error:',
        updateError,
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to assign electrician',
      });
    }

    // Notification details
    const title = 'New Job Assigned';

    const message =
      `You have been assigned a new job by Admin.`;

    const type = 'job_assigned';

    // Create notification in database
    const {
      error: notificationError,
    } = await supabase
      .from('notifications')
      .insert({
        electrician_id: electricianId,
        order_id: orderId,
        title,
        message,
        type,
        is_read: false,
      });

    if (notificationError) {
      console.error(
        'Notification creation error:',
        notificationError,
      );

      // Assignment succeeded,
      // so don't fail the request.
    }

    // Send Web Push notification
    await sendJobAssignedNotification({
      electricianId,
      title,
      message,
      type,
      orderId,
    });

    return res.status(200).json({
      success: true,
      message: 'Electrician assigned successfully',
    });
  } catch (error) {
    console.error(
      'Assign electrician error:',
      error,
    );

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const orderCompleted = async (
  req: Request,
  res: Response,
) => {
  try {
    const { orderId } = req.params;

    if (typeof orderId !== 'string' || !orderId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    // Check if order exists
    const {
      data: order,
      error: orderError,
    } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Prevent completing an already completed order
    if (order.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Order is already completed',
      });
    }

    // Update order status
    const {
      data,
      error: updateError,
    } = await supabase
      .from('orders')
      .update({
        status: 'completed',
      })
      .eq('id', orderId)
      .select('id, status')
      .single();

    if (updateError) {
      console.error(
        'Complete order error:',
        updateError,
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to complete order',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order completed successfully',
      order: data,
    });
  } catch (error) {
    console.error(
      'Order completed error:',
      error,
    );

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};