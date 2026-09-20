'use client';
import { useContext } from 'react';
import { DashboardContext } from '../layout';
import PurchaseOrdersTab from '@/views/orders';

export default function PurchaseOrdersTabPage() {
  const ctx = useContext(DashboardContext);
  if (!ctx) return null; // Wait for layout to mount

  return <PurchaseOrdersTab orders={ctx.orders} fetchData={() => ctx.fetchDataRef.current()} handleStartProcessing={ctx.handleStartProcessing} handleReadyForPickup={ctx.handleReadyForPickup} handleConfirmDelivery={ctx.handleConfirmDelivery} mode={ctx.mode} showToast={ctx.showToast} user={ctx.user} />;
}
