import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function PUT(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { addressLine1, city, state, pincode } = await req.json();

    if (!addressLine1 || !city || !state || !pincode) {
      return console.log(`[API Response] /api/v1/company/me/address - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'All address fields are required' },
        { status: 400 }
      );
    }

    await db();
    const { CompanyAddress } = await import('@/models/Company');

    const existingAddress = await CompanyAddress.findOne({
      companyId: user.companyId,
      isPrimary: true,
    });

    if (existingAddress) {
      existingAddress.addressLine1 = addressLine1;
      existingAddress.city = city;
      existingAddress.state = state;
      existingAddress.pincode = pincode;
      await existingAddress.save();
    } else {
      await CompanyAddress.create({
        companyId: user.companyId,
        addressLine1,
        city,
        state,
        pincode,
        isPrimary: true,
      });
    }

    // Fetch the updated addresses array to return
    const addresses = await CompanyAddress.find({ companyId: user.companyId }).lean();
    const formattedAddresses = addresses.map((a: any) => ({ ...a, id: a._id.toString() }));

    return console.log(`[API Response] /api/v1/company/me/address - Sending response`), NextResponse.json({
      success: true,
      message: 'Company address updated successfully',
      data: formattedAddresses,
    });
  } catch (error: any) {
    console.error('Update company address error:', error);
    return console.log(`[API Response] /api/v1/company/me/address - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
