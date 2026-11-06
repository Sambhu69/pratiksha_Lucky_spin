import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';

async function startServer() {
  try {
    // Verify DB connectivity on startup
    const client = await pool.connect();
    const res = await client.query("SELECT current_setting('TIMEZONE') as tz");
    client.release();

    console.log(`✅ Connected to PostgreSQL (Timezone: ${res.rows[0].tz})`);

    app.listen(env.PORT, () => {
      console.log(`🚀 Pratikshya Lucky Spin Backend running on http://localhost:${env.PORT}`);
      console.log(`🕒 Active Nepal Time: ${new Date().toString()}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();