import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/detect-bank
 * Detects bank type from PDF content
 * Returns: { bank: 'trustee' | 'privat' }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use pdf-parse to read PDF content
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const pdf = require('pdf-parse');
    const data = await pdf(buffer);
    const text = data.text;

    // Check for Privat Bank specific markers
    const privatMarkers = [
      'ПРИВАТБАНК',
      'ПриватБанк',
      'PrivatBank',
      'Privat24',
      'SAMDNWFC', // Contract number pattern specific to Privat
    ];

    // Check for Trustee specific markers
    const trusteeMarkers = [
      'Trustee',
      'TRUSTEE',
      'Trustee Wallet',
      'Per Period:', // Trustee uses "Per Period:" format
      'Card number:', // Trustee format for card number
      'Date and time of operation', // Trustee table header
    ];

    const textLower = text.toLowerCase();
    const hasPrivatMarkers = privatMarkers.some(marker =>
      text.includes(marker) || textLower.includes(marker.toLowerCase())
    );
    const hasTrusteeMarkers = trusteeMarkers.some(marker =>
      text.includes(marker) || textLower.includes(marker.toLowerCase())
    );

    console.log('[Bank Detection] Privat markers found:', hasPrivatMarkers);
    console.log('[Bank Detection] Trustee markers found:', hasTrusteeMarkers);

    let detectedBank: 'trustee' | 'privat' = 'trustee';

    // If both or neither found, check for more specific patterns
    if (hasPrivatMarkers && !hasTrusteeMarkers) {
      console.log('[Bank Detection] Detected: Privat Bank');
      detectedBank = 'privat';
    } else if (hasTrusteeMarkers && !hasPrivatMarkers) {
      console.log('[Bank Detection] Detected: Trustee Bank');
      detectedBank = 'trustee';
    } else {
      // Check for date format patterns as fallback
      const privatDatePattern = /\d{2}\.\d{2}\.\d{4}\n\d{2}:\d{2}\n\d{6}\*+\d{4}/; // Privat format
      const trusteeDatePattern = /\d{4}\.\d{2}\.\d{2},\s*\d{2}:\d{2}/; // Trustee format

      if (privatDatePattern.test(text)) {
        console.log('[Bank Detection] Detected by date pattern: Privat Bank');
        detectedBank = 'privat';
      } else if (trusteeDatePattern.test(text)) {
        console.log('[Bank Detection] Detected by date pattern: Trustee Bank');
        detectedBank = 'trustee';
      } else {
        // Default to Trustee if can't determine
        console.log('[Bank Detection] Could not determine bank type, defaulting to Trustee');
        detectedBank = 'trustee';
      }
    }

    return NextResponse.json({
      success: true,
      bank: detectedBank,
    });
  } catch (error) {
    console.error('Bank detection error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect bank',
        // Default to trustee on error
        bank: 'trustee',
      },
      { status: 500 }
    );
  }
}
