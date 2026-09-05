import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    console.log('[API] /rfqs GET - Step 1: Validating token and fetching auth user');
    const user = await getAuthUser(req);
    if (!user) {
      console.log('[API] /rfqs GET - Error: Unauthorized, user token invalid');
      return authErrorResponse();
    }

    console.log(`[API] /rfqs GET - Step 2: Fetching RFQs for companyId ${user.companyId}`);
    if (!user.companyId) {
      console.log(`[API] /rfqs GET - Error: User ${user.email} has no companyId`);
      return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json({ success: false, code: 'NO_COMPANY', message: 'User has no company' }, { status: 400 });
    }

    await db();
    const { RFQ } = await import('@/models/RFQ');
    const mongoose = (await import('mongoose')).default;
    
    console.log(`[API] /rfqs GET - Step 3: Querying database for RFQs with buyerCompanyId: ${user.companyId}`);
    const rfqsDoc = await RFQ.aggregate([
      { $match: { buyerCompanyId: new mongoose.Types.ObjectId(user.companyId) } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'rfqitems',
          localField: '_id',
          foreignField: 'rfqId',
          as: 'items'
        }
      },
      {
        $lookup: {
          from: 'bids',
          localField: '_id',
          foreignField: 'rfqId',
          as: 'bids'
        }
      },
      {
        $lookup: {
          from: 'purchaserequisitions',
          localField: 'buyerPrId',
          foreignField: '_id',
          as: 'prArr'
        }
      },
      {
        $addFields: {
          pr: { $arrayElemAt: ['$prArr', 0] }
        }
      },
      {
        $project: {
          prArr: 0
        }
      }
    ]);

    const rfqs = rfqsDoc.map((rfq: any) => ({
      ...rfq,
      id: rfq._id.toString(),
      items: rfq.items.map((i: any) => ({ ...i, id: i._id.toString() })),
      bids: rfq.bids.map((b: any) => ({ ...b, id: b._id.toString() }))
    }));

    console.log(`[API] /rfqs GET - Success: Found ${rfqs.length} RFQs`);
    return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json({
      success: true,
      data: rfqs,
    });
  } catch (error: any) {
    console.error('Fetch RFQs error:', error);
    return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || !user.company) return authErrorResponse();

    if (user.company.status !== 'VERIFIED') {
      return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json(
        { success: false, code: 'UNVERIFIED_COMPANY', message: 'Only verified companies can publish requirements' },
        { status: 403 }
      );
    }

    if (user.company.isActive === false) {
      return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json(
        { success: false, code: 'INACTIVE_COMPANY', message: 'Your company account is inactive. Please contact support.' },
        { status: 403 }
      );
    }

    if (process.env.EMAIL_VERIFY_REQUIRED === 'true' && !user.emailVerified) {
      return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json(
        { success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Email verification required to publish requirements' },
        { status: 403 }
      );
    }

    const { title, description, category, bidEndAt, requiredDeliveryDate, deliveryAddressId, status, items, buyerPrId } = await req.json();

    if (!title || !items || !Array.isArray(items) || items.length === 0) {
      return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing title or components list' },
        { status: 400 }
      );
    }

    if (user.company.requirePr) {
      if (!buyerPrId) {
        return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json(
          { success: false, code: 'PR_REQUIRED', message: 'A Purchase Requisition (PR) is required by your company to publish an RFQ.' },
          { status: 403 }
        );
      }
      
      await db();
      const { PurchaseRequisition } = await import('@/models/Catalog');
      const pr = await PurchaseRequisition.findOne({
        _id: buyerPrId, companyId: user.companyId
      }).lean() as any;

      if (!pr || pr.status !== 'APPROVED') {
         return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json(
          { success: false, code: 'PR_NOT_APPROVED', message: 'The linked Purchase Requisition must be APPROVED.' },
          { status: 403 }
        );
      }
    }

    // Verify all items have drawings
    for (const item of items) {
      if (!item.componentName || !item.drawingFileId || !item.quantity || !item.hsnCode) {
        return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json(
          { success: false, code: 'MISSING_DRAWING', message: 'Each component must have a name, quantity, drawing, and HSN code' },
          { status: 400 }
        );
      }
    }

    await db();
    const { CompanyAddress } = await import('@/models/Company');
    
    let primaryAddress;
    if (deliveryAddressId) {
      primaryAddress = await CompanyAddress.findOne({
        _id: deliveryAddressId, companyId: user.companyId
      }).lean() as any;
    } else {
      primaryAddress = await CompanyAddress.findOne({
        companyId: user.companyId, isPrimary: true
      }).lean() as any;
    }

    if (!primaryAddress) {
      return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'A valid delivery address belonging to the company is required' },
        { status: 400 }
      );
    }

    const { nextNumber } = await import('@/lib/sequence');
    const rfqNumber = await nextNumber('RFQ');

    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    let rfq: any = null;

    try {
      session.startTransaction();
      const { RFQ, RFQItem } = await import('@/models/RFQ');

      const rfqDoc = await RFQ.create([{
        buyerCompanyId: user.companyId,
        buyerPrId,
        rfqNumber,
        title,
        description,
        category,
        status: status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
        bidStartAt: status === 'DRAFT' ? null : new Date(),
        bidEndAt: bidEndAt ? new Date(bidEndAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // default 7 days
        requiredDeliveryDate: requiredDeliveryDate ? new Date(requiredDeliveryDate) : null,
        deliveryAddressId: primaryAddress._id,
      }], { session });

      const createdRfq = rfqDoc[0];

      const itemsToCreate = items.map((item: any) => ({
        rfqId: createdRfq._id,
        componentName: item.componentName,
        drawingFileId: item.drawingFileId,
        drawingRevision: item.drawingRevision || 'v1',
        quantity: item.quantity,
        unit: item.unit || 'pcs',
        specification: item.specification,
        hsnCode: item.hsnCode,
        materialOptionPreference: item.materialOptionPreference || 'BOTH',
        expectedTimeDays: item.expectedTimeDays ? Number(item.expectedTimeDays) : null,
      }));

      const createdItems = await RFQItem.insertMany(itemsToCreate, { session });
      
      await session.commitTransaction();

      rfq = {
        ...createdRfq.toObject(),
        id: createdRfq._id.toString(),
        items: createdItems.map(i => ({ ...i.toObject(), id: i._id.toString() }))
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    if (rfq && rfq.status === 'PUBLISHED') {
      const { publishToCentrifugo } = await import('@/lib/centrifugo');
      await publishToCentrifugo('global_updates', {
        type: 'db_change',
        target: 'all',
        message: 'A new requirement has been posted in the marketplace!'
      });
    }

    return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json({
      success: true,
      message: 'RFQ published successfully',
      data: rfq,
    });
  } catch (error: any) {
    console.error('Create RFQ error:', error);
    return console.log(`[API Response] /api/v1/rfqs - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
