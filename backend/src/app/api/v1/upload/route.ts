import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file size (Max 15MB)
    const MAX_SIZE = 15 * 1024 * 1024; // 15MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, code: 'FILE_TOO_LARGE', message: 'File size must not exceed 15MB' },
        { status: 400 }
      );
    }

    // Validate file type (PDF, PNG, JPG, JPEG)
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_FILE_TYPE', message: 'Only PDF and image files are allowed' },
        { status: 400 }
      );
    }

    // Convert file to Base64 string
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    // Save file directly to MongoDB
    const fileRecord = await db.fileStorage.create({
      data: {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: base64Data,
      },
    });

    // We return the custom endpoint serving files from MongoDB
    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: fileRecord.id,
        url: `/uploads/${fileRecord.id}`,
      },
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
