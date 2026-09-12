'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Building2,
  ShieldCheck,
  Calendar,
  Camera,
  ChevronRight,
  CreditCard,
  MapPin,
  Mail,
  Phone,
  Lock,
  User,
  Users,
  LogOut,
  CheckCircle,
  Clock,
  Upload,
  Eye,
  X,
  MessageCircle,
  Landmark,
  Loader2,
  Save,
  Link,
  Edit2,
  Shield
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ButtonSpinner } from '@/components/ui/ActionButton';

interface ProfileTabProps {
  user: any;
  setUser: (user: any) => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ProfileTab({ user, setUser, showToast }: ProfileTabProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals & Expandable sections
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);

  // Form states
  const [companyName, setCompanyName] = useState(user?.company?.name || '');
  const [gstin, setGstin] = useState(user?.company?.gstin || '');
  const [address, setAddress] = useState(user?.company?.address || '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('PROCUREMENT');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState('');

  // Bank details state
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankLast4, setBankLast4] = useState<string | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);

  // KYC state
  const [kycLoading, setKycLoading] = useState<string | null>(null);
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);

  // Sync state if user changes
  useEffect(() => {
    if (user?.company) {
      setCompanyName(user.company.name || '');
      setGstin(user.company.gstin || '');
      setAddress(user.company.address || '');
    }
  }, [user]);

  // Load bank details on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBankLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('/api/v1/company/me/bank', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled || !data.success) return;
        if (data.data) {
          setBankAccountName(data.data.accountName || '');
          setBankIfsc(data.data.ifsc || '');
          setBankLast4(data.data.accountNumberLast4 || null);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setBankLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: companyName, gstin, address })
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
            gstin: gstin,
            address: address
          }
        };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setShowCompanyModal(false);
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
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setPasswordLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
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
        setShowPasswordModal(false);
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
          Authorization: `Bearer ${token}`
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

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!bankAccountName.trim()) {
      showToast('Account holder name is required', 'error');
      return;
    }
    if (!ifscRegex.test(bankIfsc.trim().toUpperCase())) {
      showToast('Invalid IFSC format. Example: HDFC0001234', 'error');
      return;
    }
    const digitsOnly = bankAccountNumber.replace(/\D/g, '');
    if (digitsOnly.length < 4) {
      showToast('Enter a valid bank account number', 'error');
      return;
    }

    setBankSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/company/me/bank', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountName: bankAccountName.trim(),
          ifsc: bankIfsc.trim().toUpperCase(),
          accountNumber: digitsOnly,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Failed to save bank details', 'error');
        return;
      }
      setBankLast4(data.data?.accountNumberLast4 || digitsOnly.slice(-4));
      setBankAccountNumber('');
      showToast('Bank details saved successfully', 'success');
      setShowBankModal(false);
    } catch {
      showToast('Failed to save bank details', 'error');
    } finally {
      setBankSaving(false);
    }
  };

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
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.message || 'Upload failed');
      }

      const fileId = uploadData.data.filename;
      const docRes = await fetch('/api/v1/company/me/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ documentType, fileId })
      });
      const docData = await docRes.json();
      if (!docData.success) {
        throw new Error(docData.message || 'Failed to save document record');
      }

      showToast(`${documentType.replace('_', ' ')} uploaded successfully!`, 'success');
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

  // Profile display helpers
  const displayName = user?.name || user?.email?.split('@')[0] || 'Amit Kumar';
  const avatarLetter = (displayName[0] || 'A').toUpperCase();

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Procurement';
      case 'PROCUREMENT':
        return 'Procurement';
      case 'FINANCE':
        return 'Finance';
      case 'PLATFORM_ADMIN':
        return 'Admin';
      case 'TRANSPORTER':
        return 'Logistics';
      default:
        return 'Procurement';
    }
  };

  const getFullRoleDisplay = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Procurement (RFQs, POs)';
      case 'PROCUREMENT':
        return 'Procurement (RFQs, POs)';
      case 'FINANCE':
        return 'Finance (Invoices, Payments)';
      case 'PLATFORM_ADMIN':
        return 'Platform Administrator';
      case 'TRANSPORTER':
        return 'Transporter (Logistics)';
      default:
        return 'Procurement (RFQs, POs)';
    }
  };

  const formatMemberSince = (dateStr?: string) => {
    if (!dateStr) return 'Sep 2025';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return 'Sep 2025';
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-12">
      {/* Hidden file input for avatar trigger */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={() => showToast('Profile avatar updated', 'info')}
      />

      {/* 1. Hero User Profile Card */}
      <div className="bg-gradient-to-br from-blue-50/70 via-white to-sky-50/40 rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {/* Avatar Circle with Camera Overlay */}
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-[#1E293B] text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                {avatarLetter}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center absolute -bottom-0.5 -right-0.5 shadow-xs cursor-pointer transition-transform active:scale-95"
                title="Change photo"
              >
                <Camera className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Name & Title */}
            <div>
              <h2 className="text-base font-extrabold text-[#001D4A] tracking-tight leading-tight">
                {displayName}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Procurement Specialist
              </p>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[10px] font-bold mt-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Active
              </span>
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
        </div>

        {/* 3-Column Stats Metadata Box */}
        <div className="bg-white rounded-2xl border border-slate-100 p-3 mt-4 grid grid-cols-3 divide-x divide-slate-100 shadow-2xs">
          {/* Col 1: Company */}
          <div className="px-2 first:pl-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-blue-600 mb-0.5">
              <Building2 className="w-3.5 h-3.5" />
              <span className="text-[10px] text-slate-400 font-medium">Company</span>
            </div>
            <p className="text-xs font-bold text-[#001D4A] truncate">
              {companyName || user?.company?.name || 'TATA Sons'}
            </p>
          </div>

          {/* Col 2: Role */}
          <div className="px-2.5 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-blue-600 mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-[10px] text-slate-400 font-medium">Role</span>
            </div>
            <p className="text-xs font-bold text-[#001D4A] truncate">
              {getRoleLabel(user?.role)}
            </p>
          </div>

          {/* Col 3: Member Since */}
          <div className="px-2.5 last:pr-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-blue-600 mb-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-[10px] text-slate-400 font-medium">Member Since</span>
            </div>
            <p className="text-xs font-bold text-[#001D4A] truncate">
              {formatMemberSince(user?.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Company Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 transition-all">
        {/* Header */}
        <div
          onClick={() => setShowCompanyModal(true)}
          className="flex items-center justify-between cursor-pointer group pb-3 border-b border-slate-100"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-[#001D4A] group-hover:text-blue-600 transition-colors">
              Company Details
            </h3>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
        </div>

        {/* Details Rows */}
        <div className="pt-3 space-y-2.5 text-xs">
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 flex justify-between items-center">
              <span className="text-slate-500">Company Name</span>
              <span className="font-bold text-[#001D4A] text-right truncate max-w-[200px]">
                {companyName || user?.company?.name || 'TATA Sons'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 flex justify-between items-center">
              <span className="text-slate-500">GSTIN</span>
              <span className="font-medium font-mono text-slate-700 text-right">
                {gstin || user?.company?.gstin || 'dfvder 3tefsfs'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 flex justify-between items-center">
              <span className="text-slate-500">Address</span>
              <span className="font-medium text-slate-700 text-right truncate max-w-[200px]">
                {address || user?.company?.address || 'Mumbai, Maharashtra, India'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Account Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-[#001D4A]">Account Details</h3>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Rows */}
        <div className="pt-3 space-y-2.5 text-xs">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 flex justify-between items-center">
              <span className="text-slate-500">Email Address</span>
              <span className="font-medium text-slate-700 text-right truncate max-w-[200px]">
                {user?.email || 'amitkumar@gmail.com'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 flex justify-between items-center">
              <span className="text-slate-500">Mobile Number</span>
              <span className="font-medium text-slate-700 text-right">
                {user?.phone || '+91 98765 43210'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Security & Password Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 transition-all">
        {/* Header */}
        <div
          onClick={() => setShowPasswordModal(true)}
          className="flex items-center justify-between pb-3 border-b border-slate-100 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-[#001D4A] group-hover:text-blue-600 transition-colors">
              Security & Password
            </h3>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
        </div>

        {/* Content */}
        <div className="pt-3 space-y-3">
          {/* Green banner */}
          <div className="bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 rounded-xl p-2.5 text-xs font-semibold flex items-center gap-2 shadow-2xs">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Your account is secure</span>
          </div>

          {/* Change Password row */}
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between py-1 text-xs hover:text-blue-600 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              <span className="font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                Change Password
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </button>
        </div>
      </div>

      {/* 5. Role & Access Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-[#001D4A]">Role & Access</h3>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Row */}
        <div className="pt-3 text-xs">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 flex justify-between items-center">
              <span className="text-slate-500">Current Role</span>
              <span className="font-bold text-[#001D4A] text-right">
                {getFullRoleDisplay(user?.role)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Invite Team Members Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 transition-all">
        {/* Header */}
        <div
          onClick={() => setShowInviteModal(true)}
          className="flex items-center justify-between pb-3 border-b border-slate-100 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-[#001D4A] group-hover:text-blue-600 transition-colors">
              Invite Team Members
            </h3>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
        </div>

        {/* Content */}
        <div className="pt-3 space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            Generate a registration token for your team members to join this company.
          </p>

          {/* Trigger Button */}
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="w-full bg-blue-50/80 hover:bg-blue-100/80 text-blue-600 border border-blue-100 rounded-xl p-3 text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              <span>Generate Invite Token</span>
            </div>
            <ChevronRight className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      </div>

      {/* Additional Management: Bank Payouts & KYC Documents */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowBankModal(true)}
          className="bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-left shadow-2xs transition-all flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[#001D4A] truncate">Bank Details</h4>
            <p className="text-[10px] text-slate-400 truncate">
              {bankLast4 ? `••••${bankLast4}` : 'For supplier payouts'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowKycModal(true)}
          className="bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-left shadow-2xs transition-all flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[#001D4A] truncate">KYC Verification</h4>
            <p className="text-[10px] text-slate-400 truncate">
              {user?.company?.status === 'VERIFIED' ? 'Verified' : 'Upload documents'}
            </p>
          </div>
        </button>
      </div>

      {/* 7. Sign Out Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3 px-4 border border-rose-200 bg-rose-50/40 hover:bg-rose-100/70 text-rose-600 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-98"
        >
          <LogOut className="w-4 h-4 text-rose-600" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* =========================================================
          MODALS
         ========================================================= */}

      {/* Modal 1: Edit Company Details */}
      {showCompanyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowCompanyModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl p-6 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#001D4A]">Edit Company Details</h3>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCompany} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. TATA Sons"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  GSTIN Number
                </label>
                <input
                  type="text"
                  required
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="15-digit GSTIN"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-mono font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Registered Address
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, State, Country"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {profileLoading && <ButtonSpinner />}
                  {profileLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Change Password */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl p-6 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#001D4A]">Change Password</h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {passwordLoading && <ButtonSpinner />}
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Invite Team Members */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl p-6 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#001D4A]">Invite Team Member</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateInvite} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Assign Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="PROCUREMENT">Procurement (RFQs, POs)</option>
                  <option value="FINANCE">Finance (Invoices, Payments)</option>
                  {user?.role === 'PLATFORM_ADMIN' && (
                    <option value="TRANSPORTER">Transporter (Logistics)</option>
                  )}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {inviteLoading && <ButtonSpinner />}
                  {inviteLoading ? 'Generating...' : 'Generate Token'}
                </button>

                <button
                  type="button"
                  title="Share on WhatsApp"
                  disabled={!generatedToken}
                  onClick={() => {
                    if (!generatedToken) return;
                    const link = `${window.location.origin}/?invite=${generatedToken}`;
                    const text = `Join our team on the procurement platform! Register here: ${link}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className={`px-3.5 py-2.5 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                    !generatedToken
                      ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>

              {generatedToken && (
                <div className="mt-3 p-3.5 rounded-xl bg-blue-50 border border-blue-200/80 space-y-2">
                  <p className="text-xs font-bold text-blue-700">Invite Link Ready!</p>
                  <p className="text-[11px] text-slate-600 break-all bg-white p-2 rounded-lg border border-blue-100 font-mono">
                    {`${window.location.origin}/?invite=${generatedToken}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/?invite=${generatedToken}`);
                      showToast('Link copied to clipboard!', 'info');
                    }}
                    className="w-full py-1.5 bg-white hover:bg-slate-50 border border-blue-200 text-blue-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Copy Link
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Bank Details */}
      {showBankModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowBankModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl p-6 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#001D4A]">Bank Settlement Details</h3>
              <button
                type="button"
                onClick={() => setShowBankModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3.5">
              Required for supplier settlement payouts upon order completion.
            </p>

            <form onSubmit={handleSaveBankDetails} className="space-y-3.5">
              {bankLast4 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Account on file ending in <strong>••••{bankLast4}</strong></span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  required
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="As per bank records"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  IFSC Code
                </label>
                <input
                  type="text"
                  required
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0001234"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-mono font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Bank Account Number
                </label>
                <input
                  type="password"
                  required
                  autoComplete="off"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder={bankLast4 ? `Re-enter to update (ends ••••${bankLast4})` : 'Enter account number'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-mono font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bankSaving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {bankSaving && <ButtonSpinner />}
                  {bankSaving ? 'Saving...' : 'Save Bank Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: KYC Documents */}
      {showKycModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowKycModal(false)}
        >
          <div
            className="relative max-w-lg w-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl p-6 text-slate-800 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#001D4A]">KYC Document Verification</h3>
              <button
                type="button"
                onClick={() => setShowKycModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Upload the 4 required business documents to complete verification. Max file size: 15MB.
            </p>

            <div className="space-y-3">
              {[
                { id: 'GST_CERT', label: 'GST Certificate' },
                { id: 'PAN_CARD', label: 'Company PAN Card' },
                { id: 'INCORPORATION_PROOF', label: 'Proof of Incorporation' },
                { id: 'BANK_PROOF', label: 'Cancelled Cheque' }
              ].map((doc) => {
                const docData = user?.company?.documents?.find((d: any) => d.documentType === doc.id);
                const isUploaded = !!docData;

                return (
                  <div key={doc.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-[#001D4A] flex items-center gap-1.5">
                        {doc.label}
                        {isUploaded && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {isUploaded ? 'Document on file' : 'Pending upload'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                        isUploaded
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
                      }`}>
                        {kycLoading === doc.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isUploaded ? 'Replace' : 'Upload'}</span>
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
                          type="button"
                          onClick={() => setViewingFileId(docData.fileId)}
                          className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                          title="View Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Document Viewer */}
      {viewingFileId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setViewingFileId(null)}
        >
          <div
            className="relative max-w-2xl w-full h-[80vh] bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#001D4A]">Document Preview</h3>
              <button
                type="button"
                onClick={() => setViewingFileId(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-50 p-2">
              <iframe
                src={`/api/v1/upload/${viewingFileId}`}
                className="w-full h-full rounded-2xl border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
