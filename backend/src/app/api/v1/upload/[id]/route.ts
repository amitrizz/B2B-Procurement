import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const fileRecord = await db.fileStorage.findUnique({
      where: { id },
    });

    if (!fileRecord) {
      return new Response('File not found', { status: 404 });
    }

    // Convert Base64 data back to a binary Buffer
    const buffer = Buffer.from(fileRecord.data, 'base64');

    // Return binary file response with correct headers
    return new Response(buffer, {
      headers: {
        'Content-Type': fileRecord.mimeType,
        'Content-Disposition': `inline; filename="${fileRecord.filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('File retrieval error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
