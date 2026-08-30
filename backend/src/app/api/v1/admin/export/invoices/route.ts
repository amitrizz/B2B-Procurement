import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return authErrorResponse('Only Platform Admin can export data');
    }

    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const matchClause: any = {};
    if (startDate && endDate) {
      matchClause.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    await db();
    const { Invoice } = await import('@/models/Finance');
    await import('@/models/Company');

    const invoices = await Invoice.aggregate([
      { $match: matchClause },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'Company',
          localField: 'payerCompanyId',
          foreignField: '_id',
          as: 'payerCompany'
        }
      },
      {
        $addFields: {
          'payerCompany': { $arrayElemAt: ['$payerCompany', 0] }
        }
      },
      {
        $lookup: {
          from: 'Company',
          localField: 'payeeCompanyId',
          foreignField: '_id',
          as: 'payeeCompany'
        }
      },
      {
        $addFields: {
          'payeeCompany': { $arrayElemAt: ['$payeeCompany', 0] }
        }
      }
    ]);

    // Convert to CSV
    const headers = [
      'Invoice Number',
      'Date',
      'Type',
      'Status',
      'Payer Company',
      'Payer GSTIN',
      'Payee Company',
      'Payee GSTIN',
      'Taxable Amount',
      'CGST',
      'SGST',
      'IGST',
      'Total Amount',
      'IRN'
    ];

    const rows = invoices.map((inv: any) => [
      inv.invoiceNumber || inv.number,
      inv.createdAt ? new Date(inv.createdAt).toISOString() : '',
      inv.type,
      inv.status,
      inv.payerCompany?.name || 'N/A',
      inv.payerCompany?.gstin || 'N/A',
      inv.payeeCompany?.name || 'N/A',
      inv.payeeCompany?.gstin || 'N/A',
      ((inv.baseAmount || inv.taxable || 0) / 100).toFixed(2),
      ((inv.cgst || inv.cgstAmount || 0) / 100).toFixed(2),
      ((inv.sgst || inv.sgstAmount || 0) / 100).toFixed(2),
      ((inv.igst || inv.igstAmount || 0) / 100).toFixed(2),
      ((inv.totalAmount || inv.total || 0) / 100).toFixed(2),
      inv.irn || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="invoices_export_${new Date().getTime()}.csv"`
      }
    });

  } catch (error: any) {
    console.error('Export invoices error:', error);
    return console.log(`[API Response] /api/v1/admin/export/invoices - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
