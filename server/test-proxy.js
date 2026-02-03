const axios = require('axios');

async function testProxy() {
    try {
        console.log('Testing Proxy at http://localhost:3001/api/proxy?action=children...');
        const res = await axios.get('http://localhost:3001/api/proxy?action=children');

        console.log('\n--- Proxy Response Data ---');
        if (res.data && res.data.value) {
            console.log(`Found ${res.data.value.length} items:`);
            res.data.value.forEach(item => {
                console.log(` - [${item.folder ? 'FOLDER' : 'FILE'}] ${item.name}`);
            });
        } else {
            console.log('No value array in response:', res.data);
        }
        console.log('---------------------------\n');

    } catch (err) {
        console.error('Proxy Test Failed:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

testProxy();
