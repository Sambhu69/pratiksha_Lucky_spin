# PRATIKSHYA ONE-DAY LUCKY SPIN — DEVELOPMENT TASK LOG

## Completed Tasks
- [x] **Phase 1: Requirement Analysis & System Planning**
  - Finalized Kiosk/Tablet workflow for Pratikshya Kitchen Suppliers, Pokhara.
  - Defined dual eligibility check: Nepal Mobile Number (`98/97XXXXXXXX`) + Shop Bill/Invoice Number.
  - Designed 7-table relational schema and CSPRNG weighted-random algorithm.
- [x] **Phase 2: Technology Stack & Project Scaffolding**
  - Created monorepo structure (`/backend`, `/frontend`, `/docs`).
  - Configured Docker Compose with PostgreSQL 16 locked to `Asia/Kathmandu` (`UTC+05:45`).
  - Implemented `withTransaction` ACID helper.
- [x] **Codebase Audit & Hardening (Completed)**
  - Fixed database URL parsing issues when passwords contain special characters (`@`, `!`) by adding discrete DB host/user/password fields in `env.ts` and `db.ts`.
  - Added `"type": "module"` in `backend/package.json` for seamless NodeNext ESM execution.
  - Eliminated PostgreSQL pool timezone race condition via direct startup options (`options: '-c timezone=Asia/Kathmandu'`).
  - Added safe `asyncHandler` wrapper preventing unhandled promise rejections.
  - Standardized API envelope (`ApiResponse<T>`) and operational `AppError` handling.
  - Added structured request logging tagged with Nepal Standard Time (`Asia/Kathmandu`).
  - Upgraded `/api/health` with DB connection pool status, memory metrics, and timezone diagnostics.
  - Completed `frontend/` scaffolding with Next.js 14 App Router (`layout.tsx`, `page.tsx`, `globals.css`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`).

## Current Tasks
- [ ] **Phase 3: Database Implementation, Migrations & Seeding**
  - Write SQL migration script for all 7 tables with constraints and indexes (`001_initial_schema.sql` and `src/database/migrate.ts`).
  - Write seed script for initial Admin account, 1-Day Campaign, and Rewards 1–6 (`src/database/seed.ts`).

## Pending Tasks
- [ ] Phase 4: Intelligent Reward Distribution Engine & 10,000-Spin Simulation
- [ ] Phase 5: Customer Interface — Lucky Spin Experience (Kiosk Wheel)
- [ ] Phase 6: Administrator Dashboard (Inventory & Claim Verification)
- [ ] Phase 7: Security & Business Logic Hardening
- [ ] Phase 8: Testing & Quality Assurance
- [ ] Phase 9: Deployment & Pre-Launch Preparation
- [ ] Phase 10: Final Reporting & CSV/Print Export

## Technical Decisions Log
1. **Kiosk Mode First:** Selected dedicated shop Kiosk/Tablet mode to prevent remote fraud and work reliably on local Wi-Fi.
2. **Database Session Timezone:** Enforced `-c timezone=Asia/Kathmandu` directly at PostgreSQL connection options level so every connection is guaranteed Nepal Time before queries execute.
3. **Strict Inventory Law:** Added DB constraint `CHECK (remaining_quantity + distributed_quantity = initial_quantity)` on `rewards`.
4. **Resilient Credentials:** Switched to discrete DB connection parameters (`DB_HOST`, `DB_USER`, `DB_PASSWORD`) to ensure complex passwords with `@` and `!` never break the connection pool.

4. **Resilient Credentials:** Switched to discrete DB connection parameters (`DB_HOST`, `DB_USER`, `DB_PASSWORD`) to ensure complex passwords with `@` and `!` never break the connection pool.