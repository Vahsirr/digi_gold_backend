const express = require('express');
const router = express.Router();
const { KYC, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const notificationService = require('../services/NotificationService');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');

const isVercel = process.env.VERCEL === '1';
const uploadDir = isVercel ? path.join(os.tmpdir(), 'uploads') : 'uploads/';

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
        console.warn('⚠️ Could not create upload directory:', err.message);
    }
}

const upload = multer({ dest: uploadDir });

/**
 * @route   GET /api/kyc/status
 * @desc    Get user KYC status
 * @access  Private
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        const kyc = await KYC.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, status: user.kycStatus, data: kyc });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/kyc/submit
 * @desc    Submit KYC documents
 * @access  Private
 */
router.post('/submit', authenticateToken, upload.array('docs'), async (req, res) => {
    try {
        const { docType, docNumber } = req.body;
        const docs = req.files ? req.files.map(f => f.path) : [];

        let kyc = await KYC.findOne({ userId: req.user.id });
        if (kyc) {
            kyc.documentType = docType;
            kyc.documentNumber = docNumber;
            kyc.documentUrls = docs;
            kyc.status = 'pending';
            await kyc.save();
        } else {
            kyc = await KYC.create({
                userId: req.user.id,
                documentType: docType,
                documentNumber: docNumber,
                documentUrls: docs,
                status: 'pending'
            });
        }

        await User.findByIdAndUpdate(req.user.id, { kycStatus: 'pending' });

        notificationService.sendNotification(
            req.user.id,
            '📄 KYC Submitted',
            'Your document verification request has been received and is under review.',
            'kyc'
        );

        res.status(201).json({ success: true, message: 'KYC submitted successfully', data: kyc });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
