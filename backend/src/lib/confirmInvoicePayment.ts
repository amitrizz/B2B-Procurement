import mongoose from 'mongoose';

export async function confirmInvoicePayment(
  invoiceId: string,
  payerCompanyId: string,
  options?: { method?: string; utrNumber?: string }
) {
  const { db } = await import('@/lib/db');
  await db();

  const { Invoice, Payment } = await import('@/models/Finance');
  const { PurchaseOrder } = await import('@/models/PurchaseOrder');

  const invoice = (await Invoice.findById(invoiceId).lean()) as any;
  if (!invoice || invoice.type !== 'TAX_INVOICE') {
    return { ok: false as const, status: 404, code: 'NOT_FOUND', message: 'Buyer tax invoice not found' };
  }

  if (invoice.payerCompanyId?.toString() !== payerCompanyId) {
    return { ok: false as const, status: 403, code: 'FORBIDDEN', message: 'Only the buyer can confirm this payment' };
  }

  if (invoice.status === 'PAID' || invoice.status === 'SETTLED') {
    return { ok: true as const, status: 200, message: 'Invoice already paid', alreadyPaid: true };
  }

  const po = invoice.purchaseOrderId
    ? await PurchaseOrder.findById(invoice.purchaseOrderId).lean()
    : null;

  let paymentId: string | null = null;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await Invoice.updateOne({ _id: invoiceId }, { $set: { status: 'PAID' } }, { session });

    if (invoice.purchaseOrderId) {
      await Invoice.updateOne(
        { purchaseOrderId: invoice.purchaseOrderId, type: 'SUPPLIER_PAYOUT' },
        { $set: { status: 'PENDING_RELEASE' } },
        { session }
      );
    }

    const paymentDocs = await Payment.create(
      [
        {
          invoiceId,
          amount: invoice.total,
          method: options?.method || 'CASHFREE',
          utrNumber: options?.utrNumber,
          status: 'HELD',
          heldAt: new Date(),
        },
      ],
      { session }
    );

    paymentId = paymentDocs[0]._id.toString();
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  let payoutMessage = '';
  if (paymentId) {
    const { releaseSupplierPayout } = await import('@/lib/supplierPayout');
    const payout = await releaseSupplierPayout(paymentId);
    if (payout.ok) {
      payoutMessage = ` Supplier received ₹${(payout.payoutAmount / 100).toFixed(2)} for items.`;
    } else {
      console.warn('Supplier auto-payout deferred:', payout.message);
      payoutMessage = ' Supplier payout is queued for processing.';
    }
  }

  if (po) {
    const { broadcastOrderUpdate } = await import('@/lib/orderEvents');
    await broadcastOrderUpdate(
      po,
      'payment_received',
      `Buyer payment received by platform for order ${(po as any).poNumber || po._id}.${payoutMessage}`
    );
  }

  return {
    ok: true as const,
    status: 200,
    message: `Payment received by platform.${payoutMessage || ' Supplier will be paid after verification.'}`,
  };
}
