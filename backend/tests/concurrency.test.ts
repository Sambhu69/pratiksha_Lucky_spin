import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { app } from '../src/app.js';
import { pool } from '../src/config/db.js';

describe('Concurrency Stress Test Suite — Retail Race-Condition Verification', () => {
  let server: http.Server;
  let baseUrl: string;
  let campaignId: string;
  const customerIds: string[] = [];

  beforeAll(async () => {
    // Start temporary test server
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    baseUrl = `http://localhost:${port}/api`;

    // 1. Target the active campaign
    const campRes = await pool.query(`
      SELECT id FROM campaigns WHERE campaign_status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1;
    `);
    campaignId = campRes.rows[0].id;

    // 2. Setup inventory:
    // Reward 3: exactly 1 remaining, probability_weight = 1000 to ensure priority selection
    // Reward 1: exactly 50 remaining as fallback, probability_weight = 10
    // Reward 2, 4, 5, 6: 0 remaining
    await pool.query(`
      UPDATE rewards 
      SET 
        remaining_quantity = CASE 
          WHEN reward_number = 3 THEN 1
          WHEN reward_number = 1 THEN 50
          ELSE 0
        END,
        distributed_quantity = CASE
          WHEN reward_number = 3 THEN initial_quantity - 1
          WHEN reward_number = 1 THEN initial_quantity - 50
          ELSE initial_quantity
        END,
        probability_weight = CASE
          WHEN reward_number = 3 THEN 1000
          WHEN reward_number = 1 THEN 10
          ELSE probability_weight
        END
      WHERE campaign_id = $1;
    `, [campaignId]);

    // Clean up any test customers and spins from prior runs
    await pool.query(`
      DELETE FROM inventory_transactions WHERE spin_id IN (
        SELECT s.id FROM spins s JOIN customers c ON s.customer_id = c.id WHERE c.phone_number LIKE '98000000%'
      );
    `);
    await pool.query(`
      DELETE FROM spins WHERE customer_id IN (
        SELECT id FROM customers WHERE phone_number LIKE '98000000%'
      );
    `);
    await pool.query(`
      DELETE FROM customers WHERE campaign_id = $1 AND phone_number LIKE '98000000%';
    `, [campaignId]);

    // 3. Register 20 unique test customers
    for (let i = 1; i <= 20; i++) {
      const pad = String(i).padStart(2, '0');
      const phone = `98000000${pad}`;
      const invoice = `INV-TEST-${pad}`;

      const res = await pool.query(`
        INSERT INTO customers (
          campaign_id, customer_name, phone_number, invoice_reference,
          eligibility_status, allowed_spins, spins_used
        )
        VALUES ($1, $2, $3, $4, 'ELIGIBLE', 1, 0)
        RETURNING id;
      `, [campaignId, `Test Customer ${pad}`, phone, invoice]);

      customerIds.push(res.rows[0].id);
    }
  });

  afterAll(async () => {
    // Clean up test customers & spins
    if (campaignId) {
      await pool.query(`
        DELETE FROM inventory_transactions WHERE spin_id IN (
          SELECT s.id FROM spins s JOIN customers c ON s.customer_id = c.id WHERE c.phone_number LIKE '98000000%'
        );
      `);
      await pool.query(`
        DELETE FROM spins WHERE customer_id IN (
          SELECT id FROM customers WHERE phone_number LIKE '98000000%'
        );
      `);
      await pool.query(`
        DELETE FROM customers WHERE campaign_id = $1 AND phone_number LIKE '98000000%';
      `, [campaignId]);

      // Restore baseline weights
      await pool.query(`
        UPDATE rewards SET probability_weight = CASE 
          WHEN reward_number = 3 THEN 2.5 
          WHEN reward_number = 1 THEN 30.0 
          ELSE probability_weight 
        END WHERE campaign_id = $1;
      `, [campaignId]);
    }
    server.close();
  });

  it('handles 20 simultaneous spins without overselling: exactly 1 gets Reward 3 and 19 get fallback Reward 1', async () => {
    // Launch all 20 spins simultaneously
    const spinPromises = customerIds.map((customerId, idx) => {
      const idempotencyKey = `concurrency-stress-${idx}-${Date.now()}`;
      return fetch(`${baseUrl}/spins/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, idempotencyKey }),
      }).then(async (res) => {
        const json = await res.json();
        return { status: res.status, data: json.data };
      });
    });

    const results = await Promise.all(spinPromises);

    // 1. Verify all 20 requests returned HTTP 200
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.data).toBeDefined();
    }

    // 2. Count rewards received
    const reward3Winners = results.filter((r) => r.data.rewardNumber === 3);
    const reward1Winners = results.filter((r) => r.data.rewardNumber === 1);

    expect(reward3Winners.length).toBe(1);
    expect(reward1Winners.length).toBe(19);

    // 3. Query the database directly for invariants
    const r3Check = await pool.query(`
      SELECT initial_quantity, remaining_quantity, distributed_quantity
      FROM rewards
      WHERE campaign_id = $1 AND reward_number = 3;
    `, [campaignId]);

    const r3 = r3Check.rows[0];
    expect(r3.remaining_quantity).toBe(0);
    expect(r3.distributed_quantity).toBe(r3.initial_quantity);

    // 4. Verify inventory ledger transactions added
    const ledgerCheck = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM inventory_transactions it
      JOIN spins s ON it.spin_id = s.id
      WHERE s.customer_id = ANY($1::uuid[]);
    `, [customerIds]);

    expect(ledgerCheck.rows[0].count).toBe(20);
  });
});
