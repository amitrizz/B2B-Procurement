'use client';
import { useContext } from 'react';
import { DashboardContext } from '../layout';
import StandardCatalogTab from '@/views/standard_catalog';

export default function StandardCatalogTabPage() {
  const ctx = useContext(DashboardContext);
  if (!ctx) return null; // Wait for layout to mount

  return <StandardCatalogTab user={ctx.user} companyComponents={ctx.companyComponents} companyCategories={ctx.companyCategories} fetchData={() => ctx.fetchDataRef.current()} showToast={ctx.showToast} />;
}
