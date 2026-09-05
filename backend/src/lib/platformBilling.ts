import { db } from './db';

export type PlatformBilling = {
  name: string;
  gstin: string;
  state: string;
};

/** Marketplace operator billing identity shown on tax invoices. */
export async function getPlatformBilling(): Promise<PlatformBilling> {
  await db();
  const { PlatformConfig } = await import('@/models/Platform');
  const config = (await PlatformConfig.findOne().lean()) as any;

  return {
    name: process.env.PLATFORM_LEGAL_NAME || 'P2P Procurement Platform Pvt Ltd',
    gstin: process.env.PLATFORM_GSTIN || '27AABCP1234A1Z5',
    state: config?.platformState || process.env.PLATFORM_STATE || 'Maharashtra',
  };
}

export function formatInvoiceParties(
  invoice: any,
  platform: PlatformBilling,
  buyerCompany: any,
  supplierCompany: any
) {
  if (invoice.type === 'SUPPLIER_PAYOUT') {
    return {
      sellerParty: {
        name: supplierCompany?.name || 'Supplier',
        gstin: supplierCompany?.gstin || invoice.sellerGstin || '',
        label: 'Seller',
      },
      buyerParty: {
        name: platform.name,
        gstin: platform.gstin,
        label: 'Buyer (Platform)',
      },
      paymentNote:
        'The platform collects payment from the buyer and settles your payout after verification.',
    };
  }

  // TAX_INVOICE — buyer pays platform (platform is seller on the tax invoice)
  return {
    sellerParty: {
      name: platform.name,
      gstin: platform.gstin,
      label: 'Seller (Platform)',
    },
    buyerParty: {
      name: buyerCompany?.name || 'Buyer',
      gstin: buyerCompany?.gstin || invoice.buyerGstin || '',
      label: 'Buyer',
    },
    paymentNote:
      'Pay the platform. Your supplier is paid by the platform after payment is verified.',
  };
}
