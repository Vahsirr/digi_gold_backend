const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';

const tests = [
    { name: 'Health Check', url: `${BASE_URL}/health`, method: 'GET' },
    {
        name: 'Admin Login',
        url: `${BASE_URL}/api/auth/login`,
        method: 'POST',
        data: { mobile: '1234567890', password: '123456789' }
    },
    {
        name: 'Client Login',
        url: `${BASE_URL}/api/auth/login`,
        method: 'POST',
        data: { mobile: '0987654321', password: '0987654321' }
    },
    {
        name: 'Provider Login',
        url: `${BASE_URL}/api/auth/login`,
        method: 'POST',
        data: { mobile: '9876543211', password: 'password123' }
    },
    { name: 'Get Services', url: `${BASE_URL}/api/services`, method: 'GET' },
    { name: 'Get Gold Price', url: `${BASE_URL}/api/payments/meta/gold-price`, method: 'GET' }
];

async function runTests() {
    const results = [];
    let clientToken = '';
    let adminToken = '';

    for (const test of tests) {
        try {
            console.log(`Running: ${test.name}`);
            const response = await axios({
                method: test.method,
                url: test.url,
                data: test.data,
                headers: test.headers || {}
            });

            results.push({
                name: test.name,
                status: 'PASSED',
                code: response.status,
                data: response.data
            });

            if (test.name === 'Client Login' && response.data.success) {
                clientToken = response.data.data.accessToken;
                const userId = response.data.data.user.id;

                // Add dependent tests
                console.log(`Running: Get User Dashboard`);
                const dashRes = await axios.get(`${BASE_URL}/api/users/dashboard?userId=${userId}`, {
                    headers: { Authorization: `Bearer ${clientToken}` }
                });
                results.push({
                    name: 'Get User Dashboard',
                    status: 'PASSED',
                    code: dashRes.status,
                    data: dashRes.data
                });
            }

            if (test.name === 'Admin Login' && response.data.success) {
                adminToken = response.data.data.accessToken;

                console.log(`Running: Get Admin Dashboard Stats`);
                const adminRes = await axios.get(`${BASE_URL}/api/admin/dashboard`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                results.push({
                    name: 'Get Admin Dashboard Stats',
                    status: 'PASSED',
                    code: adminRes.status,
                    data: adminRes.data
                });
            }

        } catch (error) {
            results.push({
                name: test.name,
                status: 'FAILED',
                code: error.response ? error.response.status : 'N/A',
                message: error.message,
                data: error.response ? error.response.data : null
            });
        }
    }

    // Generate Report
    let report = '# 📝 Postman Automation Test Report\n\n';
    report += `**Date:** ${new Date().toLocaleString()}\n`;
    report += `**Base URL:** ${BASE_URL}\n\n`;
    report += '## 📊 Summary\n\n';

    const passed = results.filter(r => r.status === 'PASSED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;

    report += `- **Total Tests:** ${results.length}\n`;
    report += `- **Passed:** ✅ ${passed}\n`;
    report += `- **Failed:** ❌ ${failed}\n\n`;

    report += '## 📑 Detailed Test Results\n\n';

    results.forEach(res => {
        report += `### ${res.status === 'PASSED' ? '✅' : '❌'} ${res.name}\n`;
        report += `- **Status Code:** ${res.code}\n`;
        report += `- **Result:** ${res.status}\n`;
        if (res.message) report += `- **Error Message:** ${res.message}\n`;
        report += '#### Response Data:\n';
        report += '```json\n';
        report += JSON.stringify(res.data, null, 2);
        report += '\n```\n\n';
        report += '---\n\n';
    });

    fs.writeFileSync('c:/Users/Rasul/OneDrive - ISKAAN/Desktop/Digigold Alagu/postman_tests.md', report);
    console.log('Report generated: postman_tests.md');
}

runTests();
