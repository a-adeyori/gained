// Sessions are online, on the tutor's own reusable meeting link: a Zoom Personal Room or a
// Google Meet link. Safe to import from client components.

const SERVICES = [
  { name: 'Zoom', host: (h: string) => h === 'zoom.us' || h.endsWith('.zoom.us') },
  { name: 'Google Meet', host: (h: string) => h === 'meet.google.com' },
] as const;

export type MeetingService = (typeof SERVICES)[number]['name'];

/** The tidied link, or an error a tutor can act on. */
export function parseMeetingLink(raw: string): { ok: true; link: string } | { ok: false; error: string } {
  const text = raw.trim();
  let url: URL;
  try {
    // People often paste "zoom.us/j/123" without the scheme.
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, error: 'That doesn’t look like a link. Paste your Zoom or Google Meet link.' };
  }
  if (!SERVICES.some((s) => s.host(url.hostname.toLowerCase()))) {
    return { ok: false, error: 'Use a Zoom (zoom.us) or Google Meet (meet.google.com) link.' };
  }
  url.protocol = 'https:';
  return { ok: true, link: url.toString() };
}

/** Which service a saved link is on, for "Join on …" buttons. */
export function meetingService(link: string): MeetingService | null {
  try {
    const host = new URL(link).hostname.toLowerCase();
    return SERVICES.find((s) => s.host(host))?.name ?? null;
  } catch {
    return null;
  }
}
