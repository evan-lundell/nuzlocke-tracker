import { CookieOptions } from 'express';
import { DEFAULT_JWT_EXPIRES_IN_SECONDS } from './auth.constants';

// Shared by both the set (auth.controller's completeLogin) and clear
// (auth.controller's logout) call sites so their cookie attributes can
// never drift out of sync — a mismatch (e.g. differing `path`/`sameSite`)
// makes clearCookie silently no-op in the browser.
export function getAuthCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge:
      Number(
        process.env.JWT_EXPIRES_IN_SECONDS ?? DEFAULT_JWT_EXPIRES_IN_SECONDS,
      ) * 1000,
  };
}
