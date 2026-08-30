import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    await db();
    const { CompanyComponent } = await import('@/models/Catalog');
    
    const components = await CompanyComponent.find({ companyId: user.companyId }).sort({ componentName: 1 });
    
    return console.log(`[API Response] /api/v1/company/components - Sending response`), NextResponse.json({
      success: true,
      data: components.map((c: any) => ({
        id: c._id.toString(),
        componentName: c.componentName,
        description: c.description,
        defaultUnit: c.defaultUnit
      }))
    });
  } catch (error: any) {
    console.error('Fetch company components error:', error);
    return console.log(`[API Response] /api/v1/company/components - Sending response`), NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    if (!['OWNER', 'PLATFORM_ADMIN'].includes(user.role)) {
      return console.log(`[API Response] /api/v1/company/components - Sending response`), NextResponse.json({ success: false, message: 'Only Owners can manage the component catalog' }, { status: 403 });
    }

    const body = await req.json();
    const { componentName, description, defaultUnit } = body;

    if (!componentName) {
      return console.log(`[API Response] /api/v1/company/components - Sending response`), NextResponse.json({ success: false, message: 'Component Name is required' }, { status: 400 });
    }

    await db();
    const { CompanyComponent } = await import('@/models/Catalog');
    
    // Check if component with same name already exists for this company
    const existing = await CompanyComponent.findOne({
      companyId: user.companyId,
      componentName: { $regex: new RegExp(`^${componentName}$`, 'i') }
    });
    
    if (existing) {
      return console.log(`[API Response] /api/v1/company/components - Sending response`), NextResponse.json({ success: false, message: 'A component with this name already exists in your catalog' }, { status: 400 });
    }

    const component = await CompanyComponent.create({
      companyId: user.companyId,
      componentName,
      description: description || '',
      defaultUnit: defaultUnit || 'pcs'
    });
    
    return console.log(`[API Response] /api/v1/company/components - Sending response`), NextResponse.json({
      success: true,
      message: 'Component added to catalog',
      data: {
        id: component._id.toString(),
        componentName: component.componentName,
        description: component.description,
        defaultUnit: component.defaultUnit
      }
    });
  } catch (error: any) {
    console.error('Create company component error:', error);
    return console.log(`[API Response] /api/v1/company/components - Sending response`), NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
