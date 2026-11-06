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
  const [editingReward, setEditingReward] = useState<ProbabilityReward | null>(null);
  const [editRemainingQty, setEditRemainingQty] = useState('');
  const [editProbWeight, setEditProbWeight] = useState('');
  const [editTier, setEditTier] = useState<'COMMON' | 'PREMIUM'>('COMMON');
  const [editRewardName, setEditRewardName] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Embedded Quick Spin State for Counter Staff / Owners
  const [showCounterSpin, setShowCounterSpin] = useState(true);
  const [spinStep, setSpinStep] = useState<'FORM' | 'READY' | 'SPINNING' | 'WON'>('FORM');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [spinError, setSpinError] = useState('');
  const [spinLoading, setSpinLoading] = useState(false);
  const [verifiedCustomer, setVerifiedCustomer] = useState<{
    customerId: string;
    customerName: string;
    phoneNumber: string;
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

  // 2. Open Edit Modal for a Reward
  const openEditModal = (r: ProbabilityReward) => {
    setEditingReward(r);
    setEditRewardName(r.rewardName);
    setEditRemainingQty(String(r.remainingQuantity));
    setEditProbWeight(String(r.probabilityWeight));
    setEditTier(r.rewardTier);
  };

  // 3. Save Reward Edits
  const handleSaveRewardEdit = async () => {
    if (!editingReward) return;

    const remainingQty = parseInt(editRemainingQty, 10);
    const probWeight = parseFloat(editProbWeight);

    if (isNaN(remainingQty) || remainingQty < 0) {
      showToast('Remaining stock must be 0 or a positive number', 'error');
      return;
    }
    if (isNaN(probWeight) || probWeight <= 0) {
      showToast('Probability weight must be greater than 0', 'error');
      return;
    }

    setIsSavingEdit(true);
    try {
      await apiRequest(`/admin/rewards/${editingReward.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          rewardName: editRewardName.trim() || editingReward.rewardName,
          remainingQuantity: remainingQty,
          probabilityWeight: probWeight,
          rewardTier: editTier,
        }),
      });
      showToast(`Reward #${editingReward.rewardNumber} updated successfully!`);
      setEditingReward(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update reward', 'error');
    } finally {
      setIsSavingEdit(false);
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
        }),
      });

      if (!res.data || !res.data.eligible) {
        setSpinError(res.data?.reason || 'Customer is not eligible for spin.');
        return;
      }

      setVerifiedCustomer({
        customerId: res.data.customerId,
        customerName: res.data.customerName || customerName,
        phoneNumber: customerPhone,
      });
      setSpinStep('READY');
    } catch (err: any) {
      setSpinError(err.message || 'Verification failed.');
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

      if (!res.data) throw new Error('Could not fetch spin result');
      setQuickSpinResult(res.data);
      setSpinStep('SPINNING');
    } catch (err: any) {
      setSpinError(err.message || 'Spin execution failed');
    } finally {
      setSpinLoading(false);
    }
  };

  const handleQuickSpinComplete = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6'],
      });
    } catch (e) {}
    setSpinStep('WON');
    loadData(); // refresh counts and spin list immediately
  };

  const resetQuickSpin = () => {
    setCustomerName('');
    setCustomerPhone('');
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
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30">
              🎡
            </span>
            <div>
              <div className="inline-flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Counter Lucky Spin
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Ready
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                Enter phone number to spin the wheel for the customer right here.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCounterSpin(!showCounterSpin)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition"
            >
              {showCounterSpin ? 'Hide Wheel ▲' : 'Show Wheel ▼'}
            </button>
          </div>
        </div>

        {showCounterSpin && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
            {/* LEFT: THE ANIMATED WHEEL */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center space-y-4">
              <SpinWheel
                isSpinning={spinStep === 'SPINNING'}
                targetRewardNumber={quickSpinResult?.rewardNumber || null}
                onSpinComplete={handleQuickSpinComplete}
              />

              {spinStep === 'SPINNING' && (
                <div className="text-center font-bold text-amber-400 text-sm animate-pulse">
                  Wheel is spinning...
                </div>
              )}

              {spinStep === 'READY' && (
                <button
                  onClick={handleTriggerQuickSpin}
                  disabled={spinLoading}
                  className="w-full sm:w-auto px-12 py-5 rounded-2xl font-black text-xl uppercase tracking-wider text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:scale-105 active:scale-95 shadow-[0_0_35px_rgba(245,158,11,0.6)] animate-bounce transition cursor-pointer"
                >
                  SPIN NOW! 🎯
                </button>
              )}
            </div>

            {/* RIGHT: SIMPLE CUSTOMER INPUT & RESULT PANEL */}
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
                      Customer Details
                    </span>
                    <p className="text-xs text-slate-400">
                      Enter mobile number to unlock customer's spin.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Ram Shrestha"
                      className="w-full px-4 py-3 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="98XXXXXXXX or 97XXXXXXXX (10 digits)"
                      className="w-full px-4 py-3 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={spinLoading}
                    className="w-full py-4 px-6 rounded-xl font-black text-base text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.99] transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {spinLoading ? 'Checking...' : 'Unlock Spin →'}
                  </button>
                </form>
              )}

              {(spinStep === 'READY' || spinStep === 'SPINNING') && verifiedCustomer && (
                <div className="space-y-5 text-center sm:text-left">
                  <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400">
                      ✓ Verified Customer
                    </div>
                    <h4 className="text-xl font-black text-white">
                      {verifiedCustomer.customerName}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Phone: <strong className="text-amber-300">{verifiedCustomer.phoneNumber}</strong>
                    </p>
                  </div>

                  <p className="text-sm text-slate-300">
                    Ready to spin! Click the <strong>"SPIN NOW!"</strong> button on the wheel.
                  </p>

                  <button
                    onClick={resetQuickSpin}
                    disabled={spinStep === 'SPINNING'}
                    className="text-xs text-slate-400 hover:text-slate-200 underline"
                  >
                    ← Cancel / Change Customer
                  </button>
                </div>
              )}

              {spinStep === 'WON' && quickSpinResult && verifiedCustomer && (
                <div className="space-y-4 text-center">
                  <div className="p-2 inline-block rounded-full bg-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider">
                    🎉 Congratulations! Reward Won!
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-900 border-2 border-amber-500/50 space-y-2">
                    <span
                      className={`inline-block px-3 py-0.5 rounded text-xs font-black uppercase ${
                        quickSpinResult.rewardTier === 'PREMIUM'
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {quickSpinResult.rewardTier} REWARD #{quickSpinResult.rewardNumber}
                    </span>
                    <h3 className="text-2xl font-black text-amber-300">
                      {quickSpinResult.rewardName}
                    </h3>
                    <div className="text-xs text-slate-400 pt-1">
                      Code: <strong className="text-white font-mono text-lg tracking-widest">{quickSpinResult.transactionReference}</strong>
                    </div>
                  </div>

                  <button
                    onClick={resetQuickSpin}
                    className="w-full py-4 px-6 rounded-xl font-black text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    Next Customer Spin 🔄
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
                <th className="py-3 px-4 text-right">Actions</th>
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
                    <button
                      onClick={() => openEditModal(r)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer"
                    >
                      <span>⚙️</span>
                      <span>Edit</span>
                    </button>
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
                <th className="py-3 px-4">Reward Won</th>
                <th className="py-3 px-4">Spin Time (NPT)</th>
                <th className="py-3 px-4">Claim Status</th>
                <th className="py-3 px-4 text-right">Counter Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {spins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
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

      {/* FULL REWARD EDIT MODAL */}
      {editingReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>⚙️ Edit Reward #{editingReward.rewardNumber}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      editTier === 'PREMIUM'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}
                  >
                    {editTier}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Update stock, probability weight, tier, or name.
                </p>
              </div>
              <button
                onClick={() => setEditingReward(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Gift Label / Secret Item Name
                </label>
                <input
                  type="text"
                  value={editRewardName}
                  onChange={(e) => setEditRewardName(e.target.value)}
                  placeholder="e.g. Surprise Gift Box #1"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Remaining Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editRemainingQty}
                    onChange={(e) => setEditRemainingQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">0 = Exhausted</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Base Weight
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editProbWeight}
                    onChange={(e) => setEditProbWeight(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Relative win chance</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Tier Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditTier('COMMON')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase border transition ${
                      editTier === 'COMMON'
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Common Tier
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTier('PREMIUM')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase border transition ${
                      editTier === 'PREMIUM'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Premium Tier
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingReward(null)}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveRewardEdit}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

