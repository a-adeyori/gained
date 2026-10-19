// One recording file from the browser's MediaRecorder (the recorder restarts every 60 minutes,
// so a long session uploads several). Held in Key Value for at most an hour.

import { db } from '@/lib/db';
import { handle, HttpError, json, sessionForTutor } from '@/lib/api';
import { MAX_AUDIO_BYTES, putMedia } from '@/lib/media';

export const POST = handle(async (req: Request, ctx: RouteContext<'/api/sessions/[id]/audio'>) => {
  const { id } = await ctx.params;
  const session = await sessionForTutor(id);
  if (!session.consent_recording) throw new HttpError(403, 'Recording wasn’t consented to for this session.');
  if (!['live', 'booked'].includes(session.status)) throw new HttpError(409, 'This session has already ended.');

  const mime = req.headers.get('content-type') ?? '';
  if (!/^audio\/(webm|mp4|mpeg|wav|x-m4a)/.test(mime)) throw new HttpError(415, 'Unsupported audio format.');
  const data = Buffer.from(await req.arrayBuffer());
  if (!data.length) throw new HttpError(400, 'The recording was empty.');
  if (data.length > MAX_AUDIO_BYTES) throw new HttpError(413, 'Recording files must be 25 MB or less.');

  const part = await putMedia(id, 'audio', mime, data);
  if (session.status === 'booked') await db.session.update({ where: { id }, data: { status: 'live' } });
  return json({ part });
});
