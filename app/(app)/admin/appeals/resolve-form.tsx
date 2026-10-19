'use client';

import { useActionState, useState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { formatUsd } from '@/lib/escrow-states';
import { resolveAppeal } from '../actions';

export function ResolveForm({ appealId, priceCents, baseCents }: { appealId: string; priceCents: number; baseCents: number }) {
  const [state, action, pending] = useActionState(resolveAppeal.bind(null, appealId), undefined);
  const [decision, setDecision] = useState<'upheld' | 'adjusted'>('upheld');
  if (state?.ok) return <p className="text-sm text-gain-ink">{state.ok}</p>;
  return (
    <form action={action} className="space-y-3">
      <fieldset className="grid grid-cols-2 gap-2 text-sm">
        <legend className="sr-only">Decision</legend>
        {(['upheld', 'adjusted'] as const).map((d) => (
          <label key={d} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-full border ${decision === d ? 'border-ink' : 'border-line'}`}>
            <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} className="sr-only" />
            {d === 'upheld' ? 'Grade stands' : 'Override pay'}
          </label>
        ))}
      </fieldset>
      {decision === 'adjusted' && (
        <Field label="Total tutor pay" hint={`Between ${formatUsd(baseCents)} (base) and ${formatUsd(priceCents)}. The rest returns to the parent.`}>
          <input name="tutor_pay" inputMode="decimal" required className={inputClass} placeholder={(priceCents / 100).toFixed(2)} />
        </Field>
      )}
      <Field label="Note to the family and tutor">
        <textarea name="resolution" required rows={3} className={`${inputClass} py-2`} />
      </Field>
      {state?.error && <p role="alert" className="text-sm text-state-appeal">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        Resolve
      </Button>
    </form>
  );
}
