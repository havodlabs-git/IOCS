const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {

  console.warn("[WARN] DATABASE_URL não definido.");
}

const pool = new Pool({
  connectionString: DATABASE_URL
});

async function waitForDb({ maxAttempts = 30, delayMs = 1000 } = {}) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr || new Error("DB_NOT_READY");
}

async function initDb() {

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        secret_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT users_customer_email_unique UNIQUE (customer_id, email)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS iocs (
        id UUID PRIMARY KEY,
        scope TEXT NOT NULL CHECK (scope IN ('GLOBAL','CUSTOMER')),
        customer_id UUID NULL REFERENCES customers(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        severity INTEGER NULL CHECK (severity BETWEEN 0 AND 10),
        tags TEXT[] NOT NULL DEFAULT '{}'::text[],
        status TEXT NOT NULL CHECK (status IN ('active','inactive')) DEFAULT 'active',
        source TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);


    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS iocs_global_unique
      ON iocs (type, value)
      WHERE scope = 'GLOBAL';
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS iocs_customer_unique
      ON iocs (customer_id, type, value)
      WHERE scope = 'CUSTOMER';
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS iocs_customer_idx
      ON iocs (customer_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS iocs_created_at_idx
      ON iocs (created_at DESC);
    `);

    // MFA columns — idempotent, safe to run on existing DB
    await client.query(`
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS mfa_secret TEXT NULL,
        ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // Approval flow — idempotent, safe to run on existing DB
    await client.query(`
      ALTER TABLE iocs
        ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'APPROVED';
    `);
    await client.query(`
      ALTER TABLE iocs
        DROP CONSTRAINT IF EXISTS iocs_approval_status_check;
    `);
    await client.query(`
      ALTER TABLE iocs
        ADD CONSTRAINT iocs_approval_status_check
        CHECK (approval_status IN ('PENDING','APPROVED','REJECTED'));
    `);
    // Backfill: IOCs existentes ficam APPROVED
    await client.query(`
      UPDATE iocs SET approval_status = 'APPROVED'
      WHERE scope = 'GLOBAL' AND approval_status = 'APPROVED';
    `);
    // Tabela de audit de aprovações
    await client.query(`
      CREATE TABLE IF NOT EXISTS ioc_approvals (
        id UUID PRIMARY KEY,
        ioc_id UUID NOT NULL REFERENCES iocs(id) ON DELETE CASCADE,
        action TEXT NOT NULL CHECK (action IN ('APPROVED','REJECTED')),
        reviewed_by TEXT NOT NULL DEFAULT 'blue-team',
        notes TEXT NOT NULL DEFAULT '',
        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS ioc_approvals_ioc_idx ON ioc_approvals (ioc_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS iocs_approval_status_idx ON iocs (approval_status)
      WHERE scope = 'GLOBAL';
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  waitForDb,
  initDb
};
