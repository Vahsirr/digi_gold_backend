const express = require('express');
const router = express.Router();
const { Service } = require('../models');
const logger = require('../utils/logger');

/**
 * @route   GET /api/services
 * @desc    Get all services
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const { category, minPrice, maxPrice, isActive } = req.query;

        let where = {};

        // Filter by category
        if (category) {
            where.category = category;
        }

        // Filter by activity status
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        const services = await Service.findAll({ where });

        res.json({
            success: true,
            data: services,
            count: services.length,
        });
    } catch (error) {
        logger.error('Error fetching services:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

/**
 * @route   GET /api/services/:id
 * @desc    Get service by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
    try {
        const service = await Service.findByPk(req.params.id);

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found',
            });
        }

        res.json({
            success: true,
            data: service,
        });
    } catch (error) {
        logger.error('Error fetching service:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

/**
 * @route   POST /api/services
 * @desc    Create a new service
 * @access  Private (Admin Only)
 */
router.post('/', async (req, res) => {
    try {
        const { title, description, category, priceFiat, duration, isActive, discountPercentage } = req.body;

        // Simplified priceGold calculation (1g = 6000 fiat for business logic)
        const priceGold = priceFiat / 6000;

        const service = await Service.create({
            providerId: req.body.providerId || '00000000-0000-0000-0000-000000000000', // Default System Admin
            title,
            description,
            category,
            priceFiat,
            priceGold,
            duration,
            discountPercentage: discountPercentage || 0,
            isActive: isActive !== undefined ? isActive : true
        });

        res.status(201).json({
            success: true,
            data: service
        });
    } catch (error) {
        logger.error('Error creating service:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

/**
 * @route   PUT /api/services/:id
 * @desc    Update a service
 * @access  Private (Admin Only)
 */
router.put('/:id', async (req, res) => {
    try {
        const { title, description, category, priceFiat, duration, isActive, discountPercentage } = req.body;
        const service = await Service.findByPk(req.params.id);

        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        if (priceFiat) {
            service.priceGold = priceFiat / 6000;
        }

        await service.update({
            title: title || service.title,
            description: description || service.description,
            category: category || service.category,
            priceFiat: priceFiat || service.priceFiat,
            duration: duration || service.duration,
            discountPercentage: discountPercentage !== undefined ? discountPercentage : service.discountPercentage,
            isActive: isActive !== undefined ? isActive : service.isActive
        });

        res.json({
            success: true,
            data: service
        });
    } catch (error) {
        logger.error('Error updating service:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

/**
 * @route   DELETE /api/services/:id
 * @desc    Delete a service
 * @access  Private (Admin Only)
 */
router.delete('/:id', async (req, res) => {
    try {
        const service = await Service.findByPk(req.params.id);

        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        await service.destroy();

        res.json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting service:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

/**
 * @route   PUT /api/services/:id/toggle
 * @desc    Toggle service active status
 * @access  Private (Admin Only)
 */
router.put('/:id/toggle', async (req, res) => {
    try {
        const service = await Service.findByPk(req.params.id);

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found',
            });
        }

        service.isActive = !service.isActive;
        await service.save();

        res.json({
            success: true,
            data: service,
        });
    } catch (error) {
        logger.error('Error toggling service status:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;
