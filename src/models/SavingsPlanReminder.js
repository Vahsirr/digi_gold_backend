const mongoose = require('mongoose');

const savingsPlanReminderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    investmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    investmentType: { type: String, enum: ['gold', 'silver'], required: true },
    planType: { type: String, required: true },
    missedDate: { type: Date, required: true },
    installmentNumber: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('SavingsPlanReminder', savingsPlanReminderSchema);
