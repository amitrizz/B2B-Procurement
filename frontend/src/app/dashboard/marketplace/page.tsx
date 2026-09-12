'use client';
import { useContext } from 'react';
import { DashboardContext } from '../layout';
import MarketplaceTab from '@/views/marketplace';

export default function MarketplaceTabPage() {
  const ctx = useContext(DashboardContext);
  if (!ctx) return null; // Wait for layout to mount

  return <MarketplaceTab marketplaceRfqs={ctx.marketplaceRfqs} selectedRfqForBidding={ctx.selectedRfqForBidding} setSelectedRfqForBidding={ctx.setSelectedRfqForBidding} bidInputs={ctx.bidInputs} setBidInputs={ctx.setBidInputs} handleStartBidding={ctx.handleStartBidding} handleSubmitBid={ctx.handleSubmitBid} handleWithdrawBid={ctx.handleWithdrawBid} fetchData={() => ctx.fetchDataRef.current()} mode={ctx.mode} user={ctx.user} setActiveTab={ctx.handleTabChange} setSelectedRfqForDetails={ctx.setSelectedRfqForDetails} submittingActions={ctx.submittingActions} />;
}
