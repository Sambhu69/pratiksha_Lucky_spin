'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<{ username: string; role: string } | null>(null);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    // Clock in Nepal time
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kathmandu',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check session
    apiRequest<{ admin: { username: string; role: string } }>('/auth/me')
      .then((res) => {
        if (res.data?.admin) {
          setAdminUser(res.data.admin);
        }
      })
      .catch(() => {
        // Not logged in, if not on login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin/login')) {
          router.push('/admin/login');
        }
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      router.push('/admin/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Admin Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/admin/dashboard" className="flex items-center gap-2">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black flex items-center justify-center text-xs sm:text-sm shrink-0">
                PKS
              </span>
              <div>
                <h1 className="text-sm sm:text-base font-black text-white leading-tight truncate max-w-[150px] xs:max-w-none">
                  Pratikshya Kitchen Suppliers
                </h1>
                <p className="text-[10px] sm:text-[11px] text-amber-400 uppercase tracking-wider font-semibold">
                  Console • Pokhara
                </p>
              </div>
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Nepal Time Clock */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-mono text-slate-300">
              <span className="text-slate-500">NPT:</span>
              <span className="text-amber-400 font-bold">{currentTime || '--:--:--'}</span>
            </div>

            {/* Admin identity pill */}
            {adminUser && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-200 border border-slate-700 max-w-[100px] sm:max-w-none truncate">
                  {adminUser.role === 'SUPER_ADMIN' ? '👑 ' : '👤 '}
                  {adminUser.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-[11px] sm:text-xs text-red-400 hover:text-red-300 font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded hover:bg-red-950/30 transition"
                >
                  Logout
                </button>
              </div>
            )}

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95"
            >
              <span>🎯</span>
              <span>Open Kiosk</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        Pratikshya Lucky Spin Management Console • Nepal Time Enforced (+05:45)
      </footer>
    </div>
  );
}

