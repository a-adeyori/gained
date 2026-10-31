// PayPal REST client: every call Gained makes to PayPal goes through here. It covers the
// escrow loop (authorize, capture, void, reauthorize), tutor payouts, and the catalog,
// invoicing, Transaction Search and balance reads the dashboard uses, with plain fetch and
// no SDK. Server-side only: it reads the client secret from the environment.

/** True only when PAYPAL_ENV=live; anything else stays on the sandbox so test keys never move real money. */
export const PAYPAL_LIVE = process.env.PAYPAL_ENV === 'live';
const BASE_URL = PAYPAL_LIVE ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const MAX_ATTEMPTS = 4;

export class PayPalApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    body: string,
  ) {
    super(`PayPal ${status} on ${path}: ${body.slice(0, 300)}`);
    this.name = 'PayPalApiError';
  }
}

let cachedToken: { value: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const { PAYPAL_CLIENT_ID: id, PAYPAL_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID and PAYPAL_SECRET must be set (see .env.local)');

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) throw new PayPalApiError(res.status, '/v1/oauth2/token', await res.text());

  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early so an in-flight request never carries an expired token.
  cachedToken = { value: access_token, expiresAt: Date.now() + (expires_in - 60) * 1000 };
  return access_token;
}

// `requestId` is sent as PayPal-Request-Id, so retrying a POST (here or in a workflow task)
// returns the original result instead of moving money twice.
async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, requestId?: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
        Prefer: 'return=representation',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    if (res.ok) {
      // Void returns 204 with no body.
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }

    // A revoked or expired token: drop it and mint a new one once.
    if (res.status === 401 && attempt === 1) {
      cachedToken = undefined;
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
      continue;
    }
    throw new PayPalApiError(res.status, path, await res.text());
  }
}

const get = <T>(path: string) => request<T>('GET', path);

export type Money = { value: string; currency_code: string };

// --- Escrow: authorize at booking, capture what was earned, release the rest -------
// Partial captures must be enabled on the PayPal business account, or the second capture fails.

export type AuthorizationStatus =
  | 'CREATED'
  | 'CAPTURED'
  | 'PARTIALLY_CAPTURED'
  | 'DENIED'
  | 'EXPIRED'
  | 'PENDING'
  | 'VOIDED';

export type Authorization = {
  id: string;
  status: AuthorizationStatus;
  amount: Money;
  create_time?: string;
  expiration_time?: string;
};

export type Capture = {
  id: string;
  status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'REFUNDED' | 'FAILED';
  amount: Money;
  final_capture?: boolean;
};

type Link = { href: string; rel: string };

export type Order = {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  links?: Link[];
  purchase_units?: { payments?: { authorizations?: Authorization[] } }[];
};

const usd = (cents: number): Money => ({ currency_code: 'USD', value: (cents / 100).toFixed(2) });

/** Booking: an order that holds the full price once the parent approves it. */
export async function createAuthorizeOrder(opts: {
  sessionId: string;
  priceCents: number;
  description: string;
  /** Only for redirect checkout; the in-page PayPal button doesn't need them. */
  returnUrl?: string;
  cancelUrl?: string;
}): Promise<{ orderId: string; approveUrl: string | undefined }> {
  const order = await request<Order>(
    'POST',
    '/v2/checkout/orders',
    {
      intent: 'AUTHORIZE',
      purchase_units: [
        {
          reference_id: opts.sessionId,
          custom_id: opts.sessionId,
          description: opts.description,
          amount: usd(opts.priceCents),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Gained',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'CONTINUE',
            ...(opts.returnUrl ? { return_url: opts.returnUrl, cancel_url: opts.cancelUrl } : {}),
          },
        },
      },
    },
    `session-${opts.sessionId}-order`,
  );
  const approveUrl = order.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
  return { orderId: order.id, approveUrl };
}

export function getOrder(orderId: string): Promise<Order> {
  return get<Order>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

/** After the parent approves: place the hold and return its authorization. */
export async function authorizeOrder(orderId: string): Promise<Authorization> {
  const order = await request<Order>(
    'POST',
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
    {},
    `order-${orderId}-authorize`,
  );
  const auth = order.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth) throw new Error(`Order ${orderId} authorized but returned no authorization`);
  return auth;
}

export function getAuthorization(authorizationId: string): Promise<Authorization> {
  return get<Authorization>(`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}`);
}

// Not exported: every capture goes through captureEscrow, so the freshness check can't be skipped.
function captureAuthorization(
  authorizationId: string,
  opts: { amountCents: number; finalCapture: boolean; key: string; noteToPayer?: string },
): Promise<Capture> {
  return request<Capture>(
    'POST',
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,
    {
      amount: usd(opts.amountCents),
      final_capture: opts.finalCapture,
      invoice_id: opts.key,
      ...(opts.noteToPayer ? { note_to_payer: opts.noteToPayer } : {}),
    },
    opts.key,
  );
}

