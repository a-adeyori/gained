// Creates (or resets the password of) the admin account, and nothing else: no demo data.
//
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... npm run create-admin
//
// The admin resolves grade appeals at /admin/appeals; payments in appeal wait for them.

import { db } from '../lib/db';
import { ensureAdmin } from './admin';

ensureAdmin({ required: true })
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await db.$disconnect();
    process.exit(1);
  });
