const { GoldLedger, SilverLedger, User } = require('../models');
const mongoose = require('mongoose');
const crypto = require('crypto');
const logger = require('../utils/logger');

class LedgerService {
    /**
     * Records a transaction in the immutable ledger for any metal type
     */
    async recordTransaction({ userId, metalType = 'gold', type, weight, amount, price, description, investmentId = null }) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const user = await User.findById(userId).session(session);
            if (!user) throw new Error('User not found');

            const isGold = metalType.toLowerCase() === 'gold';
            const balanceKey = isGold ? 'goldBalance' : 'silverBalance';
            const LedgerModel = isGold ? GoldLedger : SilverLedger;
            const weightKey = isGold ? 'goldWeight' : 'silverWeight';
            const priceKey = isGold ? 'goldPriceAtTime' : 'silverPriceAtTime';

            const previousBalance = parseFloat(user[balanceKey] || 0);
            const newBalance = previousBalance + parseFloat(weight);

            // Calculate immutable hash
            const transactionData = `${userId}|${metalType}|${type}|${weight}|${amount}|${new Date().toISOString()}`;
            const hash = crypto.createHash('sha256').update(transactionData).digest('hex');

            const ledgerData = {
                userId,
                transactionType: type,
                [weightKey]: weight,
                amount,
                [priceKey]: price,
                balanceAfter: newBalance,
                description,
                immutableHash: hash,
                investmentId
            };

            const entry = await LedgerModel.create([ledgerData], { session });

            // Update user balance
            user[balanceKey] = newBalance;
            await user.save({ session });

            await session.commitTransaction();
            session.endSession();

            logger.info(`✅ ${metalType.toUpperCase()} Ledger entry created for user ${userId}: ${type} ${weight}g`);
            return entry[0];
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            logger.error(`❌ ${metalType.toUpperCase()} Ledger transaction failed:`, error);
            throw error;
        }
    }

    async getVaultBalance(userId, metalType = 'gold') {
        const user = await User.findById(userId);
        const balanceKey = metalType.toLowerCase() === 'gold' ? 'goldBalance' : 'silverBalance';
        return user ? user[balanceKey] : 0;
    }

    async getTransactionHistory(userId, metalType = 'gold') {
        const isGold = metalType.toLowerCase() === 'gold';
        const LedgerModel = isGold ? GoldLedger : SilverLedger;
        return await LedgerModel.find({ userId }).sort({ createdAt: -1 });
    }
}

module.exports = new LedgerService();