/** Release the uncaptured remainder of a hold (or all of it) back to the payer. */
export async function voidAuthorization(authorizationId: string, key: string): Promise<void> {
  await request<void>('POST', `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, undefined, key);
}

/** Renew a hold past its honor period. Later captures must use the returned new ID. */
export function reauthorize(authorizationId: string, amountCents: number, key: string): Promise<Authorization> {
  return request<Authorization>(
    'POST',
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/reauthorize`,
    { amount: usd(amountCents) },
    key,
  );
}

// --- Escrow captures: refresh an aging hold once, then capture -----------------------

/** A hold older than this (PayPal's 3-day honor period) is reauthorized before capturing. */
export const REAUTHORIZE_AFTER_HOURS = 72;

/** The escrow fields the capture path reads and updates (a subset of the escrows row). */
export type EscrowAuth = {
  session_id: string;
  authorization_id: string;
  authorized_at: Date;
  reauthorized: boolean;
};

export type EscrowAuthPatch = Pick<EscrowAuth, 'authorization_id' | 'authorized_at' | 'reauthorized'>;

/**
 * Reauthorize the hold if it is more than 72 hours old and hasn't been reauthorized yet;
 * otherwise do nothing. A session is reauthorized at most once. On success the new
 * authorization ID is persisted through `save` before anything captures against it. On
 * failure the error is logged and the original escrow is returned, so the capture still runs.
 *
 * `holdCents` is the uncaptured amount the hold must still cover (the full price before the
 * base capture, the remainder after it).
 */
export async function ensureFreshAuthorization<E extends EscrowAuth>(
  escrow: E,
  opts: { holdCents: number; save: (patch: EscrowAuthPatch) => Promise<void>; now?: Date },
): Promise<E> {
  const now = opts.now ?? new Date();
  const ageHours = (now.getTime() - escrow.authorized_at.getTime()) / 3_600_000;
  if (ageHours <= REAUTHORIZE_AFTER_HOURS || escrow.reauthorized) return escrow;

  let fresh: Authorization;
  try {
    fresh = await reauthorize(escrow.authorization_id, opts.holdCents, `session-${escrow.session_id}-reauthorize`);
  } catch (err) {
    console.error(`Reauthorization failed for session ${escrow.session_id}; capturing on the original hold.`, err);
    return escrow;
  }
  const patch: EscrowAuthPatch = { authorization_id: fresh.id, authorized_at: now, reauthorized: true };
  await opts.save(patch);
  return { ...escrow, ...patch };
}

/**
 * Capture part of an escrow's hold, reauthorizing it first if needed. `finalCapture: true`
 * releases whatever is left back to the payer. `key` names the step (e.g. `session-42-base`)
 * and doubles as the idempotency key. Returns the escrow as it stands after any reauthorization.
 */
export async function captureEscrow<E extends EscrowAuth>(
  escrow: E,
  opts: {
    amountCents: number;
    finalCapture: boolean;
    key: string;
    holdCents: number;
    save: (patch: EscrowAuthPatch) => Promise<void>;
    noteToPayer?: string;
    now?: Date;
  },
): Promise<{ escrow: E; capture: Capture }> {
  const current = await ensureFreshAuthorization(escrow, opts);
  const capture = await captureAuthorization(current.authorization_id, opts);
  return { escrow: current, capture };
}

// --- Payouts -----------------------------------------------------------------------

export type PayoutBatch = {
  batch_header: { payout_batch_id: string; batch_status: string; sender_batch_header: { sender_batch_id: string } };
};

/**
 * Pay a tutor. `senderBatchId` must be unique per payout (`session-{id}-base`,
 * `session-{id}-bonus`): PayPal rejects a reused ID for 30 days, so a tutor is never paid twice.
 */
export function createPayout(opts: {
  senderBatchId: string;
  receiverEmail: string;
  amountCents: number;
  note: string;
}): Promise<PayoutBatch> {
  return request<PayoutBatch>(
    'POST',
    '/v1/payments/payouts',
    {
      sender_batch_header: {
        sender_batch_id: opts.senderBatchId,
        email_subject: 'You have a payout from Gained',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          receiver: opts.receiverEmail,
          amount: { value: (opts.amountCents / 100).toFixed(2), currency: 'USD' },
          note: opts.note,
          sender_item_id: opts.senderBatchId,
        },
      ],
    },
    opts.senderBatchId,
  );
}
