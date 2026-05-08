const mongoose = require('mongoose');

const bankDetailSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accountHolderName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    bankName: { type: String },
    isPrimary: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('BankDetail', bankDetailSchema);
