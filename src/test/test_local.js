const axios = require('axios');

const url = 'http://localhost:13001/hash-weight';
const service_url = 'http://localhost:8081/hash_weight';
//
const testData = {
    values: [
        '0000000000040ca0ab3806e986392a9063c145ec7a27a47388b7bf16260e5891',
        '0000000000040ca0ab3806e986392a9063c145ec7a27a47388b7bf16260e5892',
        '0000000000040ca0ab3806e986392a9063c145ec7a27a47388b7bf16260e5892',
    ],
};

axios
    .post(service_url, testData)
    .then((response) => {
        console.log('Status Code:', response.status);
        console.log('Body:', JSON.stringify(response.data));
    })
    .catch((error) => {
        console.error(
            'An error occurred:',
            error.response ? error.response.data : error.message,
        );
    });
