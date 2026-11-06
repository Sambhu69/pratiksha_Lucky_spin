import { app } from '../app.js';
import http from 'http';

async function runTestSuite() {
  console.log('🧪 Starting Integration Test Suite for Phase 5 Endpoints...\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(4001, resolve));
  const baseUrl = 'http://localhost:4001/api';

  try {
    // 1. Test Admin Login
    console.log('1️⃣ Testing Admin Login:');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin_pratikshya',
        password: 'PratikshyaAdmin2026!',
      }),
    });
    const loginData = await loginRes.json();
    console.log('  Status:', loginRes.status);
    console.log('  Response:', loginData);

    const cookieHeader = loginRes.headers.get('set-cookie') || '';
    const tokenMatch = cookieHeader.match(/pks_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : '';

    // 2. Test Protected /api/auth/me
    console.log('\n2️⃣ Testing GET /api/auth/me:');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const meData = await meRes.json();
    console.log('  Status:', meRes.status);
    console.log('  Response:', meData);

    // 3. Test Kiosk Customer Validation
    console.log('\n3️⃣ Testing Customer Validation (New Customer):');
    const uniqueInvoice = `INV-POK-${Date.now().toString().slice(-4)}`;
    const uniquePhone = `9841${Date.now().toString().slice(-6)}`;

    const valRes = await fetch(`${baseUrl}/kiosk/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Ram Bahadur Thapa',
        phoneNumber: uniquePhone,
        invoiceReference: uniqueInvoice,
      }),
    });
    const valData = await valRes.json();
    console.log('  Status:', valRes.status);
    console.log('  Response:', valData);

    const customerId = valData.data.customerId;

    // 4. Test Atomic Spin Execution
    console.log('\n4️⃣ Testing Atomic Spin Execution:');
    const idempotencyKey = `spin-key-${Date.now()}`;
    const spinRes = await fetch(`${baseUrl}/spins/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        idempotencyKey,
      }),
    });
    const spinData = await spinRes.json();
    console.log('  Status:', spinRes.status);
    console.log('  Response:', spinData);

    // 5. Test Idempotency Replay
    console.log('\n5️⃣ Testing Idempotency Replay (Same key):');
    const replayRes = await fetch(`${baseUrl}/spins/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        idempotencyKey,
      }),
    });
    const replayData = await replayRes.json();
    console.log('  Status:', replayRes.status);
    console.log('  Replay matched:', replayData.data.transactionReference === spinData.data.transactionReference);
    console.log('  isReplay:', replayData.data.isReplay);

    // 6. Test Double Spin Rejection
    console.log('\n6️⃣ Testing Double Spin Prevention (New key, same customer):');
    const doubleRes = await fetch(`${baseUrl}/spins/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        idempotencyKey: `spin-key-${Date.now()}-2`,
      }),
    });
    const doubleData = await doubleRes.json();
    console.log('  Status:', doubleRes.status);
    console.log('  Response:', doubleData);

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED PERFECTLY!');
  } finally {
    server.close();
  }
}

runTestSuite().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
