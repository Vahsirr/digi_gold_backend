const { User, GoldLedger, sequelize } = require('../models');
const LedgerService = require('./LedgerService');
const GoldEngine = require('./GoldEngine');
const logger = require('../utils/logger');

class ReferralService {
    /**
     * Process referral when new user registers
     * Only tracks referral count - no monetary reward
     * Trigger: Immediately when referred user registers
     */
    async processReferralBonus(newUserId, referrerId) {
        try {
            const referrer = await User.findById(referrerId);
            if (!referrer) {
                logger.error(`Referrer not found: ${referrerId}`);
                return;
            }

            // Increment referral count only
            referrer.referralCount = (referrer.referralCount || 0) + 1;
            await referrer.save();

            logger.info(`Referral count incremented for ${referrerId}. Total: ${referrer.referralCount} for new user ${newUserId}`);
            
            // Send notification to referrer
            const notificationService = require('./NotificationService');
            await notificationService.sendNotification(
                referrerId,
                '🎉 New Referral!',
                `Someone joined using your referral code! You now have ${referrer.referralCount} referral(s).`,
                'referral',
                { type: 'referral_count', count: referrer.referralCount }
            ).catch(err => logger.error('Error sending referral notification:', err));

        } catch (error) {
            logger.error('Failed to process referral:', error);
        }
    }

    /**
     * Generate unique referral code
     */
    async generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    /**
     * Generate unique referral code with collision check
     */
    async generateUniqueReferralCode() {
        let code;
        let isUnique = false;
        
        while (!isUnique) {
            code = await this.generateReferralCode();
            const existingUser = await User.findOne({ referralCode: code });
            if (!existingUser) {
                isUnique = true;
            }
        }
        
        return code;
    }

    /**
     * Get referral statistics for a user
     */
    async getReferralStats(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Count total referrals
            const totalReferrals = await User.countDocuments({ referredBy: userId });

            return {
                totalReferrals,
                referralCode: user.referralCode,
            };
        } catch (error) {
            logger.error('Error getting referral stats:', error);
            throw error;
        }
    }
}

module.exports = new ReferralService();
