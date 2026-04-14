import { NextRequest, NextResponse } from 'next/server';
import { parseTrusteePDF } from '@/shared/services/trusteeParser';
import { parsePrivatPDF } from '@/shared/services/privatParser';

/**
 * POST /api/parse-pdf
 * Parses a bank statement PDF and returns transactions
 * Supports: Trustee Bank, Privat Bank
 */
export async function POST(request: NextRequest) {
  try {
    // Get the file and bank type from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bankType = formData.get('bankType') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!bankType) {
      return NextResponse.json(
        { success: false, error: 'No bank type provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the PDF based on bank type
    let statementData;
    switch (bankType) {
      case 'trustee':
        statementData = await parseTrusteePDF(buffer);
        break;
      case 'privat':
        statementData = await parsePrivatPDF(buffer);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported bank type: ${bankType}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: statementData,
    });
  } catch (error) {
    console.error('PDF parsing error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse PDF',
      },
      { status: 500 }
    );
  }
}
