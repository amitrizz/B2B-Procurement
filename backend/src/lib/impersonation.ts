interface ImpersonationRecord {
  adminUserId: string;
  adminEmail: string;
  targetEmail: string;
  companyId: string;
  startedAt: Date;
}

// Global active impersonation registry in memory
const globalForImpersonation = global as unknown as {
  activeImpersonations?: Map<string, ImpersonationRecord>;
};

export const activeImpersonations =
  globalForImpersonation.activeImpersonations || new Map<string, ImpersonationRecord>();

if (process.env.NODE_ENV !== 'production') {
  globalForImpersonation.activeImpersonations = activeImpersonations;
}

export function registerImpersonation(
  targetEmail: string,
  adminEmail: string,
  adminUserId: string,
  companyId: string
) {
  const cleanTarget = targetEmail.trim().toLowerCase();
  const cleanAdmin = adminEmail.trim().toLowerCase();
  
  activeImpersonations.set(cleanTarget, {
    adminUserId,
    adminEmail: cleanAdmin,
    targetEmail: cleanTarget,
    companyId,
    startedAt: new Date(),
  });

  console.log(`\x1b[35m[IMPERSONATION REGISTERED] Admin ${cleanAdmin} is now impersonating ${cleanTarget} (Company: ${companyId})\x1b[0m`);
}

export function clearImpersonation(targetEmail: string) {
  const cleanTarget = targetEmail.trim().toLowerCase();
  const existing = activeImpersonations.get(cleanTarget);
  if (existing) {
    activeImpersonations.delete(cleanTarget);
    console.log(`\x1b[35m[IMPERSONATION CLEARED] Ended impersonation for ${cleanTarget}\x1b[0m`);
    return true;
  }
  return false;
}

export function getImpersonationAdmin(targetEmail: string): ImpersonationRecord | null {
  const cleanTarget = targetEmail.trim().toLowerCase();
  return activeImpersonations.get(cleanTarget) || null;
}
