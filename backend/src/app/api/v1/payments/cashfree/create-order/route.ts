import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { getPlatformBilling } from '@/lib/platformBilling';
import { buildCashfreeOrderId, getCashfreeConfig } from '@/lib/cashfreeConfig';
import { createCashfreeOrder } from '@/lib/cashfreeClient';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'invoiceId is required' },
        { status: 400 }
      );
    }

    await db();
    const { Invoice } = await import('@/models/Finance');
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    const { Company } = await import('@/models/Company');

    const invoice = (await Invoice.findById(invoiceId).lean()) as any;

    if (!invoice) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (invoice.payerCompanyId?.toString() !== user.companyId) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'You are not the payer for this invoice' },
        { status: 403 }
      );
    }

    if (invoice.type !== 'TAX_INVOICE') {
      return NextResponse.json(
        { success: false, code: 'INVALID_TYPE', message: 'Only buyer tax invoices can be paid here' },
        { status: 400 }
      );
    }

    if (invoice.status !== 'UNPAID') {
      return NextResponse.json(
        { success: false, code: 'INVALID_STATUS', message: 'Invoice is already paid or settled' },
        { status: 400 }
      );
    }

    const platform = await getPlatformBilling();
    const cashfree = getCashfreeConfig();

    const po = invoice.purchaseOrderId
      ? ((await PurchaseOrder.findById(invoice.purchaseOrderId).lean()) as any)
      : null;
    const supplierCompany = po?.supplierCompanyId
      ? ((await Company.findById(po.supplierCompanyId).lean()) as any)
      : null;

    const { syncUnpaidTaxInvoiceFromPo, syncUnpaidPayoutInvoiceFromPo, computeOrderAmounts } =
      await import('@/lib/orderAmounts');
    const { PurchaseOrderItem } = await import('@/models/PurchaseOrder');

    let syncedInvoice = invoice;
    if (po) {
      syncedInvoice = await syncUnpaidTaxInvoiceFromPo(invoice, po);
      const payoutInv = await Invoice.findOne({
        purchaseOrderId: po._id,
        type: 'SUPPLIER_PAYOUT',
      }).lean();
      if (payoutInv) {
        await syncUnpaidPayoutInvoiceFromPo(payoutInv, po);
      }
    }

    const items = po ? await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean() : [];
    const amounts = po ? await computeOrderAmounts(po, items as any[]) : null;
    const amount = amounts?.invoiceTotal || syncedInvoice.totalAmount || syncedInvoice.total;

    let orderId = '';
    let paymentSessionId = '';

    if (cashfree.stubMode) {
      orderId = `order_stub_${Date.now()}`;
      paymentSessionId = `session_stub_${Date.now()}`;
    } else {
      orderId = buildCashfreeOrderId(String(invoiceId));
      const cfOrder = await createCashfreeOrder({
        orderId,
        amountPaise: amount,
        invoiceNumber: syncedInvoice.number,
        invoiceId: String(invoiceId),
        customer: {
          id: String(user.companyId),
          name: user.company?.name || user.name,
          email: user.email,
          phone: user.phone,
        },
      });
      orderId = cfOrder.order_id;
      paymentSessionId = cfOrder.payment_session_id;
    }

    return NextResponse.json({
      success: true,
      data: {
        provider: 'CASHFREE',
        orderId,
        paymentSessionId,
        amount,
        currency: 'INR',
        environment: cashfree.environment,
        stubMode: cashfree.stubMode,
        platform: {
          name: platform.name,
          gstin: platform.gstin,
          state: platform.state,
        },
        invoice: {
          id: syncedInvoice._id.toString(),
          number: syncedInvoice.number,
          goodsTaxable: amounts?.goodsTaxable || syncedInvoice.taxable,
          commissionAmount: amounts?.commissionAmount || po?.commissionAmount || 0,
          taxable: amounts?.invoiceTaxable || syncedInvoice.taxable,
          cgstAmount: amounts?.cgstAmount || syncedInvoice.cgstAmount || 0,
          sgstAmount: amounts?.sgstAmount || syncedInvoice.sgstAmount || 0,
          igstAmount: amounts?.igstAmount || syncedInvoice.igstAmount || 0,
          total: amount,
          status: syncedInvoice.status,
        },
        purchaseOrder: po
          ? {
              id: po._id.toString(),
              poNumber: po.poNumber,
              totalAmount: amounts?.buyerTotal || po.totalAmount,
              supplierName: supplierCompany?.name || 'Supplier',
            }
          : null,
        paymentNote:
          'You are paying the platform via Cashfree (not the supplier directly). The supplier is paid after platform verification.',
      },
    });
  } catch (error: any) {
    console.error('Cashfree create order error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
