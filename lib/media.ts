// Session audio and photos, held in Render Key Value for at most 1 hour: long enough for the
// workflow to transcribe and read them, then deleted. Server-only.

import { createClient } from 'redis';

const TTL_SECONDS = 3600;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // OpenAI's transcription limit per file
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 8;

export type MediaKind = 'audio' | 'photo';
export type MediaItem = { mime: string; data: Buffer };

const connect = (url: string) =>
  createClient({ url })
    .on('error', (err) => console.error('Key Value error', err))
    .connect();

let clientPromise: ReturnType<typeof connect> | undefined;

function redis() {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL must be set (Render Key Value)');
  return (clientPromise ??= connect(process.env.REDIS_URL));
}

const indexKey = (sessionId: string, kind: MediaKind) => `media:${sessionId}:${kind}`;

export async function putMedia(sessionId: string, kind: MediaKind, mime: string, data: Buffer) {
  const client = await redis();
  const index = indexKey(sessionId, kind);
  const n = await client.incr(`${index}:count`);
  const key = `${index}:${n}`;
  await client
    .multi()
    .set(key, JSON.stringify({ mime, data: data.toString('base64') }), { EX: TTL_SECONDS })
    .rPush(index, key)
    .expire(index, TTL_SECONDS)
    .expire(`${index}:count`, TTL_SECONDS)
    .exec();
  return n;
}

export async function countMedia(sessionId: string, kind: MediaKind) {
  return (await redis()).lLen(indexKey(sessionId, kind));
}

export async function listMedia(sessionId: string, kind: MediaKind): Promise<MediaItem[]> {
  const client = await redis();
  const keys = await client.lRange(indexKey(sessionId, kind), 0, -1);
  const items: MediaItem[] = [];
  for (const key of keys) {
    const raw = await client.get(key);
    if (!raw) continue; // expired
    const { mime, data } = JSON.parse(raw) as { mime: string; data: string };
    items.push({ mime, data: Buffer.from(data, 'base64') });
  }
  return items;
}

export async function deleteMedia(sessionId: string, kind: MediaKind) {
  const client = await redis();
  const index = indexKey(sessionId, kind);
  const keys = await client.lRange(index, 0, -1);
  await client.del([...keys, index, `${index}:count`]);
}
