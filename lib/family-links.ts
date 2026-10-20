// Linking that happens when a parent proves their email (verifying it, or signing in once
// verified): students who added that email first join their family. Server-only.

import { db } from './db';
import { notifyFamily } from './notify';

export async function linkInvitedChildren(parent: { id: string; name: string; email: string; role: string; email_verified_at: Date | null }) {
  if (parent.role !== 'parent' || !parent.email_verified_at) return;
  const invited = await db.user.findMany({
    where: { role: 'student', parent_id: null, invited_parent_email: parent.email.toLowerCase() },
    select: { id: true, name: true, email: true },
  });
  for (const child of invited) {
    // Only if nobody else added them in the meantime: whoever is first wins.
    const { count } = await db.user.updateMany({
      where: { id: child.id, parent_id: null },
      data: { parent_id: parent.id, invited_parent_email: null },
    });
    if (count) await notifyFamily('parent-joined', { toEmail: child.email, toName: child.name, byName: parent.name });
  }
}
