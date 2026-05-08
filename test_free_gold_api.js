// Test script for free gold price API
const axios = require('axios');

async function testFreeGoldAPI() {
    console.log('🧪 Testing Free Gold Price API (gold-api.com)...\n');

    try {
        // Test the free API
        const response = await axios.get('https://gold-api.com/api/price/XAU/INR', {
            headers: { 
                'x-access-token': '',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('✅ API Response received!\n');
        console.log('📊 Response Data:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const data = response.data;
        
        if (data.price) {
            const pricePerOunce = parseFloat(data.price);
            const pricePerGram = pricePerOunce / 31.1034768;
            
            console.log(`🥇 Gold Price:`);
            console.log(`   Per Ounce (INR): ₹${pricePerOunce.toFixed(2)}`);
            console.log(`   Per Gram (INR): ₹${pricePerGram.toFixed(2)}`);
            console.log('');
            
            if (data.silver_price) {
                const silverPerOunce = parseFloat(data.silver_price);
                const silverPerGram = silverPerOunce / 31.1034768;
                console.log(`🥈 Silver Price:`);
                console.log(`   Per Ounce (INR): ₹${silverPerOunce.toFixed(2)}`);
                console.log(`   Per Gram (INR): ₹${silverPerGram.toFixed(2)}`);
                console.log('');
            }
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            console.log('✅ FREE API is working correctly!');
            console.log('💡 No API key required for basic usage');
            console.log('🔄 Free tier: 300 requests/month');
            
        } else {
            console.log('⚠️  Response format unexpected');
            console.log('Full response:', JSON.stringify(data, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error testing API:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`   Message: ${error.message}`);
        }
    }
}

// Run test
testFreeGoldAPI();
