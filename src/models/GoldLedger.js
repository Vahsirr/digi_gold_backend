const mongoose = require('mongoose');

const goldLedgerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transactionType: { type: String, enum: ['purchase', 'sell', 'transfer', 'bonus', 'fee'], required: true },
    goldWeight: { type: Number, required: true },
    amount: { type: Number, required: true },
    goldPriceAtTime: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String },
    referenceId: { type: String },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('GoldLedger', goldLedgerSchema);
