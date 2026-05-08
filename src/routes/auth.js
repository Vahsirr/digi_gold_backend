const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validator');

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post(
    '/register',
    [
        body('fullName').trim().notEmpty().withMessage('Full name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('mobile').matches(/^[0-9]{10}$/).withMessage('Valid 10-digit mobile number is required'),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
        body('investmentPlan').isIn(['plan-a', 'plan-b', 'plan-c']).withMessage('Valid investment plan is required'),
        validate,
    ],
    authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
    '/login',
    [
        body('mobile').matches(/^[0-9]{10}$/).withMessage('Valid mobile number is required'),
        body('password').notEmpty().withMessage('Password is required'),
        validate,
    ],
    authController.login
);

/**
 * @route   POST /api/auth/otp/send
 * @desc    Send OTP to mobile
 * @access  Public
 */
router.post(
    '/otp/send',
    [
        body('mobile').matches(/^[0-9]{10}$/).withMessage('Valid mobile number is required'),
        validate,
    ],
    authController.sendOTP
);

/**
 * @route   POST /api/auth/otp/verify
 * @desc    Verify OTP and login
 * @access  Public
 */
router.post(
    '/otp/verify',
    [
        body('mobile').matches(/^[0-9]{10}$/).withMessage('Valid mobile number is required'),
        body('otp').matches(/^[0-9]{6}$/).withMessage('Valid 6-digit OTP is required'),
        validate,
    ],
    authController.verifyOTP
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authController.logout);

/**
 * @route   POST /api/auth/save-fcm-token
 * @desc    Save FCM token for push notifications
 * @access  Private
 */
const { authenticateToken } = require('../middleware/auth');
const { User } = require('../models');

router.post('/save-fcm-token', authenticateToken, async (req, res) => {
    const { fcmToken } = req.body;
    const userId = req.user.id;

    if (!fcmToken) {
        return res.status(400).json({ success: false, message: 'FCM token is required' });
    }

    try {
        await User.findByIdAndUpdate(userId, { fcmToken: fcmToken });

        console.log(`✅ FCM token saved for user: ${userId}`);
        res.json({ success: true, message: 'Token saved successfully' });
    } catch (error) {
        console.error('Error saving FCM token:', error);
        res.status(500).json({ success: false, message: 'Failed to save token' });
    }
});

router.post('/change-password', authenticateToken, authController.changePassword);
router.post('/toggle-2fa', authenticateToken, authController.toggleTwoFactor);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const { User } = require('../models');
        const user = await User.findById(req.user.id).select('-password -refreshToken');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: { user }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch user profile',
            error: error.message 
        });
    }
});

module.exports = router;
