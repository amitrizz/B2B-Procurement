import { useState } from 'react';
import { Building, Shield, Lock, Save, Sparkles, Mail, CheckCircle, Clock, Users, Link, Upload, FileText, Eye, X, MessageCircle } from 'lucide-react';
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

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('PROCUREMENT');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState('');

  // KYC state
  const [kycLoading, setKycLoading] = useState<string | null>(null);
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);

  const handleKycUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('File size must not exceed 15MB', 'error');
      return;
    }

    setKycLoading(documentType);
    try {
      const token = localStorage.getItem('token');
      
      // 1. Upload to MinIO
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const uploadData = await uploadRes.json();
      
      if (!uploadData.success) {
        throw new Error(uploadData.message || 'Upload failed');
      }

      const fileId = uploadData.data.filename;

      // 2. Save KYC Document Record
      const docRes = await fetch('/api/v1/company/me/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ documentType, fileId })
      });
      const docData = await docRes.json();

      if (!docData.success) {
        throw new Error(docData.message || 'Failed to save document record');
      }

      showToast(`${documentType.replace('_', ' ')} uploaded successfully!`, 'success');
      
      // Update local user state if needed (to trigger UI re-renders)
      const updatedUser = {
        ...user,
        company: docData.data
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (err: any) {
      showToast(err.message || 'Error uploading document', 'error');
    } finally {
      setKycLoading(null);
    }
  };

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

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'OWNER' && user?.role !== 'PLATFORM_ADMIN') {
       showToast('Only Admins or Owners can invite team members', 'error');
       return;
    }

    setInviteLoading(true);
    setGeneratedToken('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/company/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Failed to generate invite', 'error');
      } else {
        showToast('Invite generated successfully!', 'success');
        setGeneratedToken(data.data.token);
      }
    } catch (err) {
      showToast('Error generating invite', 'error');
    } finally {
      setInviteLoading(false);
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

      {/* KYC Documents */}
      {user?.company && user?.role === 'OWNER' && (
        <Card>
          <div className="flex items-center gap-2 pb-4 border-b border-white/5">
            <FileText className="w-5 h-5 text-green-400" />
            <h3 className="font-bold text-base text-white">KYC Documents</h3>
          </div>
          <p className="text-xs text-slate-400 mt-4 mb-6">
            Upload the 4 required documents to complete your company verification. Supported formats: PDF, JPG, PNG (Max 15MB).
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              { id: 'GST_CERT', label: 'GST Certificate' },
              { id: 'PAN_CARD', label: 'Company PAN Card' },
              { id: 'INCORPORATION_PROOF', label: 'Proof of Incorporation' },
              { id: 'BANK_PROOF', label: 'Bank Account Proof (Cancelled Cheque)' }
            ].map((doc) => {
              const docData = user?.company?.documents?.find((d: any) => d.documentType === doc.id);
              const isUploaded = !!docData;

              return (
                <div key={doc.id} className="p-4 bg-slate-900/50 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-white mb-1 flex items-center gap-2">
                      {doc.label} 
                      {isUploaded && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </h4>
                    <p className="text-[10px] text-slate-500 mb-4">Required for verification</p>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-auto">
                    <label className={`
                      flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer border border-white/10
                      ${kycLoading === doc.id ? 'bg-slate-800 text-slate-400' : 
                        isUploaded ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20' : 
                        'bg-slate-950 text-white hover:bg-slate-800'}
                    `}>
                      {kycLoading === doc.id ? 'Uploading...' : (
                        <>
                          {isUploaded ? <CheckCircle className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />} 
                          {isUploaded ? 'Re-upload File' : 'Upload File'}
                        </>
                      )}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => handleKycUpload(e, doc.id)}
                        disabled={kycLoading === doc.id}
                      />
                    </label>

                    {isUploaded && docData?.fileId && (
                      <button 
                        onClick={() => setViewingFileId(docData.fileId)}
                        className="py-2 px-4 rounded-lg text-xs font-bold transition-all bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center gap-2"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Team Invites (Only for OWNER & PLATFORM_ADMIN) */}
      {(user?.role === 'OWNER' || user?.role === 'PLATFORM_ADMIN') && (
        <Card>
          <div className="flex items-center gap-2 pb-4 border-b border-white/5">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base text-white">Invite Team Members</h3>
          </div>
          
          <div className="mt-4 grid md:grid-cols-2 gap-8">
             <form onSubmit={handleGenerateInvite} className="space-y-4">
               <p className="text-xs text-slate-400 mb-2">Generate a registration token for your team members to join this company.</p>
               <Input
                 label="Email Address"
                 type="email"
                 required
                 value={inviteEmail}
                 onChange={(e) => setInviteEmail(e.target.value)}
                 placeholder="colleague@company.com"
               />
               <div>
                 <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                   Role
                 </label>
                 <select
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                 >
                   <option value="PROCUREMENT">Procurement (RFQs, POs)</option>
                   <option value="FINANCE">Finance (Invoices, Payments)</option>
                   {user?.role === 'PLATFORM_ADMIN' && (
                     <option value="TRANSPORTER">Transporter (Logistics)</option>
                   )}
                 </select>
               </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={inviteLoading}
                    variant="primary"
                    className="flex-1"
                  >
                    {inviteLoading ? 'Generating...' : 'Generate Invite Token'}
                    <Link className="w-3.5 h-3.5 ml-2" />
                  </Button>
                  
                  <button
                    type="button"
                    title="Share to WhatsApp"
                    disabled={!generatedToken}
                    onClick={() => {
                      if (!generatedToken) return;
                      const link = `${window.location.origin}/?invite=${generatedToken}`;
                      const text = `Join our team on the procurement platform! Register here: ${link}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    className={`px-4 flex items-center justify-center rounded-xl transition-all duration-300 ${
                      !generatedToken 
                        ? 'bg-slate-800 border border-slate-700 text-slate-500 opacity-50 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20 active:scale-95'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" />
                  </button>
                </div>
             </form>

             {generatedToken && (
               <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col justify-center">
                 <h4 className="font-bold text-blue-400 mb-2">Invite Link Generated!</h4>
                 <p className="text-xs text-slate-300 mb-4">Share this link with your team member so they can easily register to your company.</p>
                 <div className="bg-slate-950 p-3 rounded-lg border border-white/5 break-all font-mono text-xs text-white">
                   {`${window.location.origin}/?invite=${generatedToken}`}
                 </div>
                 <div className="flex gap-2 mt-4">
                   <Button 
                     variant="secondary" 
                     className="flex-1 text-xs"
                     onClick={() => {
                       navigator.clipboard.writeText(`${window.location.origin}/?invite=${generatedToken}`);
                       showToast('Link copied to clipboard!', 'info');
                     }}
                   >
                     Copy Link
                   </Button>
                 </div>
               </div>
             )}
          </div>
        </Card>
      )}

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

      {/* Document Viewer Modal */}
      {viewingFileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-4xl h-[80vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-slate-950">
              <h3 className="text-white font-bold text-sm">Document Viewer</h3>
              <button onClick={() => setViewingFileId(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-950/50 p-4">
              <iframe src={`/api/v1/upload/${viewingFileId}`} className="w-full h-full rounded-xl border border-white/5 bg-white" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
