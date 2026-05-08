#!/usr/bin/env node

/**
 * Test script to verify:
 * 1. Gold/Silver prices are working
 * 2. Price endpoints return correct data
 * 3. Backend is properly initialized
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

async function testGoldPrices() {
    console.log('\n🔍 Testing Gold Price Endpoint...');
    console.log(`URL: ${BASE_URL}/gold/price\n`);
    
    try {
        const response = await axios.get(`${BASE_URL}/gold/price`);
        const data = response.data;
        
        if (data.success) {
            const price = parseFloat(data.price);
            console.log('✅ Gold Price Response:');
            console.log(`   Price: ₹${price.toFixed(2)} per gram`);
            console.log(`   Timestamp: ${data.timestamp}`);
            
            // Verify price is realistic
            if (price >= 12000 && price <= 15000) {
                console.log('   ✅ Price is in realistic range (₹12,000 - ₹15,000)');
            } else {
                console.log('   ⚠️  Price may be outside expected range');
            }
            
            return true;
        } else {
            console.log('❌ Response indicates failure');
            return false;
        }
    } catch (error) {
        console.log('❌ Error fetching gold price:');
        console.log(`   ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data: ${JSON.stringify(error.response.data)}`);
        }
        return false;
    }
}

async function testSilverPrices() {
    console.log('\n🔍 Testing Silver Price Endpoint...');
    console.log(`URL: ${BASE_URL}/silver/price\n`);
    
    try {
        const response = await axios.get(`${BASE_URL}/silver/price`);
        const data = response.data;
        
        if (data.success) {
            const price = parseFloat(data.price);
            console.log('✅ Silver Price Response:');
            console.log(`   Price: ₹${price.toFixed(2)} per gram`);
            console.log(`   Timestamp: ${data.timestamp}`);
            
            // Verify price is realistic
            if (price >= 150 && price <= 200) {
                console.log('   ✅ Price is in realistic range (₹150 - ₹200)');
            } else {
                console.log('   ⚠️  Price may be outside expected range');
            }
            
            return true;
        } else {
            console.log('❌ Response indicates failure');
            return false;
        }
    } catch (error) {
        console.log('❌ Error fetching silver price:');
        console.log(`   ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data: ${JSON.stringify(error.response.data)}`);
        }
        return false;
    }
}

async function testBackendHealth() {
    console.log('\n🔍 Testing Backend Health...');
    console.log(`URL: ${BASE_URL.replace('/api', '')}/health\n`);
    
    try {
        const response = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
        const data = response.data;
        
        console.log('✅ Backend Health Response:');
        console.log(`   Status: ${data.status}`);
        console.log(`   Database: ${data.database}`);
        console.log(`   Environment: ${data.environment}`);
        console.log(`   Uptime: ${Math.floor(data.uptime)}s`);
        
        return data.status === 'OK' || data.status === 'DEGRADED';
    } catch (error) {
        console.log('❌ Backend health check failed:');
        console.log(`   ${error.message}`);
        return false;
    }
}

async function testPriceUpdateInterval() {
    console.log('\n🔍 Testing Price Updates (30 second interval)...');
    
    try {
        // Get initial price
        const response1 = await axios.get(`${BASE_URL}/gold/price`);
        const price1 = parseFloat(response1.data.price);
        const time1 = new Date(response1.data.timestamp).getTime();
        
        console.log(`   Initial price: ₹${price1.toFixed(2)} at ${new Date(time1).toLocaleTimeString()}`);
        
        // Wait 35 seconds
        console.log('   ⏳ Waiting 35 seconds for next update...');
        await new Promise(resolve => setTimeout(resolve, 35000));
        
        // Get updated price
        const response2 = await axios.get(`${BASE_URL}/gold/price`);
        const price2 = parseFloat(response2.data.price);
        const time2 = new Date(response2.data.timestamp).getTime();
        
        console.log(`   Updated price: ₹${price2.toFixed(2)} at ${new Date(time2).toLocaleTimeString()}`);
        
        const priceDiff = Math.abs(price2 - price1);
        const timeDiff = time2 - time1;
        
        console.log(`   Price change: ₹${priceDiff.toFixed(2)} (${((priceDiff/price1)*100).toFixed(2)}%)`);
        console.log(`   Time difference: ${timeDiff}ms`);
        
        if (timeDiff >= 30000) {
            console.log('   ✅ Prices are updating at correct interval (≥30s)');
        } else {
            console.log('   ⚠️  Update interval may be too frequent');
        }
        
        if (priceDiff > 0) {
            console.log('   ✅ Prices are changing (fluctuation working)');
        } else {
            console.log('   ⚠️  Prices haven\'t changed yet (may need more time)');
        }
        
        return true;
    } catch (error) {
        console.log('❌ Price update test failed:');
        console.log(`   ${error.message}`);
        return false;
    }
}

async function runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 DIGIGOLD PRICE & PAYMENT SYSTEM TEST');
    console.log('='.repeat(60));
    console.log(`Backend URL: ${BASE_URL}`);
    console.log(`Test Time: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));
    
    const results = {
        health: false,
        gold: false,
        silver: false,
        updates: false
    };
    
    // Test 1: Backend Health
    results.health = await testBackendHealth();
    
    // Test 2: Gold Price
    results.gold = await testGoldPrices();
    
    // Test 3: Silver Price
    results.silver = await testSilverPrices();
    
    // Test 4: Price Updates (optional, takes 35 seconds)
    const runUpdateTest = process.argv.includes('--test-updates');
    if (runUpdateTest) {
        results.updates = await testPriceUpdateInterval();
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Backend Health:    ${results.health ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Gold Price:        ${results.gold ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Silver Price:      ${results.silver ? '✅ PASS' : '❌ FAIL'}`);
    if (runUpdateTest) {
        console.log(`Price Updates:     ${results.updates ? '✅ PASS' : '❌ FAIL'}`);
    }
    console.log('='.repeat(60));
    
    const allPassed = results.health && results.gold && results.silver;
    
    if (allPassed) {
        console.log('\n✅ All critical tests passed!');
        console.log('\n📝 Next Steps:');
        console.log('   1. Test Razorpay in mobile app');
        console.log('   2. Check admin dashboard displays prices');
        console.log('   3. Run: node test_razorpay_config.js (if available)');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed!');
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Make sure backend is running: cd backend && npm start');
        console.log('   2. Check backend logs for errors');
        console.log('   3. Verify API URL is correct');
        console.log('   4. Check MetalPriceService.js configuration');
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('\n💥 Test runner failed:', error);
    process.exit(1);
});
