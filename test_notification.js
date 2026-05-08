require('dotenv').config();
const { User } = require('./src/models');
const notificationService = require('./src/services/NotificationService');

async function testNotification() {
    try {
        // 1. Find the default admin user
        let user = await User.findOne({
            where: { mobile: '1234567890' }
        });

        if (!user) {
            console.log('❌ Admin user not found in database. Run npm run seed first!');
            process.exit(1);
        }

        // 2. PASTE YOUR REAL TOKEN HERE (from app logs: "REAL DEVICE FCM TOKEN")
        const REAL_DEVICE_TOKEN = ""; // e.g. "eKxy1234..."

        if (!user.fcmToken || REAL_DEVICE_TOKEN) {
            const tokenToUse = REAL_DEVICE_TOKEN || 'fcm_dummy_token_for_credentials_test';

            if (REAL_DEVICE_TOKEN) {
                console.log('🚀 Using REAL device token for test...');
            } else {
                console.log('⚠️ No real token found. Injecting a dummy token to test Firebase Admin credentials...');
            }

            await user.update({ fcmToken: tokenToUse });
        }

        console.log(`🔔 Sending test notification to User: ${user.fullName} (${user.id})`);
        console.log(`📱 Token: ${user.fcmToken}`);

        const result = await notificationService.sendNotification(
            user.id,
            'Test Notification 🚀',
            'If you see this, your Supabase/Firebase setup is working!',
            'system',
            { screen: 'Dashboard' }
        );

        console.log('✅ Notification request executed successfully!');
        process.exit(0);
    } catch (error) {
        if (error.message && error.message.includes('The registration token is not a valid FCM registration token')) {
            console.log('\n---------------------------------------------------------');
            console.log('🎉 GREAT NEWS: Your Firebase Credentials are VALID!');
            console.log('---------------------------------------------------------');
            console.log('The error "invalid registration token" is expected because we used a dummy token.');
            console.log('This proves your Private Key and Project ID are working perfectly.');
            console.log('\nTo see a REAL notification on your device:');
            console.log('1. Log in to the app on a physical device (or an emulator with Play Store)');
            console.log('2. Check the app logs for "Push Token: [actual-token]"');
            console.log('3. Paste that token into this script and run it again.');
            console.log('---------------------------------------------------------\n');
            process.exit(0);
        } else {
            console.error('❌ Error sending test notification:', error);
            process.exit(1);
        }
    }
}

testNotification();
