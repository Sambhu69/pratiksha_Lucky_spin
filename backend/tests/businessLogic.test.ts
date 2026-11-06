import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';

describe('Business Logic & Fraud Prevention Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let campaignId: string;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    baseUrl = `http://localhost:${port}/api`;

    const campRes = await pool.query(`
      SELECT id FROM campaigns WHERE campaign_status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1;
    `);
    campaignId = campRes.rows[0].id;

    // Clean up test data from any previous runs
    await pool.query(`
      DELETE FROM inventory_transactions WHERE spin_id IN (
        SELECT s.id FROM spins s JOIN customers c ON s.customer_id = c.id WHERE c.phone_number LIKE '98999999%'
      );
    `);
    await pool.query(`
      DELETE FROM spins WHERE customer_id IN (
        SELECT id FROM customers WHERE phone_number LIKE '98999999%'
      );
    `);
    await pool.query("DELETE FROM customers WHERE campaign_id = $1 AND phone_number LIKE '98999999%';", [campaignId]);

    // Reset standard stock for Reward 1 & 2
    await pool.query(`
      UPDATE rewards SET remaining_quantity = 50, distributed_quantity = initial_quantity - 50 
      WHERE campaign_id = $1 AND reward_number IN (1, 5, 6);
    `, [campaignId]);

    // Admin token
    const adminRes = await pool.query("SELECT id, username, role FROM admins WHERE role = 'SUPER_ADMIN' LIMIT 1;");
    adminId = adminRes.rows[0].id;
    adminToken = jwt.sign(
      { id: adminId, username: adminRes.rows[0].username, role: adminRes.rows[0].role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Restore campaign to ACTIVE and clean up
    if (campaignId) {
      await pool.query("UPDATE campaigns SET campaign_status = 'ACTIVE' WHERE id = $1;", [campaignId]);
      await pool.query(`
        DELETE FROM inventory_transactions WHERE spin_id IN (
          SELECT s.id FROM spins s JOIN customers c ON s.customer_id = c.id WHERE c.phone_number LIKE '98999999%'
        );
      `);
      await pool.query(`
        DELETE FROM spins WHERE customer_id IN (
          SELECT id FROM customers WHERE phone_number LIKE '98999999%'
        );
      `);
      await pool.query("DELETE FROM customers WHERE campaign_id = $1 AND phone_number LIKE '98999999%';", [campaignId]);
    }
    server.close();
  });

  it('1. Duplicate Spin Prevention: Rejects second spin attempt by same customer with 400', async () => {
    // Register customer
    const cRes = await pool.query(`
      INSERT INTO customers (campaign_id, customer_name, phone_number, invoice_reference, eligibility_status, allowed_spins, spins_used)
      VALUES ($1, 'Double Spin Test', '9899999901', 'INV-FRAUD-01', 'ELIGIBLE', 1, 0)
      RETURNING id;
    `, [campaignId]);
    const customerId = cRes.rows[0].id;

    // First spin
    const res1 = await fetch(`${baseUrl}/spins/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, idempotencyKey: `first-spin-${Date.now()}` }),
    });
    expect(res1.status).toBe(200);

    // Second spin with fresh key
    const res2 = await fetch(`${baseUrl}/spins/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, idempotencyKey: `second-spin-${Date.now()}` }),
    });
    const json2 = await res2.json();
    expect(res2.status).toBe(400);
    expect(json2.message).toContain('already utilized all allocated spins');
  });

  it('2. Phone Duplicate Guard: Rejects second registration attempt using the same phone number', async () => {
    // First registration
    const resA = await fetch(`${baseUrl}/kiosk/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Customer A',
        phoneNumber: '9899999902',
      }),
    });
    expect(resA.status).toBe(200);

    // Spin executed for Customer A
    const jsonA = await resA.json();
    const customerIdA = jsonA.data.customerId;
    await fetch(`${baseUrl}/spins/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customerIdA,
        idempotencyKey: 'key-customer-a',
      }),
    });

    // Second registration with identical phone number
    const resB = await fetch(`${baseUrl}/kiosk/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Customer A Again',
        phoneNumber: '9899999902',
      }),
    });
    const jsonB = await resB.json();
    expect(resB.status).toBe(200);
    expect(jsonB.data.eligible).toBe(false);
    expect(jsonB.data.reason).toContain('already completed');
  });

  it('3. Idempotency Guard: Replaying the identical idempotencyKey returns cached outcome without extra deduction', async () => {
    const cRes = await pool.query(`
      INSERT INTO customers (campaign_id, customer_name, phone_number, invoice_reference, eligibility_status, allowed_spins, spins_used)
      VALUES ($1, 'Idempotent Customer', '9899999904', 'INV-FRAUD-04', 'ELIGIBLE', 1, 0)
      RETURNING id;
    `, [campaignId]);
    const customerId = cRes.rows[0].id;
    const idempotencyKey = 'test-key-abc-123';

    // Call 1
    const res1 = await fetch(`${baseUrl}/spins/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, idempotencyKey }),
    });
    const json1 = await res1.json();
    expect(res1.status).toBe(200);

    // Call 2 with same idempotencyKey
    const res2 = await fetch(`${baseUrl}/spins/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, idempotencyKey }),
    });
    const json2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(json2.data.transactionReference).toBe(json1.data.transactionReference);
    expect(json2.data.isReplay).toBe(true);

    // Verify customer's spins_used remained 1
    const custCheck = await pool.query('SELECT spins_used FROM customers WHERE id = $1;', [customerId]);
    expect(custCheck.rows[0].spins_used).toBe(1);
  });

  it('4. Campaign Status Lockout: Rejects spin with 403 when campaign is PAUSED', async () => {
    // Create customer while active
    const cRes = await pool.query(`
      INSERT INTO customers (campaign_id, customer_name, phone_number, invoice_reference, eligibility_status, allowed_spins, spins_used)
      VALUES ($1, 'Paused Test', '9899999905', 'INV-FRAUD-05', 'ELIGIBLE', 1, 0)
      RETURNING id;
    `, [campaignId]);
    const customerId = cRes.rows[0].id;

    // Pause campaign
    await pool.query("UPDATE campaigns SET campaign_status = 'PAUSED' WHERE id = $1;", [campaignId]);

    // Attempt spin
    const res = await fetch(`${baseUrl}/spins/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, idempotencyKey: `paused-spin-${Date.now()}` }),
    });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.message).toContain('Campaign is currently PAUSED');

    // Restore to ACTIVE
    await pool.query("UPDATE campaigns SET campaign_status = 'ACTIVE' WHERE id = $1;", [campaignId]);
  });

  it('5. Physical Claim Double-Handover Guard: Rejects second claim of same voucher with 400', async () => {
    // Find or create an unclaimed spin
    const cRes = await pool.query(`
      INSERT INTO customers (campaign_id, customer_name, phone_number, invoice_reference, eligibility_status, allowed_spins, spins_used)
      VALUES ($1, 'Claim Test', '9899999906', 'INV-FRAUD-06', 'ELIGIBLE', 1, 0)
      RETURNING id;
    `, [campaignId]);
    const customerId = cRes.rows[0].id;

    const spinRes = await fetch(`${baseUrl}/spins/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, idempotencyKey: `claim-test-${Date.now()}` }),
    });
    const spinJson = await spinRes.json();
    const utr = spinJson.data.transactionReference;

    const dbSpin = await pool.query('SELECT id FROM spins WHERE unique_transaction_reference = $1;', [utr]);
    const spinId = dbSpin.rows[0].id;

    // Claim 1: Staff marks as claimed
    const claimRes1 = await fetch(`${baseUrl}/admin/spins/${spinId}/claim`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(claimRes1.status).toBe(200);

    // Claim 2: Staff attempts duplicate claim
    const claimRes2 = await fetch(`${baseUrl}/admin/spins/${spinId}/claim`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    const claimJson2 = await claimRes2.json();

    expect(claimRes2.status).toBe(400);
    expect(claimJson2.message).toContain('already claimed');
  });
});
