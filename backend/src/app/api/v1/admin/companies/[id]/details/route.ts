import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_ID', message: 'Invalid company ID' },
        { status: 400 }
      );
    }

    await db();
    const { Company, CompanyAddress, CompanyDocument, CompanyBankAccount, CompanyCapability } =
      await import('@/models/Company');
    const { User } = await import('@/models/User');
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    const { RFQ } = await import('@/models/RFQ');
    const { Bid } = await import('@/models/Bid');

    const companyOid = new mongoose.Types.ObjectId(id);

    const company = await Company.findById(companyOid).lean();
    if (!company) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Company not found' },
        { status: 404 }
      );
    }

    const [addresses, documents, bankAccount, capability, users, buyerOrders, supplierOrders, rfqsCount, bidsCount, bidsWonCount] =
      await Promise.all([
        CompanyAddress.find({ companyId: companyOid }).lean(),
        CompanyDocument.find({ companyId: companyOid }).lean(),
        CompanyBankAccount.findOne({ companyId: companyOid }).lean(),
        CompanyCapability.findOne({ companyId: companyOid }).lean(),
        User.find({ companyId: companyOid })
          .select('name email phone role status createdAt lastLogin')
          .sort({ createdAt: 1 })
          .lean(),
        PurchaseOrder.find({ buyerCompanyId: companyOid }).select('totalAmount status poNumber createdAt').lean(),
        PurchaseOrder.find({ supplierCompanyId: companyOid }).select('totalAmount status poNumber createdAt').lean(),
        RFQ.countDocuments({ buyerCompanyId: companyOid }),
        Bid.countDocuments({ supplierCompanyId: companyOid }),
        Bid.countDocuments({ supplierCompanyId: companyOid, status: 'ACCEPTED' }),
      ]);

    const buyerTotalSpend = buyerOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    const buyerCompleted = buyerOrders.filter((o: any) => o.status === 'COMPLETED' || o.status === 'DELIVERED').length;

    const supplierTotalRevenue = supplierOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    const supplierCompleted = supplierOrders.filter((o: any) => o.status === 'COMPLETED' || o.status === 'DELIVERED').length;

    return NextResponse.json({
      success: true,
      data: {
        company: {
          id: company._id.toString(),
          name: company.name,
          gstin: company.gstin,
          pan: company.pan,
          phone: company.phone,
          status: company.status,
          isActive: company.isActive !== false,
          kycRejectReason: company.kycRejectReason || null,
          drawingsNdaAcceptedAt: company.drawingsNdaAcceptedAt || null,
          requirePr: !!company.requirePr,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
        },
        addresses: (addresses || []).map((a: any) => ({
          id: a._id.toString(),
          state: a.state,
          addressLine1: a.addressLine1,
          addressLine2: a.addressLine2 || '',
          city: a.city,
          pincode: a.pincode,
          isPrimary: !!a.isPrimary,
        })),
        documents: (documents || []).map((d: any) => ({
          id: d._id.toString(),
          documentType: d.documentType,
          fileId: d.fileId,
          verified: !!d.verified,
        })),
        bankAccount: bankAccount
          ? {
              id: bankAccount._id.toString(),
              accountName: bankAccount.accountName,
              ifsc: bankAccount.ifsc,
              accountNumberLast4: bankAccount.accountNumberLast4,
              isPrimary: !!bankAccount.isPrimary,
              createdAt: bankAccount.createdAt,
            }
          : null,
        capability: capability
          ? {
              id: capability._id.toString(),
              processes: capability.processes || [],
              verifiedAt: capability.verifiedAt || null,
            }
          : null,
        users: (users || []).map((u: any) => ({
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          lastLogin: u.lastLogin || null,
        })),
        stats: {
          ordersAsBuyer: {
            count: buyerOrders.length,
            totalAmount: buyerTotalSpend,
            completedCount: buyerCompleted,
            recentOrders: buyerOrders.slice(0, 5).map((o: any) => ({
              id: o._id.toString(),
              poNumber: o.poNumber,
              totalAmount: o.totalAmount,
              status: o.status,
              createdAt: o.createdAt,
            })),
          },
          ordersAsSupplier: {
            count: supplierOrders.length,
            totalAmount: supplierTotalRevenue,
            completedCount: supplierCompleted,
            recentOrders: supplierOrders.slice(0, 5).map((o: any) => ({
              id: o._id.toString(),
              poNumber: o.poNumber,
              totalAmount: o.totalAmount,
              status: o.status,
              createdAt: o.createdAt,
            })),
          },
          rfqs: {
            createdCount: rfqsCount,
          },
          bids: {
            submittedCount: bidsCount,
            wonCount: bidsWonCount,
          },
        },
      },
    });
  } catch (error: any) {
    console.error('Company details error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
