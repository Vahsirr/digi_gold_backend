const axios = require('axios');
const logger = require('../utils/logger');

// class GoldEngine {
//     constructor() {
//         this.currentPrice = 13200; // Realistic market price per gram (April 2026)
//         this.lastUpdateTime = new Date();
//         this.priceLocks = new Map(); // Store locks: { lockId: { price, expiry } }
//     }

//     /**
//      * Polls live gold price using MetalPriceService
//      * New API: metalpriceapi.com
//      * Endpoint: https://api.metalpriceapi.com/v1/latest
//      */
//     async pollLivePrice(force = false) {
//         const MetalPriceService = require('./MetalPriceService');
//         const fiveMinutes = parseInt(process.env.GOLD_PRICE_POLL_INTERVAL_MS) || 5 * 60 * 1000;
//         const now = new Date();
        
//         // Cooldown check for live external fetch
//         if (!force && (now - this.lastUpdateTime < fiveMinutes) && this.currentPrice > 10000) {
//             // logger.debug('Gold price poll skipped (cooldown active)');
//             return this.currentPrice;
//         }

//         try {
//             await MetalPriceService.fetchPrices();
//             const pricePerGramInr = MetalPriceService.getGoldPricePerGram();
            
//             if (pricePerGramInr > 0) {
//                 // Apply 3% premium as per previous requirement
//                 this.currentPrice = pricePerGramInr * 1.03;
//                 this.lastUpdateTime = new Date();
//                 logger.info(`💛 Gold price updated (metalpriceapi.com): ₹${this.currentPrice.toFixed(2)}/gram`);
//                 return this.currentPrice;
//             }

//             // Fallback to simulation if price is 0
//             throw new Error('Retrieved gold price is zero');

//         } catch (error) {
//             const errMsg = error.message || String(error);
//             logger.error(`Error polling gold price from API: ${errMsg}`);
//             // Fallback: Slight fluctuation on current price
//             const fluctuation = (Math.random() - 0.5) * 5;
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
//         const lockId = `lock_${userId}_${Date.now()}`;
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

class GoldEngine {
    constructor() {
        this.priceLocks = new Map();
    }

    getCurrentPrice() {
        const MetalPriceService = require('./MetalPriceService');
        return MetalPriceService.getGoldPricePerGram();
    }

    async lockPrice(userId) {
        const lockId = `lock_${userId}_${Date.now()}`;
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

module.exports = new GoldEngine();
