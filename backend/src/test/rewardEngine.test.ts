import { describe, it, expect } from 'vitest';
import {
  RewardItem,
  calculateEffectiveWeights,
  selectWinningReward,
  OutOfStockError,
} from '../services/rewardEngine.js';

describe('Intelligent Reward Engine', () => {
  const sampleRewards: RewardItem[] = [
    {
      id: 'r1',
      reward_number: 1,
      reward_name: 'Kitchen Peeler',
      reward_tier: 'COMMON',
      reward_value: 150,
      initial_quantity: 100,
      remaining_quantity: 100,
      distributed_quantity: 0,
      probability_weight: 30,
      use_stock_scaling: true,
      is_active: true,
    },
    {
      id: 'r2',
      reward_number: 2,
      reward_name: 'Induction Cooktop',
      reward_tier: 'PREMIUM',
      reward_value: 4500,
      initial_quantity: 3,
      remaining_quantity: 3,
      distributed_quantity: 0,
      probability_weight: 1.5,
      use_stock_scaling: true,
      is_active: true,
    },
    {
      id: 'r3',
      reward_number: 3,
      reward_name: 'Pressure Cooker',
      reward_tier: 'PREMIUM',
      reward_value: 3200,
      initial_quantity: 5,
      remaining_quantity: 0, // Depleted!
      distributed_quantity: 5,
      probability_weight: 2.5,
      use_stock_scaling: true,
      is_active: true,
    },
  ];

  it('calculates zero effective weight and probability for depleted items', () => {
    const weights = calculateEffectiveWeights(sampleRewards);
    const r3Meta = weights.get('r3')!;

    expect(r3Meta.effectiveWeight).toBe(0);
    expect(r3Meta.probabilityPercent).toBe(0);
    expect(r3Meta.stockAvailabilityFactor).toBe(0);
  });

  it('never selects zero-stock rewards', () => {
    for (let i = 0; i < 50; i++) {
      const result = selectWinningReward(sampleRewards);
      expect(result.winner.reward_number).not.toBe(3);
      expect(result.winner.remaining_quantity).toBeGreaterThan(0);
    }
  });

  it('throws OutOfStockError when all rewards are exhausted', () => {
    const exhausted: RewardItem[] = sampleRewards.map((r) => ({
      ...r,
      remaining_quantity: 0,
    }));

    expect(() => selectWinningReward(exhausted)).toThrow(OutOfStockError);
  });
});
