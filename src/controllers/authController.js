const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, OTP } = require('../models');
const logger = require('../utils/logger');
const notificationService = require('../services/NotificationService');
const ReferralService = require('../services/ReferralService');

// SMS service for OTPs and notifications
const smsService = require('../services/SMSService');

const sendOTPSMS = async (mobile, otp) => {
    const message = `Sri vishva jewellers: Your verification code is ${otp}. Valid for 10 minutes.`;
    return await smsService.sendSMS(mobile, message);
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Register new user
 */
exports.register = async (req, res, next) => {
    try {
        await require('../config/database')(); // ✅ Ensure DB is connected
        const { fullName, email, mobile, password, investmentPlan, referralCode } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { mobile }],
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or mobile already exists',
            });
        }

        // Generate unique referral code for new user
        let newReferralCode = await ReferralService.generateUniqueReferralCode();

        // Find referrer if referral code provided
        let referrer = null;
        if (referralCode) {
            referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
            if (!referrer) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid referral code',
                });
            }
        }

        // Create user (hashing handled by Mongoose pre-save hook)
        const user = await User.create({
            fullName,
            email,
            mobile,
            password,
            investmentPlan,
            role: 'client',
            kycStatus: 'not_submitted',
            referralCode: newReferralCode,
            referredBy: referrer ? referrer._id : null,
        });

        // Process referral bonus if referred
        if (referrer) {
            await ReferralService.processReferralBonus(user._id, referrer._id);
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        // Save refresh token
        user.refreshToken = refreshToken;
        await user.save();

        logger.info(`New user registered: ${user._id}`);

        // Notification logic
        const welcomeTitle = `Welcome to Sri vishva jewellers, ${fullName}! 🎉`;
        const welcomeBody = 'Your gold investment account is now active. Start your digital gold journey today!';
        notificationService.sendNotification(user._id, welcomeTitle, welcomeBody, 'system', { type: 'welcome' }, true)
            .catch(err => logger.error('Error sending welcome notification:', err));

        notificationService.alertAdmin('New User Joined 👤', `${fullName} has just registered as a new client.`)
            .catch(err => logger.error('Error alerting admin:', err));

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    mobile: user.mobile,
                    role: user.role,
                    kycStatus: user.kycStatus,
                },
                accessToken,
                refreshToken,
            },
        });
    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Registration failed',
            error: error.message 
        });
    }
};

/**
 * Login user
 */
exports.login = async (req, res, next) => {
    try {
        await require('../config/database')(); // ✅ Ensure DB is connected
        const { mobile, password, pushToken } = req.body;

        // Find user
        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        if (pushToken && user.fcmToken !== pushToken) {
            user.fcmToken = pushToken;
            await user.save();
        }

        // Verify password (using schema method)
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        user.refreshToken = refreshToken;
        user.lastLogin = new Date();
        await user.save();

        logger.info(`User logged in: ${user._id}`);

        notificationService.sendWelcomeBackNotification(user._id, user.fullName || 'User')
            .catch(err => logger.error('Error sending welcome notification:', err));

        notificationService.sendLoginAlert(user._id, req.headers['user-agent'] || 'Unknown Device')
            .catch(err => logger.error('Error sending login alert:', err));

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    mobile: user.mobile,
                    role: user.role,
                    kycStatus: user.kycStatus,
                },
                accessToken,
                refreshToken,
            },
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Login failed',
            error: error.message 
        });
    }
};

/**
 * Send OTP to mobile
 */
exports.sendOTP = async (req, res, next) => {
    try {
        await require('../config/database')(); // ✅ Ensure DB is connected
        const { mobile, pushToken } = req.body;
        const otp = generateOTP();

        await OTP.create({
            mobile,
            otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        await sendOTPSMS(mobile, otp);

        if (pushToken) {
            notificationService.sendToToken(pushToken, '🔐 Security Code', `Sri vishva jewellers: Your verification code is ${otp}. Valid for 10 minutes.`, { type: 'otp', code: otp })
                .catch(err => logger.error('Error sending direct OTP push:', err));
        }

        const user = await User.findOne({ mobile });
        if (user && user.fcmToken && user.fcmToken !== pushToken) {
            notificationService.sendNotification(user._id, '🔐 Verification Code', `Your Sri vishva login code is: ${otp}`, 'system', { type: 'otp' })
                .catch(err => logger.error('Error sending secondary OTP push:', err));
        }

        res.json({
            success: true,
            message: 'OTP sent successfully',
            data: {
                mobile,
                otp: otp,
                expiresIn: 600,
            },
        });
    } catch (error) {
        logger.error('Send OTP error:', error);
        next(error);
    }
};

/**
 * Verify OTP and login
 */
exports.verifyOTP = async (req, res, next) => {
    try {
        const { mobile, otp } = req.body;

        const otpRecord = await OTP.findOne({
            mobile,
            otp,
            isUsed: false,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP',
            });
        }

        otpRecord.isUsed = true;
        await otpRecord.save();

        let user = await User.findOne({ mobile });
        if (!user) {
            user = await User.create({
                mobile,
                role: 'client',
                fullName: 'User',
                password: generateOTP() // Raw string, Mongoose pre-save hook will handle hashing
            });
        }

        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        user.refreshToken = refreshToken;
        user.lastLogin = new Date();
        await user.save();

        logger.info(`User logged in via OTP: ${user._id}`);
        notificationService.sendWelcomeBackNotification(user._id, user.fullName || 'User')
            .catch(err => logger.error('Error sending welcome notification:', err));

        res.json({
            success: true,
            message: 'OTP verified successfully',
            data: {
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    mobile: user.mobile,
                    role: user.role,
                    kycStatus: user.kycStatus,
                },
                accessToken,
                refreshToken,
            },
        });
    } catch (error) {
        logger.error('Verify OTP error:', error);
        next(error);
    }
};

/**
 * Refresh access token
 */
exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'Refresh token required' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            data: { accessToken },
        });
    } catch (error) {
        logger.error('Refresh token error:', error);
        next(error);
    }
};

/**
 * Change user password
 */
exports.changePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Incorrect old password' });

        user.password = newPassword; // Hashing via pre-save hook
        await user.save();
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) { next(error); }
};

/**
 * Toggle Two-Factor Authentication
 */
exports.toggleTwoFactor = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { enabled } = req.body;
        await User.findByIdAndUpdate(userId, { twoFactorEnabled: enabled });
        res.json({ success: true, message: `2FA ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error) { next(error); }
};

/**
 * Logout
 */
exports.logout = async (req, res, next) => {
    try {
        const userId = req.user.id;
        await User.findByIdAndUpdate(userId, { refreshToken: null });
        logger.info(`User logged out: ${userId}`);
        res.json({ success: true, message: 'Logout successful' });
    } catch (error) {
        logger.error('Logout error:', error);
        next(error);
    }
};
