const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    priceFiat: { type: Number, default: 0 },
    priceGold: { type: Number, default: 0 },
    duration: { type: String },
    isActive: { type: Boolean, default: true },
    imageUrl: { type: String },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('Service', serviceSchema);
