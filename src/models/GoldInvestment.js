const mongoose = require('mongoose');

const goldInvestmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    planType: { type: String, required: true },
    status: { type: String, enum: ['active', 'paused', 'completed', 'cancelled'], default: 'active' },
    startDate: { type: Date, default: Date.now },
    nextInstallmentDate: { type: Date },
    totalInvestedAmount: { type: Number, default: 0 },
    installmentsPaid: { type: Number, default: 0 },
    totalGoldAccumulated: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('GoldInvestment', goldInvestmentSchema);
