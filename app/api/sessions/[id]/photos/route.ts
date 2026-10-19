// A photo of a worked problem, resized in the browser. Held in Key Value for at most an hour.

import { handle, HttpError, json, sessionForTutor } from '@/lib/api';
import { countMedia, MAX_PHOTO_BYTES, MAX_PHOTOS, putMedia } from '@/lib/media';

export const POST = handle(async (req: Request, ctx: RouteContext<'/api/sessions/[id]/photos'>) => {
  const { id } = await ctx.params;
  const session = await sessionForTutor(id);
  if (!['live', 'booked'].includes(session.status)) throw new HttpError(409, 'This session has already ended.');

  const mime = req.headers.get('content-type') ?? '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new HttpError(415, 'Photos must be JPEG, PNG or WebP.');
  const data = Buffer.from(await req.arrayBuffer());
  if (!data.length || data.length > MAX_PHOTO_BYTES) throw new HttpError(413, 'Photos must be under 5 MB.');
  if ((await countMedia(id, 'photo')) >= MAX_PHOTOS) throw new HttpError(409, `Up to ${MAX_PHOTOS} photos per session.`);

  return json({ count: await putMedia(id, 'photo', mime, data) });
});
