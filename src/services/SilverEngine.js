const axios = require('axios');
const logger = require('../utils/logger');

// class SilverEngine {
//     constructor() {
//         this.currentPrice = 165; // Realistic market price per gram (April 2026)
//         this.lastUpdateTime = new Date();
//         this.priceLocks = new Map(); // Store locks: { lockId: { price, expiry } }
//     }

//     /**
//      * Polls live silver price using MetalPriceService
//      * New API: metalpriceapi.com
//      */
//     async pollLivePrice(force = false) {
//         const MetalPriceService = require('./MetalPriceService');
//         const fiveMinutes = parseInt(process.env.GOLD_PRICE_POLL_INTERVAL_MS) || 5 * 60 * 1000;
//         const now = new Date();
        
//         // Cooldown check for live external fetch
//         if (!force && (now - this.lastUpdateTime < fiveMinutes) && this.currentPrice > 100) {
//             // logger.debug('Silver price poll skipped (cooldown active)');
//             return this.currentPrice;
//         }

//         try {
//             await MetalPriceService.fetchPrices();
//             const pricePerGramInr = MetalPriceService.getSilverPricePerGram();
            
//             if (pricePerGramInr > 0) {
//                 // Apply 3.5% premium as per previous requirement
//                 this.currentPrice = pricePerGramInr * 1.035;
//                 this.lastUpdateTime = new Date();
//                 logger.info(`⚪ Silver price updated (metalpriceapi.com): ₹${this.currentPrice.toFixed(2)}/gram`);
//                 return this.currentPrice;
//             }

//             // Fallback to simulation if price is 0
//             throw new Error('Retrieved silver price is zero');

//         } catch (error) {
//             const errMsg = error.message || String(error);
//             logger.error(`Error polling silver price from API: ${errMsg}`);
//             // Fallback: Slight fluctuation
//             const fluctuation = (Math.random() - 0.5) * 0.5;
//             this.currentPrice += fluctuation;
//             this.lastUpdateTime = new Date();
//             return this.currentPrice;
//         }
//     }

//     getCurrentPrice() {
//         return this.currentPrice;
//     }

//     /**
//      * Section 3.0: 5 minute Price Lock
//      */
//     async lockPrice(userId) {
//         const lockId = `silver_lock_${userId}_${Date.now()}`;
//         const lockedPrice = this.currentPrice;
//         const expiry = Date.now() + 300000; // 5 minutes lock

//         this.priceLocks.set(lockId, {
//             price: lockedPrice,
//             expiry: expiry,
//             userId: userId
//         });

//         // Auto-cleanup lock
//         setTimeout(() => {
//             this.priceLocks.delete(lockId);
//         }, 310000);

//         return { lockId, lockedPrice, expiry };
//     }

//     verifyLock(lockId, userId) {
//         const lock = this.priceLocks.get(lockId);
//         if (!lock) return { valid: false, message: 'Price lock expired' };
//         if (lock.userId !== userId) return { valid: false, message: 'Unauthorized lock' };
//         if (Date.now() > lock.expiry) return { valid: false, message: 'Price lock expired' };

//         return { valid: true, price: lock.price };
//     }

//     /**
//      * Grammage conversion logic
//      */
//     convertToGrams(amountInInr, pricePerGram) {
//         return amountInInr / pricePerGram;
//     }

//     calculateIncentive(amountInInr, dayOfInvestment) {
//         // Assuming same logic as Gold for now
//         // Section 2.1 Logic:
//         // Day 1-75: 5%
//         // Day 76-150: 3%
//         // Day 151-225: 3%
//         // Day 226-330: 1%

//         let percentage = 0;
//         if (dayOfInvestment <= 75) percentage = 0.05;
//         else if (dayOfInvestment <= 150) percentage = 0.03;
//         else if (dayOfInvestment <= 225) percentage = 0.03;
//         else if (dayOfInvestment <= 330) percentage = 0.01;

//         return amountInInr * percentage;
//     }
// }

class SilverEngine {
    constructor() {
        this.priceLocks = new Map();
    }

    getCurrentPrice() {
        const MetalPriceService = require('./MetalPriceService');
        return MetalPriceService.getSilverPricePerGram();
    }

    async lockPrice(userId) {
        const lockId = `silver_lock_${userId}_${Date.now()}`;
        const lockedPrice = this.getCurrentPrice();
        const expiry = Date.now() + 300000;

        this.priceLocks.set(lockId, { price: lockedPrice, expiry, userId });
        setTimeout(() => this.priceLocks.delete(lockId), 310000);

        return { lockId, lockedPrice, expiry };
    }

    verifyLock(lockId, userId) {
        const lock = this.priceLocks.get(lockId);
        if (!lock) return { valid: false, message: 'Price lock expired' };
        if (lock.userId !== userId) return { valid: false, message: 'Unauthorized lock' };
        if (Date.now() > lock.expiry) return { valid: false, message: 'Price lock expired' };
        return { valid: true, price: lock.price };
    }

    convertToGrams(amountInInr, pricePerGram) {
        return amountInInr / pricePerGram;
    }

    calculateIncentive(amountInInr, dayOfInvestment) {
        let percentage = 0;
        if (dayOfInvestment <= 75) percentage = 0.05;
        else if (dayOfInvestment <= 150) percentage = 0.03;
        else if (dayOfInvestment <= 225) percentage = 0.03;
        else if (dayOfInvestment <= 330) percentage = 0.01;
        return amountInInr * percentage;
    }
}

module.exports = new SilverEngine();
