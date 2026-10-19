// Speech-to-text for session recordings with OpenAI's gpt-transcribe. Server-only.

import OpenAI, { toFile } from 'openai';

let client: OpenAI | undefined;
const openai = () => (client ??= new OpenAI());

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-m4a': 'm4a',
};

/** One recording file (Chrome records webm, Safari mp4). Files must be 25 MB or less. */
export async function transcribe(data: Buffer, mime: string): Promise<string> {
  const base = mime.split(';')[0].trim();
  const file = await toFile(data, `session.${EXTENSIONS[base] ?? 'webm'}`, { type: base });
  const result = await openai().audio.transcriptions.create({ model: 'gpt-transcribe', file });
  return result.text;
}
