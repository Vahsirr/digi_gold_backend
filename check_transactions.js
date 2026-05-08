const { Payment, GoldLedger, SilverLedger, User } = require('./src/models');
const logger = require('./src/utils/logger');

async function checkRecentTransactions() {
    try {
        console.log('\n--- 💳 RECENT PAYMENTS ---');
        const payments = await Payment.findAll({
            limit: 5,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'user', attributes: ['fullName', 'email'] }]
        });

        if (payments.length === 0) console.log('No payments found.');
        payments.forEach(p => {
            console.log(`[${p.createdAt.toISOString()}] User: ${p.user?.fullName} | Amt: ₹${p.amount} | Status: ${p.status} | Gateway: ${p.paymentGateway} | Ref: ${p.transactionId}`);
        });

        console.log('\n--- 🟡 RECENT GOLD TRANSACTIONS (SCHEMES) ---');
        const gold = await GoldLedger.findAll({
            limit: 5,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'user', attributes: ['fullName'] }]
        });

        if (gold.length === 0) console.log('No gold transactions found.');
        gold.forEach(g => {
            console.log(`[${g.createdAt.toISOString()}] User: ${g.user?.fullName} | Weight: ${g.weight}g | Price: ₹${g.price}/g | Desc: ${g.description}`);
        });

        console.log('\n--- ⚪ RECENT SILVER TRANSACTIONS (SCHEMES) ---');
        const silver = await SilverLedger.findAll({
            limit: 5,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'user', attributes: ['fullName'] }]
        });

        if (silver.length === 0) console.log('No silver transactions found.');
        silver.forEach(s => {
            console.log(`[${s.createdAt.toISOString()}] User: ${s.user?.fullName} | Weight: ${s.weight}g | Price: ₹${s.price}/g | Desc: ${s.description}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        process.exit(1);
    }
}

checkRecentTransactions();
