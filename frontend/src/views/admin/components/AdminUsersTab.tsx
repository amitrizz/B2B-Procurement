import { Users, Building, Clock } from 'lucide-react';
import { RefreshButton } from '@/components/ui/RefreshButton';

interface AdminUsersTabProps {
  adminUsers: any[];
  fetchData: () => Promise<void>;
}

export default function AdminUsersTab({ adminUsers, fetchData }: AdminUsersTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Platform Users</h1>
          <p className="text-xs text-slate-400">View and manage all registered users on the platform</p>
        </div>
        <RefreshButton onRefresh={fetchData} />
      </div>

      <div className="space-y-4">
        {adminUsers.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">No users found.</div>
        ) : (
          adminUsers.map((u: any) => (
            <div key={u.id} className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-start gap-4 w-full">
                <div className="p-3 bg-blue-500/10 rounded-full text-blue-400 shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm text-slate-200">{u.name || 'N/A'}</h3>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase tracking-wider font-semibold border border-slate-700">
                      {u.role ? u.role.replace(/_/g, ' ') : 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-6 text-xs text-slate-400 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-semibold w-16">Email:</span>
                      <span className="text-slate-300 truncate">{u.email}</span>
                    </div>
                    {u.company && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-semibold w-16">Company:</span>
                        <div className="flex items-center gap-1 overflow-hidden">
                          <Building className="w-3 h-3 shrink-0" />
                          <span className="text-slate-300 truncate" title={u.company.name}>{u.company.name}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-semibold w-16">Joined:</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="text-slate-300">{new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
