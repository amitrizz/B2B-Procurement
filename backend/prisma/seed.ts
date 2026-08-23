import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const PBKDF2_ITERATIONS = 10000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Seeding database...');

  // Create Platform Admin
  const adminPasswordHash = hashPassword('adminpassword');
  await prisma.user.upsert({
    where: { email: 'admin@b2b.com' },
    update: {},
    create: {
      email: 'admin@b2b.com',
      passwordHash: adminPasswordHash,
      role: 'PLATFORM_ADMIN',
      emailVerified: true,
    },
  });

  // Create Company A (Buyer)
  const companyA = await prisma.company.upsert({
    where: { gstin: '27AAAAA0000A1Z1' },
    update: {},
    create: {
      name: 'Alpha Buyers Private Limited',
      gstin: '27AAAAA0000A1Z1',
      status: 'VERIFIED',
    },
  });

  await prisma.companyAddress.create({
    data: {
      companyId: companyA.id,
      state: 'Maharashtra',
      addressLine1: '101, Alpha Tower, Bandra Kurla Complex',
      city: 'Mumbai',
      pincode: '400051',
      isPrimary: true,
    },
  });

  const buyerPasswordHash = hashPassword('buyerpassword');
  await prisma.user.upsert({
    where: { email: 'buyer@b2b.com' },
    update: {},
    create: {
      email: 'buyer@b2b.com',
      passwordHash: buyerPasswordHash,
      role: 'OWNER',
      companyId: companyA.id,
      emailVerified: true,
    },
  });

  // Create Company B (Supplier)
  const companyB = await prisma.company.upsert({
    where: { gstin: '27BBBBB0000B1Z2' },
    update: {},
    create: {
      name: 'Beta Manufacturing Solutions',
      gstin: '27BBBBB0000B1Z2',
      status: 'VERIFIED',
    },
  });

  await prisma.companyAddress.create({
    data: {
      companyId: companyB.id,
      state: 'Maharashtra',
      addressLine1: '502, Industrial Zone, Hinjewadi Phase 3',
      city: 'Pune',
      pincode: '411057',
      isPrimary: true,
    },
  });

  const supplierPasswordHash = hashPassword('supplierpassword');
  await prisma.user.upsert({
    where: { email: 'supplier@b2b.com' },
    update: {},
    create: {
      email: 'supplier@b2b.com',
      passwordHash: supplierPasswordHash,
      role: 'OWNER',
      companyId: companyB.id,
      emailVerified: true,
    },
  });

  // Create Default Transporter
  await prisma.transporter.create({
    data: {
      name: 'Apex Logistics Services',
      contactPhone: '+919876543210',
      serviceAreas: 'Mumbai, Pune, Thane',
      vehicleTypes: '3-Ton Truck, Eeco Van',
      status: 'VERIFIED',
      bankAccountRef: 'ACC-APEX-9988',
    },
  });

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
