'use client';

import React, { useState, useEffect } from 'react';

export interface RewardSegment {
  rewardNumber: number;
  name: string;
  tier: 'COMMON' | 'PREMIUM';
  color: string;
  accent: string;
}

export const SEGMENTS: RewardSegment[] = [
  { rewardNumber: 1, name: 'Peeler & Knife Set', tier: 'COMMON', color: '#1e3a8a', accent: '#3b82f6' }, // Blue
  { rewardNumber: 2, name: 'Induction Cooktop', tier: 'PREMIUM', color: '#b45309', accent: '#f59e0b' }, // Amber/Gold
  { rewardNumber: 3, name: 'Prestige Cooker 5L', tier: 'PREMIUM', color: '#047857', accent: '#10b981' }, // Emerald
  { rewardNumber: 4, name: 'Non-Stick Fry Pan', tier: 'PREMIUM', color: '#b91c1c', accent: '#ef4444' }, // Crimson
  { rewardNumber: 5, name: 'Spice Rack Set', tier: 'COMMON', color: '#4338ca', accent: '#6366f1' },    // Indigo
  { rewardNumber: 6, name: 'Cutlery Set 6pc', tier: 'COMMON', color: '#0f766e', accent: '#14b8a6' },    // Teal
];

interface SpinWheelProps {
  isSpinning: boolean;
  targetRewardNumber: number | null;
  onSpinComplete: () => void;
}

export default function SpinWheel({
  isSpinning,
  targetRewardNumber,
  onSpinComplete,
}: SpinWheelProps) {
  const [currentRotation, setCurrentRotation] = useState(0);

  // Wheel geometry: 6 segments of 60 deg each
  // With pointer at TOP (270 deg / -90 deg):
  // Segment i center angle relative to wheel = (i - 1) * 60 + 30
  // When wheel rotates by R deg clockwise, an angle theta moves to (theta + R) mod 360.
  // For segment i center to align with top pointer (270 deg):
  // ( (i - 1)*60 + 30 + R ) = 270 (mod 360) => R = 270 - ( (i - 1)*60 + 30 ) = 240 - (i - 1)*60
  useEffect(() => {
    if (isSpinning && targetRewardNumber !== null) {
      const segmentIndex = targetRewardNumber - 1; // 0 to 5
      const segmentCenter = segmentIndex * 60 + 30;
      
      // Top pointer is at 270 deg
      const targetAngleAtPointer = (270 - segmentCenter + 360) % 360;

      // Add minimum 6 full rotations (2160 deg) plus natural random jitter within +/- 14 degrees
      const randomJitter = (Math.random() - 0.5) * 28;
      const fullSpins = 6 * 360;
      
      // Calculate next absolute rotation keeping forward momentum
      const currentFullRounds = Math.floor(currentRotation / 360);
      const nextRotation = (currentFullRounds + 6) * 360 + targetAngleAtPointer + randomJitter;

      setCurrentRotation(nextRotation);

      const timer = setTimeout(() => {
        onSpinComplete();
      }, 5500);

      return () => clearTimeout(timer);
    }
  }, [isSpinning, targetRewardNumber]);

  return (
    <div className="relative w-[280px] h-[280px] xs:w-72 xs:h-72 sm:w-88 sm:h-88 md:w-[420px] md:h-[420px] max-w-[90vw] max-h-[90vw] mx-auto select-none aspect-square">
      {/* Outer Glow Ring */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 blur-xl opacity-30 animate-pulse pointer-events-none" />

      {/* Top Fixed Needle Pointer */}
      <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 z-30 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
        <svg className="w-9 h-10 sm:w-11 sm:h-12" viewBox="0 0 44 48" fill="none">
          <path
            d="M22 48L11 12C9 6 13 0 20 0H24C31 0 35 6 33 12L22 48Z"
            fill="url(#pointer-gradient)"
            stroke="#fbbf24"
            strokeWidth="2"
          />
          <circle cx="22" cy="14" r="5" fill="#fef08a" />
          <defs>
            <linearGradient id="pointer-gradient" x1="22" y1="0" x2="22" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f59e0b" />
              <stop offset="0.6" stopColor="#dc2626" />
              <stop offset="1" stopColor="#7f1d1d" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Rotating Wheel Container */}
      <div
        className="w-full h-full rounded-full border-4 sm:border-8 border-amber-500/80 shadow-[0_0_30px_rgba(245,158,11,0.4)] sm:shadow-[0_0_40px_rgba(245,158,11,0.4)] overflow-hidden"
        style={{
          transform: `rotate(${currentRotation}deg)`,
          transition: isSpinning
            ? 'transform 5.5s cubic-bezier(0.15, 0.9, 0.2, 1.0)'
            : 'none',
        }}
      >
        <svg
          viewBox="0 0 400 400"
          className="w-full h-full transform -rotate-90 origin-center"
        >
          {SEGMENTS.map((seg, i) => {
            const startAngle = (i * 60 * Math.PI) / 180;
            const endAngle = ((i + 1) * 60 * Math.PI) / 180;
            const x1 = 200 + 200 * Math.cos(startAngle);
            const y1 = 200 + 200 * Math.sin(startAngle);
            const x2 = 200 + 200 * Math.cos(endAngle);
            const y2 = 200 + 200 * Math.sin(endAngle);

            const pathData = `M 200 200 L ${x1} ${y1} A 200 200 0 0 1 ${x2} ${y2} Z`;

            // Text rotation angle (in center of slice: i*60 + 30 deg)
            const textAngle = i * 60 + 30;

            return (
              <g key={seg.rewardNumber}>
                {/* Segment Slice */}
                <path
                  d={pathData}
                  fill={seg.color}
                  stroke="#1e293b"
                  strokeWidth="2"
                />

                {/* Segment Label (Rotated outward from center) */}
                <g
                  transform={`translate(200, 200) rotate(${textAngle}) translate(110, 0)`}
                >
                  <text
                    x="0"
                    y="-4"
                    fill="#ffffff"
                    fontSize="15"
                    fontWeight="900"
                    textAnchor="middle"
                    className="tracking-wider uppercase"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                  >
                    {`#${seg.rewardNumber}`}
                  </text>
                  <text
                    x="0"
                    y="12"
                    fill={seg.tier === 'PREMIUM' ? '#fde047' : '#93c5fd'}
                    fontSize="10"
                    fontWeight="800"
                    textAnchor="middle"
                    className="tracking-widest uppercase"
                  >
                    🎁 SURPRISE
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Central Hub Plate */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 border-2 sm:border-4 border-slate-900 shadow-2xl flex items-center justify-center pointer-events-none z-20">
        <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-slate-900 flex items-center justify-center border border-amber-400">
          <span className="text-amber-400 text-[10px] sm:text-xs font-black tracking-tighter">PKS</span>
        </div>
      </div>
    </div>
  );
}

