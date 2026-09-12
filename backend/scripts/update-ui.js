const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'frontend', 'src', 'app', 'page.tsx');

let content = fs.readFileSync(targetPath, 'utf8');

// I will overwrite the whole file, but I need to make sure I don't lose the functionality.

const newContent = `'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Building, User, Lock, Mail, ArrowRight, KeyRound, Loader2, Check, Hexagon, EyeOff, Eye, ChevronLeft, Zap, Users } from 'lucide-react';
import { getDefaultRouteForRole } from '@/lib/roleRouting';

const REMEMBER_EMAIL_KEY = 'rememberedLoginEmail';

export default function Home() {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const router = useRouter();

  // Route guarding
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        router.push(getDefaultRouteForRole(parsed.role));
      } catch {
        router.push('/marketplace');
      }
    } else {
      setCheckingAuth(false);
      const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  }, [router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const rToken = params.get('resetToken');
      const iToken = params.get('inviteToken') || params.get('invite');
      
      if (rToken) {
        setResetToken(rToken);
        setAuthMode('reset');
      } else if (iToken) {
        setInviteToken(iToken);
        setAuthMode('register');
        
        try {
          const base64Url = iToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const payload = JSON.parse(jsonPayload);
          
          if (payload.email) {
            setEmail(payload.email);
          }
        } catch (e) {
          console.error('Failed to decode invite token', e);
        }
      }
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'register' && !agreeTerms) {
      setError('Please agree to the Terms & Conditions');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');

    const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const basePayload = { email, password, name };
    const fullPayload = { ...basePayload, gstin, pan: 'ABCDE1234F', phone: '9999999999', addressLine1: '123 Main St', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', role: 'OWNER' };
    
    const body = authMode === 'login' 
      ? { email, password } 
      : (inviteToken ? { ...basePayload, inviteToken } : fullPayload);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Authentication failed');
      } else {
        if (authMode === 'login') {
          if (rememberMe) {
            localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
          } else {
            localStorage.removeItem(REMEMBER_EMAIL_KEY);
          }
          localStorage.setItem('user', JSON.stringify(data.data.user));
          localStorage.setItem('token', data.data.accessToken);
          if (data.data.refreshToken) {
            localStorage.setItem('refreshToken', data.data.refreshToken);
          }
          router.push(getDefaultRouteForRole(data.data.user?.role));
        } else {
          setAuthMode('login');
          setSuccessMsg('Registration successful! Please log in.');
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Forgot password failed');
      } else {
        setSuccessMsg(data.message);
        if (data.data?.resetToken) {
          setResetToken(data.data.resetToken);
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Reset password failed');
      } else {
        setSuccessMsg('Password reset successful! You can now log in.');
        setAuthMode('login');
        setResetToken('');
        setNewPassword('');
        router.replace('/');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Wrapper for centering the mobile views on desktop
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen w-full flex justify-center items-center bg-gray-100">
      <div className="w-full max-w-md h-screen md:h-auto md:min-h-[850px] shadow-2xl relative overflow-hidden bg-white md:rounded-[2.5rem]">
         {children}
      </div>
    </div>
  );

  if (authMode === 'login' || authMode === 'forgot' || authMode === 'reset') {
    return (
      <Wrapper>
        <div className="h-full flex flex-col font-sans bg-[#001D4A]">
          {/* Top Section */}
          <div className="pt-12 pb-8 px-6 text-white flex-none relative overflow-hidden">
             <div className="flex items-center gap-2 mb-8">
                <div className="bg-white p-1.5 rounded-lg shadow-sm">
                  <Hexagon className="w-6 h-6 text-[#001D4A] fill-[#001D4A]" />
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">B2B Procurement Hub</h2>
                  <p className="text-[10px] text-blue-200">Connect • Source • Grow</p>
                </div>
             </div>
             
             <h1 className="text-3xl font-bold mb-4 leading-tight">Component-Level<br/>Procurement.</h1>
             <p className="text-sm text-blue-100 max-w-[250px] mb-6">
               Trusted platform for businesses to buy, sell and fulfill requirements with ease.
             </p>
             
             <div className="absolute right-0 bottom-0 opacity-80 mix-blend-lighten w-40 h-40 bg-gradient-to-tl from-blue-500/40 to-transparent rounded-tl-full"></div>
             {/* Decorative element resembling the gears/machine block */}
             <div className="absolute right-[-20px] bottom-[20px] w-32 h-32 opacity-20">
                <Shield className="w-full h-full text-blue-300" />
             </div>
          </div>

          {/* Bottom White Section */}
          <div className="bg-white rounded-t-[2.5rem] px-6 py-8 flex flex-col relative z-10 w-full flex-1">
              
              {authMode === 'login' && (
                <>
                  {/* Tabs */}
                  <div className="flex justify-between items-center border-b border-gray-100 mb-6 px-2">
                     <button className="pb-3 px-2 text-blue-600 font-bold border-b-2 border-blue-600">Sign In</button>
                     <button className="pb-3 px-2 text-gray-400 font-medium hover:text-gray-600 transition-colors" onClick={() => {setAuthMode('register'); setError(''); setSuccessMsg('');}}>Register Company</button>
                  </div>
                  
                  {/* Form */}
                  <form onSubmit={handleAuth} className="space-y-4">
                    {error && <div className="p-3 text-xs rounded-xl bg-red-50 text-red-600 border border-red-100">{error}</div>}
                    {successMsg && <div className="p-3 text-xs rounded-xl bg-green-50 text-green-600 border border-green-100">{successMsg}</div>}

                    {/* Email */}
                    <div className="relative mt-2">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                         <Mail className="w-5 h-5"/>
                      </div>
                      <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com" className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" />
                      <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium">Email Address</span>
                    </div>
                    {/* Password */}
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                         <Lock className="w-5 h-5"/>
                      </div>
                      <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter your password" className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-11 pr-11 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" />
                      <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium">Password</span>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                      </button>
                    </div>
                    
                    {/* Remember me & Forgot Password */}
                    <div className="flex justify-between items-center pt-2">
                       <label className="flex items-center gap-2 cursor-pointer">
                         <div className={\`w-4 h-4 rounded flex items-center justify-center transition-colors \${rememberMe ? 'bg-blue-600' : 'bg-gray-100 border border-gray-300'}\`}>
                           {rememberMe && <Check className="w-3 h-3 text-white" />}
                           <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="sr-only" />
                         </div>
                         <span className="text-sm text-gray-700 font-medium">Remember me</span>
                       </label>
                       <button type="button" onClick={() => { setAuthMode('forgot'); setError(''); setSuccessMsg(''); }} className="text-sm text-blue-600 font-medium hover:underline">Forgot Password?</button>
                    </div>

                    {/* Submit Button */}
                    <button type="submit" disabled={loading} className="w-full bg-[#1A65E6] hover:bg-blue-700 text-white rounded-xl py-3.5 font-medium flex justify-center items-center gap-2 mt-6 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-70">
                       {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Access Marketplace'} 
                       {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </form>
                  
                  {/* Register Link */}
                  <div className="mt-8 text-center border-t border-gray-100 pt-6 relative">
                     <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-xs text-gray-400">New to our platform?</span>
                     <button onClick={() => {setAuthMode('register'); setError(''); setSuccessMsg('');}} className="text-blue-600 font-semibold flex items-center justify-center gap-2 w-full text-sm hover:text-blue-700 transition-colors">
                       Register your company <ArrowRight className="w-4 h-4" />
                     </button>
                  </div>

                  {/* Badges Footer */}
                  <div className="flex justify-between items-center mt-auto pt-8 pb-4">
                     <div className="flex items-center gap-1.5">
                       <Shield className="w-4 h-4 text-gray-400" />
                       <span className="text-[10px] text-gray-500 font-medium leading-tight">Secure<br/>Transactions</span>
                     </div>
                     <div className="h-6 w-px bg-gray-200"></div>
                     <div className="flex items-center gap-1.5">
                       <Users className="w-4 h-4 text-gray-400" />
                       <span className="text-[10px] text-gray-500 font-medium leading-tight">Verified<br/>Suppliers</span>
                     </div>
                     <div className="h-6 w-px bg-gray-200"></div>
                     <div className="flex items-center gap-1.5">
                       <Zap className="w-4 h-4 text-gray-400" />
                       <span className="text-[10px] text-gray-500 font-medium leading-tight">Faster<br/>Procurement</span>
                     </div>
                  </div>
                </>
              )}

              {/* Forgot / Reset Forms adapted to this view */}
              {authMode === 'forgot' && (
                <div className="flex flex-col h-full">
                  <div className="mb-6 border-b border-gray-100 pb-4">
                    <button onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }} className="text-gray-500 hover:text-gray-800 mb-4 flex items-center gap-1 text-sm font-medium">
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <h2 className="text-xl font-bold text-gray-800">Reset Password</h2>
                    <p className="text-sm text-gray-500 mt-1">Enter your email to request a password reset link.</p>
                  </div>
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    {error && <div className="p-3 text-xs rounded-xl bg-red-50 text-red-600 border border-red-100">{error}</div>}
                    {successMsg && <div className="p-3 text-xs rounded-xl bg-green-50 text-green-600 border border-green-100 break-words">{successMsg}</div>}
                    <div className="relative mt-2">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Mail className="w-5 h-5"/></div>
                      <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com" className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" />
                      <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium">Email Address</span>
                    </div>
                    {resetToken && (
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-[11px] space-y-2">
                        <span className="text-blue-600 font-semibold block">Demo Quick Link:</span>
                        <button type="button" onClick={() => setAuthMode('reset')} className="text-left underline text-blue-500 hover:text-blue-700 break-all">Click here to simulate resetting password using this token</button>
                      </div>
                    )}
                    <button type="submit" disabled={loading} className="w-full bg-[#1A65E6] hover:bg-blue-700 text-white rounded-xl py-3.5 font-medium flex justify-center items-center gap-2 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-70 mt-4">
                       {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Send Link'} {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </form>
                </div>
              )}

              {authMode === 'reset' && (
                <div className="flex flex-col h-full">
                  <div className="mb-6 border-b border-gray-100 pb-4">
                     <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                       <KeyRound className="w-5 h-5 text-blue-600" /> Set New Password
                     </h2>
                     <p className="text-sm text-gray-500 mt-1">Please enter your new password to complete the reset.</p>
                  </div>
                  <form onSubmit={handleResetPassword} className="space-y-5">
                    {error && <div className="p-3 text-xs rounded-xl bg-red-50 text-red-600 border border-red-100">{error}</div>}
                    {successMsg && <div className="p-3 text-xs rounded-xl bg-green-50 text-green-600 border border-green-100">{successMsg}</div>}
                    <div className="relative mt-2">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><KeyRound className="w-5 h-5"/></div>
                      <input type="text" required value={resetToken} onChange={(e)=>setResetToken(e.target.value)} placeholder="Reset token" className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" />
                      <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium">Token</span>
                    </div>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Lock className="w-5 h-5"/></div>
                      <input type={showPassword ? 'text' : 'password'} required value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="Enter new password" className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-11 pr-11 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" />
                      <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium">New Password</span>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                      </button>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button type="button" onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }} className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors text-center">Cancel</button>
                      <button type="submit" disabled={loading} className="flex-1 py-3.5 bg-[#1A65E6] hover:bg-blue-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-70">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Reset Password'} {!loading && <ArrowRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </form>
                </div>
              )}
          </div>
        </div>
      </Wrapper>
    );
  }

  // Register Mode
  return (
    <Wrapper>
      <div className="h-full flex flex-col font-sans bg-[#F8FAFC]">
        {/* Top Section */}
        <div className="pt-10 px-6 pb-6 text-gray-800 flex-none relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => {setAuthMode('login'); setError(''); setSuccessMsg('');}} className="text-gray-800 hover:text-black">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-white p-1 rounded-lg border border-gray-100 shadow-sm">
                <Hexagon className="w-5 h-5 text-blue-600 fill-blue-600" />
              </div>
              <div>
                <h2 className="font-bold text-sm leading-tight text-gray-900">B2B Procurement Hub</h2>
                <p className="text-[9px] text-gray-500">Connect • Source • Grow</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-start justify-between">
             <div className="max-w-[65%]">
               <h1 className="text-2xl font-bold mb-3 leading-tight text-[#001D4A]">Create Your<br/>Company Account</h1>
               <p className="text-xs text-gray-600">
                 Join our trusted B2B marketplace and start growing your business.
               </p>
             </div>
             {/* Decorative Building Illustration */}
             <div className="w-20 h-20 bg-blue-100 rounded-2xl -mt-2 relative flex items-center justify-center overflow-hidden rotate-3 shadow-inner">
               <Building className="w-10 h-10 text-blue-500 -rotate-3" />
               <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-blue-200/50 to-transparent"></div>
             </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="bg-white rounded-t-[2.5rem] px-6 py-8 flex-1 flex flex-col shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] relative z-20">
          <form onSubmit={handleAuth} className="space-y-4">
              {error && <div className="p-3 text-xs rounded-xl bg-red-50 text-red-600 border border-red-100">{error}</div>}
              {successMsg && <div className="p-3 text-xs rounded-xl bg-green-50 text-green-600 border border-green-100">{successMsg}</div>}

              {/* Name */}
              <div className="relative mt-2">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><User className="w-5 h-5"/></div>
                <input type="text" required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Enter your full name" className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" />
                <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium">Your Name</span>
              </div>
              
              {/* GSTIN */}
              {!inviteToken && (
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Shield className="w-5 h-5"/></div>
                  <input type="text" required value={gstin} onChange={(e)=>setGstin(e.target.value)} placeholder="15-digit GSTIN number" className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" />
                  <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium">Company GSTIN</span>
                </div>
              )}

              {/* Email */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Mail className="w-5 h-5"/></div>
                <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} disabled={!!inviteToken} placeholder="you@company.com" className={\`w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors \${inviteToken ? 'opacity-60 bg-gray-50' : ''}\`} />
                <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium">Email Address</span>
              </div>

              {/* Password */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Lock className="w-5 h-5"/></div>
                <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Create a strong password" className="w-full bg-white border border-gray-200 rounded-xl py-3.5 pl-11 pr-11 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" />
                <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium">Password</span>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                </button>
              </div>
              
              {/* Terms checkbox */}
              <div className="pt-2">
                 <label className="flex items-start gap-3 cursor-pointer group">
                   <div className={\`w-4 h-4 mt-0.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors \${agreeTerms ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}\`}>
                     {agreeTerms && <Check className="w-3 h-3 text-white" />}
                     <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="sr-only" />
                   </div>
                   <span className="text-xs text-gray-600 leading-tight">
                     I agree to the <span className="text-blue-600 font-medium hover:underline">Terms & Conditions</span> and <span className="text-blue-600 font-medium hover:underline">Privacy Policy</span>
                   </span>
                 </label>
              </div>

              {/* Submit Button */}
              <button type="submit" disabled={loading} className="w-full bg-[#1A65E6] hover:bg-blue-700 text-white rounded-xl py-3.5 font-medium flex justify-center items-center gap-2 mt-6 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-70">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Register and Setup Portal'} 
                 {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
          </form>
          
          {/* Login Link */}
          <div className="mt-8 text-center border-t border-gray-100 pt-6 relative">
             <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-xs text-gray-400">Already have an account?</span>
             <button onClick={() => {setAuthMode('login'); setError(''); setSuccessMsg('');}} className="text-blue-600 font-semibold flex items-center justify-center gap-2 w-full text-sm hover:text-blue-700 transition-colors">
               Sign In <ArrowRight className="w-4 h-4" />
             </button>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
`;

fs.writeFileSync(targetPath, newContent);
console.log('Done replacing content.');
