const COMMISSION_BPS = 500;
const FEE_GST_BPS = 1800;

export type BuyerPricingBreakdown = {
  goodsPaise: number;
  commissionPaise: number;
  feeGstPaise: number;
  buyerTotalPaise: number;
};

export function computeBuyerPricing(goodsPaise: number): BuyerPricingBreakdown {
  const goods = Math.max(0, goodsPaise);
  const commission = Math.round((goods * COMMISSION_BPS) / 10000);
  const feeGst = Math.round((commission * FEE_GST_BPS) / 10000);
  return {
    goodsPaise: goods,
    commissionPaise: commission,
    feeGstPaise: feeGst,
    buyerTotalPaise: goods + commission + feeGst,
  };
}

/** Buyer pays goods + platform fee + 18% GST on the fee only (not on goods). */
export function estimateBuyerTotalPaise(goodsPaise: number): number {
  return computeBuyerPricing(goodsPaise).buyerTotalPaise;
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatInrFromPaise(paise: number): string {
  return paiseToRupees(paise).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
