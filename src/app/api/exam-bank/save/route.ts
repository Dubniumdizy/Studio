import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const examData = formData.get('exam_data') as string;

    if (!file || !examData) {
      return NextResponse.json(
        { error: 'Missing file or exam data' },
        { status: 400 }
      );
    }

    const bankDir = join(process.cwd(), 'public', 'exam-bank');
    
    // Create BANK directory if it doesn't exist
    if (!existsSync(bankDir)) {
      await mkdir(bankDir, { recursive: true });
    }

    // Save the JSON file
    const fileName = file.name;
    const filePath = join(bankDir, fileName);
    const buffer = await file.arrayBuffer();

    await writeFile(filePath, Buffer.from(buffer));

    return NextResponse.json(
      { 
        success: true, 
        message: 'Exam saved to BANK',
        fileName: fileName,
        path: `/exam-bank/${fileName}`
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving exam:', error);
    return NextResponse.json(
      { error: 'Failed to save exam to BANK' },
      { status: 500 }
    );
  }
}
