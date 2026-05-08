const { User, sequelize } = require('./src/models');

async function checkUsers() {
    try {
        await sequelize.authenticate();
        const users = await User.findAll({ attributes: ['fullName', 'mobile', 'role'] });
        console.log('--- Current Users in DB ---');
        users.forEach(u => {
            console.log(`Role: ${u.role} | Mobile: ${u.mobile} | Name: ${u.fullName}`);
        });
    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

checkUsers();
