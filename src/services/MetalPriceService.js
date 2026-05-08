const axios = require('axios');
const logger = require('../utils/logger');

// class MetalPriceService {
//     constructor() {
//         this.cache = {
//             XAU: 0,
//             XAG: 0,
//             USDINR: 87, // fallback
//             lastUpdate: 0
//         };
//         this.cooldownMs = 60000; // 1 minute for more frequent updates
//         this.apiEndpoints = [
//             {
//                 name: 'gold-api-free',
//                 url: () => 'https://www.gold-api.com/api/price/XAU/INR',
//                 headers: () => ({ 'Content-Type': 'application/json' }),
//                 parse: (data) => {
//                     // Response: { price: 4869.00 } (per ounce in USD)
//                     if (data && data.price) {
//                         const pricePerOunceUSD = parseFloat(data.price);
//                         // Get USD to INR rate (approximately 83.5)
//                         const usdToInr = 83.5;
//                         const pricePerOunceINR = pricePerOunceUSD * usdToInr;
//                         const pricePerGram = pricePerOunceINR / 31.1034768;
                        
//                         return { 
//                             XAU: pricePerGram,
//                             XAG: pricePerGram * 0.012, // Approximate silver ratio
//                             INR: usdToInr
//                         };
//                     }
//                     return null;
//                 }
//             },
//             {
//                 name: 'metalpriceapi',
//                 url: (apiKey) => `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=USD&currencies=INR,EUR,XAU,XAG`,
//                 parse: (data) => {
//                     if (data.success && data.rates) {
//                         const { XAU, XAG, INR } = data.rates;
//                         return { XAU, XAG, INR };
//                     }
//                     return null;
//                 }
//             }
//         ];
//     }

//     async fetchPrices(force = false) {
//         const now = Date.now();
//         const apiKey = process.env.GOLD_API_KEY;
//         console.log('Fetching metal prices...', process.env.GOLD_API_KEY ? 'Using API' : 'No API key available');

//         // Rate limiting check: No more than once every minute unless forced
//         if (!force && now - this.cache.lastUpdate < this.cooldownMs && this.cache.XAU > 0) {
//             return this.cache;
//         }

//         // Try API if key is available
//         if (apiKey) {
//             for (const endpoint of this.apiEndpoints) {
//                 try {
//                     const url = endpoint.url(apiKey);
//                     const config = {
//                         timeout: 10000,
//                         headers: endpoint.headers ? endpoint.headers(apiKey) : {}
//                     };

//                     const response = await axios.get(url, config);
//                     console.log('The response from api is ', response.data)
//                     const parsed = endpoint.parse(response.data);

//                     if (parsed && parsed.XAU) {
//                         this.cache.XAU = parsed.XAU;
//                         this.cache.XAG = parsed.XAG || this.cache.XAG;
//                         this.cache.USDINR = parsed.INR || this.cache.USDINR;
//                         this.cache.lastUpdate = now;
                        
//                         logger.info(`💰 Prices updated via API (${endpoint.name}): Gold=₹${parsed.XAU.toFixed(2)}/g, Silver=₹${parsed.XAG?.toFixed(2) || 'N/A'}/g`);
//                         return this.cache;
//                     }
//                 } catch (error) {
//                     logger.warn(`Error fetching from ${endpoint.name}: ${error.message}`);
//                     continue;
//                 }
//             }
//         }

//         // Fallback: Use realistic market prices with slight fluctuations
//         // Base prices (approximate current market rates as of April 2026)
//         if (this.cache.XAU === 0) {
//             this.cache.XAU = 13200; // Gold per gram in INR (approx ₹13,200/g)
//             this.cache.XAG = 165;   // Silver per gram in INR (approx ₹165/g)
//             this.cache.USDINR = 83.5;
//             logger.info('💰 Using base market prices (Gold: ₹13,200/g, Silver: ₹165/g)');
//         } else {
//             // Add small random fluctuation (±0.5%)
//             const goldFluctuation = 1 + (Math.random() - 0.5) * 0.01;
//             const silverFluctuation = 1 + (Math.random() - 0.5) * 0.012;
            
//             this.cache.XAU = this.cache.XAU * goldFluctuation;
//             this.cache.XAG = this.cache.XAG * silverFluctuation;
            
//             logger.info(`💰 Prices updated (market simulation): Gold=₹${this.cache.XAU.toFixed(2)}/g, Silver=₹${this.cache.XAG.toFixed(2)}/g`);
//         }
        
//         this.cache.lastUpdate = now;
//         return this.cache;
//     }

//     getGoldPricePerGram() {
//         if (!this.cache.XAU) return 0;
        
//         // If using goldpricez.com, XAU is already price per gram in INR
//         // If using other APIs, may need conversion
//         return this.cache.XAU;
//     }

//     getSilverPricePerGram() {
//         if (!this.cache.XAG) return 0;
        
//         // If using goldpricez.com, XAG is already price per gram in INR
//         return this.cache.XAG;
//     }

//     getLastUpdateTime() {
//         return this.cache.lastUpdate;
//     }

//     getPriceData() {
//         return {
//             goldPerGram: this.getGoldPricePerGram(),
//             silverPerGram: this.getSilverPricePerGram(),
//             lastUpdate: this.cache.lastUpdate,
//             usdInr: this.cache.USDINR
//         };
//     }
// }

class MetalPriceService {
    constructor() {
        this.prices = {
            XAU: 13200, // Gold per gram in INR
            XAG: 165,   // Silver per gram in INR
            lastUpdate: Date.now()
        };
    }

    setGoldPrice(pricePerGram) {
        this.prices.XAU = parseFloat(pricePerGram);
        this.prices.lastUpdate = Date.now();
    }

    setSilverPrice(pricePerGram) {
        this.prices.XAG = parseFloat(pricePerGram);
        this.prices.lastUpdate = Date.now();
    }

    getGoldPricePerGram() {
        return this.prices.XAU;
    }

    getSilverPricePerGram() {
        return this.prices.XAG;
    }

    getLastUpdateTime() {
        return this.prices.lastUpdate;
    }

    getPriceData() {
        return {
            goldPerGram: this.prices.XAU,
            silverPerGram: this.prices.XAG,
            lastUpdate: this.prices.lastUpdate
        };
    }
}

module.exports = new MetalPriceService();
