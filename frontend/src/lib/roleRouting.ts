import { readDashboardMode, type DashboardMode } from './userSession';

export { type DashboardMode };

/** Default landing route after login for each role and dashboard mode. */
export function getDefaultRouteForRole(role?: string | null, mode?: DashboardMode): string {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return '/dashboard/admin';
    case 'TRANSPORTER':
      return '/dashboard/delivery';
    case 'FINANCE':
      return '/dashboard/orders';
    default: {
      const activeMode = mode ?? (typeof window !== 'undefined' ? readDashboardMode() : 'buyer');
      return activeMode === 'buyer' ? '/dashboard/rfqs' : '/dashboard/marketplace';
    }
  }
}

/** Routes a role is allowed to use in the dashboard shell. */
export function isTabAllowedForRole(tab: string, role?: string | null): boolean {
  if (!role || role === 'OWNER' || role === 'PROCUREMENT') return true;

  if (role === 'PLATFORM_ADMIN') {
    return ['admin', 'admin_users', 'transporter', 'marketplace', 'orders', 'profile', 'company_chat', 'my_rfqs', 'prs'].includes(tab);
  }

  if (role === 'TRANSPORTER') {
    return tab === 'transporter' || tab === 'profile';
  }

  if (role === 'FINANCE') {
    return ['orders', 'profile', 'catalog', 'company_chat'].includes(tab);
  }

  return true;
}

export function getRouteForTab(tab: string): string {
  if (tab === 'prs' || tab === 'requisitions') return '/dashboard/requisitions';
  if (tab === 'my_rfqs') return '/dashboard/rfqs';
  if (tab === 'transporter') return '/dashboard/delivery';
  if (tab === 'marketplace') return '/dashboard/marketplace';
  if (tab === 'admin_users') return '/dashboard/admin';
  if (tab === 'company_chat') return '/dashboard/chat';
  if (tab !== 'marketplace') return `/dashboard/${tab}`;
  return '/dashboard/marketplace';
}

/** Tabs that are strictly restricted to Buyer (Procure) mode */
export const BUYER_ONLY_TABS = ['prs', 'requisitions'];

/** Tabs that are strictly restricted to Seller (Supply) mode */
export const SELLER_ONLY_TABS = ['marketplace'];

/** Checks if a tab is allowed for the active dashboard mode */
export function isTabAllowedForMode(tab: string, mode: DashboardMode): boolean {
  if (mode === 'seller') {
    return !BUYER_ONLY_TABS.includes(tab);
  }
  if (mode === 'buyer') {
    return !SELLER_ONLY_TABS.includes(tab);
  }
  return true;
}

/** Route to redirect to when a tab is not allowed for the given mode */
export function getDefaultRouteForMode(mode: DashboardMode): string {
  return '/dashboard/rfqs';
}

