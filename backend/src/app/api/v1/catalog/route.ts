import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const searchParams = req.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId');
    const search = searchParams.get('search');

    const matchClause: any = {
      validTo: { $gt: new Date() }
    };

    if (supplierId) {
      matchClause.supplierCompanyId = new mongoose.Types.ObjectId(supplierId);
    }

    if (search) {
      matchClause.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    await db();
    const { CatalogItem } = await import('@/models/Catalog');
    await import('@/models/Company');

    const itemsDoc = await CatalogItem.aggregate([
      { $match: matchClause },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'Company',
          localField: 'supplierCompanyId',
          foreignField: '_id',
          as: 'supplierCompany'
        }
      },
      {
        $addFields: {
          'supplierCompany': { $arrayElemAt: ['$supplierCompany', 0] }
        }
      }
    ]);

    const items = itemsDoc.map((item: any) => ({
      ...item,
      id: item._id.toString(),
      supplierCompany: item.supplierCompany ? { name: item.supplierCompany.name } : null
    }));

    return console.log(`[API Response] /api/v1/catalog - Sending response`), NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    console.error('List catalog error:', error);
    return console.log(`[API Response] /api/v1/catalog - Sending response`), NextResponse.json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    // Only verified supplier companies can add catalog items
    if (!user || !user.companyId || !user.company || user.company.status !== 'VERIFIED') {
      return authErrorResponse('Unauthorized or unverified company');
    }

    const { name, description, hsnCode, unitPrice, validTo } = await req.json();

    if (!name || !hsnCode || unitPrice === undefined || !validTo) {
      return console.log(`[API Response] /api/v1/catalog - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'Missing required fields' }, { status: 400 });
    }

    await db();
    const { CatalogItem } = await import('@/models/Catalog');

    const itemDoc = await CatalogItem.create({
      supplierCompanyId: user.companyId,
      name,
      description,
      hsnCode,
      unitPrice: Number(unitPrice),
      validTo: new Date(validTo)
    });

    const item = { ...itemDoc.toObject(), id: itemDoc._id.toString() };

    return console.log(`[API Response] /api/v1/catalog - Sending response`), NextResponse.json({ success: true, message: 'Catalog item created', data: item });
  } catch (error: any) {
    console.error('Create catalog item error:', error);
    return console.log(`[API Response] /api/v1/catalog - Sending response`), NextResponse.json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}
