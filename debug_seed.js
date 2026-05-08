const connectDB = require('./src/config/database');
const seedDatabase = require('./src/utils/seeder');

(async () => {
    try {
        await connectDB();
        await seedDatabase();
        console.log('✅ Seeding complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();
