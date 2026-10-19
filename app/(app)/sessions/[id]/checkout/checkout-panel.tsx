'use client';

// The PayPal button that places the hold. Uses the classic JS SDK with intent=authorize so
// the button matches the AUTHORIZE order the server creates. After approval it shows the
// held state in place of the button.

import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, ButtonLink, HeldNotCharged } from '@/components/ui';
import type { EscrowStateKey } from '@/lib/escrow-states';

const GENERIC_ERROR = 'Something went wrong with PayPal. Nothing was charged; please try again.';

async function post(url: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export function CheckoutPanel({
  sessionId,
  priceCents,
  initialState,
  clientId,
}: {
  sessionId: string;
  priceCents: number;
  initialState: EscrowStateKey | null;
  clientId: string | undefined;
}) {
  const router = useRouter();
  const [state, setState] = useState<EscrowStateKey | null>(initialState);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  // Set when PayPal approved but placing the hold failed, so the parent can retry without PayPal.
  const [approvedOrder, setApprovedOrder] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const options = useMemo(
    () => ({ clientId: clientId ?? '', intent: 'authorize', currency: 'USD', components: 'buttons' }),
    [clientId],
  );

  async function authorize(orderId: string) {
    const { ok, status, data } = await post(`/api/sessions/${sessionId}/authorize`, { orderId });
    if (!ok || typeof data.state !== 'string') {
      // 5xx means PayPal or the server hiccuped after approval; retrying the hold is safe.
      setApprovedOrder(status >= 500 ? orderId : null);
      setMessage({ text: typeof data.error === 'string' ? data.error : GENERIC_ERROR, error: true });
      return;
    }
    setApprovedOrder(null);
    setMessage(null);
    setState(data.state as EscrowStateKey);
    router.refresh();
  }

  if (state) {
    return (
      <div className="space-y-4">
        <HeldNotCharged cents={priceCents} />
        <p className="text-sm text-ink-soft">You’re booked. We’ll send the warm-up quiz before the session.</p>
        <ButtonLink href="/home">Go to your sessions</ButtonLink>
      </div>
    );
  }

  if (!clientId) {
    return (
      <p role="alert" className="text-sm text-state-appeal">
        PayPal isn’t set up on this server yet (NEXT_PUBLIC_PAYPAL_CLIENT_ID is missing). Nothing was charged.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <PayPalScriptProvider options={options}>
        <ScriptStatus />
        <PayPalButtons
          style={{ layout: 'vertical', shape: 'pill', label: 'paypal', height: 48 }}
          onClick={() => setMessage(null)}
          createOrder={async () => {
            const { ok, data } = await post(`/api/sessions/${sessionId}/order`);
            if (!ok || typeof data.orderId !== 'string') {
              if (typeof data.state === 'string') setState(data.state as EscrowStateKey);
              const text = typeof data.error === 'string' ? data.error : GENERIC_ERROR;
              setMessage({ text, error: true });
              throw new Error(text);
            }
            return data.orderId;
          }}
          onApprove={(approval) => authorize(approval.orderID)}
          onCancel={() =>
            setMessage({ text: 'You closed PayPal before approving. Nothing was held or charged. You can try again whenever you’re ready.', error: false })
          }
          // createOrder failures already set a specific message; keep it rather than the generic one.
          onError={() => setMessage((m) => (m?.error ? m : { text: GENERIC_ERROR, error: true }))}
        />
      </PayPalScriptProvider>
      {message && (
        <p role={message.error ? 'alert' : 'status'} className={message.error ? 'text-sm text-state-appeal' : 'text-sm text-ink-soft'}>
          {message.text}
        </p>
      )}
      {approvedOrder && (
        <Button
          variant="secondary"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            await authorize(approvedOrder);
            setRetrying(false);
          }}
        >
          {retrying ? 'Trying again…' : 'Try placing the hold again'}
        </Button>
      )}
    </div>
  );
}

function ScriptStatus() {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  if (isPending) return <div className="h-12 animate-pulse rounded-full bg-surface-2" aria-label="Loading PayPal" />;
  if (isRejected) {
    return (
      <p role="alert" className="text-sm text-state-appeal">
        PayPal didn’t load. Check your connection or turn off any blocker for paypal.com, then reload the page.
      </p>
    );
  }
  return null;
}
