import {
  getFrontendOrigins,
  getPrimaryFrontendOrigin,
} from './frontend-origins';

describe('frontend-origins', () => {
  const originalEnv = process.env.FRONTEND_ORIGIN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.FRONTEND_ORIGIN;
    } else {
      process.env.FRONTEND_ORIGIN = originalEnv;
    }
  });

  describe('getFrontendOrigins', () => {
    it('splits a comma-separated allowlist and trims whitespace', () => {
      process.env.FRONTEND_ORIGIN =
        'http://localhost:5173, https://staging.example.com';

      expect(getFrontendOrigins()).toEqual([
        'http://localhost:5173',
        'https://staging.example.com',
      ]);
    });

    it('returns an empty array when unset', () => {
      delete process.env.FRONTEND_ORIGIN;

      expect(getFrontendOrigins()).toEqual([]);
    });
  });

  describe('getPrimaryFrontendOrigin', () => {
    it('returns only the first origin from a multi-origin allowlist', () => {
      process.env.FRONTEND_ORIGIN =
        'http://localhost:5173,https://staging.example.com';

      expect(getPrimaryFrontendOrigin()).toBe('http://localhost:5173');
    });

    it('falls back to "/" when unset', () => {
      delete process.env.FRONTEND_ORIGIN;

      expect(getPrimaryFrontendOrigin()).toBe('/');
    });
  });
});
