'use client';
import { useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardContext } from '../layout';
import MarketplaceTab from '@/views/marketplace';

export default function MarketplaceTabPage() {
  const ctx = useContext(DashboardContext);
  const router = useRouter();

  useEffect(() => {
    if (ctx?.mode === 'buyer') {
      router.replace('/dashboard/rfqs');
    }
  }, [ctx?.mode, router]);

  if (!ctx || ctx.mode === 'buyer') return null;

  return <MarketplaceTab marketplaceRfqs={ctx.marketplaceRfqs} selectedRfqForBidding={ctx.selectedRfqForBidding} setSelectedRfqForBidding={ctx.setSelectedRfqForBidding} bidInputs={ctx.bidInputs} setBidInputs={ctx.setBidInputs} handleStartBidding={ctx.handleStartBidding} handleSubmitBid={ctx.handleSubmitBid} handleWithdrawBid={ctx.handleWithdrawBid} fetchData={() => ctx.fetchDataRef.current()} mode={ctx.mode} user={ctx.user} setActiveTab={ctx.handleTabChange} setSelectedRfqForDetails={ctx.setSelectedRfqForDetails} submittingActions={ctx.submittingActions} companyCategories={ctx.companyCategories} />;
}


