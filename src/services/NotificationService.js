const { Expo } = require('expo-server-sdk');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const { Notification, User, SavingsPlanReminder } = require('../models');
const smsService = require('./SMSService');
const logger = require('../utils/logger');

// Create a new Expo SDK client
let expo = new Expo();

// Initialize Firebase Admin
try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
            console.log('✅ Firebase Admin initialized successfully');
        }
    }
} catch (error) {
    console.error('❌ Firebase Admin initialization error:', error.message);
}

// Initialize Supabase Client
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Supabase client initialized');
}

/**
 * Send a push notification (and optionally SMS) to a user
 */
const sendNotification = async (userId, title, body, type = 'system', data = {}, sendAsSMS = false) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(`User ${userId} not found for notification.`);
            return null;
        }

        const notification = await Notification.create({
            userId,
            title,
            body,
            type,
            data,
            isRead: false
        });

        if (sendAsSMS && user.mobile) {
            await smsService.sendSMS(user.mobile, `${title}: ${body}`);
        }

        if (!user.fcmToken) {
            return notification;
        }

        const pushToken = user.fcmToken;
        let sentSuccessfully = false;

        if (Expo.isExpoPushToken(pushToken)) {
            const message = {
                to: pushToken,
                sound: 'default',
                title: title,
                body: body,
                data: { ...data, notificationId: notification._id },
                priority: 'high',
            };

            const chunks = expo.chunkPushNotifications([message]);
            for (let chunk of chunks) {
                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    if (ticketChunk[0].status === 'ok') {
                        sentSuccessfully = true;
                    }
                } catch (error) {
                    console.error('Error sending Expo chunk:', error);
                }
            }
        } else if (admin.apps.length > 0) {
            const message = {
                token: pushToken,
                notification: { title, body },
                data: {
                    ...Object.keys(data).reduce((acc, key) => { acc[key] = String(data[key]); return acc; }, {}),
                    notificationId: String(notification._id),
                    type: String(type)
                }
            };

            try {
                await admin.messaging().send(message);
                sentSuccessfully = true;
            } catch (error) {
                console.error('Error sending FCM notification:', error.message);
            }
        }

        if (sentSuccessfully) {
            notification.isSent = true;
            notification.sentAt = new Date();
            await notification.save();
        }

        return notification;
    } catch (error) {
        console.error('Error in notification service:', error);
        throw error;
    }
};

const broadcastNotification = async (userIds, title, body, type = 'system', data = {}) => {
    const results = [];
    for (const userId of userIds) {
        try {
            const res = await sendNotification(userId, title, body, type, data);
            results.push(res);
        } catch (e) {
            console.error(`Failed to send to user ${userId}:`, e);
        }
    }
    return results;
};

const sendMissedInstallmentReminder = async (userId, investmentId, metalType, planType, installmentNumber, daysMissed) => {
    const title = 'Missed Savings Payment ⚠️';
    const body = `Your ${metalType.toUpperCase()} ${planType.toUpperCase()} installment #${installmentNumber} is ${daysMissed} days overdue. Please pay to keep your benefits active!`;

    await SavingsPlanReminder.create({
        userId,
        investmentId,
        investmentType: metalType,
        planType,
        missedDate: new Date(Date.now() - (daysMissed * 24 * 60 * 60 * 1000)),
        installmentNumber,
        status: 'sent',
        reminderSent: true,
        reminderSentAt: new Date()
    });

    return await sendNotification(userId, title, body, 'reminder', {
        type: 'missed_installment',
        investmentId,
        metalType,
        planType,
        installmentNumber
    }, true);
};

const sendSchemeWelcomeNotification = async (userId, planType, metalType) => {
    const title = 'Welcome to Your New Plan! 🎉';
    const body = `You have successfully enrolled in the ${metalType.toUpperCase()} ${planType.toUpperCase()} savings scheme. Start building your wealth today!`;
    return await sendNotification(userId, title, body, 'system', { type: 'scheme_enrollment', planType, metalType }, true);
};

const sendWelcomeBackNotification = async (userId, fullName) => {
    const title = `👋 Welcome back, ${fullName}!`;
    const body = 'Great to see you again. Check your gold portfolio today! 💛';
    return await sendNotification(userId, title, body, 'system', { type: 'welcome_back' });
};

const alertAdmin = async (title, body, data = {}) => {
    try {
        const adminUsers = await User.find({ role: 'admin' });
        for (const adminUser of adminUsers) {
            await sendNotification(adminUser._id, `ADMIN ALERT: ${title}`, body, 'system', { ...data, isAdminAlert: 'true' }, false);
        }
    } catch (error) {
        console.error('Error alerting admins:', error);
    }
};

const sendLoginAlert = async (userId, deviceName = 'New Device') => {
    const title = '🔐 New Login Detected';
    const body = `Your account was just logged in from ${deviceName}. If this wasn't you, secure your account immediately.`;
    return await sendNotification(userId, title, body, 'system', { type: 'login_alert', deviceName });
};

const sendKycSuccessNotification = async (userId, docType = 'Identity') => {
    const title = '✅ KYC Verified Successfully';
    const body = `Your ${docType.toUpperCase()} verification is complete. You can now start investing in digital gold and silver!`;
    return await sendNotification(userId, title, body, 'kyc', { type: 'kyc_success', docType }, true);
};

const sendTransactionNotification = async (userId, amount, metalType, action = 'purchase') => {
    const title = action === 'purchase' ? '💰 Purchase Successful' : '📈 Transaction Update';
    const body = `Success! Your ${action} of ${metalType.toUpperCase()} for ₹${amount} has been processed and added to your vault.`;
    return await sendNotification(userId, title, body, 'payment', { type: 'transaction', amount, metalType, action }, true);
};

const sendToToken = async (fcmToken, title, body, data = {}) => {
    if (!fcmToken) return false;
    try {
        const payload = {
            notification: { title, body },
            data: { ...data, title, body },
            token: fcmToken
        };
        if (admin.apps.length > 0 && !fcmToken.includes('ExponentPushToken')) {
            await admin.messaging().send(payload);
            return true;
        }
        if (fcmToken.includes('ExponentPushToken') || Expo.isExpoPushToken(fcmToken)) {
            const messages = [{ to: fcmToken, sound: 'default', title, body, data, priority: 'high' }];
            await expo.sendPushNotificationsAsync(messages);
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`❌ sendToToken Error: ${error.message}`);
        return false;
    }
};

module.exports = {
    sendNotification,
    sendToToken,
    broadcastNotification,
    sendMissedInstallmentReminder,
    sendSchemeWelcomeNotification,
    sendWelcomeBackNotification,
    sendLoginAlert,
    sendTransactionNotification,
    sendKycSuccessNotification,
    alertAdmin
};
