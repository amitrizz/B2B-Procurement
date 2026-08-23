import { useState } from 'react';
import { Building, Shield, Lock, Save, Sparkles, Mail, CheckCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface ProfileTabProps {
  user: any;
  setUser: (user: any) => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ProfileTab({ user, setUser, showToast }: ProfileTabProps) {
  const [gstin, setGstin] = useState(user?.company?.gstin || '');
  const [companyName, setCompanyName] = useState(user?.company?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (gstin && !gstinRegex.test(gstin)) {
      showToast('Invalid GSTIN format. Example: 27AAAAA1111A1Z1', 'error');
      return;
    }

    setProfileLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/company/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: companyName, gstin })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Failed to update company profile', 'error');
      } else {
        showToast('Company profile updated successfully', 'success');
        const updatedUser = {
          ...user,
          company: {
            ...user.company,
            name: companyName,
            gstin: gstin
          }
        };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      showToast('Error updating company profile', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    setPasswordLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Failed to change password', 'error');
      } else {
        showToast('Password changed successfully!', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      showToast('Error changing password', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Profile Settings</h1>
        <p className="text-xs text-slate-400">Manage your B2B account details, company GSTIN and password security.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Company Settings */}
        <Card>
          <div className="flex items-center gap-2 pb-4 border-b border-white/5">
            <Building className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base text-white">Company Profile</h3>
          </div>

          <form onSubmit={handleUpdateCompany} className="space-y-4">
            <Input
              label="Company Name"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company Name"
              icon={<Building className="w-3.5 h-3.5 text-slate-500" />}
            />

            <Input
              label="GSTIN"
              required
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="15-digit GSTIN number"
              icon={<Shield className="w-3.5 h-3.5 text-slate-500" />}
              className="font-mono"
            />

            {user?.company && (
              <div className="p-3.5 bg-slate-950 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Verification Status:</span>
                <span className={`flex items-center gap-1 font-bold ${
                  user.company.status === 'VERIFIED' ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {user.company.status === 'VERIFIED' ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Verified Buyer/Supplier</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{user.company.status || 'Under Review'}</span>
                    </>
                  )}
                </span>
              </div>
            )}

            <Button
              type="submit"
              disabled={profileLoading}
              variant="primary"
              className="w-full"
            >
              {profileLoading ? 'Updating...' : 'Save Profile Changes'}
              <Save className="w-3.5 h-3.5" />
            </Button>
          </form>
        </Card>

        {/* Password Management */}
        <Card>
          <div className="flex items-center gap-2 pb-4 border-b border-white/5">
            <Lock className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-base text-white">Security & Password</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />

            <Input
              label="New Password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />

            <Input
              label="Confirm New Password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />

            <Button
              type="submit"
              disabled={passwordLoading}
              variant="purple"
              className="w-full"
            >
              {passwordLoading ? 'Updating Password...' : 'Change Password'}
              <Lock className="w-3.5 h-3.5" />
            </Button>
          </form>
        </Card>
      </div>

      {/* Account Info */}
      <Card>
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
          <h3 className="font-bold text-base text-white">Your Account Details</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center gap-3 p-3 bg-slate-900/40 rounded-xl border border-white/5">
            <Mail className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-500 block">Email Address</span>
              <span className="text-slate-200 font-semibold">{user?.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-900/40 rounded-xl border border-white/5">
            <Sparkles className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-500 block">User Access Role</span>
              <span className="text-blue-400 font-semibold">{user?.role}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
