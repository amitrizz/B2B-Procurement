/** Shared PO / invoice amount calculations (all values in paise). */

import { getPlatformBilling } from './platformBilling';
import { computePlatformPricing, type PlatformPricing } from './platformPricing';

export type OrderAmountBreakdown = PlatformPricing & {
  invoiceTaxable: number;
  invoiceTotal: number;
};

export async function computeOrderAmounts(
  po: any,
  items: any[] = []
): Promise<OrderAmountBreakdown> {
  const platform = await getPlatformBilling();

  const goodsTaxable = items.length
    ? items.reduce((sum, item) => sum + item.quantity * (item.unitPrice || item.finalUnitPrice || 0), 0)
    : Math.max(0, (po?.totalAmount || 0) - (po?.commissionAmount || 0) - (po?.taxAmount || 0));

  const shipToState =
    po?.placeOfSupplyState || po?.buyerState || process.env.PLATFORM_STATE || platform.state;

  const pricing = computePlatformPricing({
    goodsTaxablePaise: goodsTaxable,
    commissionAmountOverride: po?.commissionAmount,
    shipToState,
    platformState: platform.state,
  });

  return {
    ...pricing,
    invoiceTaxable: pricing.feeTaxable,
    invoiceTotal: pricing.buyerTotal,
  };
}

export async function rebuildTaxInvoiceLines(
  invoiceId: any,
  items: any[],
  amounts: OrderAmountBreakdown
) {
  const { InvoiceLine } = await import('@/models/Finance');

  await InvoiceLine.deleteMany({ invoiceId });

  const docs = items.map((item, index) => ({
    invoiceId,
    description: `PO line item ${index + 1}`,
    hsnCode: item.hsnCode || '',
    qty: item.quantity,
    unitPrice: item.unitPrice || item.finalUnitPrice || 0,
    taxable: item.quantity * (item.unitPrice || item.finalUnitPrice || 0),
    taxRateBps: 0,
    taxAmount: 0,
  }));

  if (amounts.commissionAmount > 0) {
    docs.push({
      invoiceId,
      description: 'Platform service fee',
      hsnCode: '998599',
      qty: 1,
      unitPrice: amounts.commissionAmount,
      taxable: amounts.commissionAmount,
      taxRateBps: 1800,
      taxAmount: amounts.taxTotal,
    });
  }

  if (docs.length) {
    await InvoiceLine.insertMany(docs);
  }
}

export async function rebuildPayoutInvoiceLines(invoiceId: any, items: any[]) {
  const { InvoiceLine } = await import('@/models/Finance');

  await InvoiceLine.deleteMany({ invoiceId });

  const docs = items.map((item, index) => ({
    invoiceId,
    description: `PO line item ${index + 1}`,
    hsnCode: item.hsnCode || '',
    qty: item.quantity,
    unitPrice: item.unitPrice || item.finalUnitPrice || 0,
    taxable: item.quantity * (item.unitPrice || item.finalUnitPrice || 0),
    taxRateBps: 0,
    taxAmount: 0,
  }));

  if (docs.length) {
    await InvoiceLine.insertMany(docs);
  }
}

export async function syncUnpaidTaxInvoiceFromPo(invoice: any, po: any) {
  if (!invoice || !po || invoice.type !== 'TAX_INVOICE' || invoice.status !== 'UNPAID') {
    return invoice;
  }

  const { PurchaseOrderItem } = await import('@/models/PurchaseOrder');
  const { Invoice } = await import('@/models/Finance');

  const items = await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean();
  const amounts = await computeOrderAmounts(po, items as any[]);

  await Invoice.updateOne(
    { _id: invoice._id },
    {
      $set: {
        taxable: amounts.invoiceTaxable,
        cgstAmount: amounts.cgstAmount,
        sgstAmount: amounts.sgstAmount,
        igstAmount: amounts.igstAmount,
        total: amounts.invoiceTotal,
      },
    }
  );

  await rebuildTaxInvoiceLines(invoice._id, items as any[], amounts);

  return {
    ...invoice,
    taxable: amounts.invoiceTaxable,
    cgstAmount: amounts.cgstAmount,
    sgstAmount: amounts.sgstAmount,
    igstAmount: amounts.igstAmount,
    total: amounts.invoiceTotal,
  };
}

export async function syncUnpaidPayoutInvoiceFromPo(invoice: any, po: any) {
  if (!invoice || !po || invoice.type !== 'SUPPLIER_PAYOUT' || invoice.status === 'SETTLED') {
    return invoice;
  }

  const { PurchaseOrderItem } = await import('@/models/PurchaseOrder');
  const { Invoice } = await import('@/models/Finance');

  const items = await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean();
  const amounts = await computeOrderAmounts(po, items as any[]);

  await Invoice.updateOne(
    { _id: invoice._id },
    {
      $set: {
        taxable: amounts.goodsTaxable,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        total: amounts.supplierPayoutTotal,
      },
    }
  );

  await rebuildPayoutInvoiceLines(invoice._id, items as any[]);

  return {
    ...invoice,
    taxable: amounts.goodsTaxable,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    total: amounts.supplierPayoutTotal,
  };
}
