// Simple test script to verify PDF parsing works in Next.js environment
const fs = require('fs');
const path = require('path');

async function testParse() {
  console.log('Starting PDF parse test...\n');

  try {
    // Read the PDF file
    const pdfPath = path.join(__dirname, 'trustee_statement.pdf');
    console.log('Reading PDF from:', pdfPath);

    const fileBuffer = fs.readFileSync(pdfPath);
    console.log('File buffer length:', fileBuffer.length);
    console.log('Buffer is Buffer:', fileBuffer instanceof Buffer);
    console.log('');

    // Import the parser
    const { parseTrusteePDF } = require('./shared/services/trusteeParser.ts');

    // Try to parse
    console.log('Calling parseTrusteePDF...');
    const result = await parseTrusteePDF(fileBuffer);

    console.log('\nSuccess!');
    console.log('Period:', result.period);
    console.log('Card Number:', result.cardNumber);
    console.log('Transactions:', result.transactions.length);

    if (result.transactions.length > 0) {
      console.log('\nFirst transaction:');
      console.log(JSON.stringify(result.transactions[0], null, 2));
    }

  } catch (error) {
    console.error('\nError occurred:');
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
}

testParse();
