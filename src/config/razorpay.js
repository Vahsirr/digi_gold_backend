const Razorpay = require('razorpay');
const logger = require('../utils/logger');

// Require Razorpay credentials
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    logger.error('❌ Razorpay credentials missing! Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    throw new Error('Razorpay credentials are required. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.');
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

logger.info(`✅ Razorpay initialized successfully`);

module.exports = razorpay;

