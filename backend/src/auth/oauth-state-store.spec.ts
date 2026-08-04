import { Request } from 'express';
import { OAuthStateStore } from './oauth-state-store';

describe('OAuthStateStore', () => {
  const COOKIE_NAME = 'test_oauth_state';
  let store: OAuthStateStore;
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

  beforeEach(() => {
    store = new OAuthStateStore(COOKIE_NAME);
    res = { cookie: jest.fn(), clearCookie: jest.fn() };
  });

  const buildRequest = (cookies: Record<string, string> = {}): Request =>
    ({ res, cookies }) as unknown as Request;

  describe('store', () => {
    it('sets a cookie and returns its value as the state handle (3-arg call)', () => {
      const req = buildRequest();
      const callback = jest.fn();

      store.store(req, {} as never, callback);

      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({ httpOnly: true, path: '/auth' }),
      );
      const [, nonce] = res.cookie.mock.calls[0] as [string, string];
      expect(callback).toHaveBeenCalledWith(null, nonce);
    });

    it('supports the 2-arg call form (callback as the second argument)', () => {
      const req = buildRequest();
      const callback = jest.fn();

      store.store(req, callback);

      expect(res.cookie).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(null, expect.any(String));
    });

    it('errors out when the request has no attached response object', () => {
      const req = { cookies: {} } as unknown as Request;
      const callback = jest.fn();

      store.store(req, {} as never, callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error), null);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('generates a different nonce on each call', () => {
      const req = buildRequest();
      const callback = jest.fn();

      store.store(req, {} as never, callback);
      store.store(req, {} as never, callback);

      const [, firstNonce] = callback.mock.calls[0] as [null, string];
      const [, secondNonce] = callback.mock.calls[1] as [null, string];
      expect(firstNonce).not.toBe(secondNonce);
    });
  });

  describe('verify', () => {
    it('succeeds when the provided state matches the cookie, and clears the cookie', () => {
      const req = buildRequest({ [COOKIE_NAME]: 'matching-nonce' });
      const callback = jest.fn();

      store.verify(req, 'matching-nonce', {} as never, callback);

      expect(callback).toHaveBeenCalledWith(null, true, undefined);
      expect(res.clearCookie).toHaveBeenCalledWith(
        COOKIE_NAME,
        expect.objectContaining({ path: '/auth' }),
      );
    });

    it('supports the 3-arg call form (callback as the third argument)', () => {
      const req = buildRequest({ [COOKIE_NAME]: 'matching-nonce' });
      const callback = jest.fn();

      store.verify(req, 'matching-nonce', callback);

      expect(callback).toHaveBeenCalledWith(null, true, undefined);
    });

    it('fails when no state cookie was set', () => {
      const req = buildRequest();
      const callback = jest.fn();

      store.verify(req, 'some-state', {} as never, callback);

      const [, ok, info] = callback.mock.calls[0] as [
        null,
        boolean,
        { message: string },
      ];
      expect(ok).toBe(false);
      expect(info.message).toEqual(expect.any(String));
    });

    it('fails when the provided state does not match the cookie', () => {
      const req = buildRequest({ [COOKIE_NAME]: 'expected-nonce' });
      const callback = jest.fn();

      store.verify(req, 'attacker-supplied-state', {} as never, callback);

      const [, ok, info] = callback.mock.calls[0] as [
        null,
        boolean,
        { message: string },
      ];
      expect(ok).toBe(false);
      expect(info.message).toEqual(expect.any(String));
    });
  });
});
