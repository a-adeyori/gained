// Time zones are IANA names like "America/Chicago". Pages show times in the device's zone
// (components/local-time.tsx); emails use the zone saved on the account (users.time_zone).
// Safe for the browser.

/** Whether `tz` is a time zone this runtime knows, e.g. "America/Chicago". */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The US zones, by the names people know them by, shown first on the Account page. */
export const US_TIME_ZONES = [
  { tz: 'America/New_York', name: 'Eastern Time' },
  { tz: 'America/Chicago', name: 'Central Time' },
  { tz: 'America/Denver', name: 'Mountain Time' },
  { tz: 'America/Phoenix', name: 'Mountain Time (Arizona)' },
  { tz: 'America/Los_Angeles', name: 'Pacific Time' },
  { tz: 'America/Anchorage', name: 'Alaska Time' },
  { tz: 'Pacific/Honolulu', name: 'Hawaii Time' },
] as const;

// The IANA list has 150+ "America/…" zones, mostly US towns that share the zones above. Outside
// the US, these cover the Americas' main zones; everywhere else keeps its full list.
const OTHER_AMERICAS = [
  'America/St_Johns',
  'America/Halifax',
  'America/Toronto',
  'America/Winnipeg',
  'America/Edmonton',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Guatemala',
  'America/Panama',
  'America/Jamaica',
  'America/Puerto_Rico',
  'America/Bogota',
  'America/Lima',
  'America/Caracas',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
];

/** Every zone the Account page offers below the US ones, sorted. */
export function otherTimeZones(): string[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];
  const us = new Set<string>(US_TIME_ZONES.map((z) => z.tz));
  return [...all.filter((tz) => !tz.startsWith('America/') && !us.has(tz)), ...OTHER_AMERICAS.filter(isTimeZone)].sort();
}

const abbreviation = (tz: string, at: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;

/** "America/Chicago" → "Central Time (CST)"; "Africa/Lagos" → "Africa / Lagos (GMT+1)". */
export function timeZoneLabel(tz: string, at = new Date()) {
  const us = US_TIME_ZONES.find((z) => z.tz === tz);
  const abbr = abbreviation(tz, at);
  const name = us ? us.name : tz.replaceAll('_', ' ').replaceAll('/', ' / ');
  return `${name}${abbr ? ` (${abbr})` : ''}`;
}
