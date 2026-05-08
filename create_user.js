const bcrypt = require('bcryptjs');
const { User, sequelize } = require('./src/models');

async function createChellu() {
    try {
        await sequelize.authenticate();

        const fullName = 'chellu';
        const mobile = '0567471629';
        const plainPassword = 'password123';

        // Check if user already exists
        const existingUser = await User.findOne({ where: { mobile } });
        if (existingUser) {
            console.log(`User with mobile ${mobile} already exists.`);
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash(plainPassword, 12);

        const user = await User.create({
            fullName,
            mobile,
            password: hashedPassword,
            role: 'client',
            kycStatus: 'pending',
            investmentPlan: 'plan-a',
            goldBalance: 0,
            isActive: true
        });

        console.log('✅ User created successfully!');
        console.log(`Name: ${user.fullName}`);
        console.log(`Mobile: ${user.mobile}`);
        console.log(`Role: ${user.role}`);

    } catch (error) {
        console.error('❌ Error creating user:', error);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

createChellu();
