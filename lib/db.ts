// One Prisma client per process (and one across Next.js dev hot reloads).

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: InstanceType<typeof PrismaClient> };

function createClient() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set (see .env.local)');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
