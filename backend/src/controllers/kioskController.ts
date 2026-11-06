import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';

const validateCustomerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters long').trim(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^(98|97)\d{8}$/, 'Must be a valid 10-digit Nepal mobile number starting with 98 or 97'),
  invoiceReference: z.string().trim().optional(),
});

export async function validateCustomer(req: Request, res: Response) {
  const parseResult = validateCustomerSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw AppError.badRequest('Validation failed', parseResult.error.format());
  }

  const { fullName, phoneNumber, invoiceReference } = parseResult.data;

  // 1. Verify Active Campaign within Nepal Standard Time
  const campaignRes = await pool.query(`
    SELECT id, campaign_name, start_datetime, end_datetime, campaign_status, maximum_spins_per_customer
    FROM campaigns
    ORDER BY created_at DESC
    LIMIT 1;
  `);

  if (campaignRes.rows.length === 0) {
    throw AppError.badRequest('No campaign configured.');
  }

  const campaign = campaignRes.rows[0];
  if (campaign.campaign_status !== 'ACTIVE') {
    throw AppError.forbidden(`Campaign is currently ${campaign.campaign_status}.`);
  }

  const campaignId = campaign.id;

  // 2. Check if this customer (by phone_number) already registered in this campaign
  const customerRes = await pool.query(`
    SELECT id, customer_name, phone_number, eligibility_status, allowed_spins, spins_used
    FROM customers
    WHERE campaign_id = $1 AND phone_number = $2;
  `, [campaignId, phoneNumber]);

  if (customerRes.rows.length > 0) {
    const existing = customerRes.rows[0];

    if (existing.eligibility_status === 'BLOCKED') {
      return sendSuccess(res, {
        eligible: false,
        reason: 'This customer has been marked as blocked.',
      });
    }

    const remainingSpins = Math.max(0, existing.allowed_spins - existing.spins_used);
    if (remainingSpins <= 0 || existing.eligibility_status === 'COMPLETED') {
      return sendSuccess(res, {
        eligible: false,
        reason: 'Customer has already completed their spin.',
        customerId: existing.id,
        remainingSpins: 0,
      });
    }

    return sendSuccess(res, {
      eligible: true,
      customerId: existing.id,
      customerName: existing.customer_name,
      remainingSpins,
      campaignId,
    });
  }

  // 3. Register new eligible customer
  const insertRes = await pool.query(`
    INSERT INTO customers (
      campaign_id, customer_name, phone_number, invoice_reference,
      eligibility_status, allowed_spins, spins_used
    )
    VALUES ($1, $2, $3, $4, 'ELIGIBLE', $5, 0)
    RETURNING id, customer_name, phone_number, allowed_spins, spins_used;
  `, [
    campaignId,
    fullName,
    phoneNumber,
    invoiceReference || null,
    campaign.maximum_spins_per_customer || 1,
  ]);

  const newCustomer = insertRes.rows[0];

  return sendSuccess(res, {
    eligible: true,
    customerId: newCustomer.id,
    customerName: newCustomer.customer_name,
    remainingSpins: 1,
    campaignId,
  });
}

