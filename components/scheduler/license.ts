// Registers the Bryntum licence key before the first scheduler is created. Without a key, Bryntum
// runs as an unregistered trial. The key isn't a secret (it ships to the browser and is only
// verified there), but it stays out of Git: set NEXT_PUBLIC_BRYNTUM_LICENSE_KEY in .env.local and Render.

const key = process.env.NEXT_PUBLIC_BRYNTUM_LICENSE_KEY;
if (key) (globalThis.bryntum ??= {} as typeof bryntum).licenseKey = key;
