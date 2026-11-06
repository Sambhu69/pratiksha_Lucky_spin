'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import SpinWheel from '@/components/SpinWheel';
import VoucherModal from '@/components/VoucherModal';
import { apiRequest } from '@/lib/api';

type KioskStep = 'ENTRY' | 'READY_TO_SPIN' | 'SPINNING' | 'REWARD_MODAL';

interface CustomerSession {
  customerId: string;
  customerName: string;
  phoneNumber: string;
  remainingSpins: number;
}

interface SpinResult {
  rewardNumber: number;
  rewardName: string;
  rewardTier: 'COMMON' | 'PREMIUM';
  transactionReference: string;
  spinTimestamp: string;
}

export default function KioskPage() {
  const [step, setStep] = useState<KioskStep>('ENTRY');

  // Customer Form Inputs
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Active Session
  const [session, setSession] = useState<CustomerSession | null>(null);

  // Spin Execution
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);

  // 1. Submit Customer Verification
  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await apiRequest<{
        eligible: boolean;
        reason?: string;
        customerId: string;
        customerName: string;
        remainingSpins: number;
      }>('/kiosk/validate', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          phoneNumber,
        }),
      });

      if (!res.data || !res.data.eligible) {
        setErrorMsg(res.data?.reason || 'Customer is not eligible for a spin.');
        return;
      }

      setSession({
        customerId: res.data.customerId,
        customerName: res.data.customerName || fullName,
        phoneNumber,
        remainingSpins: res.data.remainingSpins,
      });

      setStep('READY_TO_SPIN');
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Trigger Spin
  const handleSpinNow = async () => {
    if (!session || step === 'SPINNING') return;
    setErrorMsg('');
    setIsLoading(true);

    try {
      const idempotencyKey = `kiosk-${session.customerId}-${Date.now()}`;
      const res = await apiRequest<SpinResult>('/spins/execute', {
        method: 'POST',
        body: JSON.stringify({
          customerId: session.customerId,
          idempotencyKey,
        }),
      });

      if (!res.data) {
        throw new Error('Failed to obtain spin outcome from server.');
      }

      setSpinResult(res.data);
      setStep('SPINNING');
    } catch (err: any) {
      setErrorMsg(err.message || 'Spin execution failed. Please alert staff.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Callback when wheel stops
  const handleSpinComplete = () => {
    // Fire confetti celebration
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6'],
      });
    } catch (e) {
      // Ignored if canvas-confetti is not supported
    }

    setStep('REWARD_MODAL');
  };

  // 4. Reset Kiosk for Next Customer
  const handleReset = () => {
    setFullName('');
    setPhoneNumber('');
    setErrorMsg('');
    setSession(null);
    setSpinResult(null);
    setStep('ENTRY');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur py-3 sm:py-4 px-4 sm:px-6 text-center shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="text-left">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-1.5 sm:px-2 py-0.5 rounded border border-amber-400/20">
              Pokhara, Nepal
            </span>
            <h1 className="text-lg sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 truncate max-w-[200px] xs:max-w-none">
              Pratikshya Kitchen Suppliers
            </h1>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 block sm:inline">Lucky Spin</span>
            <div className="text-[10px] sm:text-[11px] text-emerald-400 flex items-center gap-1.5 justify-end mt-0.5">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-ping" />
              Live
            </div>
          </div>
        </div>
      </header>

      {/* Main Kiosk Area */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 w-full max-w-full">
        <div className="w-full max-w-xl mx-auto">
          {/* STEP 1: CUSTOMER ENTRY FORM */}
          {step === 'ENTRY' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur space-y-5 sm:space-y-6">
              <div className="text-center space-y-1.5 sm:space-y-2">
                <h2 className="text-xl sm:text-3xl font-black text-white">
                  Welcome to the Lucky Spin!
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Enter your bill and phone details to unlock your spin.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs sm:text-sm font-medium flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleValidate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Customer Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ram Bahadur Thapa"
                    className="w-full px-4 py-3 text-base bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Nepal Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 9846012345"
                    className="w-full px-4 py-3 text-base bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">10 digits starting with 98 or 97.</p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-4 px-6 rounded-xl font-black text-base text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.99] transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Proceed to Spin →'}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2 & 3: WHEEL PRESENTATION & SPINNING */}
          {(step === 'READY_TO_SPIN' || step === 'SPINNING') && (
            <div className="text-center space-y-4 sm:space-y-6">
              {/* Customer Greeting Banner */}
              <div className="inline-flex items-center gap-2 sm:gap-3 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-800 shadow-md max-w-full">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs sm:text-sm font-semibold text-slate-300 truncate">
                  Player: <strong className="text-amber-300">{session?.customerName}</strong>
                </span>
              </div>

              {errorMsg && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs sm:text-sm font-medium">
                  {errorMsg}
                </div>
              )}

              {/* The 6-Segment Wheel */}
              <div className="py-1 sm:py-2 flex items-center justify-center">
                <SpinWheel
                  isSpinning={step === 'SPINNING'}
                  targetRewardNumber={spinResult?.rewardNumber || null}
                  onSpinComplete={handleSpinComplete}
                />
              </div>

              {/* Spin Trigger Button */}
              <div className="pt-2">
                <button
                  onClick={handleSpinNow}
                  disabled={step === 'SPINNING' || isLoading}
                  className={`w-full sm:w-auto py-4 sm:py-5 px-8 sm:px-12 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl tracking-wider uppercase transition-all transform ${
                    step === 'SPINNING'
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed scale-95'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(245,158,11,0.5)] animate-bounce'
                  }`}
                >
                  {step === 'SPINNING' ? 'Wheel Spinning...' : 'SPIN NOW! 🎯'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REWARD VOUCHER MODAL */}
          {step === 'REWARD_MODAL' && spinResult && session && (
            <VoucherModal
              rewardName={spinResult.rewardName}
              rewardTier={spinResult.rewardTier}
              rewardNumber={spinResult.rewardNumber}
              transactionReference={spinResult.transactionReference}
              customerName={session.customerName}
              onReset={handleReset}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 sm:py-4 text-center text-[10px] sm:text-xs text-slate-500 border-t border-slate-900 flex flex-col xs:flex-row items-center justify-between gap-2 px-4 sm:px-6 max-w-4xl mx-auto w-full">
        <span>Pratikshya Kitchen Suppliers © 2026 • Pokhara</span>
        <a
          href="/admin/login"
          className="text-slate-500 hover:text-amber-400 transition"
        >
          Staff & Admin Console →
        </a>
      </footer>
    </div>
  );
}
