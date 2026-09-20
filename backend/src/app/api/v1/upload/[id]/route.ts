import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { id } = await params;
    const cleanId = id.split('.')[0];

    await db();
    const { FileStorage } = await import('@/models/Platform');
    const fileRecord = await FileStorage.findById(cleanId).lean() as any;

    if (!fileRecord) {
      return new Response('File not found', { status: 404 });
    }

    const isCad = ['.sldprt', '.step', '.stp', '.iges', '.igs', '.dxf', '.dwg', '.sldasm'].some(ext =>
      fileRecord.filename?.toLowerCase().endsWith(ext)
    );
    const isPdf = fileRecord.filename?.toLowerCase().endsWith('.pdf');
    const isImage = ['.png', '.jpg', '.jpeg', '.webp'].some(ext =>
      fileRecord.filename?.toLowerCase().endsWith(ext)
    );

    // Return file metadata if ?info=true requested
    if (req.nextUrl.searchParams.get('info') === 'true') {
      return NextResponse.json({
        success: true,
        data: {
          id: fileRecord._id.toString(),
          filename: fileRecord.filename,
          mimeType: fileRecord.mimeType,
          isCad,
          isPdf,
          isImage,
          url: `/uploads/${cleanId}`,
          downloadUrl: `/api/v1/upload/${cleanId}?download=true`
        }
      });
    }

    // Retrieve binary buffer either from MongoDB Base64 or local disk storage
    let buffer: Buffer | null = null;
    if (fileRecord.data && fileRecord.data.length > 0) {
      buffer = Buffer.from(fileRecord.data, 'base64');
    } else {
      const diskPath = path.join(process.cwd(), 'public', 'uploads', cleanId);
      if (fs.existsSync(diskPath)) {
        buffer = await fs.promises.readFile(diskPath);
      }
    }

    if (!buffer) {
      return new Response('File content not available', { status: 404 });
    }

    const isDownload = req.nextUrl.searchParams.get('download') === 'true';
    const disposition = (isDownload || isCad)
      ? `attachment; filename="${fileRecord.filename}"`
      : `inline; filename="${fileRecord.filename}"`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': fileRecord.mimeType || 'application/octet-stream',
        'Content-Disposition': disposition,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('File retrieval error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
