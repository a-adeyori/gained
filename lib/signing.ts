// HMAC signing for the sign-in cookie and for quiz links, keyed by SESSION_SECRET.
// Server-only.

import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters');
  return value;
}

const mac = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** `payload.signature`, where payload is base64url JSON. */
export function sign(data: object): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${payload}.${mac(payload)}`;
}

export function verify<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, mac(payload))) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as T;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export async function checkPassword(password: string, stored: string | null): Promise<boolean> {
  const [scheme, salt, key] = stored?.split(':') ?? [];
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const actual = await scrypt(password, Buffer.from(salt, 'base64url'), 64);
  return safeEqual(actual.toString('base64url'), key);
}

export type LinkPurpose = 'verify' | 'reset';

/**
 * A signed, expiring token for an emailed link. The purpose is part of what's signed, so a
 * verification link can't be used to reset a password, and neither can pass as a sign-in cookie.
 */
export function signLink(purpose: LinkPurpose, data: object, ttlMs: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlMs })).toString('base64url');
  return `${payload}.${mac(`${purpose}:${payload}`)}`;
}

export function readLink<T>(purpose: LinkPurpose, token: string | undefined, now = Date.now()): T | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, mac(`${purpose}:${payload}`))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as T & { exp?: number };
    return typeof data.exp === 'number' && data.exp > now ? data : null;
  } catch {
    return null;
  }
}

/** A link token that lets a student open one quiz on their phone without signing in. */
export const quizToken = (quizId: string) => mac(`quiz:${quizId}`);
export const checkQuizToken = (quizId: string, token: string | undefined) => !!token && safeEqual(token, quizToken(quizId));
