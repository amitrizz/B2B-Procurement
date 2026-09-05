import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    await db();
    const { Invoice, InvoiceLine } = await import('@/models/Finance');
    const { PurchaseOrder, PurchaseOrderItem } = await import('@/models/PurchaseOrder');
    const { Company } = await import('@/models/Company');

    let invoice = (await Invoice.findById(id).lean()) as any;
    if (!invoice) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Invoice not found' }, { status: 404 });
    }

    const po = invoice.purchaseOrderId
      ? ((await PurchaseOrder.findById(invoice.purchaseOrderId).lean()) as any)
      : null;

    if (!po) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Linked order not found' }, { status: 404 });
    }

    const isParty =
      po.buyerCompanyId?.toString() === user.companyId ||
      po.supplierCompanyId?.toString() === user.companyId;

    if (!isParty && user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Unauthorized' }, { status: 403 });
    }

    const poItems = await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean();
    const {
      computeOrderAmounts,
      syncUnpaidTaxInvoiceFromPo,
      syncUnpaidPayoutInvoiceFromPo,
    } = await import('@/lib/orderAmounts');

    const amounts = await computeOrderAmounts(po, poItems as any[]);

    if (invoice.type === 'TAX_INVOICE' && invoice.status === 'UNPAID') {
      invoice = await syncUnpaidTaxInvoiceFromPo(invoice, po);
    } else if (invoice.type === 'SUPPLIER_PAYOUT' && invoice.status !== 'SETTLED') {
      invoice = await syncUnpaidPayoutInvoiceFromPo(invoice, po);
    }

    const lines = await InvoiceLine.find({ invoiceId: invoice._id }).lean();
    const buyerCompany = (await Company.findById(po.buyerCompanyId).lean()) as any;
    const supplierCompany = (await Company.findById(po.supplierCompanyId).lean()) as any;

    const { getPlatformBilling, formatInvoiceParties } = await import('@/lib/platformBilling');
    const platform = await getPlatformBilling();
    const parties = formatInvoiceParties(invoice, platform, buyerCompany, supplierCompany);

    const isTaxInvoice = invoice.type === 'TAX_INVOICE';
    const displayTotal = isTaxInvoice ? amounts.invoiceTotal : amounts.supplierPayoutTotal;

    return NextResponse.json({
      success: true,
      data: {
        ...invoice,
        id: invoice._id.toString(),
        taxable: isTaxInvoice ? amounts.invoiceTaxable : amounts.goodsTaxable,
        cgstAmount: isTaxInvoice ? amounts.cgstAmount : 0,
        sgstAmount: isTaxInvoice ? amounts.sgstAmount : 0,
        igstAmount: isTaxInvoice ? amounts.igstAmount : 0,
        total: displayTotal,
        goodsTaxable: amounts.goodsTaxable,
        commissionAmount: amounts.commissionAmount,
        feeTaxable: amounts.invoiceTaxable,
        platformFeeGst: amounts.taxTotal,
        lines: lines.map((line: any) => ({ ...line, id: line._id.toString() })),
        purchaseOrder: {
          id: po._id.toString(),
          poNumber: po.poNumber,
          status: po.status,
        },
        buyerCompany: buyerCompany ? { name: buyerCompany.name, gstin: buyerCompany.gstin } : null,
        supplierCompany: supplierCompany
          ? { name: supplierCompany.name, gstin: supplierCompany.gstin }
          : null,
        platform: { name: platform.name, gstin: platform.gstin, state: platform.state },
        sellerParty: parties.sellerParty,
        buyerParty: parties.buyerParty,
        paymentNote: parties.paymentNote,
      },
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
