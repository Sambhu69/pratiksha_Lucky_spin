'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      router.push('/admin/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6">
        <div className="text-center space-y-1.5 sm:space-y-2">
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
            Pratikshya Kitchen Suppliers
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white">Staff & Admin Login</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Access the live spin monitor and counter claim desk.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs sm:text-sm font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3.5 sm:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 sm:mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin_pratikshya or staff_counter"
              className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 sm:mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 sm:py-4 px-4 sm:px-6 rounded-xl font-bold text-sm sm:text-base text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.99] transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Dashboard →'}
          </button>
        </form>

        <div className="pt-1 text-center">
          <a
            href="/"
            className="text-xs text-slate-400 hover:text-amber-400 transition"
          >
            ← Back to Customer Spin Terminal
          </a>
        </div>
      </div>
    </div>
  );
}

