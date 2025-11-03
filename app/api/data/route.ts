import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Route handler for serving CSV data files
// Usage: GET /api/data?file=filename.csv
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');
    
    if (!filename) {
      return NextResponse.json(
        { error: 'File parameter is required' },
        { status: 400 }
      );
    }

    // Security: Only allow CSV files and prevent directory traversal
    if (!filename.endsWith('.csv') || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid file name' },
        { status: 400 }
      );
    }

    // Read from data directory at project root
    const filePath = join(process.cwd(), 'data', 'csv', filename);
    const fileContents = await readFile(filePath, 'utf-8');

    return new NextResponse(fileContents, {
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error reading CSV file:', error);
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }
}

