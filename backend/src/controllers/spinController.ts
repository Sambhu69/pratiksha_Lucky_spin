import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { withTransaction } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { selectWinningReward, RewardItem } from '../services/rewardEngine.js';

const executeSpinSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format'),
  idempotencyKey: z.string().min(8, 'Idempotency key must be at least 8 characters').trim(),
});

/**
 * Generate human-readable Unique Transaction Reference (UTR)
 * Format: PKS-MMDD-XXXX (e.g. PKS-1106-9482)
 */
function generateUTR(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }));
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = crypto.randomInt(1000, 9999).toString();
  return `PKS-${month}${day}-${randomSuffix}`;
}

export async function executeSpin(req: Request, res: Response) {
  const parseResult = executeSpinSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw AppError.badRequest('Invalid spin execution payload', parseResult.error.format());
  }

  const { customerId, idempotencyKey } = parseResult.data;

  const result = await withTransaction(async (client) => {
    // -------------------------------------------------------------
    // Step A: Idempotency Check (Fast return if network retry)
    // -------------------------------------------------------------
    const existingSpin = await client.query(`
      SELECT 
        s.id, s.unique_transaction_reference, s.spin_timestamp, s.claim_status,
        r.reward_number, r.reward_name, r.reward_tier
      FROM spins s
      JOIN rewards r ON s.reward_id = r.id
      WHERE s.idempotency_key = $1;
    `, [idempotencyKey]);

    if (existingSpin.rows.length > 0) {
      const s = existingSpin.rows[0];
      return {
        rewardNumber: s.reward_number,
        rewardName: s.reward_name,
        rewardTier: s.reward_tier,
        transactionReference: s.unique_transaction_reference,
        spinTimestamp: s.spin_timestamp,
        isReplay: true,
      };
    }

    // -------------------------------------------------------------
    // Step B: Lock Customer Row (Pessimistic Concurrency Lock)
    // -------------------------------------------------------------
    const customerLock = await client.query(`
      SELECT id, campaign_id, customer_name, eligibility_status, allowed_spins, spins_used
      FROM customers
      WHERE id = $1
      FOR UPDATE;
    `, [customerId]);

    if (customerLock.rows.length === 0) {
      throw AppError.notFound('Customer record not found.');
    }

    const customer = customerLock.rows[0];

    if (customer.eligibility_status === 'BLOCKED') {
      throw AppError.forbidden('Customer is blocked from spinning.');
    }

    if (customer.spins_used >= customer.allowed_spins || customer.eligibility_status === 'COMPLETED') {
      throw AppError.badRequest('Customer has already utilized all allocated spins.');
    }

    // -------------------------------------------------------------
    // Step C: Lock Active Rewards in this Campaign
    // -------------------------------------------------------------
    const rewardsLock = await client.query(`
      SELECT 
        id, campaign_id, reward_number, reward_name, reward_tier,
        reward_value, initial_quantity, remaining_quantity,
        distributed_quantity, probability_weight, use_stock_scaling, is_active
      FROM rewards
      WHERE campaign_id = $1 AND is_active = TRUE
      ORDER BY reward_number ASC
      FOR UPDATE;
    `, [customer.campaign_id]);

    if (rewardsLock.rows.length === 0) {
      throw AppError.badRequest('No active rewards configured for this campaign.');
    }

    const rewardEntities: RewardItem[] = rewardsLock.rows;

    // -------------------------------------------------------------
    // Step D: Decoupled Intelligent CSPRNG Selection
    // -------------------------------------------------------------
    const selection = selectWinningReward(rewardEntities);
    const winningReward = selection.winner;

    // -------------------------------------------------------------
    // Step E: Atomic Inventory Deduction
    // -------------------------------------------------------------
    const deductRes = await client.query(`
      UPDATE rewards
      SET 
        remaining_quantity = remaining_quantity - 1,
        distributed_quantity = distributed_quantity + 1,
        updated_at = NOW()
      WHERE id = $1 AND remaining_quantity > 0
      RETURNING remaining_quantity;
    `, [winningReward.id]);

    if (deductRes.rows.length === 0) {
      throw AppError.conflict('Reward inventory depleted during checkout. Please retry.');
    }

    const remainingAfter = deductRes.rows[0].remaining_quantity;

    // -------------------------------------------------------------
    // Step F: Generate Transaction Reference (UTR)
    // -------------------------------------------------------------
    let utr = generateUTR();
    // Ensure collision-free
    let utrCheck = await client.query('SELECT id FROM spins WHERE unique_transaction_reference = $1', [utr]);
    while (utrCheck.rows.length > 0) {
      utr = generateUTR();
      utrCheck = await client.query('SELECT id FROM spins WHERE unique_transaction_reference = $1', [utr]);
    }

    // -------------------------------------------------------------
    // Step G: Insert Spin Record
    // -------------------------------------------------------------
    const spinInsert = await client.query(`
      INSERT INTO spins (
        customer_id, campaign_id, reward_id, idempotency_key,
        spin_status, spin_timestamp, claim_status, unique_transaction_reference
      )
      VALUES ($1, $2, $3, $4, 'COMPLETED', NOW(), 'UNCLAIMED', $5)
      RETURNING id, unique_transaction_reference, spin_timestamp;
    `, [
      customerId,
      customer.campaign_id,
      winningReward.id,
      idempotencyKey,
      utr,
    ]);

    const createdSpin = spinInsert.rows[0];

    // -------------------------------------------------------------
    // Step H: Update Customer State
    // -------------------------------------------------------------
    const updatedSpinsUsed = customer.spins_used + 1;
    const isCompleted = updatedSpinsUsed >= customer.allowed_spins;

    await client.query(`
      UPDATE customers
      SET 
        spins_used = $1,
        eligibility_status = $2
      WHERE id = $3;
    `, [
      updatedSpinsUsed,
      isCompleted ? 'COMPLETED' : 'ELIGIBLE',
      customerId,
    ]);

    // -------------------------------------------------------------
    // Step I: Record in Inventory Ledger
    // -------------------------------------------------------------
    await client.query(`
      INSERT INTO inventory_transactions (
        reward_id, spin_id, transaction_type, quantity_changed, remaining_after, timestamp
      )
      VALUES ($1, $2, 'SPIN_DEDUCTION', -1, $3, NOW());
    `, [
      winningReward.id,
      createdSpin.id,
      remainingAfter,
    ]);

    return {
      rewardNumber: winningReward.reward_number,
      rewardName: winningReward.reward_name,
      rewardTier: winningReward.reward_tier,
      transactionReference: createdSpin.unique_transaction_reference,
      spinTimestamp: createdSpin.spin_timestamp,
      isReplay: false,
    };
  });

  return sendSuccess(res, result, 'Spin executed successfully');
}

