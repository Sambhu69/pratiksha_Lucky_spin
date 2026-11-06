import { Request, Response } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { calculateEffectiveWeights, RewardItem } from '../services/rewardEngine.js';

// 1. GET /api/admin/metrics
export async function getMetrics(_req: Request, res: Response) {
  const campaignRes = await pool.query(`
    SELECT id, campaign_name, campaign_status
    FROM campaigns
    ORDER BY created_at DESC
    LIMIT 1;
  `);

  if (campaignRes.rows.length === 0) {
    throw AppError.notFound('No active or configured campaign found.');
  }

  const campaign = campaignRes.rows[0];
  const campaignId = campaign.id;

  // Aggregate Metrics in parallel
  const [customerCountRes, spinCountRes, rewardStatsRes, unclaimedCountRes] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM customers WHERE campaign_id = $1', [campaignId]),
    pool.query('SELECT COUNT(*)::int AS count FROM spins WHERE campaign_id = $1', [campaignId]),
    pool.query(`
      SELECT 
        COALESCE(SUM(remaining_quantity), 0)::int AS total_remaining,
        COALESCE(SUM(CASE WHEN reward_tier = 'COMMON' THEN distributed_quantity ELSE 0 END), 0)::int AS common_distributed,
        COALESCE(SUM(CASE WHEN reward_tier = 'PREMIUM' THEN distributed_quantity ELSE 0 END), 0)::int AS premium_distributed
      FROM rewards
      WHERE campaign_id = $1;
    `, [campaignId]),
    pool.query(`
      SELECT COUNT(*)::int AS count
      FROM spins
      WHERE campaign_id = $1 AND claim_status = 'UNCLAIMED';
    `, [campaignId]),
  ]);

  const totalRegistered = customerCountRes.rows[0]?.count || 0;
  const totalSpins = spinCountRes.rows[0]?.count || 0;
  const totalGiftsRemaining = rewardStatsRes.rows[0]?.total_remaining || 0;
  const commonDistributed = rewardStatsRes.rows[0]?.common_distributed || 0;
  const premiumDistributed = rewardStatsRes.rows[0]?.premium_distributed || 0;
  const unclaimedSpinsCount = unclaimedCountRes.rows[0]?.count || 0;

  return sendSuccess(res, {
    campaignId,
    campaignName: campaign.campaign_name,
    campaignStatus: campaign.campaign_status,
    totalRegistered,
    totalSpins,
    totalGiftsRemaining,
    commonDistributed,
    premiumDistributed,
    unclaimedSpinsCount,
  });
}

// 2. GET /api/admin/probability-table
export async function getProbabilityTable(_req: Request, res: Response) {
  const campaignRes = await pool.query(`
    SELECT id FROM campaigns ORDER BY created_at DESC LIMIT 1;
  `);

  if (campaignRes.rows.length === 0) {
    throw AppError.notFound('No campaign found');
  }

  const campaignId = campaignRes.rows[0].id;

  const rewardsRes = await pool.query(`
    SELECT 
      id, campaign_id, reward_number, reward_name, reward_tier,
      reward_value, initial_quantity, remaining_quantity,
      distributed_quantity, probability_weight, use_stock_scaling, is_active
    FROM rewards
    WHERE campaign_id = $1
    ORDER BY reward_number ASC;
  `, [campaignId]);

  const rewards: RewardItem[] = rewardsRes.rows;
  const weightsMap = calculateEffectiveWeights(rewards);

  const table = rewards.map((r) => {
    const meta = weightsMap.get(r.id);
    return {
      id: r.id,
      rewardNumber: r.reward_number,
      rewardName: r.reward_name,
      rewardTier: r.reward_tier,
      remainingQuantity: r.remaining_quantity,
      initialQuantity: r.initial_quantity,
      distributedQuantity: r.distributed_quantity,
      probabilityWeight: Number(r.probability_weight),
      effectiveWeight: meta ? Number(meta.effectiveWeight.toFixed(4)) : 0,
      currentWinPercentage: meta ? Number(meta.probabilityPercent.toFixed(2)) : 0,
      isActive: r.is_active,
      isExhausted: r.remaining_quantity <= 0,
    };
  });

  return sendSuccess(res, { rewards: table });
}

