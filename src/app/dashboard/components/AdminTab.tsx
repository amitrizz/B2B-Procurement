import { RefreshCw } from 'lucide-react';

interface AdminTabProps {
  adminCompanies: any[];
  fetchData: () => Promise<void>;
  handleVerifyCompany: (companyId: string) => Promise<void>;
}

export default function AdminTab({
  adminCompanies,
  fetchData,
  handleVerifyCompany
}: AdminTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Platform Administration</h1>
          <p className="text-xs text-slate-400">Review company registrations, KYC profiles, and platform status</p>
        </div>
        <button onClick={fetchData} className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      <div className="space-y-4">
        {adminCompanies.map((c: any) => (
          <div key={c.id} className="glass-card rounded-2xl p-5 border border-white/5 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-slate-200">{c.name}</h3>
              <p className="text-[10px] text-slate-500">GSTIN: {c.gstin} | Status: <span className="font-semibold text-blue-400">{c.status}</span></p>
            </div>
            {c.status === 'PENDING' && (
              <button
                onClick={() => handleVerifyCompany(c.id)}
                className="py-1.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold"
              >
                Approve KYC (Verify)
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
