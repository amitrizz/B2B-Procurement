import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    await db();
    const { CompanyCategory } = await import('@/models/Catalog');
    
    const categories = await CompanyCategory.find({ companyId: user.companyId }).sort({ categoryName: 1 });
    
    return console.log(`[API Response] /api/v1/company/categories - Sending response`), NextResponse.json({
      success: true,
      data: categories.map((c: any) => ({
        id: c._id.toString(),
        categoryName: c.categoryName,
        description: c.description
      }))
    });
  } catch (error: any) {
    console.error('Fetch company categories error:', error);
    return console.log(`[API Response] /api/v1/company/categories - Sending response`), NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    if (!['OWNER', 'PLATFORM_ADMIN'].includes(user.role)) {
      return console.log(`[API Response] /api/v1/company/categories - Sending response`), NextResponse.json({ success: false, message: 'Only Owners can manage the category catalog' }, { status: 403 });
    }

    const body = await req.json();
    const { categoryName, description } = body;

    if (!categoryName) {
      return console.log(`[API Response] /api/v1/company/categories - Sending response`), NextResponse.json({ success: false, message: 'Category Name is required' }, { status: 400 });
    }

    await db();
    const { CompanyCategory } = await import('@/models/Catalog');
    
    const existing = await CompanyCategory.findOne({
      companyId: user.companyId,
      categoryName: { $regex: new RegExp(`^${categoryName}$`, 'i') }
    });
    
    if (existing) {
      return console.log(`[API Response] /api/v1/company/categories - Sending response`), NextResponse.json({ success: false, message: 'A category with this name already exists in your catalog' }, { status: 400 });
    }

    const category = await CompanyCategory.create({
      companyId: user.companyId,
      categoryName,
      description: description || ''
    });
    
    return console.log(`[API Response] /api/v1/company/categories - Sending response`), NextResponse.json({
      success: true,
      message: 'Category added to catalog',
      data: {
        id: category._id.toString(),
        categoryName: category.categoryName,
        description: category.description
      }
    });
  } catch (error: any) {
    console.error('Create company category error:', error);
    return console.log(`[API Response] /api/v1/company/categories - Sending response`), NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
