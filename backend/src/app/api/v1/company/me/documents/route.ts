import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { documentType, fileId } = await req.json();

    if (!documentType || !fileId) {
      return console.log(`[API Response] /api/v1/company/me/documents - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing documentType or fileId' },
        { status: 400 }
      );
    }

    const validTypes = ['GST_CERT', 'PAN_CARD', 'INCORPORATION_PROOF', 'BANK_PROOF'];
    if (!validTypes.includes(documentType)) {
      return console.log(`[API Response] /api/v1/company/me/documents - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Invalid document type' },
        { status: 400 }
      );
    }

    await db();
    const { Company, CompanyDocument } = await import('@/models/Company');

    const session = await mongoose.startSession();
    let updatedCompany: any = null;

    try {
      session.startTransaction();

      // Upsert document
      await CompanyDocument.findOneAndUpdate(
        { companyId: user.companyId, documentType },
        {
          $set: {
            fileId,
            verified: false,
          }
        },
        { new: true, upsert: true, session }
      );

      // Check total distinct types uploaded
      const distinctTypesCount = await CompanyDocument.countDocuments({ companyId: user.companyId }).session(session);

      const comp = await Company.findById(user.companyId).session(session).lean() as any;
      const allDocs = await CompanyDocument.find({ companyId: user.companyId }).session(session).lean();

      if (distinctTypesCount >= 4 && comp?.status === 'PENDING') {
        const cDoc = await Company.findByIdAndUpdate(
          user.companyId,
          { $set: { status: 'UNDER_REVIEW' } },
          { new: true, session }
        ).lean() as any;
        updatedCompany = cDoc ? { ...cDoc, id: cDoc._id.toString(), documents: allDocs.map((d: any) => ({ ...d, id: d._id.toString() })) } : null;
      } else {
        updatedCompany = comp ? { ...comp, id: comp._id.toString(), documents: allDocs.map((d: any) => ({ ...d, id: d._id.toString() })) } : null;
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return console.log(`[API Response] /api/v1/company/me/documents - Sending response`), NextResponse.json({
      success: true,
      message: 'Document uploaded successfully',
      data: updatedCompany,
    });
  } catch (error: any) {
    console.error('Upload document error:', error);
    return console.log(`[API Response] /api/v1/company/me/documents - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
