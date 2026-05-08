const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ReferralService = require('../services/ReferralService');
const { User } = require('../models');

/**
 * @route   GET /api/referral/stats
 * @desc    Get referral statistics for authenticated user
 * @access  Private
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const stats = await ReferralService.getReferralStats(userId);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching referral stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch referral stats',
            error: error.message 
        });
    }
});

/**
 * @route   GET /api/referral/code
 * @desc    Get user's referral code
 * @access  Private
 */
router.get('/code', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                referralCode: user.referralCode
            }
        });
    } catch (error) {
        console.error('Error fetching referral code:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch referral code',
            error: error.message 
        });
    }
});

/**
 * @route   POST /api/referral/validate
 * @desc    Validate a referral code
 * @access  Private
 */
router.post('/validate', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Referral code is required'
            });
        }

        const user = await User.findOne({ referralCode: code.toUpperCase() });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Invalid referral code'
            });
        }

        res.json({
            success: true,
            data: {
                valid: true,
                referrerName: user.fullName
            }
        });
    } catch (error) {
        console.error('Error validating referral code:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to validate referral code',
            error: error.message 
        });
    }
});

module.exports = router;
