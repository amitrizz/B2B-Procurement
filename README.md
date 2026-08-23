# B2B Procurement Marketplace

A premium, production-ready full-stack B2B procurement marketplace built with Next.js, App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Redis, and MinIO.

## Getting Started

### Prerequisites

- Node.js (v20+)
- Docker & Docker Compose

### Installation & Local Setup

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Verify configurations in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:45432/b2b_procurement?schema=public"
   JWT_SECRET="your-jwt-secret-key"
   ```

3. **Start local services via Docker Compose:**
   This spins up PostgreSQL and MinIO:
   ```bash
   docker compose up -d postgres minio
   ```

4. **Sync the Database Schema and Seed initial data:**
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts
   ```

5. **Run the Next.js development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the portal.

### Seed Accounts (Logins)

We seed standard test accounts for instant happy-path flow testing:
- **Buyer Portal (Alpha Buyers):** `buyer@b2b.com` / `buyerpassword`
- **Supplier Portal (Beta Mfg):** `supplier@b2b.com` / `supplierpassword`
- **Platform Admin (Super Admin):** `admin@b2b.com` / `adminpassword`
- **Transporter (Apex Logistics):** `supplier@b2b.com` / `supplierpassword`
