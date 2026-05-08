const mongoose = require('mongoose');

const investmentPlanSchema = new mongoose.Schema({
    planId: {
        type: String,
        required: true,
        unique: true,
        enum: ['plan-a', 'plan-b', 'plan-c']
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    features: [{
        type: String
    }],
    bonusPercentage: {
        type: Number,
        required: true,
        default: 0
    },
    metalType: {
        type: String,
        enum: ['gold', 'silver', 'both'],
        default: 'both'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    terms: [{
        label: String,
        subLabel: String,
        value: String,
        color: String,
        bonus: Number
    }],
    advantages: [{
        icon: String,
        title: String,
        sub: String
    }]
}, {
    timestamps: true
});

const InvestmentPlan = mongoose.model('InvestmentPlan', investmentPlanSchema);

module.exports = InvestmentPlan;
