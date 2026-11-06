<div align="center">

# 🎰 Pratikshya Lucky Spin

### A digital promotional Lucky Spin system for **Pratikshya Kitchen Suppliers, Pokhara, Nepal**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-9%2F9%20Passing-brightgreen?logo=vitest&logoColor=white)](./backend/tests/)
[![Timezone](https://img.shields.io/badge/Timezone-Asia%2FKathmandu-orange)](https://en.wikipedia.org/wiki/Nepal_Time)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

<br/>

> **A real-world kiosk application** that runs entirely offline on shop Wi-Fi. Customers enter their bill number and phone, spin a wheel, and win a gift — all protected by cryptographic randomness, atomic database transactions, and race-condition-proof concurrency locking.

<br/>

![Lucky Spin Kiosk](https://placehold.co/900x400/0f172a/f59e0b?text=🎰+Pratikshya+Lucky+Spin+Kiosk&font=raleway)

</div>

---

## 📖 Table of Contents

1. [What is this project?](#-what-is-this-project)
2. [How it works — Customer Journey](#-how-it-works--customer-journey)
3. [System Architecture](#-system-architecture)
4. [Tech Stack](#-tech-stack)
5. [Quick Start (3 Steps)](#-quick-start-3-steps)
6. [Accessing the App](#-accessing-the-app)
7. [Default Login Credentials](#-default-login-credentials)
8. [Reward Segments](#-reward-segments-wheel-layout)
9. [Security Architecture](#-security-architecture)
10. [Testing & Simulation](#-testing--simulation)
11. [Project Structure](#-project-structure)
12. [All NPM Scripts](#-all-npm-scripts-reference)
13. [Environment Variables](#-environment-variables)

---

## 🏪 What is this project?

**Pratikshya Lucky Spin** is a **promotional gift giveaway system** built for a physical retail kitchen supplies shop in Pokhara, Nepal.

During a promotional campaign, every customer who makes a purchase receives a chance to **spin a digital lucky wheel** and win one of 6 different gifts — from a simple Kitchen Peeler Set all the way up to a Prestige Pressure Cooker.

### Why was this built?

| Problem | Solution |
|---|---|
| Paper-based lucky draws are slow and prone to cheating | Digital wheel with cryptographic randomness |
| Staff manually check duplicate entries | Database tracks every phone + invoice combination |
| Two customers winning the last item simultaneously | Atomic database locking (`SELECT FOR UPDATE`) |
| Running on-site without internet | Fully self-hosted with Docker Compose |
| Need to track claims after the event | Admin dashboard with real-time claim desk |

### Key Features

- 🎡 **Animated 6-segment SVG spin wheel** with smooth physics
- 🔐 **Cryptographically secure reward selection** (Node.js `crypto.randomBytes`, 53-bit entropy)
- ⚛️ **Race-condition-proof** — atomic PostgreSQL transactions prevent double-winning
- 📱 **Nepal mobile number validation** (`98XXXXXXXX` / `97XXXXXXXX` format)
- 🧾 **Invoice deduplication** — same bill can't win twice
- 🎊 **Confetti celebration** + printable voucher modal
- 🛡️ **Admin dashboard** with live probability table, spin history, and claim desk
- 🕐 **Nepal time enforced** — `Asia/Kathmandu (UTC+05:45)` at the database level
- 🧪 **9/9 automated tests passing** (fraud prevention + 20-request concurrency stress test)

---

## 🚶 How it works — Customer Journey

```
  CUSTOMER MAKES A PURCHASE
           │
           ▼
  ┌─────────────────────┐
  │  Step 1: VERIFY     │  Enter: Full Name + Nepal Phone + Invoice Number
  │  (Kiosk Terminal)   │  → System checks: active campaign? first time? not blocked?
  └─────────┬───────────┘
            │  ✅ Eligible
            ▼
  ┌─────────────────────┐
  │  Step 2: SPIN       │  Press the golden "SPIN NOW" button
  │  (Spin Wheel)       │  → Backend picks reward using CSPRNG weighted probability
  └─────────┬───────────┘
            │  🎁 Win!
            ▼
  ┌─────────────────────┐
  │  Step 3: VOUCHER    │  Modal shows: Gift Name + Tier + Unique Code (e.g. PKS-1106-9482)
  │  (Reward Modal)     │  → Customer shows code to counter staff
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │  Step 4: CLAIM      │  Staff searches code in Admin Dashboard
  │  (Admin Dashboard)  │  → Marks as CLAIMED, inventory auto-decremented
  └─────────────────────┘
```

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 14)                     │
│                                                                  │
│   ┌─────────────────────┐    ┌──────────────────────────────┐   │
│   │  Kiosk Terminal UI  │    │   Admin / Staff Dashboard    │   │
│   │  localhost:3000/    │    │   localhost:3000/admin       │   │
│   │                     │    │                              │   │
│   │  · Customer form    │    │  · Live metrics cards        │   │
│   │  · SVG Spin Wheel   │    │  · Probability table         │   │
│   │  · Confetti modal   │    │  · Spin history & search     │   │
│   │  · Voucher display  │    │  · Gift claim desk           │   │
│   └──────────┬──────────┘    └──────────────┬───────────────┘   │
│              │  HTTP (REST API)              │                   │
└──────────────┼───────────────────────────────┼───────────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express.js API)                     │
│                        localhost:4000                            │
│                                                                  │
│   Controllers: auth · kiosk · spin · admin                       │
│   Middleware:  JWT auth · Zod validation · request logger        │
│   Services:   rewardEngine (CSPRNG weighted probability)        │
│   Security:   SELECT FOR UPDATE · idempotency keys · bcrypt      │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│               DATABASE (PostgreSQL 16 via Docker)                │
│                        localhost:5432                            │
│                                                                  │
│   Tables: admins · campaigns · rewards · customers               │
│           spins · inventory_transactions · audit_logs            │
│   Timezone: Asia/Kathmandu enforced at connection level          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | File-based routing, server components, fast |
| **Styling** | Tailwind CSS | Utility-first, easy dark-mode kiosk design |
| **Animations** | Framer Motion | Smooth wheel spin physics |
| **Confetti** | canvas-confetti | Celebration effect on win |
| **Backend** | Node.js + Express.js | Lightweight REST API, ESM modules |
| **Language** | TypeScript (strict) | Type safety across full stack |
| **Validation** | Zod | Runtime schema validation on all API inputs |
| **Database** | PostgreSQL 16 | ACID transactions, `SELECT FOR UPDATE` locking |
| **DB Driver** | node-postgres (`pg`) | Direct SQL — no ORM overhead |
| **Auth** | JWT + bcrypt | Secure admin login, httpOnly cookies |
| **Randomness** | `crypto.randomBytes` | Cryptographically secure reward selection |
| **Container** | Docker Compose | One-command local setup, works offline |
| **Testing** | Vitest | Fast unit + integration + concurrency tests |

---

## ⚡ Quick Start (3 Steps)

> **Prerequisites:** [Node.js 20+](https://nodejs.org/), [Docker Desktop](https://www.docker.com/products/docker-desktop/), [Git](https://git-scm.com/)

### Step 1 — Clone & Start the Database

```bash
git clone https://github.com/Sambhu69/pratiksha_Lucky_spin.git
cd pratiksha_Lucky_spin

# Start PostgreSQL in Docker (runs in background)
docker compose up -d
```

### Step 2 — Start the Backend API

```bash
cd backend

# Install dependencies
npm install

# Run database migrations (creates all 7 tables)
npm run db:migrate

# Seed initial data (campaign, rewards, admin accounts)
npm run db:seed

# Start the backend server (port 4000)
npm run dev
```

> ✅ You should see: `🚀 Server running on port 4000` and `✅ Connected to PostgreSQL (Timezone: Asia/Kathmandu)`

### Step 3 — Start the Frontend

```bash
# Open a new terminal tab
cd frontend

# Install dependencies
npm install

# Start the Next.js dev server (port 3000)
npm run dev
```

> ✅ You should see: `▲ Next.js 14 ready on http://localhost:3000`

---

## 🌐 Accessing the App

| Interface | URL | Who uses it |
|---|---|---|
| 🎡 **Customer Kiosk** | [http://localhost:3000](http://localhost:3000) | Customers at the shop counter |
| 🛡️ **Admin Dashboard** | [http://localhost:3000/admin/login](http://localhost:3000/admin/login) | Shop manager / staff |
| 🔌 **Backend API** | [http://localhost:4000](http://localhost:4000) | (Internal — used by frontend) |

---

## 🔑 Default Login Credentials

> These are seeded automatically when you run `npm run db:seed`

| Role | Username | Password | Access Level |
|---|---|---|---|
| 🔴 **Super Admin** | `admin_pratikshya` | `PratikshyaAdmin2026!` | Full access — campaign management, all data |
| 🟡 **Counter Staff** | `staff_counter` | `StaffPokhara2026!` | Claim desk + spin history only |

> ⚠️ **Change these passwords** before deploying to a production environment.

---

## 🎡 Reward Segments (Wheel Layout)

The wheel is divided into 6 equal segments. Each reward has a **tier**, a **stock quantity**, and a **probability weight**:

| Segment | Gift | Tier | Starting Stock | Win Probability |
|:---:|---|:---:|:---:|:---:|
| 1️⃣ | Kitchen Peeler Set | 🟢 Common | 100 | ~40% |
| 2️⃣ | Spice Rack Container Set | 🟢 Common | 80 | ~30% |
| 3️⃣ | Prestige Pressure Cooker 5L | 🔴 Premium | 10 | ~5% |
| 4️⃣ | Non-Stick Cookware Set | 🔴 Premium | 15 | ~8% |
| 5️⃣ | Kitchen Storage Organizer | 🟢 Common | 60 | ~12% |
| 6️⃣ | Premium Chef's Knife Set | 🔴 Premium | 20 | ~5% |

> 📊 **Weights are dynamic** — as stock depletes, the probability engine automatically redistributes weights to only in-stock rewards. When a reward runs out, it is excluded from future draws.

---

## 🔐 Security Architecture

### How the winning reward is chosen

```
1. Backend generates 6 bytes of CSPRNG data
   → crypto.randomBytes(6)   [53-bit entropy]

2. Each in-stock reward has a probability_weight (e.g. 100, 80, 10...)
   → calculateEffectiveWeights() computes live percentages

3. Random number is mapped to a weighted range
   → Like drawing from a weighted hat — higher weight = bigger section

4. Winning reward ID is returned and the spin is committed atomically
```

### Race Condition Protection (the hard problem)

> **Scenario:** 50 customers spin simultaneously. Only 1 Pressure Cooker is left. How do we ensure exactly 1 person wins it?

```sql
-- Inside a database transaction:
BEGIN;
  SELECT * FROM rewards WHERE id = $1 FOR UPDATE;
  -- ☝️ This locks the row — all other spins WAIT here

  -- Check remaining_quantity > 0
  -- Decrement remaining_quantity
  -- Insert spin record
COMMIT;
-- Only now do other spins proceed — and they see quantity = 0
```

This `SELECT ... FOR UPDATE` pessimistic lock is the guarantee that **no two customers ever win the same last item**.

### Additional Security Measures

| Measure | Implementation |
|---|---|
| **Idempotency keys** | Each spin carries a UUID — clicking "Spin" twice is safe |
| **Nepal phone validation** | Regex `^(98\|97)\d{8}$` enforced on backend via Zod |
| **Invoice deduplication** | Unique constraint on `(campaign_id, invoice_reference)` |
| **JWT httpOnly cookies** | Admin tokens not accessible to JavaScript |
| **bcrypt password hashing** | Salt rounds = 12 |
| **SQL injection prevention** | 100% parameterized queries, no string concatenation |
| **Helmet.js** | HTTP security headers on all API responses |

---

## 🧪 Testing & Simulation

All tests are inside `backend/tests/`. Run from the `backend/` directory:

```bash
# Run all 9 tests (sequential — required due to shared DB state)
npm run test:all

# Run only business logic tests (fraud prevention, duplicate spins)
npm run test:business

# Run only the concurrency stress test (20 simultaneous spins)
npm run test:concurrency

# Run the 10,000 spin Monte Carlo simulation (verify probability engine)
npm run sim:10k
```

### What the tests verify

| Test Suite | Tests | What it checks |
|---|---|---|
| `businessLogic.test.ts` | 7 tests | Duplicate spin rejection, invoice reuse attack, blocked customer lockout, full spin flow |
| `concurrency.test.ts` | 2 tests | 20 simultaneous spins — exactly 1 Pressure Cooker winner, 19 fallback; DB integrity |

### 10,000 Spin Simulation Output (example)

```
🎰 Running 10,000 spin Monte Carlo simulation...

Reward Distribution Results:
  Kitchen Peeler Set       →  3,987 wins  (39.87%)  ✅ Target ~40%
  Spice Rack Container     →  2,994 wins  (29.94%)  ✅ Target ~30%
  Prestige Pressure Cooker →    501 wins  ( 5.01%)  ✅ Target ~5%
  Non-Stick Cookware Set   →    803 wins  ( 8.03%)  ✅ Target ~8%
  Kitchen Storage Organizer →  1,197 wins (11.97%)  ✅ Target ~12%
  Premium Chef's Knife Set →    518 wins  ( 5.18%)  ✅ Target ~5%

✅ All probability targets within acceptable variance
```

---

## 📁 Project Structure

```
pratikshya-lucky-spin/
│
├── 📄 docker-compose.yml          # PostgreSQL 16 container config
├── 📄 .gitignore                  # Excludes .env files and node_modules
├── 📄 README.md                   # This file
│
├── 📂 backend/                    # Node.js + Express REST API
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   ├── 📄 .env                    # ⚠️ Not committed — create from .env.example
│   │
│   └── 📂 src/
│       ├── 📄 server.ts           # Express app entry point
│       ├── 📂 config/
│       │   ├── db.ts              # PostgreSQL connection pool (Nepal timezone)
│       │   └── env.ts             # Typed environment variable loader
│       │
│       ├── 📂 controllers/        # Route handler logic
│       │   ├── authController.ts  # POST /api/auth/login|logout, GET /api/auth/me
│       │   ├── kioskController.ts # POST /api/kiosk/validate (customer eligibility)
│       │   ├── spinController.ts  # POST /api/spins/execute (atomic spin transaction)
│       │   └── adminController.ts # GET metrics, spins, probability; PATCH claim
│       │
│       ├── 📂 middleware/
│       │   ├── auth.ts            # requireAdminAuth (JWT cookie verification)
│       │   └── requestLogger.ts   # HTTP request logging
│       │
│       ├── 📂 routes/
│       │   └── api.ts             # All route definitions
│       │
│       ├── 📂 services/
│       │   └── rewardEngine.ts    # CSPRNG weighted probability + weight calculator
│       │
│       ├── 📂 database/
│       │   ├── migrate.ts         # Creates all 7 tables (idempotent)
│       │   └── seed.ts            # Seeds campaign, rewards, admin accounts
│       │
│       ├── 📂 simulation/
│       │   └── run-10k-simulation.ts  # Monte Carlo probability verifier
│       │
│       └── 📂 utils/
│           ├── apiResponse.ts     # Standardized { success, data, message } envelope
│           ├── appError.ts        # Custom error classes (400, 401, 403, 404, 409)
│           └── asyncHandler.ts    # Wraps async controllers to catch thrown errors
│
├── 📂 backend/tests/              # Vitest test suites
│   ├── concurrency.test.ts        # 20 simultaneous spins stress test
│   └── businessLogic.test.ts      # Fraud prevention integration tests
│
└── 📂 frontend/                   # Next.js 14 App Router
    └── 📂 src/
        ├── 📂 app/
        │   ├── layout.tsx         # Root layout (fonts, metadata)
        │   ├── globals.css        # Tailwind base styles
        │   ├── page.tsx           # 🎡 Customer Kiosk (3-state machine: ENTRY → SPINNING → REWARD)
        │   └── 📂 admin/
        │       ├── layout.tsx     # Admin shell layout
        │       ├── login/page.tsx # Admin login page
        │       └── dashboard/page.tsx  # 🛡️ Full admin dashboard
        │
        ├── 📂 components/
        │   ├── SpinWheel.tsx      # SVG 6-segment animated wheel component
        │   └── VoucherModal.tsx   # Win celebration modal with confetti
        │
        └── 📂 lib/
            └── api.ts             # Typed fetch wrapper for all API calls
```

---

## 📜 All NPM Scripts Reference

Run these from inside the `backend/` directory:

| Script | Command | What it does |
|---|---|---|
| `dev` | `npm run dev` | Start backend with hot-reload (tsx watch) |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `start` | `npm start` | Run compiled production build |
| `db:migrate` | `npm run db:migrate` | Create all database tables (safe to re-run) |
| `db:seed` | `npm run db:seed` | Insert campaign, rewards & admin accounts |
| `test:all` | `npm run test:all` | Run all 9 tests sequentially |
| `test:business` | `npm run test:business` | Run fraud prevention tests only |
| `test:concurrency` | `npm run test:concurrency` | Run 20-simultaneous-spin stress test |
| `sim:10k` | `npm run sim:10k` | Run 10,000 spin Monte Carlo simulation |

---

## 🔧 Environment Variables

Create a `.env` file in the `backend/` directory. **Never commit this file.**

```env
# Server
NODE_ENV=development
PORT=4000
TZ=Asia/Kathmandu

# PostgreSQL — use discrete vars (avoids URL-encoding issues with special chars)
DB_HOST=localhost
DB_PORT=5432
DB_USER=pratikshya_admin
DB_PASSWORD=your_secure_password_here
DB_NAME=pratikshya_lucky_spin

# JWT Authentication
JWT_SECRET=your_long_random_secret_here_min_32_chars
JWT_EXPIRES_IN=12h

# CORS
CORS_ORIGIN=http://localhost:3000
```

> 💡 **Tip:** The database container credentials in `docker-compose.yml` must match `DB_USER`, `DB_PASSWORD`, and `DB_NAME` exactly.

---

## 🏃 Running in Production (Local Shop Wi-Fi)

This system is designed to run **fully offline** on the shop's local network:

1. Run all services on a single laptop/PC behind the shop Wi-Fi router.
2. Connect kiosk tablet/display to the same Wi-Fi.
3. Customer-facing kiosk opens `http://<shop-pc-ip>:3000`
4. Staff admin dashboard opens `http://<shop-pc-ip>:3000/admin`
5. No internet connection required after initial `npm install`.

---

## 👨‍💻 Author

**Built by [Sambhu69](https://github.com/Sambhu69)** for **Pratikshya Kitchen Suppliers, Pokhara, Nepal** 🇳🇵

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

---

<div align="center">

Made with ❤️ in Pokhara, Nepal 🇳🇵 &nbsp;|&nbsp; `Asia/Kathmandu (UTC+05:45)`

</div>
