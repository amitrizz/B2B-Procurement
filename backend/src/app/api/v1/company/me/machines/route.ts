import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    await db();
    const { CompanyMachine } = await import('@/models/Company');
    await import('@/models/Machine');

    const machines = await CompanyMachine.find({ companyId: user.companyId })
      .populate('machineId', 'name model description')
      .sort({ createdAt: -1 })
      .lean();

    const consolidatedMap = new Map<string, any>();
    for (const m of machines) {
      const machineName = m.machineId?.name || 'Unknown Machine';
      const key = (m.machineId?._id?.toString() || machineName).toLowerCase().trim();
      const count = Number(m.numberOfMachines) || 1;

      if (consolidatedMap.has(key)) {
        const existing = consolidatedMap.get(key);
        existing.numberOfMachines = (Number(existing.numberOfMachines) || 0) + count;
        if (!existing.model && m.model) existing.model = m.model;
        if (!existing.specifications && m.specifications) existing.specifications = m.specifications;
      } else {
        consolidatedMap.set(key, {
          id: m._id.toString(),
          machineId: m.machineId?._id?.toString() || m.machineId?.toString() || '',
          name: machineName,
          model: m.model || m.machineId?.model || '',
          numberOfMachines: count,
          specifications: m.specifications || '',
          createdAt: m.createdAt
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: Array.from(consolidatedMap.values())
    });
  } catch (error: any) {
    console.error(`[API Error] /api/v1/company/me/machines (GET):`, error.message);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const body = await req.json();
    const { machineId, model, numberOfMachines, specifications } = body;

    if (!machineId) {
      return NextResponse.json({ success: false, message: 'Machine selection is required' }, { status: 400 });
    }

    const count = Number(numberOfMachines);
    if (isNaN(count) || count < 1) {
      return NextResponse.json({ success: false, message: 'Number of machines must be at least 1' }, { status: 400 });
    }

    await db();
    const { CompanyMachine } = await import('@/models/Company');
    const { MachineMaster } = await import('@/models/Machine');

    const master = await MachineMaster.findById(machineId).lean();
    if (!master) {
      return NextResponse.json({ success: false, message: 'Selected machine not found in master catalog' }, { status: 404 });
    }

    const existing = await CompanyMachine.findOne({
      companyId: user.companyId,
      machineId
    });

    if (existing) {
      existing.numberOfMachines = (Number(existing.numberOfMachines) || 0) + count;
      if (model) existing.model = String(model).trim();
      if (specifications) existing.specifications = String(specifications).trim();
      await existing.save();

      return NextResponse.json({
        success: true,
        data: {
          id: existing._id.toString(),
          machineId: master._id.toString(),
          name: master.name,
          model: existing.model || master.model || '',
          numberOfMachines: existing.numberOfMachines,
          specifications: existing.specifications
        }
      });
    }

    const created = await CompanyMachine.create({
      companyId: user.companyId,
      machineId,
      model: model ? String(model).trim() : (master.model || ''),
      numberOfMachines: count,
      specifications: specifications ? String(specifications).trim() : ''
    });

    return NextResponse.json({
      success: true,
      data: {
        id: created._id.toString(),
        machineId: master._id.toString(),
        name: master.name,
        model: created.model,
        numberOfMachines: created.numberOfMachines,
        specifications: created.specifications
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error(`[API Error] /api/v1/company/me/machines (POST):`, error.message);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
