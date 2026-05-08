const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { User, Booking, Notification, GoldLedger, SilverLedger, GoldInvestment, SilverInvestment, InvestmentPlan } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const GoldEngine = require('../services/GoldEngine');
const SilverEngine = require('../services/SilverEngine');

const os = require('os');

// Ensure upload directory exists
const isVercel = process.env.VERCEL === '1';
const uploadDir = isVercel 
    ? path.join(os.tmpdir(), 'uploads')
    : path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
        console.warn('⚠️ Could not create upload directory:', err.message);
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, req.user.id + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/users/dashboard
 * @desc    Get dashboard data
 * @access  Private
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userBookings = await Booking.find({ clientId: userId }).populate('serviceId', 'title');
        const activeBookings = userBookings.filter(b => b.status === 'in_progress' || b.status === 'pending');

        const goldInvestments = await GoldInvestment.find({ userId, status: 'active' });
        
        // Calculate overdue status
        const overdueAlerts = goldInvestments
            .filter(inv => inv.planType === 'plan-a' && inv.nextInstallmentDate)
            .map(inv => {
                const dueDate = new Date(inv.nextInstallmentDate);
                const graceLimit = new Date(dueDate.getTime() + (10 * 24 * 60 * 60 * 1000));
                const isOverdue = new Date() > graceLimit;
                return isOverdue ? { 
                    id: inv._id, 
                    message: `Gold Savings Scheme Payment Overdue! Due date was ${dueDate.toLocaleDateString()}.`,
                    dueDate: inv.nextInstallmentDate
                } : null;
            })
            .filter(alert => alert !== null);

        res.json({
            success: true,
            data: {
                user: {
                    name: user.fullName || 'User',
                    goldBalance: user.goldBalance || 0,
                    silverBalance: user.silverBalance || 0,
                    portfolioValue: user.portfolioValue || 0,
                    totalInvested: user.totalInvested || 0,
                    lifetimeReturns: user.lifetimeReturns || 0,
                    investmentPlan: user.investmentPlan,
                },
                stats: {
                    activeBookings: activeBookings.length,
                    totalBookings: userBookings.length,
                    savingsPlanProgress: 60,
                    returnsPercentage: user.totalInvested > 0 ? ((user.lifetimeReturns / user.totalInvested) * 100).toFixed(2) : 0,
                },
                goldPrice: {
                    price: GoldEngine.getCurrentPrice(),
                    unit: 'gram',
                    currency: 'INR'
                },
                silverPrice: {
                    price: SilverEngine.getCurrentPrice(),
                    unit: 'gram',
                    currency: 'INR'
                },
                recentBookings: userBookings.slice(0, 3).map(b => {
                   const obj = b.toObject();
                   obj.service = obj.serviceId;
                   return obj;
                }),
                overdueAlerts
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/users/portfolio
 * @desc    Get user portfolio data
 * @access  Private
 */
router.get('/portfolio', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const [goldTransactions, silverTransactions, goldInvestmentsRaw, silverInvestments] = await Promise.all([
            GoldLedger.find({ userId }).sort({ createdAt: -1 }),
            SilverLedger.find({ userId }).sort({ createdAt: -1 }),
            GoldInvestment.find({ userId, status: 'active' }),
            SilverInvestment.find({ userId, status: 'active' })
        ]);

        const goldInvestments = goldInvestmentsRaw.map(inv => {
            const data = inv.toObject();
            if (data.planType === 'plan-a' && data.nextInstallmentDate) {
                const dueDate = new Date(data.nextInstallmentDate);
                const graceLimit = new Date(dueDate.getTime() + (10 * 24 * 60 * 60 * 1000));
                const isOverdue = new Date() > graceLimit;
                return {
                    ...data,
                    isOverdue,
                    warningMessage: isOverdue ? `Overdue: Payment was due on ${dueDate.toLocaleDateString()}` : null
                };
            }
            return data;
        });

        res.json({
            success: true,
            data: {
                goldBalance: user.goldBalance || 0,
                silverBalance: user.silverBalance || 0,
                goldTransactions,
                silverTransactions,
                goldInvestments,
                silverInvestments
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/users/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/notifications', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userNotifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            success: true,
            data: userNotifications,
            unreadCount: userNotifications.filter(n => !n.isRead).length,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/users/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.post('/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/users/investment-plans
 * @desc    Get investment plans
 * @access  Public
 */
router.get('/investment-plans', async (req, res) => {
    try {
        const plans = await InvestmentPlan.find({ isActive: true });
        res.json({
            success: true,
            data: plans,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/users/fcm-token
 * @desc    Register FCM token for push notifications
 * @access  Private
 */
router.post('/fcm-token', authenticateToken, async (req, res) => {
    try {
        const { fcmToken, deviceId } = req.body;
        const userId = req.user.id;

        if (!fcmToken) {
            return res.status(400).json({ success: false, message: 'FCM token is required' });
        }

        await User.findByIdAndUpdate(userId, { fcmToken, deviceId });

        res.json({
            success: true,
            message: 'FCM token registered successfully',
            data: { userId, deviceId },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to register FCM token' });
    }
});

/**
 * @route   POST /api/users/profile-picture
 * @desc    Upload profile picture
 * @access  Private
 */
router.post('/profile-picture', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload an image file' });
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        await User.findByIdAndUpdate(req.user.id, { profilePicture: imageUrl });

        res.json({
            success: true,
            message: 'Profile picture updated',
            data: { profilePicture: imageUrl }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
