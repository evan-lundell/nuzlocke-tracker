// Throws at call time (rather than letting a downstream library fail
// later with a less actionable error) when a required env var is unset.
// Use only for vars the app cannot run without at all — not for vars like
// the OAuth client credentials, which are allowed to be unset placeholders
// until the OAuth apps are registered.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See backend/.env.example.`,
    );
  }
  return value;
}
