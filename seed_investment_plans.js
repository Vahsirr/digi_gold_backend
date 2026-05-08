/**
 * Seed Investment Plans to Database
 * Run this script once to populate the database with investment plans
 * Usage: node seed_investment_plans.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const InvestmentPlan = require('./src/models/InvestmentPlan');
const logger = require('./src/utils/logger');

const investmentPlans = [
    {
        planId: 'plan-a',
        name: 'Gold Savings Scheme: Tiered Incentive (11-Month SIP)',
        description: 'Earn up to 5% bonus gold weight based on your investment duration',
        features: [
            'Up to 5% bonus extra weight',
            'Structured 11-month plan',
            'Highest accumulation rate',
            'Dedicated wealth manager',
        ],
        bonusPercentage: 5,
        metalType: 'both',
        isActive: true,
        terms: [
            { label: 'Term 1', subLabel: '75 days', value: '5.0% bonus weight', color: '#10B981', bonus: 0.05 },
            { label: 'Term 2', subLabel: '75-150days', value: '3.0% bonus weight', color: '#3B82F6', bonus: 0.03 },
            { label: 'Term 3', subLabel: '150-225days', value: '3.0% bonus weight', color: '#8B5CF6', bonus: 0.03 },
            { label: 'Term 4-11', subLabel: 'Accumulation', value: '1.0% bonus weight', color: '#F59E0B', bonus: 0.01 },
        ],
        advantages: [
            { icon: 'percent', title: '5% Extra', sub: 'High yield bonus' },
            { icon: 'calendar', title: 'Fixed Term', sub: 'Disciplined saving' },
            { icon: 'shield', title: 'Secure', sub: 'Guaranteed returns' }
        ]
    },
    {
        planId: 'plan-b',
        name: 'Direct Investment Plan',
        description: 'Earn a flat 3% bonus weight on all flexible purchases',
        features: [
            'Flexible purchase amounts',
            'Anytime liquidity',
            'Market-linked growth',
        ],
        bonusPercentage: 3,
        metalType: 'both',
        isActive: true,
        terms: [
            { label: 'Flex Phase', subLabel: 'Anytime', value: '3.0% Instant Bonus', color: '#3B82F6', bonus: 0.03, id: 'flex' },
            { label: 'Redemptions', subLabel: 'Anytime', value: 'Instant Liquidity', color: '#10B981', bonus: 0, id: 'redemption' },
        ],
        advantages: [
            { icon: 'percent', title: '3% Bonus', sub: 'Every gram extra' },
            { icon: 'zap', title: 'Live Rate', sub: 'Market prices' },
            { icon: 'layout', title: 'Flexible', sub: 'Buy anytime' },
            { icon: 'layers', title: 'No Limit', sub: 'Unlimited buys' }
        ]
    },
    {
        planId: 'plan-c',
        name: 'Digital Gold Account',
        description: 'Secure your savings with 1% bonus weight on every transaction',
        features: [
            'Real-time wealth tracking',
            'Convert to physical anytime',
            'No lock-in period',
        ],
        bonusPercentage: 1,
        metalType: 'both',
        isActive: true,
        terms: [
            { label: 'Savings Phase', subLabel: 'Daily', value: '1.0% bonus weight', color: '#8B5CF6' },
            { label: 'Control', subLabel: 'Instant', value: 'Physical conversion', color: '#F59E0B' },
        ],
        advantages: [
            { icon: 'home', title: '1% Extra', sub: 'Stable growth' },
            { icon: 'activity', title: 'Real-Time', sub: 'Vault tracking' },
            { icon: 'arrow-up', title: 'Low Entry', sub: 'Start at ₹100' },
            { icon: 'shield-check', title: 'Certified', sub: 'BIS Hallmarked' }
        ]
    }
];

async function seedInvestmentPlans() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('✅ Connected to MongoDB');

        // Check if plans already exist
        const existingPlans = await InvestmentPlan.countDocuments();
        
        if (existingPlans > 0) {
            logger.info(`⚠️  Database already has ${existingPlans} investment plan(s)`);
            logger.info('Skipping seed. Delete existing plans first if you want to re-seed.');
            
            // Show existing plans
            const plans = await InvestmentPlan.find({}, 'planId name isActive');
            logger.info('\nExisting plans:');
            plans.forEach(plan => {
                logger.info(`  - ${plan.planId}: ${plan.name} (${plan.isActive ? 'Active' : 'Inactive'})`);
            });
            
            process.exit(0);
        }

        // Insert plans
        const result = await InvestmentPlan.insertMany(investmentPlans);
        logger.info(`✅ Successfully seeded ${result.length} investment plans`);
        
        result.forEach(plan => {
            logger.info(`  ✓ ${plan.planId}: ${plan.name}`);
        });

        logger.info('\n🎉 Seed completed successfully!');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Seed failed:', error);
        process.exit(1);
    }
}

seedInvestmentPlans();
