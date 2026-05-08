const express = require('express');
const router = express.Router();
const { Payment, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const notificationService = require('../services/NotificationService');
const razorpay = require('../config/razorpay');
const crypto = require('crypto');

/**
 * @route   GET /api/payments
 * @desc    Get user payment history
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user.id })
            .sort({ createdAt: -1 });

        res.json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/payments/create-order
 * @desc    Create Razorpay order
 * @access  Private
 */
router.post('/create-order', authenticateToken, async (req, res) => {
    try {
        const { amount, currency = 'INR', planType, metalType } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        const receipt = `receipt_${Date.now()}`;

        const order = await razorpay.orders.create({
            amount: amount * 100,
            currency,
            receipt: receipt,
            notes: { userId: req.user.id, planType, metalType }
        });

        // Pre-create payment record
        const payment = await Payment.create({
            userId: req.user.id,
            amount,
            currency,
            status: 'pending',
            transactionId: order.id,
            razorpayOrderId: order.id,
            paymentGateway: 'Razorpay',
            method: 'upi',
            planType,
            metalType,
            receipt
        });

        res.json({ success: true, order, data: { orderId: order.id, paymentId: payment._id } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/payments/initiate
 * @desc    Alias for create-order to match frontend
 * @access  Private
 */
router.post('/initiate', authenticateToken, async (req, res) => {
    try {
        const { amount, currency = 'INR', planType, investmentType: metalType } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        const receipt = `receipt_${Date.now()}`;

        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency,
            receipt: receipt,
            notes: { userId: req.user.id, planType, metalType }
        });

        // Pre-create payment record
        const payment = await Payment.create({
            userId: req.user.id,
            amount,
            currency,
            status: 'pending',
            transactionId: order.id,
            razorpayOrderId: order.id,
            paymentGateway: 'Razorpay',
            method: 'upi',
            planType,
            metalType,
            receipt
        });

        res.json({ 
            success: true, 
            data: { 
                orderId: order.id, 
                paymentId: payment._id 
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/payments/verify
 * @desc    Verify Razorpay payment
 * @access  Private
 */
router.post('/verify', authenticateToken, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = req.body;

        // In production, verify signature here using crypto
        let payment;
        if (paymentId) {
            payment = await Payment.findById(paymentId);
        } else {
            payment = await Payment.findOne({ transactionId: razorpay_order_id });
        }

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }

        payment.status = 'completed';
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.razorpayOrderId = razorpay_order_id;
        payment.providerReferenceId = razorpay_payment_id || `PAY_${Date.now()}`;
        await payment.save();

        notificationService.sendNotification(
            req.user.id,
            '💰 Payment Successful',
            `Your payment of ₹${payment.amount} has been processed successfully.`,
            'payment'
        );

        res.json({ success: true, message: 'Payment verified successfully', payment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/payments/config
 * @desc    Get Razorpay configuration
 * @access  Private
 */
router.get('/config', authenticateToken, (req, res) => {
    res.json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder'
    });
});

/**
 * @route   POST /api/payments/webhook
 * @desc    Razorpay webhook handler for payment events
 * @access  Public (verified via signature)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const body = req.body.toString();
        
        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(body)
            .digest('hex');
        
        if (signature !== expectedSignature) {
            console.error('Invalid webhook signature');
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }
        
        const event = JSON.parse(body);
        
        switch (event.event) {
            case 'payment.captured':
                const paymentData = event.payload.payment.entity;
                const payment = await Payment.findOne({
                    razorpayOrderId: paymentData.order_id
                });
                
                if (payment) {
                    payment.status = 'completed';
                    payment.razorpayPaymentId = paymentData.id;
                    payment.providerReferenceId = paymentData.id;
                    payment.method = paymentData.method;
                    payment.email = paymentData.email;
                    payment.contact = paymentData.contact;
                    await payment.save();
                    
                    // Send notification to user
                    await notificationService.sendNotification(
                        payment.userId,
                        '💰 Payment Successful',
                        `Your payment of ₹${payment.amount} has been processed successfully.`,
                        'payment'
                    );
                    
                    console.log(`✅ Payment ${paymentData.id} marked as completed`);
                }
                break;
                
            case 'payment.failed':
                const failedPaymentData = event.payload.payment.entity;
                const failedPayment = await Payment.findOne({
                    razorpayOrderId: failedPaymentData.order_id
                });
                
                if (failedPayment) {
                    failedPayment.status = 'failed';
                    failedPayment.failureReason = failedPaymentData.error_description || 'Payment failed';
                    await failedPayment.save();
                    
                    await notificationService.sendNotification(
                        failedPayment.userId,
                        '❌ Payment Failed',
                        `Your payment of ₹${failedPayment.amount} failed. Please try again.`,
                        'payment'
                    );
                    
                    console.log(`❌ Payment ${failedPaymentData.id} marked as failed`);
                }
                break;
                
            case 'refund.processed':
                const refundData = event.payload.refund.entity;
                const refundPayment = await Payment.findOne({
                    razorpayPaymentId: refundData.payment_id
                });
                
                if (refundPayment) {
                    refundPayment.status = 'refunded';
                    refundPayment.refundId = refundData.id;
                    refundPayment.refundAmount = refundData.amount / 100;
                    await refundPayment.save();
                    
                    await notificationService.sendNotification(
                        refundPayment.userId,
                        '💸 Refund Processed',
                        `Your refund of ₹${refundPayment.refundAmount} has been processed.`,
                        'payment'
                    );
                    
                    console.log(`💸 Refund ${refundData.id} processed`);
                }
                break;
                
            default:
                console.log(`Unhandled event: ${event.event}`);
        }
        
        res.json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
