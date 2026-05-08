#!/usr/bin/env node

/**
 * Pre-flight check for backend startup
 * Verifies all required configuration before starting server
 */

require('dotenv').config();

console.log('🔍 Backend Pre-flight Check\n');
console.log('=' .repeat(50));

let hasErrors = false;
let warnings = [];

// Check 1: MongoDB URI
console.log('\n1️⃣  MongoDB Configuration');
if (!process.env.MONGO_URI) {
    console.log('   ❌ MONGO_URI is not set');
    hasErrors = true;
} else if (process.env.MONGO_URI.includes('your-project')) {
    console.log('   ❌ MONGO_URI contains placeholder value');
    hasErrors = true;
} else {
    console.log('   ✅ MONGO_URI is set');
}

// Check 2: JWT Secrets
console.log('\n2️⃣  JWT Configuration');
if (!process.env.JWT_SECRET) {
    console.log('   ❌ JWT_SECRET is not set');
    hasErrors = true;
} else {
    console.log('   ✅ JWT_SECRET is set');
}

if (!process.env.JWT_REFRESH_SECRET) {
    console.log('   ❌ JWT_REFRESH_SECRET is not set');
    hasErrors = true;
} else {
    console.log('   ✅ JWT_REFRESH_SECRET is set');
}

// Check 3: Razorpay
console.log('\n3️⃣  Razorpay Configuration');
if (!process.env.RAZORPAY_KEY_ID) {
    console.log('   ❌ RAZORPAY_KEY_ID is not set');
    hasErrors = true;
} else if (process.env.RAZORPAY_KEY_ID === 'rzp_test_demo_key') {
    console.log('   ❌ RAZORPAY_KEY_ID is demo value');
    hasErrors = true;
} else {
    console.log('   ✅ RAZORPAY_KEY_ID is set');
}

if (!process.env.RAZORPAY_KEY_SECRET) {
    console.log('   ❌ RAZORPAY_KEY_SECRET is not set');
    hasErrors = true;
} else {
    console.log('   ✅ RAZORPAY_KEY_SECRET is set');
}

// Check 4: Twilio (Optional but should not be demo)
console.log('\n4️⃣  Twilio Configuration (Optional)');
if (!process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID === 'demo_account_sid') {
    console.log('   ⚠️  Twilio not configured (SMS will be disabled)');
    warnings.push('Twilio SMS will not work');
} else if (!process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    console.log('   ❌ Invalid TWILIO_ACCOUNT_SID (must start with AC)');
    hasErrors = true;
} else {
    console.log('   ✅ Twilio is configured');
}

// Check 5: Port
console.log('\n5️⃣  Port Configuration');
if (!process.env.PORT) {
    console.log('   ⚠️  PORT not set (will use default: 3001)');
    warnings.push('Using default port 3001');
} else {
    console.log(`   ✅ PORT is set to ${process.env.PORT}`);
}

// Check 6: Node Environment
console.log('\n6️⃣  Environment');
if (!process.env.NODE_ENV) {
    console.log('   ⚠️  NODE_ENV not set (defaulting to production)');
    warnings.push('NODE_ENV not specified');
} else {
    console.log(`   ✅ NODE_ENV is ${process.env.NODE_ENV}`);
}

// Check 7: Firebase (Optional)
console.log('\n7️⃣  Firebase Configuration (Optional)');
if (!process.env.FIREBASE_PROJECT_ID) {
    console.log('   ⚠️  Firebase not configured (push notifications disabled)');
    warnings.push('Firebase push notifications will not work');
} else {
    console.log('   ✅ Firebase is configured');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('\n📊 Summary:');

if (hasErrors) {
    console.log('\n❌ CRITICAL ERRORS FOUND');
    console.log('   The server will NOT start properly!');
    console.log('\n🔧 Fix the errors above before deploying.');
    process.exit(1);
} else if (warnings.length > 0) {
    console.log('\n⚠️  Server can start with warnings:');
    warnings.forEach(w => console.log(`   - ${w}`));
    console.log('\n✅ You can proceed, but some features may be limited.');
    process.exit(0);
} else {
    console.log('\n✅ ALL CHECKS PASSED');
    console.log('   Server should start successfully!');
    process.exit(0);
}
