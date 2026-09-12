'use client';
import { useContext } from 'react';
import { DashboardContext } from '../layout';
import AdminTab from '@/views/admin';

export default function AdminTabPage() {
  const ctx = useContext(DashboardContext);
  if (!ctx) return null; // Wait for layout to mount

  return <AdminTab adminCompanies={ctx.adminCompanies} adminUsers={ctx.adminUsers} adminPayments={ctx.adminPayments} adminInvoices={ctx.adminInvoices} fetchData={() => ctx.fetchDataRef.current()} handleVerifyCompany={ctx.handleVerifyCompany} />;
}
