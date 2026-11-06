'use client';

import React from 'react';

interface VoucherModalProps {
  rewardName: string;
  rewardTier: 'COMMON' | 'PREMIUM';
  rewardNumber: number;
  transactionReference: string;
  customerName: string;
  invoiceReference: string;
  onReset: () => void;
}

export default function VoucherModal({
  rewardName,
  rewardTier,
  rewardNumber,
  transactionReference,
  customerName,
  invoiceReference,
  onReset,
}: VoucherModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-sm sm:max-w-md bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 border border-amber-500/50 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.3)] text-center text-white space-y-4 sm:space-y-6 my-auto">
        {/* Celebration Header */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30">
            🎉 Congratulations!
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-500 truncate">
            {customerName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Invoice: <span className="text-slate-200 font-semibold">{invoiceReference}</span>
          </p>
        </div>

        {/* Won Gift Card */}
        <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-inner space-y-2 sm:space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`px-2 sm:px-2.5 py-0.5 rounded text-[10px] sm:text-xs font-black tracking-wider uppercase ${
                rewardTier === 'PREMIUM'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-blue-600/80 text-white'
              }`}
            >
              {rewardTier} REWARD #{rewardNumber}
            </span>
          </div>

          <h3 className="text-lg sm:text-2xl font-black text-amber-300">
            {rewardName}
          </h3>
        </div>

        {/* Claim Voucher Box */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-1">
          <p className="text-[10px] sm:text-xs font-medium text-amber-300 uppercase tracking-wider">
            Unique Verification Code
          </p>
          <div className="font-mono text-xl sm:text-3xl font-black tracking-widest text-white selection:bg-amber-500 break-all">
            {transactionReference}
          </div>
          <p className="text-[10px] sm:text-[11px] text-amber-200/70 pt-1">
            Show this code at the billing counter to collect your reward.
          </p>
        </div>

        {/* Reset Action */}
        <button
          onClick={onReset}
          className="w-full py-3 sm:py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20"
        >
          Done / Next Customer
        </button>
      </div>
    </div>
  );
}

