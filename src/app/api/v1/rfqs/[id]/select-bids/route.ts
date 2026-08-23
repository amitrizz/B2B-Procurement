import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId } = await params;
    const { selections } = await req.json(); // Array of { rfqItemId, bidId, materialOption }

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing selections array' },
        { status: 400 }
      );
    }

    const rfq = await db.rFQ.findUnique({
      where: { id: rfqId },
      include: { items: true },
    });

    if (!rfq) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'RFQ not found' },
        { status: 404 }
      );
    }

    if (rfq.buyerCompanyId !== user.companyId) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'You do not own this RFQ' },
        { status: 403 }
      );
    }

    const buyerAddress = await db.companyAddress.findFirst({
      where: { companyId: user.companyId, isPrimary: true },
    });

    // Execute atomic transaction for selection & PO generation
    const purchaseOrders = await db.$transaction(async (tx) => {
      const selectedBidsData = [];

      for (const sel of selections) {
        // Row level locking of the bid using raw SQL if needed, or update status immediately
        const bid = await tx.bid.findUnique({
          where: { id: sel.bidId },
          include: {
            rfqItem: true,
            supplierCompany: {
              include: { addresses: true },
            },
          },
        });

        if (!bid || bid.rfqItemId !== sel.rfqItemId || bid.rfqId !== rfqId) {
          throw new Error(`Bid ${sel.bidId} does not match RFQ item ${sel.rfqItemId}`);
        }

        if (bid.supplierCompany.status !== 'VERIFIED') {
          throw new Error(`Supplier for bid ${sel.bidId} is not verified`);
        }

        // Accept the bid
        await tx.bid.update({
          where: { id: bid.id },
          data: { status: 'ACCEPTED' },
        });

        // Reject other bids on this item
        await tx.bid.updateMany({
          where: {
            rfqItemId: sel.rfqItemId,
            id: { not: bid.id },
            status: 'SUBMITTED',
          },
          data: { status: 'REJECTED' },
        });

        const selectedPrice = sel.materialOption === 'WITH_MATERIAL' 
          ? bid.priceWithMaterial 
          : bid.priceWithoutMaterial;

        selectedBidsData.push({
          bid,
          selectedPrice,
          materialOption: sel.materialOption,
        });
      }

      // Group selections by Supplier to generate multiple POs
      const selectionsBySupplier: { [key: string]: typeof selectedBidsData } = {};
      selectedBidsData.forEach(item => {
        const supplierId = item.bid.supplierCompanyId;
        if (!selectionsBySupplier[supplierId]) {
          selectionsBySupplier[supplierId] = [];
        }
        selectionsBySupplier[supplierId].push(item);
      });

      const generatedPOs = [];

      for (const [supplierId, itemsWon] of Object.entries(selectionsBySupplier)) {
        const poNumber = 'PO-' + Math.floor(100000 + Math.random() * 900000);

        let totalBase = 0;
        let totalTax = 0;
        const commissionRate = 0.05; // 5% platform commission

        const supplier = itemsWon[0].bid.supplierCompany;
        const supplierAddress = supplier.addresses.find(addr => addr.isPrimary) || supplier.addresses[0];

        // Determine GST Split: CGST/SGST if in same state, IGST if different
        const isSameState = buyerAddress && supplierAddress && (buyerAddress.state === supplierAddress.state);

        const poItemsData = itemsWon.map(item => {
          const qty = Number(item.bid.quantity);
          const price = Number(item.selectedPrice);
          const baseAmount = qty * price;
          totalBase += baseAmount;

          // Standard GST Rate lookup based HSN, defaulting to 18% for procurement goods
          const taxRate = 18.00; 
          const taxAmount = baseAmount * (taxRate / 100);
          totalTax += taxAmount;

          return {
            rfqItemId: item.bid.rfqItemId,
            bidId: item.bid.id,
            quantity: item.bid.quantity,
            unitPrice: item.selectedPrice,
            materialOption: item.materialOption,
            taxRate,
            taxAmount,
          };
        });

        const commissionAmount = totalBase * commissionRate;
        const totalAmount = totalBase + totalTax + commissionAmount;

        const po = await tx.purchaseOrder.create({
          data: {
            poNumber,
            rfqId,
            buyerCompanyId: user.companyId!,
            supplierCompanyId: supplierId,
            status: 'CREATED',
            totalAmount,
            taxAmount: totalTax,
            commissionAmount,
            deliveryCharge: 0,
            items: {
              create: poItemsData,
            },
          },
        });

        generatedPOs.push(po);
      }

      // Recalculate RFQ status
      const totalRFQItems = rfq.items.length;
      const uniqueSelectedItemIds = new Set(selections.map(s => s.rfqItemId));
      const newRFQStatus = uniqueSelectedItemIds.size === totalRFQItems 
        ? 'FULLY_AWARDED' 
        : 'PARTIALLY_AWARDED';

      await tx.rFQ.update({
        where: { id: rfqId },
        data: { status: newRFQStatus },
      });

      return generatedPOs;
    });

    return NextResponse.json({
      success: true,
      message: 'Bids selected and Purchase Order(s) generated successfully',
      data: purchaseOrders,
    });
  } catch (error: any) {
    console.error('Bid selection error:', error.message);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
