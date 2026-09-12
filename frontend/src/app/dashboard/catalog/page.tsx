'use client';
import { useContext } from 'react';
import { DashboardContext } from '../layout';
import CatalogTab from '@/views/catalog';

export default function CatalogTabPage() {
  const ctx = useContext(DashboardContext);
  if (!ctx) return null; // Wait for layout to mount

  return <CatalogTab catalogItems={ctx.catalogItems} fetchData={() => ctx.fetchDataRef.current()} user={ctx.user} showToast={ctx.showToast} mode={ctx.mode} />;
}
