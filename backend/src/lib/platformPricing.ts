import { computeGst } from './gst';

export type PlatformPricing = {
  goodsTaxable: number;
  commissionAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxTotal: number;
  /** GST taxable base (= platform fee only). */
  feeTaxable: number;
  /** Amount buyer pays the platform. */
  buyerTotal: number;
  /** Amount platform pays supplier (goods only, no GST). */
  supplierPayoutTotal: number;
};

type PlatformPricingInput = {
  goodsTaxablePaise: number;
  commissionRate?: number;
  commissionBps?: number;
  shipToState: string;
  platformState: string;
  taxRateBps?: number;
  /** Use stored commission from PO when recalculating legacy orders. */
  commissionAmountOverride?: number;
};

export function computePlatformPricing(input: PlatformPricingInput): PlatformPricing {
  const goodsTaxable = Math.max(0, input.goodsTaxablePaise);

  let commissionAmount = input.commissionAmountOverride;
  if (commissionAmount == null) {
    if (input.commissionBps != null) {
      commissionAmount = Math.round((goodsTaxable * input.commissionBps) / 10000);
    } else {
      commissionAmount = Math.round(goodsTaxable * (input.commissionRate ?? 0.05));
    }
  }

  const { cgst, sgst, igst, taxTotal } = computeGst({
    taxablePaise: commissionAmount,
    shipToState: input.shipToState,
    supplierState: input.platformState,
    taxRateBps: input.taxRateBps ?? 1800,
  });

  const buyerTotal = goodsTaxable + commissionAmount + taxTotal;

  return {
    goodsTaxable,
    commissionAmount,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    taxTotal,
    feeTaxable: commissionAmount,
    buyerTotal,
    supplierPayoutTotal: goodsTaxable,
  };
}
