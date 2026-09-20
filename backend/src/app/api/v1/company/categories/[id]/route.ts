import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    if (user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({
        success: false,
        message: 'Only Platform Admin can delete global categories'
      }, { status: 403 });
    }

    const { id } = await params;
    await db();
    const { CompanyCategory } = await import('@/models/Catalog');

    const deleted = await CompanyCategory.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Global category deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete category error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    if (user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({
        success: false,
        message: 'Only Platform Admin can edit global categories'
      }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { categoryName, description } = body;

    if (!categoryName || !categoryName.trim()) {
      return NextResponse.json({ success: false, message: 'Category Name is required' }, { status: 400 });
    }

    await db();
    const { CompanyCategory } = await import('@/models/Catalog');

    // Check conflict with other categories
    const existing = await CompanyCategory.findOne({
      _id: { $ne: id },
      categoryName: { $regex: new RegExp(`^${categoryName.trim()}$`, 'i') }
    });

    if (existing) {
      return NextResponse.json({ success: false, message: 'A category with this name already exists' }, { status: 400 });
    }

    const updated = await CompanyCategory.findByIdAndUpdate(
      id,
      {
        categoryName: categoryName.trim(),
        description: (description || '').trim(),
        isGlobal: true
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Global category updated successfully',
      data: {
        id: updated._id.toString(),
        categoryName: updated.categoryName,
        description: updated.description
      }
    });
  } catch (error: any) {
    console.error('Update category error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
