const express = require('express');
const router = express.Router();
const GoldEngine = require('../services/GoldEngine');
const SilverEngine = require('../services/SilverEngine');
const LedgerService = require('../services/LedgerService');
const InvestmentService = require('../services/InvestmentService');
const { authenticateToken } = require('../middleware/auth');
const notificationService = require('../services/NotificationService');
const { GoldInvestment, Payment, User, InvestmentPlan } = require('../models');
const MetalPriceService = require('../services/MetalPriceService');

// Get live price
router.get('/price', (req, res) => {
    const price = MetalPriceService.getGoldPricePerGram();
    // res.json({
    //     success: true,
    //     price: GoldEngine.getCurrentPrice(),
    //     timestamp: GoldEngine.lastUpdateTime
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
                { metalType: 'gold' }
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
        const lock = await GoldEngine.lockPrice(req.user.id);
        res.json({ success: true, ...lock });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get vault balance and history
router.get('/vault', authenticateToken, async (req, res) => {
    try {
        const balance = await LedgerService.getVaultBalance(req.user.id, 'gold');
        const history = await LedgerService.getTransactionHistory(req.user.id, 'gold');
        res.json({ success: true, balance, history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create/Subscribe to a new investment plan
router.post('/subscribe', authenticateToken, async (req, res) => {
    try {
        const { planType } = req.body;
        if (!['plan-a', 'plan-b', 'plan-c'].includes(planType)) {
            return res.status(400).json({ success: false, message: 'Invalid plan type' });
        }

        const investment = await InvestmentService.createInvestment(req.user.id, planType, 'gold');
        res.status(201).json({ success: true, investment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get user's active investments
router.get('/investments', authenticateToken, async (req, res) => {
    try {
        const investments = await GoldInvestment.find({
            userId: req.user.id,
            status: 'active'
        });

        // Add overdue status for User Portal notifications
        const processed = investments.map(inv => {
            const data = inv.toObject();
            if (data.planType === 'plan-a' && data.nextInstallmentDate) {
                const dueDate = new Date(data.nextInstallmentDate);
                const graceLimit = new Date(dueDate.getTime() + (10 * 24 * 60 * 60 * 1000));
                const now = new Date();
                
                const isOverdue = now > graceLimit;
                const daysLate = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

                return {
                    ...data,
                    isOverdue,
                    daysLate,
                    warningMessage: isOverdue ? `Installment Overdue: Your payment for Gold Savings Scheme was due on ${dueDate.toLocaleDateString()}. Please clear it immediately.` : null
                };
            }
            return data;
        });

        res.json({ success: true, investments: processed });
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

        // Verify price lock
        const lockVerification = GoldEngine.verifyLock(lockId, req.user.id);
        if (!lockVerification.valid) {
            return res.status(400).json({ success: false, message: lockVerification.message });
        }

        const livePrice = lockVerification.price;
        let result;
        let weight;

        if (planType && ['plan-a', 'plan-b', 'plan-c'].includes(planType)) {
            const investment = await InvestmentService.getOrCreateInvestment(req.user.id, planType, 'gold');

            if (planType === 'plan-a') {
                const { phase } = req.body;
                const planResult = await InvestmentService.processPlanAInstallment(req.user.id, investment._id, amount, 'gold', phase);
                weight = planResult.totalWeight;
                result = { ...planResult, description: `Gold Savings Scheme Gold Month ${phase || '1'} Purchase (+${((planResult.incentiveWeight / planResult.baseWeight) * 100).toFixed(1)}% bonus)` };
            } else if (planType === 'plan-b') {
                const { subType } = req.body;
                const planResult = await InvestmentService.processPlanBPurchase(req.user.id, investment._id, amount, 'gold', subType);
                weight = planResult.weight;
                result = { ...planResult, description: `Direct Investment Plan Gold ${subType === 'redemption' ? 'Redemption' : 'Flex'} Purchase` };
            } else if (planType === 'plan-c') {
                const planResult = await InvestmentService.updateVirtualLedger(req.user.id, investment._id, amount, 'gold');
                weight = planResult.weight;
                result = { ...planResult, description: 'Digital Gold Account Virtual Gold (+1% bonus)' };
            }
        } else {
            return res.status(400).json({ success: false, message: 'Investment scheme selection is required for all purchases.' });
        }

        // Update or create Payment record
        const { paymentId: rzpOrderId } = req.body;

        if (rzpOrderId) {
            const payment = await Payment.findOne({ transactionId: rzpOrderId });
            if (payment) {
                payment.status = 'completed';
                payment.providerReferenceId = result._id || result.id || `INV_${Date.now()}`;
                payment.method = 'razorpay';
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
            user.goldBalance = (user.goldBalance || 0) + weight;
            user.portfolioValue = user.goldBalance * GoldEngine.getCurrentPrice() + 
                                 (user.silverBalance || 0) * SilverEngine.getCurrentPrice();
            // Calculate lifetime returns (current value - invested)
            user.lifetimeReturns = user.portfolioValue - user.totalInvested;
            await user.save();
        }

        res.json({ success: true, weight, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Process investment installment (Plan A)
router.post('/invest/plan-a', authenticateToken, async (req, res) => {
    try {
        const { investmentId, amount, lockId, phase } = req.body;

        // Verify price lock
        const lockVerification = GoldEngine.verifyLock(lockId, req.user.id);
        if (!lockVerification.valid) {
            return res.status(400).json({ success: false, message: lockVerification.message });
        }

        const result = await InvestmentService.processPlanAInstallment(req.user.id, investmentId, amount, 'gold', phase);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Process Plan B Flexible Purchase
router.post('/invest/plan-b', authenticateToken, async (req, res) => {
    try {
        const { investmentId, amount, lockId, subType } = req.body;

        const lockVerification = GoldEngine.verifyLock(lockId, req.user.id);
        if (!lockVerification.valid) {
            return res.status(400).json({ success: false, message: lockVerification.message });
        }

        const result = await InvestmentService.processPlanBPurchase(req.user.id, investmentId, amount, 'gold', subType);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update Plan C Virtual Ledger
router.post('/invest/plan-c', authenticateToken, async (req, res) => {
    try {
        const { investmentId, amount } = req.body;
        const balance = await InvestmentService.updateVirtualLedger(req.user.id, investmentId, amount);
        res.json({ success: true, balance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Convert Plan C to physical metal
router.post('/invest/plan-c-convert', authenticateToken, async (req, res) => {
    try {
        const { investmentId } = req.body;
        const weight = await InvestmentService.convertVirtualToPhysical(req.user.id, investmentId);
        res.json({ success: true, weight });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
