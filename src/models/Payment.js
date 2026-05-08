const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    method: { type: String }, // 'upi', 'razorpay', etc.
    paymentGateway: { type: String }, // 'Razorpay', 'Mock', 'Internal'
    transactionId: { type: String, unique: true, sparse: true },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    providerReferenceId: { type: String }, // generic field for gateway transaction ref
    description: { type: String },
    // Webhook specific fields
    email: { type: String },
    contact: { type: String },
    failureReason: { type: String },
    refundId: { type: String },
    refundAmount: { type: Number },
    planType: { type: String }, // 'plan-a', 'plan-b', 'plan-c'
    metalType: { type: String }, // 'gold', 'silver'
    receipt: { type: String },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('Payment', paymentSchema);
