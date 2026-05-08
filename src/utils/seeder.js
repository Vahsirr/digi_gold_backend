const bcrypt = require('bcryptjs');
const { User, KYC, GoldLedger, SilverLedger, GoldInvestment, SilverInvestment, Service, Notification, SavingsPlanReminder } = require('../models');
const logger = require('./logger');

const seedDatabase = async () => {
    try {
        logger.info('🌱 Starting database seeding...');

        // Clear existing data
        await User.deleteMany({});
        await KYC.deleteMany({});
        await GoldLedger.deleteMany({});
        await SilverLedger.deleteMany({});
        await GoldInvestment.deleteMany({});
        await SilverInvestment.deleteMany({});
        await Service.deleteMany({});
        await Notification.deleteMany({});
        await SavingsPlanReminder.deleteMany({});

        logger.info('🗑️ All collections cleared.');

        // Create Admin
        const admin = await User.create({
            fullName: 'Sri Vishva Admin',
            mobile: '0000000000',
            password: 'password_admin_123',
            role: 'admin',
            kycStatus: 'verified',
            isActive: true,
        });
        logger.info('✅ Admin user created.');

        // Create Client
        const client = await User.create({
            fullName: 'Rasul',
            mobile: '9876543210',
            password: 'password123',
            role: 'client',
            kycStatus: 'verified',
            investmentPlan: 'plan-a',
            goldBalance: 5.25,
            silverBalance: 50.0,
            portfolioValue: 35000.0,
            isActive: true,
        });
        logger.info('✅ Client Rasul created.');

        // Create Pending KYC user
        const testUser = await User.create({
            fullName: 'Srivishva Jewellers Client',
            mobile: '1234567890',
            password: 'password123',
            role: 'client',
            kycStatus: 'pending',
            isActive: true,
        });

        await KYC.create({
            userId: testUser._id,
            panNumber: 'ABCDE1234F',
            aadhaarNumber: '123456789012',
            status: 'pending',
        });
        logger.info('✅ KYC test user created.');

        // Create services
        await Service.insertMany([
            { providerId: admin._id, title: 'Professional Gold Appraisal', description: 'Expert valuation of your physical gold assets.', category: 'appraisal', priceFiat: 500, priceGold: 0.05, duration: '45 mins', isActive: true },
            { providerId: admin._id, title: 'High-Security Vaulting', description: 'Insured storage for your physical precious metals.', category: 'vault', priceFiat: 1200, priceGold: 0.12, duration: 'Annual', isActive: true },
            { providerId: admin._id, title: 'Metal Purity Testing', description: 'XRF testing for precise metal composition analysis.', category: 'testing', priceFiat: 350, priceGold: 0.03, duration: '20 mins', isActive: true },
        ]);
        logger.info('✅ Services seeded.');

        // Create ledger entries
        await GoldLedger.insertMany([
            { userId: client._id, transactionType: 'purchase', goldWeight: 1.5, amount: 9000, goldPriceAtTime: 6000, balanceAfter: 1.5, description: 'Direct purchase' },
            { userId: client._id, transactionType: 'purchase', goldWeight: 3.75, amount: 22500, goldPriceAtTime: 6000, balanceAfter: 5.25, description: 'Monthly SIP Investment' },
        ]);

        await SilverLedger.insertMany([
            { userId: client._id, transactionType: 'purchase', silverWeight: 50, amount: 3500, goldPriceAtTime: 70, balanceAfter: 50, description: 'Initial silver investment' },
        ]);
        logger.info('✅ Ledger transactions seeded.');

        logger.info('✅ Database seeding complete!');
    } catch (error) {
        logger.error('❌ Seeding error:', error.message);
        throw error;
    }
};

module.exports = seedDatabase;
