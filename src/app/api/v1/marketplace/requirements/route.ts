import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const whereClause: any = {
      buyerCompanyId: { not: user.companyId },
      status: 'PUBLISHED',
      bidEndAt: { gt: new Date() },
    };

    if (category) {
      whereClause.category = category;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rfqs = await db.rFQ.findMany({
      where: whereClause,
      include: {
        buyerCompany: {
          select: { name: true },
        },
        items: {
          include: {
            bids: {
              where: {
                supplierCompanyId: user.companyId,
              },
            },
          },
        },
        _count: {
          select: { bids: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: rfqs,
    });
  } catch (error: any) {
    console.error('Marketplace requirements error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
