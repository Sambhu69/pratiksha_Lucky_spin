'use client';

import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { apiRequest } from '@/lib/api';
import SpinWheel from '@/components/SpinWheel';
import VoucherModal from '@/components/VoucherModal';

interface Metrics {
  campaignId: string;
  campaignName: string;
  campaignStatus: 'ACTIVE' | 'PAUSED' | 'CLOSED';
  totalRegistered: number;
  totalSpins: number;
  totalGiftsRemaining: number;
  commonDistributed: number;
  premiumDistributed: number;
  unclaimedSpinsCount: number;
}

interface ProbabilityReward {
  id: string;
  rewardNumber: number;
  rewardName: string;
  rewardTier: 'COMMON' | 'PREMIUM';
  remainingQuantity: number;
  initialQuantity: number;
  distributedQuantity: number;
  probabilityWeight: number;
  effectiveWeight: number;
  currentWinPercentage: number;
  isActive: boolean;
  isExhausted: boolean;
}

interface SpinRecord {
  id: string;
  unique_transaction_reference: string;
  spin_timestamp: string;
  claim_status: 'UNCLAIMED' | 'CLAIMED';
  claim_timestamp?: string;
  customer_name: string;
  phone_number: string;
  invoice_reference: string;
  reward_number: number;
  reward_name: string;
  reward_tier: 'COMMON' | 'PREMIUM';
  verified_by_admin?: string;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [rewards, setRewards] = useState<ProbabilityReward[]>([]);
  const [spins, setSpins] = useState<SpinRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [claimLoadingId, setClaimLoadingId] = useState<string | null>(null);
  const [addQtyRewardId, setAddQtyRewardId] = useState<string | null>(null);
  const [addQtyValue, setAddQtyValue] = useState('10');
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Embedded Quick Spin State for Counter Staff / Owners
  const [showCounterSpin, setShowCounterSpin] = useState(true);
  const [spinStep, setSpinStep] = useState<'FORM' | 'READY' | 'SPINNING' | 'WON'>('FORM');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerInvoice, setCustomerInvoice] = useState('');
  const [spinError, setSpinError] = useState('');
  const [spinLoading, setSpinLoading] = useState(false);
  const [verifiedCustomer, setVerifiedCustomer] = useState<{
    customerId: string;
    customerName: string;
    invoice: string;
  } | null>(null);
  const [quickSpinResult, setQuickSpinResult] = useState<{
    rewardNumber: number;
    rewardName: string;
    rewardTier: 'COMMON' | 'PREMIUM';
    transactionReference: string;
  } | null>(null);

  // Auto-refresh interval
  const loadData = async () => {
    try {
      const [mRes, pRes, sRes] = await Promise.all([
        apiRequest<Metrics>('/admin/metrics'),
        apiRequest<{ rewards: ProbabilityReward[] }>('/admin/probability-table'),
        apiRequest<{ spins: SpinRecord[] }>(
          `/admin/spins?search=${encodeURIComponent(searchTerm)}&status=${statusFilter}`
        ),
      ]);

      if (mRes.data) setMetrics(mRes.data);
      if (pRes.data) setRewards(pRes.data.rewards);
      if (sRes.data) setSpins(sRes.data.spins);
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 5-second polling
    return () => clearInterval(interval);
  }, [searchTerm, statusFilter]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // 1. Claim Reward Action
  const handleClaim = async (spinId: string) => {
    setClaimLoadingId(spinId);
    try {
      await apiRequest(`/admin/spins/${spinId}/claim`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      showToast('Reward claimed and handed over successfully!');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to claim reward', 'error');
    } finally {
      setClaimLoadingId(null);
    }
  };

  // 2. Add Stock to Reward
  const handleAddStock = async (rewardId: string) => {
    const qty = parseInt(addQtyValue, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid positive number', 'error');
      return;
    }

    try {
      await apiRequest(`/admin/rewards/${rewardId}/inventory`, {
        method: 'PATCH',
        body: JSON.stringify({ quantityChange: qty }),
      });
      showToast(`Added ${qty} units to inventory!`);
      setAddQtyRewardId(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to add stock', 'error');
    }
  };

  // 3. Update Campaign Status
  const handleUpdateStatus = async (status: 'ACTIVE' | 'PAUSED' | 'CLOSED') => {
    try {
      await apiRequest('/admin/campaign/status', {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast(`Campaign status changed to ${status}`);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update campaign status', 'error');
    }
  };

  // 4. Quick Spin Verification (Counter / Admin)
  const handleQuickVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpinError('');
    setSpinLoading(true);

    try {
      const res = await apiRequest<{
        eligible: boolean;
        reason?: string;
        customerId: string;
        customerName: string;
      }>('/kiosk/validate', {
        method: 'POST',
        body: JSON.stringify({
          fullName: customerName,
          phoneNumber: customerPhone,
          invoiceReference: customerInvoice,
        }),
      });

      if (!res.data || !res.data.eligible) {
        setSpinError(res.data?.reason || 'ग्राहक योग्य छैन (Not eligible).');
        return;
      }

      setVerifiedCustomer({
        customerId: res.data.customerId,
        customerName: res.data.customerName || customerName,
        invoice: customerInvoice.toUpperCase(),
      });
      setSpinStep('READY');
    } catch (err: any) {
      setSpinError(err.message || 'जाँच असफल भयो (Verification failed).');
    } finally {
      setSpinLoading(false);
    }
  };

  // 5. Trigger Quick Spin Now
  const handleTriggerQuickSpin = async () => {
    if (!verifiedCustomer || spinStep === 'SPINNING') return;
    setSpinError('');
    setSpinLoading(true);

    try {
      const idempotencyKey = `counter-${verifiedCustomer.customerId}-${Date.now()}`;
      const res = await apiRequest<{
        rewardNumber: number;
        rewardName: string;
        rewardTier: 'COMMON' | 'PREMIUM';
        transactionReference: string;
      }>('/spins/execute', {
        method: 'POST',
        body: JSON.stringify({
          customerId: verifiedCustomer.customerId,
          idempotencyKey,
        }),
      });

      if (!res.data) throw new Error('उपहार पाउन सकिएन');
      setQuickSpinResult(res.data);
      setSpinStep('SPINNING');
    } catch (err: any) {
      setSpinError(err.message || 'स्पिन असफल भयो');
    } finally {
      setSpinLoading(false);
    }
  };

  const handleQuickSpinComplete = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {}
    setSpinStep('WON');
    loadData(); // refresh counts and spin list immediately
  };

  const resetQuickSpin = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerInvoice('');
    setVerifiedCustomer(null);
    setQuickSpinResult(null);
    setSpinError('');
    setSpinStep('FORM');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold border ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50'
              : 'bg-red-950/90 text-red-200 border-red-500/50'
          }`}
        >
          {toastMsg.text}
        </div>
      )}

      {/* Campaign Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
            Campaign Control
          </span>
          <h2 className="text-lg sm:text-xl font-black text-white flex flex-wrap items-center gap-2 mt-0.5">
            {metrics?.campaignName || 'Grand Promotional Lucky Spin'}
            <span
              className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-black uppercase tracking-wider ${
                metrics?.campaignStatus === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : metrics?.campaignStatus === 'PAUSED'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              ● {metrics?.campaignStatus || 'ACTIVE'}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {metrics?.campaignStatus !== 'ACTIVE' && (
            <button
              onClick={() => handleUpdateStatus('ACTIVE')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition text-center"
            >
              Resume (ACTIVE)
            </button>
          )}
          {metrics?.campaignStatus === 'ACTIVE' && (
            <button
              onClick={() => handleUpdateStatus('PAUSED')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition text-center"
            >
              Pause Event
            </button>
          )}
          {metrics?.campaignStatus !== 'CLOSED' && (
            <button
              onClick={() => handleUpdateStatus('CLOSED')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-xs font-bold text-white transition text-center"
            >
              Close Campaign
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🎡 PROMINENT EMBEDDED LUCKY SPIN WHEEL DESK (FOR OWNERS & STAFF)         */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 border-2 border-amber-500/70 rounded-3xl p-5 sm:p-8 shadow-[0_0_40px_rgba(245,158,11,0.25)] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl sm:text-2xl shadow-lg shadow-amber-500/30">
              🎡
            </span>
            <div>
              <div className="inline-flex items-center gap-2">
                <h3 className="text-lg sm:text-2xl font-black text-white">
                  लक्की स्पिन काउन्टर (Counter Lucky Spin Wheel)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  काउन्टर डेस्क
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                ग्राहकको बिल र फोन नम्बर हानेर यहिँबाट तुरुन्तै स्पिन घुमाउनुहोस्। (Spin right here from this counter!)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCounterSpin(!showCounterSpin)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition"
            >
              {showCounterSpin ? 'लुकाउनुहोस् (Hide Wheel) ▲' : 'ह्वील देखाउनुहोस् (Show Wheel) ▼'}
            </button>
          </div>
        </div>

        {showCounterSpin && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
            {/* LEFT / CENTER: THE ANIMATED WHEEL */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center space-y-4">
              <SpinWheel
                isSpinning={spinStep === 'SPINNING'}
                targetRewardNumber={quickSpinResult?.rewardNumber || null}
                onSpinComplete={handleQuickSpinComplete}
              />

              {spinStep === 'SPINNING' && (
                <div className="text-center font-bold text-amber-400 text-sm animate-pulse">
                  ह्वील घुम्दैछ, कृपया प्रतिक्षा गर्नुहोस्... (Wheel is spinning...)
                </div>
              )}

              {spinStep === 'READY' && (
                <button
                  onClick={handleTriggerQuickSpin}
                  disabled={spinLoading}
                  className="w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-lg sm:text-xl uppercase tracking-wider text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(245,158,11,0.5)] animate-bounce transition"
                >
                  🎯 स्पिन घुमाउनुहोस् (SPIN NOW!)
                </button>
              )}
            </div>

            {/* RIGHT: CUSTOMER INPUT & RESULT PANEL */}
            <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-inner space-y-4">
              {spinError && (
                <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{spinError}</span>
                </div>
              )}

              {spinStep === 'FORM' && (
                <form onSubmit={handleQuickVerify} className="space-y-4">
                  <div className="border-b border-slate-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                      चरण १: ग्राहक विवरण (Step 1: Customer Info)
                    </span>
                    <p className="text-xs text-slate-400">
                      स्पिन गर्नको लागि ग्राहकको बिल र मोबाइल नम्बर भर्नुहोस्।
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      ग्राहकको नाम (Customer Full Name)
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. राम बहादुर थापा"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      नेपाल मोबाइल नम्बर (Nepal Mobile Number)
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 9846012345 (10 अङ्क)"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      बिल / इनभ्वाइस नम्बर (Shop Bill Number)
                    </label>
                    <input
                      type="text"
                      required
                      value={customerInvoice}
                      onChange={(e) => setCustomerInvoice(e.target.value)}
                      placeholder="e.g. INV-1049"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 uppercase focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={spinLoading}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.99] transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    {spinLoading ? 'जाँच हुँदैछ (Checking)...' : 'बिल प्रमाणित गर्नुहोस् (Verify & Unlock Spin) →'}
                  </button>
                </form>
              )}

              {(spinStep === 'READY' || spinStep === 'SPINNING') && verifiedCustomer && (
                <div className="space-y-5 text-center sm:text-left">
                  <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400">
                      ✓ ग्राहक प्रमाणित भयो (Verified)
                    </div>
                    <h4 className="text-lg font-black text-white">
                      {verifiedCustomer.customerName}
                    </h4>
                    <p className="text-xs text-slate-400">
                      बिल नम्बर: <strong className="text-amber-300">{verifiedCustomer.invoice}</strong>
                    </p>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300">
                    ग्राहक तयार हुनुहुन्छ! बायाँ पट्टिको <strong>"🎯 स्पिन घुमाउनुहोस्"</strong> बटन थिच्नुहोस्।
                  </p>

                  <button
                    onClick={resetQuickSpin}
                    disabled={spinStep === 'SPINNING'}
                    className="text-xs text-slate-400 hover:text-slate-200 underline"
                  >
                    ← अर्को ग्राहक / रद्द गर्नुहोस् (Cancel / Reset)
                  </button>
                </div>
              )}

              {spinStep === 'WON' && quickSpinResult && verifiedCustomer && (
                <div className="space-y-4 text-center">
                  <div className="p-2 inline-block rounded-full bg-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider">
                    🎉 बधाई छ! उपहार जित्नुभयो!
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border-2 border-amber-500/50 space-y-2">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                        quickSpinResult.rewardTier === 'PREMIUM'
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {quickSpinResult.rewardTier} उपहार #{quickSpinResult.rewardNumber}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-amber-300">
                      {quickSpinResult.rewardName}
                    </h3>
                    <div className="text-xs text-slate-400 pt-1">
                      कोड: <strong className="text-white font-mono text-base tracking-widest">{quickSpinResult.transactionReference}</strong>
                    </div>
                  </div>

                  <button
                    onClick={resetQuickSpin}
                    className="w-full py-3.5 px-6 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition shadow-lg shadow-amber-500/20"
                  >
                    अर्को ग्राहकको लागि नयाँ स्पिन (Next Spin) 🔄
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Customers
          </p>
          <p className="text-2xl sm:text-3xl font-black text-white mt-1">
            {metrics?.totalRegistered ?? 0}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Verified</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Spins Executed
          </p>
          <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
            {metrics?.totalSpins ?? 0}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
            C: {metrics?.commonDistributed ?? 0} | P: {metrics?.premiumDistributed ?? 0}
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Unclaimed Gifts
          </p>
          <p className="text-2xl sm:text-3xl font-black text-orange-400 mt-1">
            {metrics?.unclaimedSpinsCount ?? 0}
          </p>
          <p className="text-[10px] sm:text-[11px] text-orange-400/70 mt-0.5">Awaiting handover</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Stock Left
          </p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
            {metrics?.totalGiftsRemaining ?? 0}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Gifts remaining</p>
        </div>
      </div>

      {/* LIVE PROBABILITY TRANSPARENCY TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">
              Wheel Segments & Dynamic Probability Table
            </h3>
            <p className="text-xs text-slate-400">
              Live probabilities recalculate dynamically based on remaining stock.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300 min-w-[600px]">
            <thead className="bg-slate-950/60 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Segment #</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Gift Name</th>
                <th className="py-3 px-4">Stock (Left / Initial)</th>
                <th className="py-3 px-4">Base Weight</th>
                <th className="py-3 px-4">Current Win %</th>
                <th className="py-3 px-4 text-right">Quick Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rewards.map((r) => (
                <tr
                  key={r.id}
                  className={`hover:bg-slate-800/40 transition ${
                    r.isExhausted ? 'opacity-60 bg-red-950/20' : ''
                  }`}
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-white">
                    Reward {r.rewardNumber}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        r.rewardTier === 'PREMIUM'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {r.rewardTier}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-white">
                    {r.rewardName}
                    {r.isExhausted && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white uppercase">
                        Exhausted
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    <span className="font-bold text-white">{r.remainingQuantity}</span>
                    <span className="text-slate-500"> / {r.initialQuantity}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {r.probabilityWeight}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${Math.min(100, r.currentWinPercentage)}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-amber-300 text-xs">
                        {r.currentWinPercentage.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {addQtyRewardId === r.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          value={addQtyValue}
                          onChange={(e) => setAddQtyValue(e.target.value)}
                          className="w-16 px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-white"
                        />
                        <button
                          onClick={() => handleAddStock(r.id)}
                          className="px-2 py-1 bg-emerald-600 text-[11px] font-bold rounded text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setAddQtyRewardId(null)}
                          className="px-1.5 py-1 text-slate-400 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddQtyRewardId(r.id);
                          setAddQtyValue('10');
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                      >
                        + Add Stock
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PHYSICAL GIFT CLAIM DESK & RECENT SPINS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">
              Counter Voucher Claim & Handover Desk
            </h3>
            <p className="text-xs text-slate-400">
              Verify customer vouchers and confirm gift handovers.
            </p>
          </div>

          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 sm:gap-3">
            <input
              type="text"
              placeholder="Search code, phone, invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 w-full xs:w-60 focus:outline-none focus:border-amber-400"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-300 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="UNCLAIMED">Unclaimed Only</option>
              <option value="CLAIMED">Claimed Only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300 min-w-[700px]">
            <thead className="bg-slate-950/60 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Verification Code</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Reward Won</th>
                <th className="py-3 px-4">Spin Time (NPT)</th>
                <th className="py-3 px-4">Claim Status</th>
                <th className="py-3 px-4 text-right">Counter Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {spins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    No matching spin records found.
                  </td>
                </tr>
              ) : (
                spins.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                      {s.unique_transaction_reference}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{s.customer_name}</div>
                      <div className="text-[11px] text-slate-500">{s.phone_number}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      {s.invoice_reference}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{s.reward_name}</div>
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                          s.reward_tier === 'PREMIUM'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {s.reward_tier}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-400">
                      {new Date(s.spin_timestamp).toLocaleTimeString('en-US', {
                        timeZone: 'Asia/Kathmandu',
                        hour12: false,
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          s.claim_status === 'CLAIMED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse'
                        }`}
                      >
                        {s.claim_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {s.claim_status === 'UNCLAIMED' ? (
                        <button
                          onClick={() => handleClaim(s.id)}
                          disabled={claimLoadingId === s.id}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition active:scale-95 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                        >
                          {claimLoadingId === s.id ? 'Verifying...' : 'Hand Over Gift ✓'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          Claimed {s.verified_by_admin ? `by ${s.verified_by_admin}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

