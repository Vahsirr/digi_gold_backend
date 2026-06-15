const express = require('express');
const router = express.Router();
const { User, Booking, KYC, Payment, GoldLedger, SilverLedger, Service, BankDetail, GoldInvestment, SilverInvestment, SavingsPlanReminder } = require('../models');
const MetalPriceService = require('../services/MetalPriceService');
const logger = require('../utils/logger');
// PDFDocument might not be used if the library isn't installed, but I'll keep the logic if it was there.
const PDFDocument = require('pdfkit-table');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const CarouselImage = require('../models/Carouselmages');

/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 * @access  Admin
 */
router.get('/users', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            logger.warn('⚠️ MongoDB not connected, attempting to reconnect...');
            await require('../config/database')();
        }

        const { role } = req.query;
        const query = role ? { role } : {};

        const users = await User.find(query)
            .select('-password')
            .populate('bankDetails')
            .sort({ createdAt: -1 })
            .maxTimeMS(8000);

        res.json({
            success: true,
            data: users,
            count: users.length,
        });
    } catch (error) {
        logger.error('Error fetching admin users:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching users',
            error: error.message 
        });
    }
});

/**
 * @route   GET /api/admin/bookings
 * @desc    Get all bookings
 * @access  Admin
 */
router.get('/bookings', async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};

        const bookings = await Booking.find(query)
            .populate('clientId', 'fullName mobile')
            .populate('serviceId', 'title')// Service model has 'title', not 'name'
            .sort({ createdAt: -1 });

        // Rename clientId to client, serviceId to service to match frontend expectation
        const formatted = bookings.map(b => {
           const obj = b.toObject();
           obj.client = obj.clientId;
           obj.service = obj.serviceId;
           return obj;
        });

        res.json({
            success: true,
            data: formatted,
            count: formatted.length,
        });
    } catch (error) {
        logger.error('Error fetching admin bookings:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   GET /api/admin/transactions
 * @desc    Get all user purchases/transactions (Gold & Silver)
 * @access  Admin
 */
router.get('/transactions', async (req, res) => {
    try {
        // Ensure database is connected
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            logger.warn('⚠️ MongoDB not connected, attempting to reconnect...');
            await require('../config/database')();
        }

        const [goldTxs, silverTxs] = await Promise.all([
            GoldLedger.find().populate('userId', 'fullName mobile').sort({ createdAt: -1 }).maxTimeMS(5000),
            SilverLedger.find().populate('userId', 'fullName mobile').sort({ createdAt: -1 }).maxTimeMS(5000)
        ]);

        const transactions = [
            ...goldTxs.map(tx => {
                const obj = tx.toObject();
                obj.user = obj.userId;
                obj.metalType = 'gold';
                return obj;
            }),
            ...silverTxs.map(tx => {
                const obj = tx.toObject();
                obj.user = obj.userId;
                obj.metalType = 'silver';
                return obj;
            })
        ].sort((a, b) => b.createdAt - a.createdAt);

        res.json({
            success: true,
            data: transactions,
            count: transactions.length
        });
    } catch (error) {
        logger.error('Error fetching admin transactions:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   GET /api/admin/reports/compliance
 * @desc    Generate compliance report (HTML format)
 * @access  Admin
 */
router.get('/reports/compliance', async (req, res) => {
    try {
        const [goldTxs, silverTxs] = await Promise.all([
            GoldLedger.find().populate('userId', 'fullName mobile').sort({ createdAt: -1 }),
            SilverLedger.find().populate('userId', 'fullName mobile').sort({ createdAt: -1 })
        ]);

        const transactions = [
            ...goldTxs.map(tx => {
                const obj = tx.toObject();
                obj.user = obj.userId;
                obj.metalType = 'gold';
                return obj;
            }),
            ...silverTxs.map(tx => {
                const obj = tx.toObject();
                obj.user = obj.userId;
                obj.metalType = 'silver';
                return obj;
            })
        ].sort((a, b) => b.createdAt - a.createdAt);

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Srivishva jewellers Compliance Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; background-color: #f8fafc; }
                .container { max-width: 1000px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #064E3B; text-align: center; border-bottom: 2px solid #10B981; padding-bottom: 15px; }
                table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 14px; }
                th { background-color: #f1f5f9; color: #0f172a; font-weight: 700; }
                tr:nth-child(even) { background-color: #f8fafc; }
                .gold { color: #b45309; font-weight: 600; background: #fef3c7; padding: 2px 6px; border-radius: 4px; }
                .silver { color: #475569; font-weight: 600; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
                .status-sale { color: #ef4444; font-weight: bold; }
                .status-purchase { color: #10b981; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Srivishva jewellers - Financial Compliance</h1>
                <p><strong>Generated on:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Total Transactions:</strong> ${transactions.length}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Transaction ID</th>
                            <th>User Name</th>
                            <th>Mobile</th>
                            <th>Metal</th>
                            <th>Type</th>
                            <th>Weight (g)</th>
                            <th>Amount (&#8377;)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(tx => `
                            <tr>
                                <td>${new Date(tx.createdAt).toLocaleDateString()}</td>
                                <td style="font-family: monospace;">${tx._id.toString().substring(0, 8)}...</td>
                                <td>${tx.user?.fullName || 'N/A'}</td>
                                <td>${tx.user?.mobile || 'N/A'}</td>
                                <td><span class="${tx.metalType}">${tx.metalType.toUpperCase()}</span></td>
                                <td class="status-${tx.transactionType}">${tx.transactionType.toUpperCase()}</td>
                                <td>${parseFloat(tx.goldWeight || tx.silverWeight || 0).toFixed(6)}</td>
                                <td>${parseFloat(tx.amount).toLocaleString('en-IN')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </body>
        </html>
        `;

        res.setHeader('Content-disposition', 'attachment; filename=Srivishva_Compliance_Report.html');
        res.setHeader('Content-type', 'text/html');
        return res.send(htmlContent);

    } catch (error) {
        logger.error('Error generating compliance report:', error);
        res.status(500).send('Internal Server Error generating report');
    }
});

/**
 * @route   GET /api/admin/reports/pdf/ledger
 * @desc    Generate master ledger PDF (Server-side)
 * @access  Admin
 */
router.get('/reports/pdf/ledger', async (req, res) => {
    try {
        const [goldTxs, silverTxs] = await Promise.all([
            GoldLedger.find().populate('userId', 'fullName mobile').sort({ createdAt: -1 }),
            SilverLedger.find().populate('userId', 'fullName mobile').sort({ createdAt: -1 })
        ]);

        const transactions = [
            ...goldTxs.map(tx => {
                const obj = tx.toObject();
                obj.user = obj.userId;
                obj.metalType = 'gold';
                return obj;
            }),
            ...silverTxs.map(tx => {
                const obj = tx.toObject();
                obj.user = obj.userId;
                obj.metalType = 'silver';
                return obj;
            })
        ].sort((a, b) => b.createdAt - a.createdAt);

        const doc = new PDFDocument({ margin: 30, size: 'A4' });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Srivishva_Ledger.pdf');

        // Pipe PDF to response
        doc.pipe(res);

        // Header section
        doc.fillColor('#064E3B').fontSize(18).text('Srivishva jewellers - Master Ledger Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor('#64748B').fontSize(10).text(`Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
        doc.moveDown(1.5);

        // Summary Statistics
        const goldReserve = goldTxs.reduce((sum, tx) => sum + (tx.transactionType === 'purchase' ? parseFloat(tx.goldWeight || 0) : -parseFloat(tx.goldWeight || 0)), 0);
        const silverReserve = silverTxs.reduce((sum, tx) => sum + (tx.transactionType === 'purchase' ? parseFloat(tx.silverWeight || 0) : -parseFloat(tx.silverWeight || 0)), 0);

        doc.fontSize(12).fillColor('#1E293B').text(`Record Summary:`, { underline: true });
        doc.fontSize(10).text(`Total Transactions: ${transactions.length}`);
        doc.text(`Digital Gold Reserve: ${goldReserve.toFixed(6)}g`);
        doc.text(`Digital Silver Reserve: ${silverReserve.toFixed(6)}g`);
        doc.moveDown(1);

        // Define table data
        const rows = transactions.map(tx => [
            new Date(tx.createdAt).toLocaleDateString(),
            (tx.user?.fullName || tx.user?.mobile || 'N/A').substring(0, 15),
            tx.metalType.toUpperCase(),
            tx.transactionType.toUpperCase(),
            (tx.goldWeight || tx.silverWeight || 0).toString() + 'g',
            'INR ' + parseFloat(tx.amount).toLocaleString('en-IN')
        ]);

        const table = {
            title: "Detailed Ledger Log",
            headers: ["Date", "User", "Metal", "Type", "Weight", "Amount"],
            rows: rows,
        };

        // Render table
        await doc.table(table, {
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(9),
            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                doc.font("Helvetica").fontSize(8);
                indexColumn === 0 && doc.addBackground(rectRow, (indexRow % 2) ? '#F8FAFC' : '#FFFFFF', 0.5);
            },
        });

        // Finalize PDF
        doc.end();

    } catch (error) {
        logger.error('Backend PDF Error:', error);
        res.status(500).send('Internal Server Error generating PDF');
    }
});

/**
 * @route   GET /api/admin/reports/pdf/summary
 * @desc    Generate system summary PDF (Server-side)
 * @access  Admin
 */
router.get('/reports/pdf/summary', async (req, res) => {
    try {
        const [totalUsers, clientsCount, goldResult, silverResult] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'client' }),
            GoldLedger.aggregate([{ $group: { _id: null, total: { $sum: "$goldWeight" } } }]),
            SilverLedger.aggregate([{ $group: { _id: null, total: { $sum: "$silverWeight" } } }])
        ]);

        const goldRes = goldResult[0]?.total || 0;
        const silverRes = silverResult[0]?.total || 0;

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Srivishva_jewellers_Summary.pdf');
        doc.pipe(res);

        doc.fontSize(20).text('Srivishva jewellers', { align: 'center' });
        doc.fontSize(14).text('Digital Asset & System Summary', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12).text(`Report Date: ${new Date().toLocaleString('en-IN')}`);
        doc.moveDown();

        const table = {
            headers: ["Metric", "Value"],
            rows: [
                ["Total Registered Users", totalUsers.toString()],
                ["Active Clients", clientsCount.toString()],
                ["Current Gold Inventory", goldRes.toFixed(4) + "g"],
                ["Current Silver Inventory", silverRes.toFixed(4) + "g"],
                ["System Status", "OPERATIONAL"],
                ["Environment", "Production-Vite/Expo"]
            ]
        };

        await doc.table(table, { width: 300 });

        doc.moveDown();
        doc.fontSize(10).fillColor('grey').text('This is an automated system report. Confidential.', { align: 'center' });

        doc.end();
    } catch (error) {
        logger.error('Summary PDF Error:', error);
        res.status(500).send('Error');
    }
});

/**
 * @route   GET /api/admin/kyc/pending
 * @desc    Get pending KYC verifications
 * @access  Admin
 */
router.get('/kyc/pending', async (req, res) => {
    try {
        const pendingKYC = await KYC.find({ status: 'pending' })
            .populate('userId', 'fullName mobile email')
            .sort({ createdAt: -1 });

        // Also check for users who might be stuck with kycStatus 'pending' but no KYC doc
        const usersPending = await User.find({ kycStatus: 'pending' }, 'fullName mobile email createdAt');
        
        const existingUserIds = pendingKYC.map(k => k.userId?._id?.toString() || k.userId?.toString());
        const stuckUsers = usersPending.filter(u => !existingUserIds.includes(u._id.toString()));

        const formattedStuck = stuckUsers.map(u => ({
            _id: `stuck-${u._id}`,
            userId: u,
            user: u,
            status: 'pending',
            documentType: 'NOT_UPLOADED_YET',
            createdAt: u.createdAt || new Date(),
        }));

        const finalData = [
            ...pendingKYC.map(k => {
                const obj = k.toObject();
                obj.user = obj.userId;
                return obj;
            }),
            ...formattedStuck
        ];

        res.json({
            success: true,
            data: finalData,
            count: finalData.length,
        });
    } catch (error) {
        logger.error('Error fetching pending KYC:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   POST /api/admin/kyc/:id/verify
 * @desc    Verify KYC document
 * @access  Admin
 */
router.post('/kyc/:id/verify', async (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'
        let kycDoc = null;
        let userId = null;

        if (req.params.id.startsWith('stuck-')) {
            userId = req.params.id.replace('stuck-', '');
            // Let's see if we can create a minimalist KYC record for history tracking
            kycDoc = await KYC.findOne({ userId });
            if (!kycDoc) {
                kycDoc = new KYC({ 
                    userId, 
                    documentType: 'ADMIN_MANUAL_CONSENT',
                    status: 'pending' 
                });
            }
        } else {
            kycDoc = await KYC.findById(req.params.id);
        }

        if (!kycDoc) {
            return res.status(404).json({
                success: false,
                message: 'KYC document or User not found',
            });
        }

        userId = userId || kycDoc.userId;

        const newStatus = action === 'approve' ? 'verified' : 'rejected';
        kycDoc.status = newStatus;
        kycDoc.verifiedAt = new Date();
        await kycDoc.save();

        if (action === 'approve') {
            const ReferralService = require('../services/ReferralService');
            const NotificationService = require('../services/NotificationService');

            await User.findByIdAndUpdate(userId, { kycStatus: 'verified' });

            ReferralService.processReferralBonus(userId);
            NotificationService.sendNotification(
                userId,
                'Identity Verified! ✅',
                'Your KYC documents have been approved. You can now start investing in Gold & Silver.',
                'kyc'
            );
        } else {
            const NotificationService = require('../services/NotificationService');
            await User.findByIdAndUpdate(userId, { kycStatus: 'rejected' });
            NotificationService.sendNotification(
                userId,
                'KYC Update ⚠️',
                'Your identity verification was not successful. Please re-submit your documents or contact support.',
                'kyc'
            );
        }

        res.json({
            success: true,
            message: `KYC ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
            data: kycDoc,
        });
    } catch (error) {
        logger.error('Error verifying KYC:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   POST /api/admin/payments/:id/release
 * @desc    Release payment from escrow
 * @access  Admin
 */
router.post('/payments/:id/release', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found',
            });
        }

        payment.status = 'released';
        payment.releasedAt = new Date();
        await payment.save();

        res.json({
            success: true,
            message: 'Payment released successfully',
            data: payment,
        });
    } catch (error) {
        logger.error('Error releasing payment:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard stats from database
 * @access  Admin
 */
router.get('/dashboard', async (req, res) => {
    try {
        const [
            totalUsers,
            totalClients,
            totalBookings,
            pendingKYC,
            goldInvResult,
            silverInvResult,
            activeGoldPlans,
            activeSilverPlans,
            revResult
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'client' }),
            Booking.countDocuments(),
            KYC.countDocuments({ status: 'pending' }),
            User.aggregate([{ $group: { _id: null, total: { $sum: "$goldBalance" } } }]),
            User.aggregate([{ $group: { _id: null, total: { $sum: "$silverBalance" } } }]),
            GoldInvestment.countDocuments({ status: 'active' }),
            SilverInvestment.countDocuments({ status: 'active' }),
            Payment.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ])
        ]);

        const goldInventory = goldInvResult[0]?.total || 0;
        const silverInventory = silverInvResult[0]?.total || 0;
        const totalRevenue = revResult[0]?.total || 0;

        const stats = {
            totalUsers,
            totalClients,
            totalBookings,
            pendingKYC,
            totalRevenue: parseFloat(totalRevenue).toFixed(2),
            activePlans: {
                gold: activeGoldPlans,
                silver: activeSilverPlans
            },
            inventory: {
                gold: parseFloat(goldInventory).toFixed(6),
                silver: parseFloat(silverInventory).toFixed(6)
            }
        };

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        logger.error('Error fetching admin dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   POST /api/admin/users/:userId/notify-missed-plan
 * @desc    Send manual notification for missed savings plan
 * @access  Admin
 */
router.post('/users/:userId/notify-missed-plan', async (req, res) => {
    try {
        const { userId } = req.params;
        const NotificationService = require('../services/NotificationService');

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const investment = await GoldInvestment.findOne({ userId, status: 'active' });

        await NotificationService.sendMissedInstallmentReminder(
            userId,
            investment ? investment._id : 'manual',
            'gold',
            user.investmentPlan || 'plan-a',
            investment ? (investment.installmentsPaid + 1) : 1,
            1
        );

        res.json({
            success: true,
            message: `Notification sent to ${user.fullName || user.mobile}`,
        });
    } catch (error) {
        console.error('Error sending manual notification:', error);
        res.status(500).json({ success: false, message: 'Failed to send notification' });
    }
});

/**
 * @route   POST /api/admin/users/:userId/enroll
 * @desc    Enroll user in a savings plan
 * @access  Admin
 */
router.post('/users/:userId/enroll', async (req, res) => {
    try {
        const { userId } = req.params;
        const { planType, metalType = 'gold' } = req.body;
        const NotificationService = require('../services/NotificationService');

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let investment;
        if (metalType === 'gold') {
            investment = await GoldInvestment.create({
                userId,
                planType,
                status: 'active',
                startDate: new Date(),
                nextInstallmentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        } else {
            investment = await SilverInvestment.create({
                userId,
                planType,
                status: 'active',
                startDate: new Date(),
                nextInstallmentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        }

        if (!user.investmentPlan) {
            user.investmentPlan = planType;
            await user.save();
        }

        await NotificationService.sendSchemeWelcomeNotification(userId, planType, metalType);

        res.json({
            success: true,
            message: `User enrolled in ${planType.toUpperCase()} successfully`,
            data: investment
        });
    } catch (error) {
        console.error('Error enrolling user:', error);
        res.status(500).json({ success: false, message: 'Failed to enroll user' });
    }
});

/**
 * @route   GET /api/admin/payments
 * @desc    Get all payment records (Razorpay/Internal)
 * @access  Admin
 */
router.get('/payments', async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('userId', 'fullName mobile')
            .sort({ createdAt: -1 });

        const formatted = payments.map(p => {
           const obj = p.toObject();
           obj.user = obj.userId;
           return obj;
        });

        res.json({
            success: true,
            data: formatted,
            count: formatted.length
        });
    } catch (error) {
        logger.error('Error fetching admin payments:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   GET /api/admin/reminders
 * @desc    Get all missed payment reminders
 * @access  Admin
 */
router.get('/reminders', async (req, res) => {
    try {
        // Ensure database is connected
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            logger.warn('⚠️ MongoDB not connected, attempting to reconnect...');
            await require('../config/database')();
        }

        // Add timeout to prevent hanging queries
        const reminders = await SavingsPlanReminder.find()
            .populate('userId', 'fullName mobile')
            .sort({ createdAt: -1 })
            .maxTimeMS(5000); // 5 second timeout

        const processed = reminders.map(r => {
            const data = r.toObject();
            data.user = data.userId;
            const remindedAt = new Date(data.reminderSentAt);
            const daysSince = Math.floor((new Date() - remindedAt) / (1000 * 60 * 60 * 24));
            
            return {
                ...data,
                daysSinceReminder: daysSince >= 0 ? daysSince : 0
            };
        });

        res.json({
            success: true,
            data: processed,
            count: processed.length
        });
    } catch (error) {
        logger.error('Error fetching admin reminders:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   POST /api/admin/payments/:id/refund
 * @desc    Issue refund for a payment
 * @access  Admin
 */
router.post('/payments/:id/refund', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        payment.status = 'refunded';
        payment.refundedAt = new Date();
        await payment.save();

        res.json({
            success: true,
            message: 'Payment marked as refunded',
            data: payment
        });
    } catch (error) {
        logger.error('Error refunding payment:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   GET /api/admin/referrals
 * @desc    Get all users with their referral counts
 * @access  Admin
 */
router.get('/referrals', async (req, res) => {
    try {
        // Find all users who have referred someone (referralCount > 0)
        const usersWithReferrals = await User.find({ 
            referralCount: { $gt: 0 } 
        })
        .select('fullName email mobile referralCount referralCode')
        .sort({ referralCount: -1 });

        // Format the data
        const referrals = usersWithReferrals.map(user => ({
            id: user._id,
            user: {
                fullName: user.fullName,
                email: user.email,
                mobile: user.mobile
            },
            referralCount: user.referralCount || 0,
            referralCode: user.referralCode
        }));

        res.json({
            success: true,
            data: referrals,
            count: referrals.length
        });
    } catch (error) {
        logger.error('Error fetching admin referrals:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   PATCH /api/admin/users/:id
 * @desc    Update user information
 * @access  Admin
 */
router.patch('/users/:id', async (req, res) => {
    try {
        const { fullName, email, mobile, investmentPlan, role, kycStatus, isActive } = req.body;
        
        // Build update object with only provided fields
        const updateFields = {};
        if (fullName !== undefined) updateFields.fullName = fullName;
        if (email !== undefined) updateFields.email = email;
        if (mobile !== undefined) updateFields.mobile = mobile;
        if (investmentPlan !== undefined) updateFields.investmentPlan = investmentPlan;
        if (role !== undefined) updateFields.role = role;
        if (kycStatus !== undefined) updateFields.kycStatus = kycStatus;
        if (isActive !== undefined) updateFields.isActive = isActive;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        logger.info(`User ${req.params.id} updated by admin`);

        res.json({
            success: true,
            message: 'User updated successfully',
            data: user
        });
    } catch (error) {
        logger.error('Error updating user:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating user',
            error: error.message 
        });
    }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete a user
 * @access  Admin
 */
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Optionally: Delete related data
        // await KYC.deleteMany({ userId: req.params.id });
        // await BankDetail.deleteMany({ userId: req.params.id });
        // await GoldLedger.deleteMany({ userId: req.params.id });
        // await SilverLedger.deleteMany({ userId: req.params.id });

        logger.info(`User ${req.params.id} deleted by admin`);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting user:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting user',
            error: error.message 
        });
    }
});

router.get('/metal-prices', (req, res) => {
    res.json({ success: true, data: MetalPriceService.getPriceData() });
});

// POST to update prices manually
router.post('/metal-prices', (req, res) => {
    const { goldPerGram, silverPerGram } = req.body;
    if (goldPerGram !== undefined) MetalPriceService.setGoldPrice(goldPerGram);
    if (silverPerGram !== undefined) MetalPriceService.setSilverPrice(silverPerGram);
    res.json({ success: true, data: MetalPriceService.getPriceData() });
});

const carouselStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/carousel');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `carousel_${Date.now()}${ext}`);
    }
});
const uploadCarousel = multer({
    storage: carouselStorage,
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

/**
 * @route   GET /api/admin/carousel
 * @desc    Get all carousel images (admin view)
 */
router.get('/carousel', async (req, res) => {
    try {
        const images = await CarouselImage.find().sort({ order: 1, createdAt: -1 });
        res.json({ success: true, data: images });
    } catch (error) {
        logger.error('Error fetching carousel images:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   POST /api/admin/carousel
 * @desc    Upload a new carousel image
 */
router.post('/carousel', uploadCarousel.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }
        const { title, order } = req.body;
        const imageUrl = `/uploads/carousel/${req.file.filename}`;

        const image = await CarouselImage.create({
            imageUrl,
            title: title || '',
            order: order ? parseInt(order) : 0,
            isActive: true,
        });

        res.json({ success: true, data: image });
    } catch (error) {
        logger.error('Error uploading carousel image:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   PATCH /api/admin/carousel/:id
 * @desc    Update carousel image (toggle active, change order/title)
 */
router.patch('/carousel/:id', async (req, res) => {
    try {
        const { isActive, order, title } = req.body;
        const update = {};
        if (isActive !== undefined) update.isActive = isActive;
        if (order !== undefined) update.order = parseInt(order);
        if (title !== undefined) update.title = title;

        const image = await CarouselImage.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!image) return res.status(404).json({ success: false, message: 'Image not found' });

        res.json({ success: true, data: image });
    } catch (error) {
        logger.error('Error updating carousel image:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

/**
 * @route   DELETE /api/admin/carousel/:id
 * @desc    Delete a carousel image (also removes file from disk)
 */
router.delete('/carousel/:id', async (req, res) => {
    try {
        const image = await CarouselImage.findByIdAndDelete(req.params.id);
        if (!image) return res.status(404).json({ success: false, message: 'Image not found' });

        // Remove file from disk
        const filePath = path.join(__dirname, '..', image.imageUrl);
        fs.unlink(filePath, (err) => {
            if (err) logger.warn('Could not delete carousel file:', err.message);
        });

        res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        logger.error('Error deleting carousel image:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
