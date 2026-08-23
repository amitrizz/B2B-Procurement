import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Remove any file extensions if they are appended in the URL (e.g. "64b58e72f8d83921.pdf" -> "64b58e72f8d83921")
    const cleanId = id.split('.')[0];

    const fileRecord = await db.fileStorage.findUnique({
      where: { id: cleanId },
    });

    if (!fileRecord) {
      return new Response('File not found', { status: 404 });
    }

    // Convert Base64 back to binary Buffer
    const buffer = Buffer.from(fileRecord.data, 'base64');

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
