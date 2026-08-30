interface GstParams {
  taxablePaise: number;
  shipToState: string;
  supplierState: string;
  taxRateBps?: number; // Defaults to 1800 (18%)
}

export function computeGst({ taxablePaise, shipToState, supplierState, taxRateBps = 1800 }: GstParams) {
  if (!shipToState || !supplierState) {
    throw new Error('GST_ADDRESS_REQUIRED: Both shipToState and supplierState are required to compute GST.');
  }

  const shipTo = shipToState.trim().toLowerCase();
  const supplier = supplierState.trim().toLowerCase();
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  
  const isSameState = shipTo === supplier;

  if (isSameState) {
    const halfRate = taxRateBps / 2;
    cgst = Math.round((taxablePaise * halfRate) / 10000);
    // Calculate SGST based on total tax minus CGST to avoid rounding mismatch
    const totalTax = Math.round((taxablePaise * taxRateBps) / 10000);
    sgst = totalTax - cgst;
  } else {
    igst = Math.round((taxablePaise * taxRateBps) / 10000);
  }

  const taxTotal = cgst + sgst + igst;

  return {
    cgst,
    sgst,
    igst,
    taxTotal,
    isSameState
  };
}

export function getHsnTaxRate(hsnCode: string | null | undefined): number {
  if (!hsnCode) return 1800; // default 18%
  const hsnMap: Record<string, number> = {
    '8482': 1800, // Bearings
    '7318': 1800, // Screws, bolts, nuts
    '4016': 2800, // Unvulcanised rubber
    '7208': 1800, // Flat-rolled products of iron or non-alloy steel
    '8544': 1800, // Insulated wire, cable
    '8501': 1800, // Electric motors and generators
  };
  return hsnMap[hsnCode] || 1800;
}
