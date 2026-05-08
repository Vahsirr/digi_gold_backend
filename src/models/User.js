const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['client', 'admin', 'provider'], default: 'client' },
    kycStatus: { type: String, enum: ['pending', 'verified', 'rejected', 'not_submitted'], default: 'not_submitted' },
    isActive: { type: Boolean, default: true },
    goldBalance: { type: Number, default: 0 },
    silverBalance: { type: Number, default: 0 },
    portfolioValue: { type: Number, default: 0 },
    totalInvested: { type: Number, default: 0 },
    lifetimeReturns: { type: Number, default: 0 },
    investmentPlan: { type: String, default: null },
    profileImage: { type: String, default: null },
    fcmToken: { type: String, default: null },
    lastLogin: { type: Date, default: null },
    refreshToken: { type: String, default: null },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referralCount: { type: Number, default: 0 },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

userSchema.virtual('bankDetails', {
    ref: 'BankDetail',
    localField: '_id',
    foreignField: 'userId'
});

userSchema.virtual('kyc', {
    ref: 'KYC',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
});

userSchema.virtual('investments', {
    ref: 'GoldInvestment',
    localField: '_id',
    foreignField: 'userId'
});

userSchema.virtual('silverInvestments', {
    ref: 'SilverInvestment',
    localField: '_id',
    foreignField: 'userId'
});

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.refreshToken;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
