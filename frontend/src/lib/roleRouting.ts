/** Default landing route after login for each role. */
export function getDefaultRouteForRole(role?: string | null): string {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return '/admin';
    case 'TRANSPORTER':
      return '/delivery';
    case 'FINANCE':
      return '/orders';
    default:
      return '/marketplace';
  }
}

/** Routes a role is allowed to use in the dashboard shell. */
export function isTabAllowedForRole(tab: string, role?: string | null): boolean {
  if (!role || role === 'OWNER' || role === 'PROCUREMENT') return true;

  if (role === 'PLATFORM_ADMIN') {
    return ['admin', 'admin_users', 'transporter', 'marketplace', 'orders', 'profile'].includes(tab);
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
  if (tab === 'my_rfqs') return '/rfqs';
  if (tab === 'transporter') return '/delivery';
  if (tab === 'marketplace') return '/marketplace';
  if (tab === 'admin_users') return '/admin';
  if (tab === 'company_chat') return '/chat';
  if (tab !== 'marketplace') return `/${tab}`;
  return '/marketplace';
}
