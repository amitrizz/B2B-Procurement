import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    await db();
    const { PurchaseRequisition, PurchaseRequisitionLine: PurchaseRequisitionLine } = await import('@/models/Catalog');
    const mongoose = (await import('mongoose')).default;
    
    const prsDoc = await PurchaseRequisition.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(user.companyId) } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'purchaserequisitionlines',
          localField: '_id',
          foreignField: 'prId',
          as: 'lines'
        }
      },
      {
        $lookup: {
          from: 'User',
          localField: 'createdByUserId',
          foreignField: '_id',
          as: 'creatorArr'
        }
      },
      {
        $addFields: {
          creator: { $arrayElemAt: ['$creatorArr', 0] }
        }
      },
      {
        $project: {
          creatorArr: 0
        }
      }
    ]);

    const prs = prsDoc.map((pr: any) => ({
      ...pr,
      id: pr._id.toString(),
      lines: pr.lines.map((l: any) => ({ ...l, id: l._id.toString() }))
    }));

    return console.log(`[API Response] /api/v1/prs - Sending response`), NextResponse.json({ success: true, data: prs });
  } catch (error: any) {
    console.error('List PRs error:', error);
    return console.log(`[API Response] /api/v1/prs - Sending response`), NextResponse.json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || !user.company) return authErrorResponse();

    if (user.company.isActive === false) {
      return console.log(`[API Response] /api/v1/prs - Sending response`), NextResponse.json(
        { success: false, code: 'INACTIVE_COMPANY', message: 'Your company account is inactive. Please contact support.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { items, title, description } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return console.log(`[API Response] /api/v1/prs - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'At least one PR line is required' }, { status: 400 });
    }

    const { nextNumber } = await import('@/lib/sequence');
    const prNumber = await nextNumber('PR');

    let totalEstimated = 0;
    for (const line of items) {
      if (!line.componentName || !line.quantity) {
         return console.log(`[API Response] /api/v1/prs - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'Missing line details' }, { status: 400 });
      }
    }

    // Determine initial status based on Approval rules. 
    // Maker-checker means if a rule matches this amount, we require approval.
    // If no rule matches, it might just be APPROVED immediately, or PENDING_APPROVER. Let's say PENDING_APPROVER is default unless no rules exist.
    await db();
    const { ApprovalRule } = await import('@/models/Catalog');
    const { PurchaseRequisition, PurchaseRequisitionLine } = await import('@/models/Catalog');
    const mongoose = (await import('mongoose')).default;

    const rules = await ApprovalRule.find({ companyId: user.companyId }).lean();

    let requiresApproval = false;
    for (const rule of rules) {
      if (totalEstimated >= rule.minPaise && totalEstimated <= rule.maxPaise) {
         requiresApproval = true;
         break;
      }
    }

    // Spec says PR must be approved. We'll set it to PENDING_APPROVER if rules exist, or if requiresApproval is true.
    // Actually, let's always require approval to enforce Maker-Checker.
    const status = 'PENDING_APPROVER'; 

    const session = await mongoose.startSession();
    let pr: any = null;

    try {
      session.startTransaction();

      const prDoc = await PurchaseRequisition.create([{
        prNumber,
        title,
        description,
        companyId: user.companyId,
        createdByUserId: user.id,
        totalEstimated,
        status,
      }], { session });

      const createdPr = prDoc[0];

      const linesToCreate = items.map((l: any) => ({
        prId: createdPr._id,
        componentName: l.componentName,
        quantity: Number(l.quantity),
        unit: 'pcs',
        estimatedPrice: 0
      }));

      const createdLines = await PurchaseRequisitionLine.insertMany(linesToCreate, { session });

      await session.commitTransaction();

      pr = {
        ...createdPr.toObject(),
        id: createdPr._id.toString(),
        lines: createdLines.map(l => ({ ...l.toObject(), id: l._id.toString() }))
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return console.log(`[API Response] /api/v1/prs - Sending response`), NextResponse.json({ success: true, message: 'Purchase Requisition created', data: pr });

  } catch (error: any) {
    console.error('Create PR error:', error);
    return console.log(`[API Response] /api/v1/prs - Sending response`), NextResponse.json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}
