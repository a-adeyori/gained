// The signed-in person's account: who they are, the time zone their emails use, and deleting it.
// A parent also deletes their children's accounts here; a student in a family can't delete theirs.

import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui';
import { canDeleteOwnAccount } from '@/lib/account-deletion';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { otherTimeZones, timeZoneLabel } from '@/lib/time-zone';
import { DeleteAccount } from './delete-account';
import { TimeZoneForm } from './time-zone-form';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await requireUser();
  const children =
    user.role === 'parent'
      ? await db.user.findMany({ where: { parent_id: user.id }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } })
      : [];
  const parent =
    user.role === 'student' && user.parent_id
      ? await db.user.findUnique({ where: { id: user.parent_id }, select: { name: true } })
      : null;
  const deletable = canDeleteOwnAccount(user);
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="Account" title={user.name} />
      <Card className="mb-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd className="capitalize">{user.role}</dd>
          <dt className="text-muted">Emails use</dt>
          <dd>
            {user.time_zone ? timeZoneLabel(user.time_zone) : 'UTC (no time zone saved yet)'}
            {user.time_zone && <span className="text-muted">{user.time_zone_manual ? ' · chosen by you' : ' · from your device'}</span>}
          </dd>
        </dl>
      </Card>
      <Card>
        <TimeZoneForm saved={user.time_zone} manual={user.time_zone_manual} zones={otherTimeZones()} />
      </Card>

      {children.length > 0 && (
        <section className="mt-10" aria-labelledby="children-title">
          <h2 id="children-title" className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">
            Your children’s accounts
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {children.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="truncate text-sm text-muted">{c.email}</p>
                </div>
                <DeleteAccount child={{ id: c.id, name: c.name }} compact />
              </li>
            ))}
          </ul>
        </section>
      )}

      {user.role !== 'admin' && (
        <section className="mt-10 rounded-2xl border border-state-appeal/40 p-5 sm:p-6" aria-labelledby="delete-title">
          <h2 id="delete-title" className="font-medium">
            Delete account
          </h2>
          {deletable.ok ? (
            <>
              <p className="mt-1 mb-4 text-sm text-ink-soft">
                Removes your account and everything in it. You can sign up again any time with the same email.
              </p>
              <DeleteAccount hasChildren={children.length > 0} />
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">
              {parent ? `${parent.name} manages your account. Ask them to delete it from their Account page.` : deletable.reason}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
