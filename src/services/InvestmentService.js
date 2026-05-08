const { GoldInvestment, SilverInvestment, User } = require('../models');
const GoldEngine = require('./GoldEngine');
const SilverEngine = require('./SilverEngine');
const LedgerService = require('./LedgerService');
const logger = require('../utils/logger');
const notificationService = require('./NotificationService');

class InvestmentService {
    /**
     * Create a new investment plan (Gold or Silver)
     */
    async createInvestment(userId, planType, metalType = 'gold') {
        const Model = metalType.toLowerCase() === 'gold' ? GoldInvestment : SilverInvestment;
        const investment = await Model.create({
            userId,
            planType,
            status: 'active',
            startDate: new Date(),
            nextInstallmentDate: new Date(Date.now() + 1000) // Immediate first installment due
        });

        logger.info(`✨ New ${metalType.toUpperCase()} Investment created for user ${userId}: ${planType}`);
        return investment;
    }

    /**
     * Plan A: 11-Month SIP Logic (Unified)
     * Supports manual phase selection (1, 2, 3, 4)
     */
    async processPlanAInstallment(userId, investmentId, amount, metalType = 'gold', phase = null) {
        const Model = metalType.toLowerCase() === 'gold' ? GoldInvestment : SilverInvestment;
        const Engine = metalType.toLowerCase() === 'gold' ? GoldEngine : SilverEngine;

        const investment = await Model.findById(investmentId);
        if (!investment || investment.planType !== 'plan-a') {
            throw new Error(`Invalid Plan A ${metalType} investment`);
        }

        const daysSinceStart = Math.floor((new Date() - new Date(investment.startDate)) / (1000 * 60 * 60 * 24));

        // Calculate incentive percentage
        let incentivePercent = 0;
        if (phase) {
            const phaseNum = parseInt(phase);
            if (phaseNum === 1) incentivePercent = 0.05;
            else if (phaseNum === 2) incentivePercent = 0.03;
            else if (phaseNum === 3) incentivePercent = 0.03;
            else if (phaseNum === 4) incentivePercent = 0.01;
        } else {
            // Fallback to monthly logic (30 days per month for 11 months)
            if (daysSinceStart <= 30) incentivePercent = 0.05;
            else if (daysSinceStart <= 60) incentivePercent = 0.03;
            else if (daysSinceStart <= 90) incentivePercent = 0.03;
            else if (daysSinceStart <= 330) incentivePercent = 0.01;
        }

        // Calculate base weight
        const livePrice = Engine.getCurrentPrice();
        if (livePrice <= 0) throw new Error('Live price not available');
        const baseWeight = amount / livePrice;

        // Calculate incentive weight
        const incentiveWeight = baseWeight * incentivePercent;
        const totalWeight = baseWeight + incentiveWeight;

        // Record in ledger
        const entry = await LedgerService.recordTransaction({
            userId,
            metalType,
            type: 'purchase',
            weight: totalWeight,
            amount,
            price: livePrice,
            description: `Plan A Phase ${phase || 'Auto'} Installment (${(incentivePercent * 100).toFixed(1)}% incentive)`,
            investmentId: investment._id
        });

        // Update investment progress
        const accumulationKey = metalType.toLowerCase() === 'gold' ? 'totalGoldAccumulated' : 'totalSilverAccumulated';
        
        investment.totalInvestedAmount = (parseFloat(investment.totalInvestedAmount) || 0) + amount;
        investment[accumulationKey] = (parseFloat(investment[accumulationKey]) || 0) + totalWeight;
        investment.installmentsPaid = (investment.installmentsPaid || 0) + 1;
        investment.nextInstallmentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await investment.save();

        // Send notification
        notificationService.sendTransactionNotification(userId, amount, metalType, 'installment')
            .catch(err => logger.error('Error sending installment notification:', err));

        return { ...entry.toObject(), baseWeight, incentiveWeight, totalWeight };
    }

