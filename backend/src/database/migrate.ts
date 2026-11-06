import { pool } from '../config/db.js';

export async function runMigrations() {
  console.log('🔄 [Migration] Starting database migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. admins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'STAFF')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✓ Table: admins created/verified');

    // 2. campaigns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_name VARCHAR(150) NOT NULL,
        description TEXT,
        start_datetime TIMESTAMPTZ NOT NULL,
        end_datetime TIMESTAMPTZ NOT NULL,
        campaign_status VARCHAR(20) NOT NULL CHECK (campaign_status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED')),
        maximum_spins_per_customer INTEGER NOT NULL DEFAULT 1 CHECK (maximum_spins_per_customer >= 1),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✓ Table: campaigns created/verified');

    // 3. rewards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        reward_number INTEGER NOT NULL CHECK (reward_number BETWEEN 1 AND 6),
        reward_name VARCHAR(100) NOT NULL,
        reward_description TEXT,
        reward_value NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (reward_value >= 0),
        reward_tier VARCHAR(20) NOT NULL CHECK (reward_tier IN ('COMMON', 'PREMIUM')),
        initial_quantity INTEGER NOT NULL CHECK (initial_quantity >= 0),
        remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
        distributed_quantity INTEGER NOT NULL DEFAULT 0 CHECK (distributed_quantity >= 0),
        probability_weight NUMERIC(10,4) NOT NULL CHECK (probability_weight >= 0),
        use_stock_scaling BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(campaign_id, reward_number),
        CHECK (remaining_quantity + distributed_quantity = initial_quantity)
      );
    `);
    console.log('  ✓ Table: rewards created/verified');

    // 4. customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        customer_name VARCHAR(100) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        invoice_reference VARCHAR(50),
        eligibility_status VARCHAR(20) NOT NULL CHECK (eligibility_status IN ('ELIGIBLE', 'BLOCKED', 'COMPLETED')),
        allowed_spins INTEGER NOT NULL DEFAULT 1 CHECK (allowed_spins >= 1),
        spins_used INTEGER NOT NULL DEFAULT 0 CHECK (spins_used >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(campaign_id, phone_number)
      );
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS spins_used INTEGER NOT NULL DEFAULT 0 CHECK (spins_used >= 0);
    `);
    console.log('  ✓ Table: customers created/verified');

    // 5. spins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS spins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES customers(id),
        campaign_id UUID NOT NULL REFERENCES campaigns(id),
        reward_id UUID NOT NULL REFERENCES rewards(id),
        idempotency_key VARCHAR(100) UNIQUE NOT NULL,
        spin_status VARCHAR(20) NOT NULL CHECK (spin_status IN ('COMPLETED', 'VOIDED')),
        spin_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        claim_status VARCHAR(20) NOT NULL DEFAULT 'UNCLAIMED' CHECK (claim_status IN ('UNCLAIMED', 'CLAIMED')),
        claim_timestamp TIMESTAMPTZ,
        verified_by_admin_id UUID REFERENCES admins(id),
        unique_transaction_reference VARCHAR(30) UNIQUE NOT NULL
      );
    `);
    console.log('  ✓ Table: spins created/verified');

    // 6. inventory_transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reward_id UUID NOT NULL REFERENCES rewards(id),
        spin_id UUID REFERENCES spins(id),
        admin_id UUID REFERENCES admins(id),
        transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('INITIAL_LOAD', 'SPIN_DEDUCTION', 'ADMIN_ADD', 'ADMIN_DEDUCT')),
        quantity_changed INTEGER NOT NULL,
        remaining_after INTEGER NOT NULL CHECK (remaining_after >= 0),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✓ Table: inventory_transactions created/verified');

    // 7. audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID REFERENCES admins(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        previous_value JSONB,
        new_value JSONB,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✓ Table: audit_logs created/verified');

    // Required Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_campaign_phone ON customers(campaign_id, phone_number);
      CREATE INDEX IF NOT EXISTS idx_customers_campaign_invoice ON customers(campaign_id, invoice_reference);
      CREATE INDEX IF NOT EXISTS idx_spins_utr ON spins(unique_transaction_reference);
      CREATE INDEX IF NOT EXISTS idx_spins_customer_id ON spins(customer_id);
      CREATE INDEX IF NOT EXISTS idx_rewards_campaign_number ON rewards(campaign_id, reward_number);
    `);
    console.log('  ✓ Indexes created/verified');

    await client.query('COMMIT');
    console.log('✅ [Migration] All 7 tables and indexes successfully migrated.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [Migration Failed]:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Auto-run if executed directly
if (process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => {
      console.log('🎉 Database migration complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration aborted with error:', err);
      process.exit(1);
    });
}

