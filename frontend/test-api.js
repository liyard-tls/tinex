// Test the parse-pdf API route directly
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testAPI() {
  console.log('Testing /api/parse-pdf endpoint...\n');

  try {
    // Read the PDF file
    const pdfPath = path.join(__dirname, 'trustee_statement.pdf');
    const fileBuffer = fs.readFileSync(pdfPath);

    // Create form data
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: 'trustee_statement.pdf',
      contentType: 'application/pdf',
    });

    // Make request to API (assuming dev server is running on 3000)
    console.log('Making request to http://localhost:3000/api/parse-pdf');
    const response = await fetch('http://localhost:3000/api/parse-pdf', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });

    const result = await response.json();

    console.log('\nResponse status:', response.status);
    console.log('Success:', result.success);

    if (result.success) {
      console.log('Period:', result.data.period);
      console.log('Card Number:', result.data.cardNumber);
      console.log('Transactions:', result.data.transactions.length);

      if (result.data.transactions.length > 0) {
        console.log('\nFirst transaction:');
        console.log(JSON.stringify(result.data.transactions[0], null, 2));
      }
    } else {
      console.error('\nError:', result.error);
    }

  } catch (error) {
    console.error('\nError occurred:');
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Check if dev server is running
console.log('Make sure dev server is running: npm run dev\n');
testAPI();
