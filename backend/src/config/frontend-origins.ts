// FRONTEND_ORIGIN is a comma-separated allowlist (CORS may need to trust
// more than one origin — e.g. a preview deploy alongside production).
// getPrimaryFrontendOrigin() exists for call sites that need exactly one
// URL (a redirect target) rather than the whole allowlist.
export function getFrontendOrigins(): string[] {
  return (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getPrimaryFrontendOrigin(): string {
  return getFrontendOrigins()[0] ?? '/';
}
