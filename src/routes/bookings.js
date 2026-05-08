const express = require('express');
const router = express.Router();
const { Booking } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const notificationService = require('../services/NotificationService');

/**
 * @route   GET /api/bookings
 * @desc    Get user bookings
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const bookings = await Booking.find({ clientId: req.user.id })
            .populate('serviceId', 'title description duration priceFiat priceGold category')
            .sort({ createdAt: -1 });

        const formatted = bookings.map(b => {
           const obj = b.toObject();
           if (obj.serviceId) {
               obj.service = obj.serviceId;
           }
           return obj;
        });

        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/bookings
 * @desc    Create a booking
 * @access  Private
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { serviceId, scheduledAt, notes } = req.body;

        const booking = await Booking.create({
            clientId: req.user.id,
            providerId: '65f1a2b3c4d5e6f7a8b9c0d1', // Admin ID fallback
            serviceId,
            scheduledAt,
            notes,
            status: 'pending'
        });

        notificationService.sendNotification(
            req.user.id,
            '🗓️ Booking Received',
            'Your appointment request has been sent for approval. We will notify you soon!',
            'booking'
        );

        res.status(201).json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/bookings/:id/cancel
 * @desc    Cancel a booking
 * @access  Private
 */
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, clientId: req.user.id });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        booking.status = 'cancelled';
        await booking.save();

        res.json({ success: true, message: 'Booking cancelled' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
