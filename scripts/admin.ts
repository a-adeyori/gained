// Creates or updates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD. Shared by
// `npm run create-admin` (admin only, no demo data) and `npm run seed`.

import { db } from '../lib/db';
import { hashPassword } from '../lib/signing';

export async function ensureAdmin({ required = false } = {}) {
  const { ADMIN_EMAIL: rawEmail, ADMIN_PASSWORD: password } = process.env;
  if (!rawEmail || !password) {
    if (required) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (in .env.local or the environment) first.');
    return;
  }
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  const email = rawEmail.trim().toLowerCase();

  const existing = await db.user.findUnique({ where: { email }, select: { role: true } });
  if (existing && existing.role !== 'admin') {
    // Promoting a real family or tutor account to admin would hide their own home and sessions.
    throw new Error(`${email} is already a ${existing.role} account. Use a different email for the admin.`);
  }
  await db.user.upsert({
    where: { email },
    create: { email, name: 'Admin', role: 'admin', password_hash: await hashPassword(password) },
    update: { password_hash: await hashPassword(password) },
  });
  console.log(`Admin account ready: ${email}`);
}
