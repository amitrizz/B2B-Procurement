'use client';
import { useContext } from 'react';
import { DashboardContext } from '../layout';
import LocalDeliveryTab from '@/views/delivery';

export default function LocalDeliveryTabPage() {
  const ctx = useContext(DashboardContext);
  if (!ctx) return null; // Wait for layout to mount

  return <LocalDeliveryTab deliveries={ctx.deliveries} fetchData={() => ctx.fetchDataRef.current()} handleUpdateDeliveryStatus={ctx.handleUpdateDeliveryStatus} handleVerifyDeliveryOtp={ctx.handleVerifyDeliveryOtp} showToast={ctx.showToast} />;
}
