export const AUTH_COOKIE_NAME = 'nuzlocke_token';

// Shared default so the JWT's expiry and the cookie's maxAge can't drift
// apart when JWT_EXPIRES_IN_SECONDS is unset.
export const DEFAULT_JWT_EXPIRES_IN_SECONDS = 2_592_000; // 30 days
