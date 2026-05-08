const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    panNumber: { type: String, trim: true },
    aadhaarNumber: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    panImageUrl: { type: String },
    aadhaarFrontUrl: { type: String },
    aadhaarBackUrl: { type: String },
    selfieUrl: { type: String },
    rejectionReason: { type: String },
    documentType: { type: String },
    documentNumber: { type: String },
    documentUrls: [{ type: String }],
    verifiedAt: { type: Date },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('KYC', kycSchema);
