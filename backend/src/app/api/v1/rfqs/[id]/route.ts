import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    await db();
    const { RFQ } = await import('@/models/RFQ');
    await import('@/models/Company');
    const mongoose = (await import('mongoose')).default;

    const rfqDoc = await RFQ.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'companies',
          localField: 'buyerCompanyId',
          foreignField: '_id',
          as: 'buyerCompany'
        }
      },
      { $unwind: { path: '$buyerCompany', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'rfqitems',
          localField: '_id',
          foreignField: 'rfqId',
          as: 'items'
        }
      },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'bids',
          localField: 'items._id',
          foreignField: 'rfqItemId',
          as: 'items.bids'
        }
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'items.bids.supplierCompanyId',
          foreignField: '_id',
          as: 'supplierCompanies'
        }
      },
      {
        $group: {
          _id: '$_id',
          root: { $first: '$$ROOT' },
          items: {
            $push: {
              $mergeObjects: [
                '$items',
                {
                  bids: {
                    $map: {
                      input: '$items.bids',
                      as: 'bid',
                      in: {
                        $mergeObjects: [
                          '$$bid',
                          {
                            supplierCompany: {
                              $arrayElemAt: [
                                {
                                  $filter: {
                                    input: '$supplierCompanies',
                                    as: 'sc',
                                    cond: { $eq: ['$$sc._id', '$$bid.supplierCompanyId'] }
                                  }
                                },
                                0
                              ]
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ['$root', { items: '$items' }]
          }
        }
      },
      { $project: { supplierCompanies: 0 } }
    ]);

    let rfq: any = null;
    if (rfqDoc.length > 0) {
      rfq = {
        ...rfqDoc[0],
        id: rfqDoc[0]._id.toString(),
        buyerCompany: rfqDoc[0].buyerCompany ? {
          ...rfqDoc[0].buyerCompany,
          id: rfqDoc[0].buyerCompany._id.toString()
        } : null,
        items: rfqDoc[0].items[0] && rfqDoc[0].items[0]._id ? rfqDoc[0].items.map((i: any) => ({
          ...i,
          id: i._id.toString(),
          bids: i.bids ? i.bids.map((b: any) => ({
            ...b,
            id: b._id.toString(),
            supplierCompany: b.supplierCompany ? {
              name: b.supplierCompany.name
            } : null
          })) : []
        })) : []
      };
    }

    if (!rfq) {
      return console.log(`[API Response] /api/v1/rfqs/[id] - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'RFQ not found' },
        { status: 404 }
      );
    }

    // Strict security check: non-buyer cannot see bids on the RFQ
    const isBuyer = rfq.buyerCompanyId.toString() === user.companyId;

    const sanitizedItems = rfq.items.map((item: any) => {
      if (!isBuyer) {
        // Hide other suppliers' bids from public viewers
        const { bids, ...rest } = item;
        return rest;
      }
      return item;
    });

    return console.log(`[API Response] /api/v1/rfqs/[id] - Sending response`), NextResponse.json({
      success: true,
      data: {
        ...rfq,
        items: sanitizedItems,
      },
    });
  } catch (error: any) {
    console.error('Get RFQ details error:', error);
    return console.log(`[API Response] /api/v1/rfqs/[id] - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || !user.company) return authErrorResponse();

    if (user.company.status !== 'VERIFIED') {
      return console.log(`[API Response] /api/v1/rfqs/[id] PUT - Sending response`), NextResponse.json(
        { success: false, code: 'UNVERIFIED_COMPANY', message: 'Only verified companies can modify requirements' },
        { status: 403 }
      );
    }

    if (user.company.isActive === false) {
      return console.log(`[API Response] /api/v1/rfqs/[id] PUT - Sending response`), NextResponse.json(
        { success: false, code: 'INACTIVE_COMPANY', message: 'Your company account is inactive. Please contact support.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { title, description, category, bidEndAt, requiredDeliveryDate, items } = await req.json();

    if (!title || !items || !Array.isArray(items) || items.length === 0) {
      return console.log(`[API Response] /api/v1/rfqs/[id] PUT - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing title or components list' },
        { status: 400 }
      );
    }

    // Verify all items have drawings
    for (const item of items) {
      if (!item.componentName || !item.drawingFileId || !item.quantity || !item.hsnCode) {
        return console.log(`[API Response] /api/v1/rfqs/[id] PUT - Sending response`), NextResponse.json(
          { success: false, code: 'MISSING_DRAWING', message: 'Each component must have a name, quantity, drawing, and HSN code' },
          { status: 400 }
        );
      }
    }

    await db();
    const { RFQ, RFQItem } = await import('@/models/RFQ');
    const mongoose = (await import('mongoose')).default;

    const existingRfq = await RFQ.findOne({ _id: id, buyerCompanyId: user.companyId });
    if (!existingRfq) {
      return console.log(`[API Response] /api/v1/rfqs/[id] PUT - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'RFQ not found or you do not have permission to edit it' },
        { status: 404 }
      );
    }

    if (!['DRAFT', 'PUBLISHED', 'BIDDING_OPEN'].includes(existingRfq.status)) {
      return console.log(`[API Response] /api/v1/rfqs/[id] PUT - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_STATUS', message: 'This RFQ can no longer be modified' },
        { status: 400 }
      );
    }

    const session = await mongoose.startSession();
    let updatedRfq: any = null;

    try {
      session.startTransaction();

      existingRfq.title = title;
      existingRfq.description = description;
      existingRfq.category = category;
      if (bidEndAt) existingRfq.bidEndAt = new Date(bidEndAt);
      if (requiredDeliveryDate) existingRfq.requiredDeliveryDate = new Date(requiredDeliveryDate);
      existingRfq.version += 1;
      
      await existingRfq.save({ session });

      // Delete existing items
      await RFQItem.deleteMany({ rfqId: id }, { session });

      // Insert new items
      const itemsToCreate = items.map((item: any) => ({
        rfqId: existingRfq._id,
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

      updatedRfq = {
        ...existingRfq.toObject(),
        id: existingRfq._id.toString(),
        items: createdItems.map(i => ({ ...i.toObject(), id: i._id.toString() }))
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return console.log(`[API Response] /api/v1/rfqs/[id] PUT - Sending response`), NextResponse.json({
      success: true,
      message: 'RFQ updated successfully',
      data: updatedRfq,
    });
  } catch (error: any) {
    console.error('Update RFQ error:', error);
    return console.log(`[API Response] /api/v1/rfqs/[id] PUT - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
