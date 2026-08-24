import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
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

    const { data, error } = await supabase
      .from('orders')
      .insert({
        // order_id: orderId,

        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        latitude,
        longitude,
        service_date: serviceDate,
        service_time: serviceTime,
        description,
        status: 'pending',
        // No electrician assigned yet
        electrician_id: null,
        inspection: inspection,
        service_type: service
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase order error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to create order',
      });
    }

    // Send notification to all admins
    sendNewOrderNotificationToAdmins({
      title: 'New Order Received',
      message: `New order received from ${customerName}`,
      type: 'NEW_ORDER',
      orderId: data.id,
    }).catch((error) => {
      console.error(
        'Background admin notification error:',
        error,
      );
    });

    return res.status(201).json({
      success: true,
      orderId: data.id,
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
  req: Request,
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
        status,
        created_at
      `)
      .order('created_at', { ascending: false });

    // Filter by customer

    // Filter by electrician
    if (electricianId) {
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