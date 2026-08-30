# B2B Procurement Marketplace

A premium, production-ready full-stack B2B procurement marketplace built with Next.js, App Router, TypeScript, Tailwind CSS, MongoDB, and Prisma.

## Phase 1 Stack
- **Database**: MongoDB ONLY (No Postgres, No MinIO, No Redis for Phase 1).

## Getting Started

### Prerequisites
- Node.js (v20+)
- MongoDB Atlas (or local MongoDB server)

### Installation & Local Setup

1. **Configure environment variables in both `/backend` and `/frontend`:**
   Create `.env` file based on `.env.example`:
   ```env
   DATABASE_URL="mongodb+srv://..."
   JWT_SECRET="your-jwt-secret-key"
   EMAIL_VERIFY_REQUIRED="false"
   ```

2. **Wipe & Seed the Database (from the `backend` directory):**
   ```bash
   cd backend
   npx prisma generate
   npx prisma db push
   npx tsx prisma/seed.ts
   ```

3. **Start the Development Servers:**
   Terminal 1 (Backend):
   ```bash
   cd backend
   npm run dev
   ```
   
   Terminal 2 (Frontend):
   ```bash
   cd frontend
   npm run dev
   ```

### Seed Accounts (Phase 1)
- **Buyer (Karnataka):** `amit@gmail.com` / `1234`
- **Supplier (Maharashtra):** `amitsagar121001@gmail.com` / `1234`
