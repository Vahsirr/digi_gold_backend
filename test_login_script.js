const bcrypt = require('bcryptjs');
const { User, sequelize } = require('./src/models');

async function testLogin() {
    try {
        await sequelize.authenticate();
        const user = await User.findOne({ where: { mobile: '0000000000' } });
        if (!user) {
            console.log('User not found');
            return;
        }
        console.log('User found:', user.fullName);
        const isValid = await bcrypt.compare('123456789', user.password);
        console.log('Password valid:', isValid);
    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

testLogin();
