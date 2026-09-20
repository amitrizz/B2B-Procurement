import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

const DEFAULT_GLOBAL_CATEGORIES = [
  { categoryName: 'Mechanical', description: 'Castings, forgings, machined parts, and mechanical assemblies' },
  { categoryName: 'Electrical', description: 'Wiring harnesses, transformers, switches, and electrical components' },
  { categoryName: 'Raw Materials', description: 'Sheet metal, steel bars, aluminum extrusions, and bulk raw stock' },
  { categoryName: 'Electronics', description: 'PCBs, microcontrollers, sensors, and electronic subsystems' },
  { categoryName: 'Fasteners', description: 'Bolts, nuts, screws, rivets, washers, and industrial hardware' },
  { categoryName: 'Plastics & Polymers', description: 'Injection molded parts, rubber seals, gaskets, and polymer goods' },
  { categoryName: 'Hydraulics & Pneumatics', description: 'Valves, cylinders, hoses, fittings, and fluid power equipment' },
  { categoryName: 'Tooling & Dies', description: 'Jigs, fixtures, molds, cutting tools, and custom dies' },
  { categoryName: 'Packaging', description: 'Corrugated boxes, protective pallets, crating, and packaging supplies' },
  { categoryName: 'General', description: 'General procurement supplies and non-categorized components' }
];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    await db();
    const { CompanyCategory } = await import('@/models/Catalog');
    
    // Fetch all global categories common across all companies
    let categories = await CompanyCategory.find({}).sort({ categoryName: 1 });

    // If database has no categories yet, automatically seed the standard platform global categories
    if (!categories || categories.length === 0) {
      await CompanyCategory.insertMany(
        DEFAULT_GLOBAL_CATEGORIES.map(c => ({
          ...c,
          isGlobal: true,
          companyId: user.companyId || null
        }))
      );
      categories = await CompanyCategory.find({}).sort({ categoryName: 1 });
    }
    
    return console.log(`[API Response] /api/v1/company/categories - Sending global categories (${categories.length})`), NextResponse.json({
      success: true,
      data: categories.map((c: any) => ({
        id: c._id.toString(),
        categoryName: c.categoryName,
        description: c.description,
        isGlobal: c.isGlobal ?? true
      }))
    });
  } catch (error: any) {
    console.error('Fetch company categories error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    // Only Platform Admin can create global categories for the platform
    if (user.role !== 'PLATFORM_ADMIN') {
      return console.log(`[API Response] /api/v1/company/categories - 403 Forbidden for non-admin`), NextResponse.json({ 
        success: false, 
        message: 'Only Platform Admin can create global categories' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { categoryName, description } = body;

    if (!categoryName || !categoryName.trim()) {
      return NextResponse.json({ success: false, message: 'Category Name is required' }, { status: 400 });
    }

    await db();
    const { CompanyCategory } = await import('@/models/Catalog');
    
    // Check if category already exists globally (case-insensitive)
    const existing = await CompanyCategory.findOne({
      categoryName: { $regex: new RegExp(`^${categoryName.trim()}$`, 'i') }
    });
    
    if (existing) {
      return NextResponse.json({ success: false, message: 'A global category with this name already exists' }, { status: 400 });
    }

    const category = await CompanyCategory.create({
      categoryName: categoryName.trim(),
      description: (description || '').trim(),
      isGlobal: true,
      companyId: user.companyId || null
    });
    
    return NextResponse.json({
      success: true,
      message: 'Global category created successfully',
      data: {
        id: category._id.toString(),
        categoryName: category.categoryName,
        description: category.description,
        isGlobal: true
      }
    });
  } catch (error: any) {
    console.error('Create company category error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

