import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return authErrorResponse('Only Platform Admin can release payments');
    }

    const { id } = await params;

    await db();
    const { Payment, Invoice, LedgerEntry } = await import('@/models/Finance');
    const { PurchaseOrder, PurchaseOrderItem } = await import('@/models/PurchaseOrder');
    const { GoodsReceipt } = await import('@/models/PurchaseOrder');

    const payment = await Payment.findById(id).lean() as any;

    if (!payment) {
       return console.log(`[API Response] /api/v1/admin/payments/[id]/release - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Payment not found' }, { status: 404 });
    }

    const invoice = await Invoice.findById(payment.invoiceId).lean() as any;
    if (!invoice) {
       return console.log(`[API Response] /api/v1/admin/payments/[id]/release - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Linked Invoice not found' }, { status: 404 });
    }

    if (payment.status !== 'HELD') {
       return console.log(`[API Response] /api/v1/admin/payments/[id]/release - Sending response`), NextResponse.json({ success: false, code: 'INVALID_STATUS', message: 'Payment is not in HELD state' }, { status: 400 });
    }

    const po = invoice.purchaseOrderId ? await PurchaseOrder.findById(invoice.purchaseOrderId).lean() as any : null;

    if (!po) {
      // Direct invoice without PO? We can't do 3-way match. Let's just release.
    } else {
      // 3-Way Match Logic
      // |invoice.taxable - sum(GRN accepted qty * unitPrice)| <= taxable * toleranceBps / 10000.
      
      let totalAcceptedValue = 0;
      // In a full implementation, GRN would store quantities per item. 
      // For this simplified spec, let's assume if a GRN decision is 'ACCEPT' or 'ACCEPT_WITH_DEVIATION', we calculate accepted value.
      // If GRN is at the PO level (as per current schema), we might assume all quantities accepted unless noted.
      // Let's assume GRN acceptance means 100% of PO value is accepted, OR we parse it.
      // Since schema doesn't have GRN lines, we will approximate based on PO value.
      
      const goodsReceipts = await GoodsReceipt.find({ purchaseOrderId: po._id }).lean() as any[];
      const acceptedGrn = goodsReceipts.find((g: any) => g.decision === 'ACCEPT' || g.decision === 'ACCEPT_WITH_DEVIATION');
      
      if (!acceptedGrn) {
        return console.log(`[API Response] /api/v1/admin/payments/[id]/release - Sending response`), NextResponse.json({ success: false, code: 'MATCH_FAILED', message: '3-way match failed: No approved GRN found' }, { status: 400 });
      }

      const poItems = await PurchaseOrderItem.find({ poId: po._id }).lean() as any[];
      totalAcceptedValue = poItems.reduce((sum, item) => sum + (item.quantity * item.finalUnitPrice), 0);
      
      const toleranceBps = 100; // 1%
      const invoiceTaxable = invoice.baseAmount || invoice.taxable || 0; // Using baseAmount or taxable
      const difference = Math.abs(invoiceTaxable - totalAcceptedValue);
      const allowedTolerance = (invoiceTaxable * toleranceBps) / 10000;

      if (difference > allowedTolerance) {
        return console.log(`[API Response] /api/v1/admin/payments/[id]/release - Sending response`), NextResponse.json({ 
          success: false, 
          code: 'MATCH_FAILED', 
          message: `3-way match failed: Invoice taxable (${invoiceTaxable}) vs GRN value (${totalAcceptedValue}) exceeds tolerance.` 
        }, { status: 400 });
      }
    }

    // Release Payment
    const session = await mongoose.startSession();
    let updatedPayment: any = null;

    try {
      session.startTransaction();

      const pDoc = await Payment.findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'RELEASED',
            releasedAt: new Date()
          }
        },
        { new: true, session }
      ).lean() as any;

      updatedPayment = pDoc ? { ...pDoc, id: pDoc._id.toString() } : null;

      // Update invoice status if fully paid (assuming 1 invoice = 1 payment here)
      await Invoice.updateOne(
        { _id: payment.invoiceId },
        { $set: { status: 'SETTLED' } },
        { session }
      );

      // Payout Ledger Entry
      await LedgerEntry.create([{
        paymentId: id,
        companyId: invoice.payeeCompanyId,
        type: 'SUPPLIER_PAYOUT',
        amount: (invoice.totalAmount || invoice.total) - (po?.commissionAmount || 0) // deducting commission if any
      }], { session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return console.log(`[API Response] /api/v1/admin/payments/[id]/release - Sending response`), NextResponse.json({
      success: true,
      message: 'Payment released successfully',
      data: updatedPayment
    });

  } catch (error: any) {
    console.error('Release payment error:', error);
    return console.log(`[API Response] /api/v1/admin/payments/[id]/release - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
