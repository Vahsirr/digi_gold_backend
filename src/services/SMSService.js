const twilio = require('twilio');
const logger = require('../utils/logger');

let client = null;

// Load ENV variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio safely (NO CRASH)
if (!accountSid || !authToken || !phoneNumber) {
    logger.warn('⚠️ Twilio not configured. SMS service disabled.');
} else if (!accountSid.startsWith('AC')) {
    logger.error('❌ Invalid Twilio SID. Must start with AC');
} else {
    try {
        client = twilio(accountSid.trim(), authToken.trim());
        logger.info('✅ Twilio SMS service initialized');
    } catch (error) {
        logger.error('❌ Twilio initialization error:', error.message);
        client = null;
    }
}

/**
 * Send SMS
 */
const sendSMS = async (mobile, message) => {
    try {
        if (!client) {
            logger.warn('⚠️ SMS not sent (Twilio not configured)');
            return null;
        }

        let formattedMobile = mobile;

        // Add country code if missing (India default)
        if (mobile.length === 10 && !mobile.startsWith('+')) {
            formattedMobile = `+91${mobile}`;
        }

        const response = await client.messages.create({
            body: message,
            from: phoneNumber,
            to: formattedMobile
        });

        logger.info(`✅ SMS sent to ${formattedMobile}. SID: ${response.sid}`);
        return response;

    } catch (error) {
        logger.error(`❌ Error sending SMS to ${mobile}:`, error.message);
        return null; // don't crash app
    }
};

/**
 * Payment SMS
 */
const sendPaymentSMS = async (mobile, amount, txId) => {
    const message = `✅ Sri Vishva Jewellers: Payment of ₹${amount} received successfully. Transaction ID: ${txId}.`;
    return await sendSMS(mobile, message);
};

/**
 * Reminder SMS
 */
const sendReminderSMS = async (mobile, planName, amount) => {
    const message = `🔔 Reminder: ₹${amount} for your ${planName} plan is due. Please pay on time.`;
    return await sendSMS(mobile, message);
};

/**
 * Welcome SMS
 */
const sendWelcomeSMS = async (mobile, fullName) => {
    const message = `👋 Hello ${fullName}! Welcome to Sri Vishva Jewellers. Start your digital gold journey today.`;
    return await sendSMS(mobile, message);
};

module.exports = {
    sendSMS,
    sendPaymentSMS,
    sendReminderSMS,
    sendWelcomeSMS
};