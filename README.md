# Pratikshya Kitchen Suppliers — One-Day Lucky Spin Promotional System

A full-stack, concurrency-safe promotional gamification platform built for **Pratikshya Kitchen Suppliers (Pokhara, Nepal)**.

## Architecture
- **Frontend:** Next.js 14 App Router (React 18, TypeScript, Tailwind CSS, Framer Motion, Canvas Confetti)
- **Backend:** Node.js, Express.js (ESM), TypeScript REST API
- **Database:** PostgreSQL 16 (`Asia/Kathmandu` / `UTC+05:45` timezone strictly enforced)
- **Security:** CSPRNG (`crypto.randomBytes`), ACID Transactions (`SELECT ... FOR UPDATE`), Idempotency Keys, Nepal Mobile & Invoice validation.

## Key Hardening Measures Applied
1. **Discrete Database Config:** Handles complex passwords containing special characters (`@`, `!`) without URI decoding failures.
2. **Startup Timezone Enforced:** Configured PostgreSQL pool with `-c timezone=Asia/Kathmandu` startup options to prevent session race conditions.
3. **Async Route Safety:** Wrapped all Express handlers with `asyncHandler` to eliminate unhandled promise crashes.
4. **Structured Nepal Time Logging:** Terminal logs display human-readable Nepal Standard Time for counter auditing.

## Quick Start

### 1. Start PostgreSQL Database
```bash
docker compose up -d
```

### 2. Backend API
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Kiosk Application
```bash
cd frontend
npm install
npm run dev
```

```

### 2. Backend API
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Kiosk Application
```bash
cd frontend
npm install
npm run dev
```