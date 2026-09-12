'use client';
import { useContext } from 'react';
import { DashboardContext } from '../layout';
import ProfileTab from '@/views/profile';

export default function ProfileTabPage() {
  const ctx = useContext(DashboardContext);
  if (!ctx) return null; // Wait for layout to mount

  return <ProfileTab user={ctx.user} setUser={ctx.setUser} showToast={ctx.showToast} />;
}
