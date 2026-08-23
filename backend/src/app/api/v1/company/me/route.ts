import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const company = await db.company.findUnique({
      where: { id: user.companyId },
      include: {
        addresses: true,
        documents: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: company,
    });
  } catch (error: any) {
    console.error('Get company error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { name, gstin, address, city, state, pincode } = await req.json();

    // Check if GSTIN is already in use by another company
    if (gstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin)) {
        return NextResponse.json(
          { success: false, code: 'INVALID_GSTIN', message: 'Please provide a valid 15-character GSTIN format' },
          { status: 400 }
        );
      }

      const existingCompanyWithGstin = await db.company.findFirst({
        where: {
          gstin,
          id: { not: user.companyId },
        },
      });

      if (existingCompanyWithGstin) {
        return NextResponse.json(
          { success: false, code: 'GSTIN_CONFLICT', message: 'GSTIN is already in use by another company' },
          { status: 400 }
        );
      }
    }

    const updatedCompany = await db.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: user.companyId! },
        data: {
          name,
          ...(gstin ? { gstin } : {}),
        },
      });

      if (address || city || state || pincode) {
        // Upsert primary address
        const existingAddress = await tx.companyAddress.findFirst({
          where: { companyId: user.companyId!, isPrimary: true },
        });

        if (existingAddress) {
          await tx.companyAddress.update({
            where: { id: existingAddress.id },
            data: { addressLine1: address, city, state, pincode },
          });
        } else {
          await tx.companyAddress.create({
            data: {
              companyId: user.companyId!,
              addressLine1: address || '',
              city: city || '',
              state: state || '',
              pincode: pincode || '',
              isPrimary: true,
            },
          });
        }
      }

      return company;
    });

    return NextResponse.json({
      success: true,
      message: 'Company profile updated successfully',
      data: updatedCompany,
    });
  } catch (error: any) {
    console.error('Update company error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
