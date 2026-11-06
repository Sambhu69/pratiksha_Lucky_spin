import crypto from 'crypto';

export interface RewardItem {
  id: string;
  reward_number: number;
  reward_name: string;
  reward_tier: 'COMMON' | 'PREMIUM';
  reward_value: number | string;
  initial_quantity: number;
  remaining_quantity: number;
  distributed_quantity: number;
  probability_weight: number | string;
  use_stock_scaling: boolean;
  is_active: boolean;
}

export interface CalculatedWeightMeta {
  rewardId: string;
  rewardNumber: number;
  rewardName: string;
  tier: 'COMMON' | 'PREMIUM';
  initialQuantity: number;
  remainingQuantity: number;
  baseWeight: number;
  stockAvailabilityFactor: number;
  effectiveWeight: number;
  probabilityPercent: number;
}

export class OutOfStockError extends Error {
  constructor(message = 'All rewards are out of stock or inactive for this campaign.') {
    super(message);
    this.name = 'OutOfStockError';
  }
}

/**
 * Calculates effective dynamic weights and selection probabilities for rewards.
 * 
 * Formula:
 * Availability Factor F_i = (R_i > 0 && A_i) ? (use_stock_scaling ? (R_i / I_i) : 1) : 0
 * Effective Weight E_i = Base Weight W_i * F_i
 * Probability P_i = (E_i / Sum(E_k)) * 100%
 */
export function calculateEffectiveWeights(
  rewards: RewardItem[]
): Map<string, CalculatedWeightMeta> {
  const metaMap = new Map<string, CalculatedWeightMeta>();
  let totalEffectiveWeight = 0;

  for (const reward of rewards) {
    const baseWeight = Number(reward.probability_weight) || 0;
    const initialQty = Number(reward.initial_quantity) || 0;
    const remainingQty = Number(reward.remaining_quantity) || 0;
    const isActive = Boolean(reward.is_active);

    let factor = 0;
    if (remainingQty > 0 && isActive) {
      if (reward.use_stock_scaling && initialQty > 0) {
        factor = remainingQty / initialQty;
      } else {
        factor = 1.0;
      }
    }

    const effectiveWeight = baseWeight * factor;
    totalEffectiveWeight += effectiveWeight;

    metaMap.set(reward.id, {
      rewardId: reward.id,
      rewardNumber: reward.reward_number,
      rewardName: reward.reward_name,
      tier: reward.reward_tier,
      initialQuantity: initialQty,
      remainingQuantity: remainingQty,
      baseWeight,
      stockAvailabilityFactor: factor,
      effectiveWeight,
      probabilityPercent: 0, // Computed in next pass
    });
  }

  // Calculate actual probabilities
  for (const meta of metaMap.values()) {
    meta.probabilityPercent =
      totalEffectiveWeight > 0
        ? (meta.effectiveWeight / totalEffectiveWeight) * 100
        : 0;
  }

  return metaMap;
}

/**
 * Decoupled Cryptographically Secure Pseudo-Random Number Generator (CSPRNG)
 * Produces a high-precision float in [0, 1) using 53 bits of cryptographic entropy.
 */
export function secureRandomFloat(): number {
  const buffer = crypto.randomBytes(8);
  // Read a 64-bit unsigned integer (as BigInt)
  const bigInt = buffer.readBigUInt64BE(0);
  // Shift right by 11 bits to get 53 bits (standard IEEE 754 float precision limit)
  const floatBits = Number(bigInt >> 11n);
  // 2^53 = 9007199254740992
  return floatBits / 9007199254740992;
}

export interface SelectionResult {
  winner: RewardItem;
  meta: CalculatedWeightMeta;
  randomRoll: number;
  totalEffectiveWeight: number;
}

/**
 * Pure CSPRNG Weighted Reward Selection.
 * Order-independent, zero-stock immune.
 */
export function selectWinningReward(
  rewards: RewardItem[],
  customRoll?: number
): SelectionResult {
  const metaMap = calculateEffectiveWeights(rewards);

  // Compute total effective weight
  let totalEffectiveWeight = 0;
  for (const meta of metaMap.values()) {
    totalEffectiveWeight += meta.effectiveWeight;
  }

  if (totalEffectiveWeight <= 0) {
    throw new OutOfStockError('No eligible rewards remaining with positive stock.');
  }

  // Deterministic roll for unit testing or CSPRNG roll
  const rollFraction = customRoll !== undefined ? customRoll : secureRandomFloat();
  const targetWeight = rollFraction * totalEffectiveWeight;

  // Cumulative interval matching
  let accumulated = 0;
  for (const reward of rewards) {
    const meta = metaMap.get(reward.id);
    if (!meta || meta.effectiveWeight <= 0) {
      continue;
    }

    accumulated += meta.effectiveWeight;
    if (targetWeight < accumulated || accumulated >= totalEffectiveWeight) {
      return {
        winner: reward,
        meta,
        randomRoll: rollFraction,
        totalEffectiveWeight,
      };
    }
  }

  // Fallback to the last positive-weight reward in edge precision cases
  const validRewards = rewards.filter(r => (metaMap.get(r.id)?.effectiveWeight ?? 0) > 0);
  const fallback = validRewards[validRewards.length - 1];
  return {
    winner: fallback,
    meta: metaMap.get(fallback.id)!,
    randomRoll: rollFraction,
    totalEffectiveWeight,
  };
}

