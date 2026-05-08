const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const BASE_URL = 'http://localhost:3001';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'zzFJyBseRyfk5A2kgPBt4tbF';

async function testPayment() {
    console.log('🚀 Starting Payment Gateway Test...');

    try {
        // 1. Login to get token
        console.log('🔐 Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            mobile: '0987654321', // demo client
            password: '0987654321'
        });

        const token = loginRes.data.data.accessToken;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        console.log('✅ Logged in successfully');

        // 2. Initiate Payment
        console.log('💳 Initiating Payment...');
        const initiateRes = await axios.post(`${BASE_URL}/api/payments/initiate`, {
            amount: 500,
            currency: 'INR'
        }, config);

        if (!initiateRes.data.success) {
            throw new Error('Payment initiation failed');
        }

        const { orderId, paymentId } = initiateRes.data.data;
        console.log(`✅ Payment initiated. Order ID: ${orderId}`);

        // 3. Mock Razorpay Verification
        // In a real scenario, this comes from the frontend after successful payment
        console.log('🔍 Verifying Payment (Mocking Signature)...');
        const razorpay_payment_id = 'pay_' + Math.random().toString(36).substring(7);
        const body = orderId + "|" + razorpay_payment_id;
        const signature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');


        const verifyRes = await axios.post(`${BASE_URL}/api/payments/verify`, {
            razorpay_order_id: orderId,
            razorpay_payment_id: razorpay_payment_id,
            razorpay_signature: signature,
            paymentId: paymentId
        }, config);

        if (verifyRes.data.success) {
            console.log('✅ Payment verified successfully!');
        } else {
            console.log('❌ Payment verification failed!');
        }

        // 4. Get Payment History
        console.log('📜 Fetching Payment History...');
        const historyRes = await axios.get(`${BASE_URL}/api/payments`, config);
        console.log(`✅ Found ${historyRes.data.count} payments in history.`);

        console.log('\n✨ All Payment Gateway Tests Passed! ✨');

    } catch (error) {
        console.error('❌ Test Failed:', error.response ? error.response.data : error.message);
    }
}

testPayment();
