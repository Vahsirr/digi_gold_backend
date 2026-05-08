const cron = require('node-cron');
const NotificationService = require('../services/NotificationService');
const logger = require('../utils/logger');

class CronScheduler {
    /**
     * Initialize all cron jobs
     */
    static init() {
        // Check for missed installments daily at 10:00 AM IST
        cron.schedule('0 10 * * *', async () => {
            logger.info('Running daily missed installment check...');
            try {
                await NotificationService.checkMissedInstallments();
                logger.info('Missed installment check completed successfully');
            } catch (error) {
                logger.error('Error in missed installment cron job:', error);
            }
        }, {
            timezone: 'Asia/Kolkata'
        });

        // Send reminder at 6:00 PM IST as well
        cron.schedule('0 18 * * *', async () => {
            logger.info('Running evening missed installment check...');
            try {
                await NotificationService.checkMissedInstallments();
                logger.info('Evening missed installment check completed successfully');
            } catch (error) {
                logger.error('Error in evening missed installment cron job:', error);
            }
        }, {
            timezone: 'Asia/Kolkata'
        });

        logger.info('Cron jobs initialized successfully');
    }
}

module.exports = CronScheduler;
