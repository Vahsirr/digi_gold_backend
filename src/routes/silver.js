const express = require('express');
const router = express.Router();
const GoldEngine = require('../services/GoldEngine');
const SilverEngine = require('../services/SilverEngine');
const LedgerService = require('../services/LedgerService');
const InvestmentService = require('../services/InvestmentService');
const { authenticateToken } = require('../middleware/auth');
const notificationService = require('../services/NotificationService');
const { SilverInvestment, Payment, User, InvestmentPlan } = require('../models');
const MetalPriceService = require('../services/MetalPriceService');

// Get live price
router.get('/price', (req, res) => {
    const price = MetalPriceService.getSilverPricePerGram();
    // res.json({
    //     success: true,
    //     price: SilverEngine.getCurrentPrice(),
    //     timestamp: SilverEngine.lastUpdateTime
    // });
    res.json({
        success: true,
        price: price.toFixed(2),
        timestamp: MetalPriceService.getLastUpdateTime()
    });
});

// Get available investment plans and their terms
router.get('/plans', async (req, res) => {
    try {
        const plans = await InvestmentPlan.find({ 
            isActive: true,
            $or: [
                { metalType: 'both' },
                { metalType: 'silver' }
            ]
        });
        res.json({ success: true, plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Lock price for transaction
router.post('/lock-price', authenticateToken, async (req, res) => {
    try {
        const lock = await SilverEngine.lockPrice(req.user.id);
        res.json({ success: true, ...lock });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get vault balance and history
router.get('/vault', authenticateToken, async (req, res) => {
    try {
        const balance = await LedgerService.getVaultBalance(req.user.id, 'silver');
        const history = await LedgerService.getTransactionHistory(req.user.id, 'silver');
        res.json({ success: true, balance, history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get user's active silver investments
router.get('/investments', authenticateToken, async (req, res) => {
    try {
        const investments = await SilverInvestment.find({
            userId: req.user.id,
            status: 'active'
        });
        res.json({ success: true, investments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Process direct investment/purchase in Rupees
router.post('/buy', authenticateToken, async (req, res) => {
    try {
        const { amount, lockId, planType } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        const lockVerification = SilverEngine.verifyLock(lockId, req.user.id);
        if (!lockVerification.valid) {
            return res.status(400).json({ success: false, message: lockVerification.message });
        }

        let result;
        let weight;

        if (planType && ['plan-a', 'plan-b', 'plan-c'].includes(planType)) {
            const investment = await InvestmentService.getOrCreateInvestment(req.user.id, planType, 'silver');
            
            if (planType === 'plan-a') {
                const { phase } = req.body;
                const planResult = await InvestmentService.processPlanAInstallment(req.user.id, investment._id, amount, 'silver', phase);
                weight = planResult.totalWeight;
                result = { ...planResult, description: `Gold Savings Scheme Silver Month ${phase || '1'} Purchase` };
            } else if (planType === 'plan-b') {
                const { subType } = req.body;
                const planResult = await InvestmentService.processPlanBPurchase(req.user.id, investment._id, amount, 'silver', subType);
                weight = planResult.weight;
                result = { ...planResult, description: `Direct Investment Plan Silver ${subType === 'redemption' ? 'Redemption' : 'Flex'} Purchase` };
            } else if (planType === 'plan-c') {
                const planResult = await InvestmentService.updateVirtualLedger(req.user.id, investment._id, amount, 'silver');
                weight = planResult.weight;
                result = { ...planResult, description: 'Digital Gold Account Virtual Silver' };
            }
        } else {
            return res.status(400).json({ success: false, message: 'Investment scheme selection is required for all purchases.' });
        }

        const { paymentId: rzpOrderId } = req.body;
        if (rzpOrderId) {
            const payment = await Payment.findOne({ transactionId: rzpOrderId });
            if (payment) {
                payment.status = 'completed';
                payment.providerReferenceId = result._id || result.id || `INV_${Date.now()}`;
                await payment.save();
            }
        } else {
            await Payment.create({
                userId: req.user.id,
                amount: amount,
                currency: 'INR',
                status: 'completed',
                transactionId: `TXN_${Date.now()}_${req.user.id.substring(0, 4)}`,
                paymentGateway: 'Internal',
                method: 'upi',
                providerReferenceId: result._id || result.id || `INV_${Date.now()}`
            });
        }
        
        // Update user's total invested and portfolio value
        const user = await User.findById(req.user.id);
        if (user) {
            user.totalInvested = (user.totalInvested || 0) + amount;
            user.silverBalance = (user.silverBalance || 0) + weight;
            user.portfolioValue = (user.goldBalance || 0) * GoldEngine.getCurrentPrice() + 
                                 user.silverBalance * SilverEngine.getCurrentPrice();
            // Calculate lifetime returns (current value - invested)
            user.lifetimeReturns = user.portfolioValue - user.totalInvested;
            await user.save();
        }
        
        res.json({ success: true, weight, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
