/** Keep localStorage user + React state in sync (companyId at root, full company object). */

export function getCompanyIdFromUser(user: any): string | null {
  if (!user) return null;
  return user.companyId || user.company?.id || user.company?.companyId || null;
}

export function applyCompanyToUser(user: any, company: any): any {
  if (!user) return user;
  const companyId = company?.id || company?._id?.toString?.() || getCompanyIdFromUser(user);
  return {
    ...user,
    companyId: companyId || user.companyId || null,
    company: company
      ? {
          ...user.company,
          ...company,
          id: company.id || company._id?.toString?.() || companyId,
        }
      : user.company,
  };
}

export function persistUser(user: any): void {
  if (typeof window !== 'undefined' && user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
}

export function patchUserCompany(user: any, patch: Record<string, unknown>): any {
  if (!user?.company) return user;
  return applyCompanyToUser(user, { ...user.company, ...patch });
}

const DASHBOARD_MODE_KEY = 'p2p_dashboard_mode';

export type DashboardMode = 'buyer' | 'seller';

export function readDashboardMode(companyId?: string | null): DashboardMode {
  if (typeof window === 'undefined') return 'buyer';
  if (companyId) {
    const scoped = localStorage.getItem(`${DASHBOARD_MODE_KEY}_${companyId}`);
    if (scoped === 'buyer' || scoped === 'seller') return scoped;
  }
  const saved = localStorage.getItem(DASHBOARD_MODE_KEY);
  return saved === 'seller' ? 'seller' : 'buyer';
}

export function persistDashboardMode(mode: DashboardMode, companyId?: string | null): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DASHBOARD_MODE_KEY, mode);
  if (companyId) {
    localStorage.setItem(`${DASHBOARD_MODE_KEY}_${companyId}`, mode);
  }
}