// 3. GET /api/admin/spins
export async function getSpins(req: Request, res: Response) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  let baseQuery = `
    FROM spins s
    JOIN customers c ON s.customer_id = c.id
    JOIN rewards r ON s.reward_id = r.id
    LEFT JOIN admins a ON s.verified_by_admin_id = a.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIdx = 1;

  if (search) {
    baseQuery += ` AND (
      c.phone_number ILIKE $${paramIdx} 
      OR c.invoice_reference ILIKE $${paramIdx} 
      OR c.customer_name ILIKE $${paramIdx} 
      OR s.unique_transaction_reference ILIKE $${paramIdx}
    )`;
    params.push(`%${search}%`);
    paramIdx++;
  }

  if (status && (status === 'UNCLAIMED' || status === 'CLAIMED')) {
    baseQuery += ` AND s.claim_status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  const countRes = await pool.query(`SELECT COUNT(*)::int as total ${baseQuery}`, params);
  const total = countRes.rows[0]?.total || 0;

  const spinsRes = await pool.query(`
    SELECT 
      s.id,
      s.unique_transaction_reference,
      s.spin_timestamp,
      s.claim_status,
      s.claim_timestamp,
      c.id AS customer_id,
      c.customer_name,
      c.phone_number,
      c.invoice_reference,
      r.id AS reward_id,
      r.reward_number,
      r.reward_name,
      r.reward_tier,
      a.username AS verified_by_admin
    ${baseQuery}
    ORDER BY s.spin_timestamp DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
  `, [...params, limit, offset]);

  return sendSuccess(res, {
    spins: spinsRes.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// 4. PATCH /api/admin/spins/:id/claim
const claimSchema = z.object({
  transactionReference: z.string().optional(),
});

export async function claimSpin(req: Request, res: Response) {
  const { id } = req.params;
  const adminId = req.admin?.id;
  claimSchema.parse(req.body);

  const updatedSpin = await withTransaction(async (client) => {
    // Lock spin row
    const spinRes = await client.query(`
      SELECT s.*, c.customer_name, r.reward_name
      FROM spins s
      JOIN customers c ON s.customer_id = c.id
      JOIN rewards r ON s.reward_id = r.id
      WHERE s.id = $1
      FOR UPDATE;
    `, [id]);

    if (spinRes.rows.length === 0) {
      throw AppError.notFound('Spin record not found.');
    }

    const spin = spinRes.rows[0];

    if (spin.claim_status === 'CLAIMED') {
      throw AppError.badRequest(`This reward was already claimed on ${spin.claim_timestamp}.`);
    }

    const updateRes = await client.query(`
      UPDATE spins
      SET 
        claim_status = 'CLAIMED',
        claim_timestamp = NOW(),
        verified_by_admin_id = $1
      WHERE id = $2
      RETURNING *;
    `, [adminId, id]);

    // Audit log
    await client.query(`
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, previous_value, new_value)
      VALUES ($1, 'CLAIM_REWARD', 'spins', $2, $3, $4);
    `, [
      adminId,
      id,
      JSON.stringify({ claim_status: 'UNCLAIMED' }),
      JSON.stringify({ claim_status: 'CLAIMED', verified_by_admin_id: adminId, timestamp: new Date().toISOString() }),
    ]);

    return updateRes.rows[0];
  });

  return sendSuccess(res, updatedSpin, 'Reward successfully claimed and verified');
}

// 5. PATCH /api/admin/rewards/:id (Full Edit: Name, Remaining Stock, Base Weight, Tier)
const editRewardSchema = z.object({
  rewardName: z.string().trim().min(1).optional(),
  remainingQuantity: z.number().int().min(0, 'Remaining stock cannot be negative').optional(),
  probabilityWeight: z.number().positive('Probability weight must be positive').optional(),
  rewardTier: z.enum(['COMMON', 'PREMIUM']).optional(),
  quantityChange: z.number().int().positive().optional(), // backwards compatibility
});

export async function updateRewardDetails(req: Request, res: Response) {
  const { id } = req.params;
  const adminId = req.admin?.id;
  const data = editRewardSchema.parse(req.body);

  const updatedReward = await withTransaction(async (client) => {
    // Lock reward row
    const lockRes = await client.query(`
      SELECT * FROM rewards WHERE id = $1 FOR UPDATE;
    `, [id]);

    if (lockRes.rows.length === 0) {
      throw AppError.notFound('Reward not found.');
    }

    const reward = lockRes.rows[0];

    // Calculate new values
    let newRemaining = reward.remaining_quantity;
    let newInitial = reward.initial_quantity;

    if (typeof data.remainingQuantity === 'number') {
      newRemaining = data.remainingQuantity;
      // Maintain consistency: initial = distributed + remaining
      newInitial = Number(reward.distributed_quantity) + newRemaining;
    } else if (typeof data.quantityChange === 'number') {
      newRemaining += data.quantityChange;
      newInitial += data.quantityChange;
    }

    const newName = data.rewardName || reward.reward_name;
    const newWeight = typeof data.probabilityWeight === 'number' ? data.probabilityWeight : reward.probability_weight;
    const newTier = data.rewardTier || reward.reward_tier;

    const updateRes = await client.query(`
      UPDATE rewards
      SET 
        reward_name = $1,
        remaining_quantity = $2,
        initial_quantity = $3,
        probability_weight = $4,
        reward_tier = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *;
    `, [newName, newRemaining, newInitial, newWeight, newTier, id]);

    // Record inventory transaction if quantity changed
    const diff = newRemaining - reward.remaining_quantity;
    if (diff !== 0) {
      const txType = diff > 0 ? 'ADMIN_ADD' : 'ADMIN_DEDUCT';
      await client.query(`
        INSERT INTO inventory_transactions (
          reward_id, admin_id, transaction_type, quantity_changed, remaining_after
        )
        VALUES ($1, $2, $3, $4, $5);
      `, [id, adminId, txType, Math.abs(diff), newRemaining]);
    }

    // Record audit log
    await client.query(`
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, previous_value, new_value)
      VALUES ($1, 'REWARD_EDIT', 'rewards', $2, $3, $4);
    `, [
      adminId,
      id,
      JSON.stringify(reward),
      JSON.stringify(updateRes.rows[0]),
    ]);

    return updateRes.rows[0];
  });

  return sendSuccess(res, updatedReward, 'Reward updated successfully.');
}

// Kept for backward compatibility
export const adjustRewardInventory = updateRewardDetails;

// 6. PATCH /api/admin/campaign/status
const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']),
});

export async function updateCampaignStatus(req: Request, res: Response) {
  const adminId = req.admin?.id;
  const { status } = updateStatusSchema.parse(req.body);

  const updatedCampaign = await withTransaction(async (client) => {
    const campaignRes = await client.query(`
      SELECT id, campaign_name, campaign_status
      FROM campaigns
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE;
    `);

    if (campaignRes.rows.length === 0) {
      throw AppError.notFound('No campaign found to update.');
    }

    const campaign = campaignRes.rows[0];

    const updateRes = await client.query(`
      UPDATE campaigns
      SET campaign_status = $1
      WHERE id = $2
      RETURNING *;
    `, [status, campaign.id]);

    await client.query(`
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, previous_value, new_value)
      VALUES ($1, 'UPDATE_CAMPAIGN_STATUS', 'campaigns', $2, $3, $4);
    `, [
      adminId,
      campaign.id,
      JSON.stringify({ campaign_status: campaign.campaign_status }),
      JSON.stringify({ campaign_status: status }),
    ]);

    return updateRes.rows[0];
  });

  return sendSuccess(res, updatedCampaign, `Campaign status set to ${status}.`);
}

