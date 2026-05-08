require('dotenv').config();
const axios = require('axios');

async function verifyPrices() {
    const key = process.env.GOLD_API_KEY;
    console.log(`--- Troubleshooting API Key (${key.substring(0, 6)}...) ---`);

    const tests = [
        {
            name: 'Metals-API.com',
            url: `https://metals-api.com/api/latest?access_key=${key}&base=USD&symbols=XAU`
        },
        {
            name: 'MetalPriceAPI.com',
            url: `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=USD&currencies=XAU`
        },
        {
            name: 'Gold-API.com (Header Auth)',
            url: 'https://api.gold-api.com/price/XAU',
            headers: { 'x-api-key': key } // Guessing header name
        },
        {
            name: 'Gold-API.com (Query Param)',
            url: `https://api.gold-api.com/price/XAU?api_key=${key}`
        }
    ];

    for (const test of tests) {
        console.log(`\nTesting: ${test.name}`);
        try {
            const config = {};
            if (test.headers) config.headers = test.headers;

            const res = await axios.get(test.url, config);
            console.log(`✅ RESPONSE:`, JSON.stringify(res.data));
            if (res.data.success || res.data.price || res.data.rates) {
                console.log(`🎉 MATCH FOUND! This key belongs to ${test.name}`);
            }
        } catch (error) {
            console.log(`❌ Failed (${error.response ? error.response.status : error.message})`);
            if (error.response && error.response.data) {
                // console.log(JSON.stringify(error.response.data)); 
                // Keep output clean, usually 401/403 means wrong key
            }
        }
    }
}

verifyPrices();
