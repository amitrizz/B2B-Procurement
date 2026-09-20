import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import path from 'path';

import fs from 'fs';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return console.log(`[API Response] /api/v1/upload - Sending response`), NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return console.log(`[API Response] /api/v1/upload - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file size (Max 50MB to support 3D CAD parts)
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      return console.log(`[API Response] /api/v1/upload - Sending response`), NextResponse.json(
        { success: false, code: 'FILE_TOO_LARGE', message: 'File size must not exceed 50MB' },
        { status: 400 }
      );
    }

    // Validate file type (PDF, Images, SolidWorks .sldprt, STEP, IGES, DXF)
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.sldprt', '.step', '.stp', '.iges', '.igs', '.dxf', '.dwg', '.sldasm'];
    const ext = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return console.log(`[API Response] /api/v1/upload - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_FILE_TYPE', message: 'Allowed files: PDF, Images (PNG/JPG), and CAD models (.sldprt, .step, .stp, .iges, .dxf)' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure uploads directory exists on disk
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    await db();
    const { FileStorage } = await import('@/models/Platform');

    // MongoDB 16MB document size limit guard: only store base64 in doc if <= 11MB
    const canStoreInMongo = buffer.length <= 11 * 1024 * 1024;
    const base64Data = canStoreInMongo ? buffer.toString('base64') : '';

    const mimeMap: Record<string, string> = {
      '.sldprt': 'application/vnd.solidworks.part',
      '.sldasm': 'application/vnd.solidworks.assembly',
      '.step': 'application/step',
      '.stp': 'application/step',
      '.iges': 'model/iges',
      '.igs': 'model/iges',
      '.dxf': 'image/vnd.dxf',
      '.dwg': 'image/vnd.dwg',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    const mimeType = file.type || mimeMap[ext] || 'application/octet-stream';

    const fileRecordDoc = await FileStorage.create({
      filename: file.name,
      mimeType,
      data: base64Data,
      objectKey: null,
    });

    const fileId = fileRecordDoc._id.toString();
    const diskFilePath = path.join(uploadDir, fileId);
    await fs.promises.writeFile(diskFilePath, buffer);

    const isCad = ['.sldprt', '.step', '.stp', '.iges', '.igs', '.dxf', '.dwg', '.sldasm'].includes(ext);

    return console.log(`[API Response] /api/v1/upload - Sending response`), NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: fileId,
        originalName: file.name,
        isCad,
        mimeType,
        url: `/uploads/${fileId}`,
      },
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    return console.log(`[API Response] /api/v1/upload - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
