import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const rfqs = await db.rFQ.findMany({
      where: { buyerCompanyId: user.companyId },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: rfqs,
    });
  } catch (error: any) {
    console.error('List own RFQs error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || !user.company) return authErrorResponse();

    if (user.company.status !== 'VERIFIED') {
      return NextResponse.json(
        { success: false, code: 'UNVERIFIED_COMPANY', message: 'Only verified companies can publish requirements' },
        { status: 403 }
      );
    }

    const { title, description, category, bidEndAt, requiredDeliveryDate, items } = await req.json();

    if (!title || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing title or components list' },
        { status: 400 }
      );
    }

    // Verify all items have drawings
    for (const item of items) {
      if (!item.componentName || !item.drawingFileId || !item.quantity || !item.hsnCode) {
        return NextResponse.json(
          { success: false, code: 'MISSING_DRAWING', message: 'Each component must have a name, quantity, drawing, and HSN code' },
          { status: 400 }
        );
      }
    }

    let primaryAddress = await db.companyAddress.findFirst({
      where: { companyId: user.companyId, isPrimary: true },
    });

    if (!primaryAddress) {
      primaryAddress = await db.companyAddress.create({
        data: {
          companyId: user.companyId!,
          state: 'Maharashtra',
          addressLine1: 'Primary Business Office',
          city: 'Mumbai',
          pincode: '400001',
          isPrimary: true,
        },
      });
    }

    const rfqNumber = 'RFQ-' + Math.floor(100000 + Math.random() * 900000);

    const rfq = await db.rFQ.create({
      data: {
        buyerCompanyId: user.companyId,
        rfqNumber,
        title,
        description,
        category,
        status: 'PUBLISHED',
        bidStartAt: new Date(),
        bidEndAt: bidEndAt ? new Date(bidEndAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // default 7 days
        requiredDeliveryDate: requiredDeliveryDate ? new Date(requiredDeliveryDate) : null,
        deliveryAddressId: primaryAddress.id,
        items: {
          create: items.map((item: any) => ({
            componentName: item.componentName,
            drawingFileId: item.drawingFileId,
            drawingRevision: item.drawingRevision || 'v1',
            quantity: item.quantity,
            unit: item.unit || 'pcs',
            specification: item.specification,
            hsnCode: item.hsnCode,
            materialOptionPreference: item.materialOptionPreference || 'BOTH',
            expectedTimeDays: item.expectedTimeDays ? Number(item.expectedTimeDays) : null,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'RFQ published successfully',
      data: rfq,
    });
  } catch (error: any) {
    console.error('Create RFQ error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