    /**
     * Plan B: Direct Investment Plan (Unified)
     * Supports Flex Phase and Redemption
     */
    async processPlanBPurchase(userId, investmentId, amount, metalType = 'gold', subType = 'flex') {
        const Model = metalType.toLowerCase() === 'gold' ? GoldInvestment : SilverInvestment;
        const Engine = metalType.toLowerCase() === 'gold' ? GoldEngine : SilverEngine;

        const investment = await Model.findById(investmentId);
        if (!investment || investment.planType !== 'plan-b') {
            throw new Error(`Invalid Plan B ${metalType} investment`);
        }

        const livePrice = Engine.getCurrentPrice();
        if (livePrice <= 0) throw new Error('Live price not available');
        const baseWeight = amount / livePrice;

        let incentiveWeight = 0;
        let transType = 'purchase';
        let desc = `Direct Investment Plan ${metalType.toUpperCase()} Purchase`;

        let accumulationKey = metalType.toLowerCase() === 'gold' ? 'totalGoldAccumulated' : 'totalSilverAccumulated';

        if (subType === 'redemption') {
            if ((parseFloat(investment[accumulationKey]) || 0) < baseWeight) {
                throw new Error(`Insufficient ${metalType} balance for redemption`);
            }
            transType = 'redemption';
            desc = `Direct Investment Plan ${metalType.toUpperCase()} Redemption`;
        } else {
            // 3% Incentive for Direct Investment Plan (Plan B) Flex Phase
            incentiveWeight = baseWeight * 0.03;
            desc += ` (+3% bonus flex phase)`;
        }

        const totalWeight = subType === 'redemption' ? -baseWeight : (baseWeight + incentiveWeight);

        const entry = await LedgerService.recordTransaction({
            userId,
            metalType,
            type: transType,
            weight: totalWeight,
            amount: subType === 'redemption' ? -amount : amount,
            price: livePrice,
            description: desc,
            investmentId: investment._id
        });

        // Update total
        investment.totalInvestedAmount = (parseFloat(investment.totalInvestedAmount) || 0) + (subType === 'redemption' ? -amount : amount);
        investment[accumulationKey] = (parseFloat(investment[accumulationKey]) || 0) + totalWeight;
        investment.installmentsPaid = (investment.installmentsPaid || 0) + 1;
        await investment.save();

        // Send notification
        notificationService.sendTransactionNotification(userId, amount, metalType, subType === 'redemption' ? 'redemption' : 'purchase')
            .catch(err => logger.error('Error sending purchase notification:', err));

        return { ...entry.toObject(), weight: totalWeight, baseWeight, incentiveWeight };
    }

    /**
     * Plan C: Digital Gold Account (Unified)
     */
    async updateVirtualLedger(userId, investmentId, amount, metalType = 'gold') {
        const Model = metalType.toLowerCase() === 'gold' ? GoldInvestment : SilverInvestment;
        const Engine = metalType.toLowerCase() === 'gold' ? GoldEngine : SilverEngine;

        const investment = await Model.findById(investmentId);
        if (!investment || investment.planType !== 'plan-c') {
            throw new Error(`Invalid Plan C ${metalType} investment`);
        }

        const livePrice = Engine.getCurrentPrice();
        if (livePrice <= 0) throw new Error('Live price not available');
        const baseWeight = amount / livePrice;

        // 1% Incentive for Digital Gold Account (Plan C)
        const incentiveWeight = baseWeight * 0.01;
        const totalWeight = baseWeight + incentiveWeight;

        const entry = await LedgerService.recordTransaction({
            userId,
            metalType,
            type: 'purchase',
            weight: totalWeight,
            amount,
            price: livePrice,
            description: `Digital Gold Account Virtual ${metalType.toUpperCase()} (+1% bonus)`,
            investmentId: investment._id
        });

        const accumulationKey = metalType.toLowerCase() === 'gold' ? 'totalGoldAccumulated' : 'totalSilverAccumulated';
        investment.virtualLedgerBalance = (parseFloat(investment.virtualLedgerBalance) || 0) + amount;
        investment[accumulationKey] = (parseFloat(investment[accumulationKey]) || 0) + totalWeight;
        await investment.save();

        // Send notification
        notificationService.sendTransactionNotification(userId, amount, metalType, 'virtual_purchase')
            .catch(err => logger.error('Error sending virtual purchase notification:', err));

        return { balance: investment.virtualLedgerBalance, weight: totalWeight };
    }

    async getOrCreateInvestment(userId, planType, metalType = 'gold') {
        const Model = metalType.toLowerCase() === 'gold' ? GoldInvestment : SilverInvestment;
        let investment = await Model.findOne({
            userId, planType, status: 'active'
        });

        if (!investment) {
            investment = await this.createInvestment(userId, planType, metalType);
        }

        return investment;
    }

    async convertVirtualToPhysical(userId, investmentId, metalType = 'gold') {
        const Model = metalType.toLowerCase() === 'gold' ? GoldInvestment : SilverInvestment;
        const Engine = metalType.toLowerCase() === 'gold' ? GoldEngine : SilverEngine;

        const investment = await Model.findById(investmentId);
        if (!investment || investment.planType !== 'plan-c') {
            throw new Error(`Invalid Plan C ${metalType} investment`);
        }

        const amount = investment.virtualLedgerBalance;
        const livePrice = Engine.getCurrentPrice();
        if (livePrice <= 0) throw new Error('Live price not available');
        const weight = amount / livePrice;

        await LedgerService.recordTransaction({
            userId,
            metalType,
            type: 'purchase',
            weight,
            amount,
            price: livePrice,
            description: `Conversion from Virtual Ledger to Physical ${metalType.toUpperCase()}`,
            investmentId: investment._id
        });

        investment.virtualLedgerBalance = 0;
        investment.status = 'matured';
        await investment.save();

        // Send notification
        notificationService.sendNotification(userId, '✨ Conversion Successful', `Your virtual ${metalType} has been converted to ${weight.toFixed(4)}g of physical metal.`, 'system', { type: 'conversion' }, true)
            .catch(err => logger.error('Error sending conversion notification:', err));

        return weight;
    }
}

module.exports = new InvestmentService();
