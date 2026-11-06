import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';

export async function runSeed() {
  console.log('🌱 [Seeding] Starting authoritative database seeding...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Seed Admins
    console.log('  -> Seeding Admin Accounts...');
    const superAdminPasswordHash = await bcrypt.hash('PratikshyaAdmin2026!', 10);
    const staffPasswordHash = await bcrypt.hash('StaffPokhara2026!', 10);

    const superAdminRes = await client.query(`
      INSERT INTO admins (username, password_hash, role)
      VALUES ($1, $2, 'SUPER_ADMIN')
      ON CONFLICT (username) DO UPDATE 
        SET password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role
      RETURNING id, username;
    `, ['admin_pratikshya', superAdminPasswordHash]);

    const superAdminId = superAdminRes.rows[0].id;

    await client.query(`
      INSERT INTO admins (username, password_hash, role)
      VALUES ($1, $2, 'STAFF')
      ON CONFLICT (username) DO UPDATE 
        SET password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role
      RETURNING id, username;
    `, ['staff_counter', staffPasswordHash]);

    console.log('  ✓ Admins seeded (admin_pratikshya, staff_counter)');

    // 2. Seed Campaign (Today 06:00 to 22:00 in Asia/Kathmandu)
    console.log('  -> Seeding One-Day Campaign...');
    // We compute Nepal local date dynamically:
    const nowNepal = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }));
    const year = nowNepal.getFullYear();
    const month = String(nowNepal.getMonth() + 1).padStart(2, '0');
    const day = String(nowNepal.getDate()).padStart(2, '0');
    const startDatetime = `${year}-${month}-${day} 00:00:00+05:45`;
    const endDatetime = `${year}-${month}-${day} 23:59:59+05:45`;

    const campaignRes = await client.query(`
      INSERT INTO campaigns (campaign_name, description, start_datetime, end_datetime, campaign_status, maximum_spins_per_customer)
      VALUES ($1, $2, $3, $4, 'ACTIVE', 1)
      RETURNING id, campaign_name;
    `, [
      'Pratikshya Kitchen Suppliers - Grand Promotional Lucky Spin',
      'Exclusive one-day promotional event for customers at retail counter, Pokhara, Nepal.',
      startDatetime,
      endDatetime,
    ]);

    const campaignId = campaignRes.rows[0].id;
    console.log(`  ✓ Active Campaign created: "${campaignRes.rows[0].campaign_name}" (ID: ${campaignId})`);

    // 3. Seed Rewards 1 through 6
    console.log('  -> Seeding 6 Wheel Rewards...');
    const rewards = [
      {
        number: 1,
        tier: 'COMMON',
        name: 'Kitchen Peeler & Knife Set',
        desc: 'High-quality stainless steel kitchen utility peeler and fruit knife set.',
        value: 150.0,
        qty: 100,
        weight: 30.0,
      },
      {
        number: 2,
        tier: 'PREMIUM',
        name: 'Induction Cooktop (Limited Edition)',
        desc: 'Energy-efficient 2000W digital induction cooktop with touch controls.',
        value: 4500.0,
        qty: 3,
        weight: 1.5,
      },
      {
        number: 3,
        tier: 'PREMIUM',
        name: 'Prestige Pressure Cooker 5L',
        desc: 'Virgin aluminium outer lid durable pressure cooker with safety valve.',
        value: 3200.0,
        qty: 5,
        weight: 2.5,
      },
      {
        number: 4,
        tier: 'PREMIUM',
        name: 'Non-Stick Cookware Fry Pan',
        desc: 'Premium multi-layer granite coated non-stick frying pan (24cm).',
        value: 1200.0,
        qty: 15,
        weight: 6.0,
      },
      {
        number: 5,
        tier: 'COMMON',
        name: 'Spice Rack Container Set',
        desc: 'Aesthetic 6-piece airtight revolving condiment and spice container set.',
        value: 250.0,
        qty: 100,
        weight: 30.0,
      },
      {
        number: 6,
        tier: 'COMMON',
        name: 'Stainless Steel Cutlery 6pc',
        desc: 'Heavy gauge mirror finish dinner spoon and fork set.',
        value: 200.0,
        qty: 100,
        weight: 30.0,
      },
    ];

    for (const r of rewards) {
      const rewardInsert = await client.query(`
        INSERT INTO rewards (
          campaign_id, reward_number, reward_name, reward_description,
          reward_value, reward_tier, initial_quantity, remaining_quantity,
          distributed_quantity, probability_weight, use_stock_scaling, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 0, $8, TRUE, TRUE)
        RETURNING id, reward_number, reward_name, remaining_quantity;
      `, [
        campaignId,
        r.number,
        r.name,
        r.desc,
        r.value,
        r.tier,
        r.qty,
        r.weight,
      ]);

      const rewardId = rewardInsert.rows[0].id;

      // 4. Record INITIAL_LOAD in inventory_transactions
      await client.query(`
        INSERT INTO inventory_transactions (
          reward_id, admin_id, transaction_type, quantity_changed, remaining_after
        )
        VALUES ($1, $2, 'INITIAL_LOAD', $3, $3);
      `, [rewardId, superAdminId, r.qty]);

      console.log(`    • Reward ${r.number} [${r.tier}]: "${r.name}" (${r.qty} units, weight: ${r.weight})`);
    }

    // 5. Initial Audit Log
    await client.query(`
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_value)
      VALUES ($1, 'CAMPAIGN_AND_REWARDS_SEEDED', 'campaigns', $2, $3);
    `, [
      superAdminId,
      campaignId,
      JSON.stringify({ campaignId, rewardCount: 6, seededAt: new Date().toISOString() }),
    ]);

    await client.query('COMMIT');
    console.log('✅ [Seeding Complete] Successfully seeded Admins, Campaign, and 6 Rewards with Initial Ledger.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [Seeding Failed]:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Auto-run if executed directly
if (process.argv[1]?.includes('seed')) {
  runSeed()
    .then(() => {
      console.log('🎉 Seeding script finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding aborted with error:', err);
      process.exit(1);
    });
}

