import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text using pdf-parse
    const data = await pdf(buffer);

    return NextResponse.json({
      text: data.text,
      pages: data.numpages,
      info: data.info,
    });
  } catch (error: any) {
    console.error('PDF extraction error:', error);
    return NextResponse.json(
      { error: `Failed to extract PDF text: ${error.message}` },
      { status: 500 }
    );
  }
}
