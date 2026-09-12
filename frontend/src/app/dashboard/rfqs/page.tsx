'use client';
import { useContext } from 'react';
import { DashboardContext } from '../layout';
import MyRequirementsTab from '@/views/rfqs';

export default function MyRequirementsTabPage() {
  const ctx = useContext(DashboardContext);
  if (!ctx) return null; // Wait for layout to mount

  return <MyRequirementsTab rfqs={ctx.rfqs} selectedRfqForDetails={ctx.selectedRfqForDetails} setSelectedRfqForDetails={ctx.setSelectedRfqForDetails} fetchData={() => ctx.fetchDataRef.current()} setShowRfqModal={ctx.setShowRfqModal} handleEditRfq={ctx.handleEditRfq} handleSelectWinner={ctx.handleSelectWinner} handleViewRfqDetails={ctx.handleViewRfqDetails} mode={ctx.mode} showToast={ctx.showToast} />;
}
