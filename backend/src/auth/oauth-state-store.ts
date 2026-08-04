import { randomBytes } from 'crypto';
import type { Request } from 'express';
import type OAuth2Strategy from 'passport-oauth2';

const STATE_COOKIE_MAX_AGE_MS = 5 * 60 * 1000; // long enough for the provider's consent screen

// passport-oauth2's built-in state stores (SessionStore/NonceStore) require
// req.session, which this app deliberately doesn't have — auth is stateless
// JWT, no session middleware. Without *some* state store the strategy falls
// back to a no-op NullStore, leaving the OAuth login flow open to CSRF (a
// third party could initiate/complete a login on the victim's behalf).
//
// This implements the same store contract passport-oauth2 expects, backed
// by a short-lived, httpOnly, single-use cookie instead of a session: a
// random nonce is set before redirecting to the provider, then compared
// against the `state` query param the provider echoes back on the callback.
export class OAuthStateStore implements OAuth2Strategy.StateStore {
  constructor(private readonly cookieName: string) {}

  store(
    req: Request,
    metaOrCallback:
      OAuth2Strategy.Metadata | OAuth2Strategy.StateStoreStoreCallback,
    callback?: OAuth2Strategy.StateStoreStoreCallback,
  ): void {
    const done = (
      typeof metaOrCallback === 'function' ? metaOrCallback : callback
    )!;
    const res = req.res;
    if (!res) {
      done(
        new Error('OAuthStateStore requires access to the response object'),
        null,
      );
      return;
    }

    const nonce = randomBytes(24).toString('hex');
    res.cookie(this.cookieName, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // 'lax' (not 'none'): this cookie only needs to survive a top-level
      // GET navigation (provider's redirect back to our callback URL),
      // which Lax already allows cross-site.
      sameSite: 'lax',
      path: '/auth',
      maxAge: STATE_COOKIE_MAX_AGE_MS,
    });
    done(null, nonce);
  }

  verify(
    req: Request,
    providedState: string,
    metaOrCallback:
      OAuth2Strategy.Metadata | OAuth2Strategy.StateStoreVerifyCallback,
    callback?: OAuth2Strategy.StateStoreVerifyCallback,
  ): void {
    const done = (
      typeof metaOrCallback === 'function' ? metaOrCallback : callback
    )!;
    // Single-use: clear it immediately regardless of outcome.
    req.res?.clearCookie(this.cookieName, { path: '/auth' });

    const cookieState = req.cookies?.[this.cookieName] as unknown;
    if (!cookieState || typeof cookieState !== 'string') {
      done(null, false, {
        message: 'Unable to verify authorization request state.',
      });
      return;
    }
    if (cookieState !== providedState) {
      done(null, false, { message: 'Invalid authorization request state.' });
      return;
    }
    done(null, true, undefined);
  }
}
