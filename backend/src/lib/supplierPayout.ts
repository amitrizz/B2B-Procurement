import mongoose from 'mongoose';

export type ReleaseSupplierPayoutResult =
  | { ok: true; payoutAmount: number; supplierCompanyId: string; po: any }
  | { ok: false; status: number; code: string; message: string };

/** Release escrow to supplier (goods value) after buyer paid the platform. */
export async function releaseSupplierPayout(paymentId: string): Promise<ReleaseSupplierPayoutResult> {
  const { db } = await import('@/lib/db');
  await db();

  const { Payment, Invoice, LedgerEntry } = await import('@/models/Finance');
  const { PurchaseOrder, PurchaseOrderItem, GoodsReceipt } = await import('@/models/PurchaseOrder');

  const payment = (await Payment.findById(paymentId).lean()) as any;
  if (!payment) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Payment not found' };
  }

  const invoice = (await Invoice.findById(payment.invoiceId).lean()) as any;
  if (!invoice || invoice.type !== 'TAX_INVOICE') {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Buyer tax invoice not found' };
  }

  if (payment.status !== 'HELD') {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_STATUS',
      message: payment.status === 'RELEASED' ? 'Payout already sent to supplier' : 'Payment is not in HELD state',
    };
  }

  const po = invoice.purchaseOrderId
    ? ((await PurchaseOrder.findById(invoice.purchaseOrderId).lean()) as any)
    : null;

  if (po) {
    const goodsReceipts = (await GoodsReceipt.find({ purchaseOrderId: po._id }).lean()) as any[];
    const acceptedGrn = goodsReceipts.find(
      (g: any) => g.decision === 'ACCEPT' || g.decision === 'ACCEPT_WITH_DEVIATION'
    );

    if (!acceptedGrn && po.status !== 'COMPLETED') {
      return {
        ok: false,
        status: 400,
        code: 'MATCH_FAILED',
        message: 'Cannot pay supplier until delivery is confirmed (GRN)',
      };
    }

    const poItems = (await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean()) as any[];
    const totalAcceptedValue = poItems.reduce(
      (sum, item) => sum + item.quantity * (item.unitPrice || item.finalUnitPrice || 0),
      0
    );

    const { computeOrderAmounts } = await import('@/lib/orderAmounts');
    const orderAmounts = await computeOrderAmounts(po, poItems);
    const expectedPayout = orderAmounts.supplierPayoutTotal;

    const toleranceBps = 100;
    const difference = Math.abs(expectedPayout - totalAcceptedValue);
    const allowedTolerance = Math.max(100, (expectedPayout * toleranceBps) / 10000);

    if (difference > allowedTolerance) {
      return {
        ok: false,
        status: 400,
        code: 'MATCH_FAILED',
        message: `Payout amount (${expectedPayout}) does not match accepted goods value (${totalAcceptedValue})`,
      };
    }
  }

  const payoutCompanyId = po?.supplierCompanyId || invoice.payeeCompanyId;
  if (!payoutCompanyId) {
    return { ok: false, status: 400, code: 'NO_SUPPLIER', message: 'Supplier not found for payout' };
  }

  let payoutAmount = 0;
  if (po?._id) {
    const poItems = (await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean()) as any[];
    const { computeOrderAmounts } = await import('@/lib/orderAmounts');
    const orderAmounts = await computeOrderAmounts(po, poItems);
    payoutAmount = orderAmounts.supplierPayoutTotal;
  } else {
    payoutAmount = Math.max(0, (invoice.total || 0) - (invoice.taxable || 0));
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await Payment.findByIdAndUpdate(
      paymentId,
      { $set: { status: 'RELEASED', releasedAt: new Date() } },
      { session }
    );

    await Invoice.updateOne({ _id: payment.invoiceId }, { $set: { status: 'SETTLED' } }, { session });

    if (po?._id) {
      await Invoice.updateOne(
        { purchaseOrderId: po._id, type: 'SUPPLIER_PAYOUT' },
        { $set: { status: 'SETTLED' } },
        { session }
      );
    }

    await LedgerEntry.create(
      [
        {
          paymentId,
          companyId: payoutCompanyId,
          type: 'SUPPLIER_PAYOUT',
          amount: payoutAmount,
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  const payoutCfg = (await import('@/lib/cashfreeConfig')).getSupplierPayoutConfig();
  if (payoutCfg.ledgerOnly) {
    console.info(
      `[supplierPayout] Ledger release ₹${(payoutAmount / 100).toFixed(2)} (SUPPLIER_PAYOUT_MODE=${payoutCfg.mode})`
    );
  }

  if (po) {
    const { broadcastOrderUpdate } = await import('@/lib/orderEvents');
    await broadcastOrderUpdate(
      po,
      'supplier_payout_released',
      `Platform sent ₹${(payoutAmount / 100).toFixed(2)} to supplier for order ${po.poNumber || po._id}.`
    );

    const { broadcastCompanyUpdate } = await import('@/lib/companyEvents');
    await broadcastCompanyUpdate(
      payoutCompanyId.toString(),
      'supplier_payout_released',
      `You received ₹${(payoutAmount / 100).toFixed(2)} from the platform for PO ${po.poNumber || po._id}.`
    );
  }

  return {
    ok: true,
    payoutAmount,
    supplierCompanyId: payoutCompanyId.toString(),
    po,
  };
}
