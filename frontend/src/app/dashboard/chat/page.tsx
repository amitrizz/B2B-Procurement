'use client';
import { useContext } from 'react';
import { DashboardContext } from '../layout';
import CompanyChatTab from '@/views/chat';

export default function CompanyChatTabPage() {
  const ctx = useContext(DashboardContext);
  if (!ctx) return null; // Wait for layout to mount

  return <CompanyChatTab user={ctx.user} showToast={ctx.showToast} realtimeEvent={ctx.chatRealtimeEvent} mode={ctx.mode} />;
}
