import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    await db();
    const { Notification } = await import('@/models/User');
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    const { RFQ } = await import('@/models/RFQ');
    const { Bid } = await import('@/models/Bid');
    const { DeliveryOrder } = await import('@/models/Logistics');
    const { Company } = await import('@/models/Company');

    const userCompanyId = user.companyId ? new mongoose.Types.ObjectId(user.companyId) : null;
    const userId = user.id ? new mongoose.Types.ObjectId(user.id) : null;

    // 1. Fetch existing stored notifications
    const queryConditions: any[] = [];
    if (userCompanyId) queryConditions.push({ companyId: userCompanyId });
    if (userId) queryConditions.push({ userId });

    let storedNotifications: any[] = [];
    if (queryConditions.length > 0) {
      storedNotifications = await Notification.find({ $or: queryConditions })
        .sort({ createdAt: -1 })
        .limit(60)
        .lean();
    }

    console.log('[NOTIFICATIONS API GET]', {
      userId: user.id,
      companyId: user.companyId,
      userCompanyId: userCompanyId?.toString(),
      storedCount: storedNotifications.length
    });

    // 2. Dynamic Activity Capture (Capture activities related to Buyer, Supplier, Transporter)
    const existingMetaIds = new Set<string>();
    // Query all existing sourceIds already stored in MongoDB for this company/user so we never duplicate
    try {
      const existingSourceIds = await Notification.distinct('meta.sourceId', { $or: queryConditions });
      for (const sid of existingSourceIds) {
        if (sid) {
          const sidStr = String(sid);
          existingMetaIds.add(sidStr);
          existingMetaIds.add(`MARKET_RFQ_${sidStr}`);
          existingMetaIds.add(`RFQ_${sidStr}`);
          existingMetaIds.add(`ORDER_${sidStr}`);
          existingMetaIds.add(`BID_${sidStr}`);
          existingMetaIds.add(`LOGISTICS_${sidStr}`);
        }
      }
    } catch {}

    for (const n of storedNotifications) {
      const src = n.meta?.sourceId || n.meta?.rfqId || n.meta?.poNumber || n.meta?.deliveryNumber;
      if (src) {
        existingMetaIds.add(String(src));
        existingMetaIds.add(`${n.type}_${src}`);
        existingMetaIds.add(`${n.type}_${src}_${n.meta?.status || ''}`);
        existingMetaIds.add(`MARKET_RFQ_${src}`);
      }
      if (n.meta?.sourceId) existingMetaIds.add(String(n.meta.sourceId));
      if (n.meta?.rfqId) existingMetaIds.add(String(n.meta.rfqId));
      if (n.title && src) existingMetaIds.add(`${n.title}_${src}`);
    }

    const backfillItems: any[] = [];

    if (userCompanyId) {
      // --- (A) ORDER ACTIVITIES (Buyer & Supplier) ---
      const recentOrders = await PurchaseOrder.find({
        $or: [{ buyerCompanyId: userCompanyId }, { supplierCompanyId: userCompanyId }]
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(15)
        .populate('buyerCompanyId', 'name')
        .populate('supplierCompanyId', 'name')
        .lean() as any[];

      for (const po of recentOrders) {
        const key = `ORDER_${po._id.toString()}_${po.status}`;
        if (!existingMetaIds.has(key)) {
          existingMetaIds.add(key);
          const isBuyer = po.buyerCompanyId?._id?.toString() === user.companyId;
          const counterpartName = isBuyer
            ? po.supplierCompanyId?.name || 'Supplier'
            : po.buyerCompanyId?.name || 'Buyer';

          let title = `Order ${po.poNumber || 'PO'}`;
          let message = `Order with ${counterpartName} is currently ${po.status.replace(/_/g, ' ')}.`;

          if (po.status === 'CREATED') {
            title = isBuyer ? `Purchase Order Created` : `New Order Received`;
            message = isBuyer
              ? `PO ${po.poNumber} issued to ${counterpartName}.`
              : `You received a new purchase order ${po.poNumber} from ${counterpartName}.`;
          } else if (po.status === 'ACCEPTED') {
            title = `Order Confirmed`;
            message = `${counterpartName} confirmed PO ${po.poNumber}.`;
          } else if (po.status.startsWith('PROCESSING')) {
            title = `Order In Production`;
            message = `PO ${po.poNumber} production milestone updated (${po.status.replace('PROCESSING_', '')}%).`;
          } else if (po.status === 'READY_FOR_PICKUP') {
            title = `Ready for Pickup`;
            message = `Order ${po.poNumber} is packaged and ready for transporter pickup.`;
          } else if (po.status === 'DELIVERED') {
            title = `Order Delivered`;
            message = `PO ${po.poNumber} has been delivered successfully.`;
          }

          backfillItems.push({
            companyId: userCompanyId,
            title,
            message,
            type: 'ORDER',
            link: '/dashboard/orders',
            read: false,
            meta: { sourceId: po._id.toString(), status: po.status, poNumber: po.poNumber },
            createdAt: po.updatedAt || po.createdAt || new Date()
          });
        }
      }

      // --- (B) RFQ & BID ACTIVITIES ---
      // For Buyers: RFQs created and bids received
      const myRfqs = await RFQ.find({ buyerCompanyId: userCompanyId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean() as any[];

      for (const rfq of myRfqs) {
        const rfqKey = `RFQ_${rfq._id.toString()}_${rfq.status}`;
        if (!existingMetaIds.has(rfqKey)) {
          existingMetaIds.add(rfqKey);
          backfillItems.push({
            companyId: userCompanyId,
            title: `RFQ Published`,
            message: `Your requirement "${rfq.title || rfq.rfqNumber}" is open for bids.`,
            type: 'RFQ',
            link: '/dashboard/my_rfqs',
            read: true,
            meta: { sourceId: rfq._id.toString(), status: rfq.status, rfqNumber: rfq.rfqNumber },
            createdAt: rfq.createdAt || new Date()
          });
        }

        // Bids on these RFQs
        const bidsOnRfq = await Bid.find({ rfqId: rfq._id })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('supplierCompanyId', 'name')
          .lean() as any[];

        for (const bid of bidsOnRfq) {
          const bidKey = `BID_${bid._id.toString()}_${bid.status}`;
          if (!existingMetaIds.has(bidKey)) {
            existingMetaIds.add(bidKey);
            backfillItems.push({
              companyId: userCompanyId,
              title: `New Quote Received`,
              message: `${bid.supplierCompanyId?.name || 'A supplier'} submitted a quote for RFQ ${rfq.rfqNumber}.`,
              type: 'BID',
              link: '/dashboard/my_rfqs',
              read: false,
              meta: { sourceId: bid._id.toString(), status: bid.status, bidNumber: bid.bidNumber },
              createdAt: bid.createdAt || new Date()
            });
          }
        }
      }

      // For Suppliers: Bids submitted & status
      const myBids = await Bid.find({ supplierCompanyId: userCompanyId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('rfqId', 'rfqNumber title')
        .lean() as any[];

      for (const bid of myBids) {
        const bidKey = `BID_${bid._id.toString()}_${bid.status}`;
        if (!existingMetaIds.has(bidKey)) {
          existingMetaIds.add(bidKey);
          backfillItems.push({
            companyId: userCompanyId,
            title: bid.status === 'SELECTED' ? `Bid Selected! (PO Created)` : `Quote Submitted`,
            message: bid.status === 'SELECTED'
              ? `Congratulations! Your quote for ${bid.rfqId?.rfqNumber || 'RFQ'} was accepted.`
              : `Your bid quote ${bid.bidNumber} was submitted for ${bid.rfqId?.rfqNumber || 'RFQ'}.`,
            type: 'BID',
            link: bid.status === 'SELECTED' ? '/dashboard/orders' : '/dashboard/my_rfqs',
            read: bid.status !== 'SELECTED',
            meta: { sourceId: bid._id.toString(), status: bid.status, bidNumber: bid.bidNumber },
            createdAt: bid.updatedAt || bid.createdAt || new Date()
          });
        }
      }

      // --- (B2) MARKETPLACE REQUIREMENTS (Open for Suppliers to Bid) ---
      const marketplaceRfqs = (await RFQ.find({
        buyerCompanyId: { $ne: userCompanyId },
        status: 'PUBLISHED'
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('buyerCompanyId', 'name')
        .lean()) as any[];

      for (const mRfq of marketplaceRfqs) {
        const rfqIdStr = mRfq._id.toString();
        const mKey = `MARKET_RFQ_${rfqIdStr}`;
        if (!existingMetaIds.has(mKey) && !existingMetaIds.has(rfqIdStr)) {
          existingMetaIds.add(mKey);
          existingMetaIds.add(rfqIdStr);
          backfillItems.push({
            companyId: userCompanyId,
            title: `New Requirement in Market`,
            message: `${mRfq.buyerCompanyId?.name || 'A buyer'} posted "${mRfq.title || mRfq.rfqNumber}" in ${mRfq.category || 'Marketplace'} — Submit your bid quote!`,
            type: 'RFQ',
            link: '/dashboard/marketplace',
            read: false,
            meta: { sourceId: rfqIdStr, rfqId: rfqIdStr, status: mRfq.status, rfqNumber: mRfq.rfqNumber },
            createdAt: mRfq.createdAt || new Date()
          });
        }
      }

      // --- (C) TRANSPORTER & LOGISTICS ACTIVITIES ---
      const isTransporter = user.role === 'TRANSPORTER';
      const deliveryQuery: any = isTransporter
        ? {
            $or: [
              { transporterId: userCompanyId },
              { assignedToPlatform: true },
              { status: 'CREATED' }
            ]
          }
        : {
            $or: [
              { transporterId: userCompanyId },
              { purchaseOrderId: { $in: recentOrders.map((o) => o._id) } }
            ]
          };

      const recentDeliveries = await DeliveryOrder.find(deliveryQuery)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(15)
        .lean() as any[];

      for (const del of recentDeliveries) {
        const delKey = `LOGISTICS_${del._id.toString()}_${del.status}`;
        if (!existingMetaIds.has(delKey)) {
          existingMetaIds.add(delKey);
          let title = `Shipment ${del.deliveryNumber}`;
          let message = `Delivery ${del.deliveryNumber} status: ${del.status}.`;

          if (isTransporter) {
            if (del.status === 'CREATED') {
              title = `New Delivery Available`;
              message = `Shipment ${del.deliveryNumber} is available for pickup.`;
            } else if (del.status === 'IN_TRANSIT') {
              title = `Trip In Transit`;
              message = `Shipment ${del.deliveryNumber} is out on route.`;
            } else if (del.status === 'DELIVERED') {
              title = `Delivery Completed`;
              message = `Shipment ${del.deliveryNumber} was successfully delivered.`;
            }
          } else {
            if (del.status === 'IN_TRANSIT') {
              title = `Shipment In Transit`;
              message = `Your order delivery ${del.deliveryNumber} is on the way.`;
            } else if (del.status === 'DELIVERED') {
              title = `Shipment Delivered`;
              message = `Delivery ${del.deliveryNumber} has arrived at destination.`;
            }
          }

          backfillItems.push({
            companyId: userCompanyId,
            title,
            message,
            type: 'LOGISTICS',
            link: isTransporter ? '/dashboard/transporter' : '/dashboard/orders',
            read: false,
            meta: { sourceId: del._id.toString(), status: del.status, deliveryNumber: del.deliveryNumber },
            createdAt: del.updatedAt || del.createdAt || new Date()
          });
        }
      }
    }

    // Persist any newly identified backfilled activity so state (like marking read) sticks
    if (backfillItems.length > 0) {
      try {
        const createdDocs = await Notification.insertMany(backfillItems, { ordered: false });
        storedNotifications = [...createdDocs.map((d) => d.toObject()), ...storedNotifications];
      } catch (e) {
        // In case of duplicate keys or race conditions, fallback to merging in-memory
        storedNotifications = [...backfillItems, ...storedNotifications];
      }
    }

    // Sort all combined notifications by timestamp descending
    storedNotifications.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    // Deduplicate notifications before sending to frontend:
    // If duplicate records exist in MongoDB, merge them and honor read=true if any record was read
    const dedupeMap = new Map<string, any>();
    for (const n of storedNotifications) {
      const srcId = n.meta?.sourceId || n.meta?.rfqId || n.meta?.poNumber || n.meta?.deliveryNumber || (n._id ? n._id.toString() : '');
      const dedupeKey = srcId ? `${n.type || 'SYSTEM'}_${srcId}` : (n._id ? n._id.toString() : `${n.title}_${n.createdAt}`);

      if (!dedupeMap.has(dedupeKey)) {
        dedupeMap.set(dedupeKey, {
          id: n._id ? n._id.toString() : `temp_${srcId || Math.random()}`,
          title: n.title,
          message: n.message,
          type: n.type || 'SYSTEM',
          link: n.link || '/dashboard',
          read: Boolean(n.read),
          meta: n.meta,
          createdAt: n.createdAt
        });
      } else {
        // If any duplicate was marked read, ensure the deduplicated card is marked read
        if (Boolean(n.read)) {
          dedupeMap.get(dedupeKey).read = true;
        }
      }
    }

    const notifications = Array.from(dedupeMap.values()).slice(0, 50);
    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error: any) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    const body = await req.json();
    const { action, id } = body;

    await db();
    const { Notification } = await import('@/models/User');

    const userCompanyId = user.companyId ? new mongoose.Types.ObjectId(user.companyId) : null;
    const userId = user.id ? new mongoose.Types.ObjectId(user.id) : null;

    if (action === 'mark_all_read') {
      const filter: any[] = [];
      if (userCompanyId) filter.push({ companyId: userCompanyId });
      if (userId) filter.push({ userId });

      if (filter.length > 0) {
        await Notification.updateMany({ $or: filter }, { $set: { read: true } });
      }

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
        unreadCount: 0
      });
    }

    if (action === 'mark_read' && id) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        const targetNotif = await Notification.findByIdAndUpdate(
          id,
          { $set: { read: true } },
          { returnDocument: 'after' }
        );
        const sourceId = targetNotif?.meta?.sourceId || targetNotif?.meta?.rfqId;
        if (sourceId) {
          const filter: any[] = [];
          if (userCompanyId) filter.push({ companyId: userCompanyId });
          if (userId) filter.push({ userId });
          if (filter.length > 0) {
            await Notification.updateMany(
              {
                $and: [
                  { $or: filter },
                  {
                    $or: [
                      { 'meta.sourceId': sourceId },
                      { 'meta.rfqId': sourceId }
                    ]
                  }
                ]
              },
              { $set: { read: true } }
            );
          }
        }
      }
      return NextResponse.json({
        success: true,
        message: 'Notification marked as read'
      });
    }

    return NextResponse.json(
      { success: false, code: 'BAD_REQUEST', message: 'Invalid action or parameters' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Update notification error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
