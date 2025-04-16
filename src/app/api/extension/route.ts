import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const extensionPath = join(process.cwd(), 'public', 'extension.zip');
    const fileBuffer = readFileSync(extensionPath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=context-reader-extension.zip'
      }
    });
  } catch (error) {
    console.error('Error serving extension:', error);
    return NextResponse.json(
      { error: 'Extension file not found' },
      { status: 404 }
    );
  }
}
