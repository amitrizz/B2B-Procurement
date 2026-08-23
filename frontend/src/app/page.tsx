'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Building, User, Lock, Mail, ArrowRight, KeyRound } from 'lucide-react';

export default function Home() {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  // Detect resetToken in query parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('resetToken');
      if (token) {
        setResetToken(token);
        setAuthMode('reset');
      }
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const body = authMode === 'login' ? { email, password } : { email, password, name, gstin };

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
          localStorage.setItem('user', JSON.stringify(data.data.user));
          localStorage.setItem('token', data.data.accessToken);
          router.push('/dashboard');
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
          // Expose token for easier local testing/development
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
        // Remove query parameters
        router.replace('/');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-12 relative overflow-y-auto custom-scrollbar">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10" />

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        
        {/* Left Side: Product Intro */}
        <div className="flex flex-col justify-center p-4 space-y-6">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 font-semibold mb-6">
              <Shield className="w-6 h-6 animate-pulse" />
              <span>B2B Procurement Hub</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent leading-tight">
              Component-Level Procurement.
            </h1>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
          {authMode === 'login' || authMode === 'register' ? (
            <>
              <div className="flex justify-between mb-8 border-b border-white/5 pb-4">
                <button
                  onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
                  className={`pb-2 text-sm font-semibold transition-all ${authMode === 'login' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg(''); }}
                  className={`pb-2 text-sm font-semibold transition-all ${authMode === 'register' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
                >
                  Register Company
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {error && (
                  <div className="p-3 text-xs rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                    {error}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 text-xs rounded-xl bg-green-500/10 border border-green-500/20 text-green-400">
                    {successMsg}
                  </div>
                )}

                {authMode === 'register' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5" /> Company Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter company name"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> GSTIN
                      </label>
                      <input
                        type="text"
                        required
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value)}
                        placeholder="15-digit GSTIN number"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Password
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setAuthMode('forgot'); setError(''); setSuccessMsg(''); }}
                        className="text-[11px] text-blue-400 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-blue-500/20 active:scale-[0.98]"
                >
                  {loading ? 'Authenticating...' : authMode === 'login' ? 'Access Marketplace' : 'Register and Setup Portal'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : authMode === 'forgot' ? (
            <div className="space-y-4">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-white">Reset Password</h2>
                <p className="text-xs text-slate-400 mt-1">Enter your email to request a password reset link.</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                {error && (
                  <div className="p-3 text-xs rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                    {error}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 text-xs rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 break-words">
                    {successMsg}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                  />
                </div>

                {resetToken && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-white/5 text-[11px] space-y-2">
                    <span className="text-blue-400 font-semibold block">Demo Quick Link:</span>
                    <button
                      type="button"
                      onClick={() => setAuthMode('reset')}
                      className="text-left underline text-purple-400 hover:text-purple-300 break-all"
                    >
                      Click here to simulate resetting password using this token
                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
                    className="flex-1 py-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-xl font-medium text-xs transition-all text-center"
                  >
                    Back to Login
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    {loading ? 'Sending...' : 'Send Link'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-blue-400" /> Set New Password
                </h2>
                <p className="text-xs text-slate-400 mt-1">Please enter your new password to complete the reset.</p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && (
                  <div className="p-3 text-xs rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                    {error}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 text-xs rounded-xl bg-green-500/10 border border-green-500/20 text-green-400">
                    {successMsg}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Reset Token</label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Enter or paste reset token"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-all text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
                    className="flex-1 py-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-xl font-medium text-xs transition-all text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
