import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    await db();
    const { Company } = await import('@/models/Company');
    const mongoose = (await import('mongoose')).default;
    
    // Using Mongoose aggregation to replicate include behaviour
    const companiesDoc = await Company.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'companyaddresses',
          localField: '_id',
          foreignField: 'companyId',
          as: 'addresses',
        },
      },
      {
        $lookup: {
          from: 'companydocuments',
          localField: '_id',
          foreignField: 'companyId',
          as: 'documents',
        },
      },
    ]);

    const companies = companiesDoc.map((c: any) => ({
      ...c,
      id: c._id.toString(),
      addresses: c.addresses.map((a: any) => ({ ...a, id: a._id.toString() })),
      documents: c.documents.map((d: any) => ({ ...d, id: d._id.toString() })),
    }));

    return console.log(`[API Response] /api/v1/admin/companies - Sending response`), NextResponse.json({
      success: true,
      data: companies,
    });
  } catch (error: any) {
    console.error('Admin list companies error:', error);
    return console.log(`[API Response] /api/v1/admin/companies - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
