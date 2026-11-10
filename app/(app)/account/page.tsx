// The signed-in person's account: who they are, and the time zone their emails use.

import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { otherTimeZones, timeZoneLabel } from '@/lib/time-zone';
import { TimeZoneForm } from './time-zone-form';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await requireUser();
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
    </div>
  );
}
