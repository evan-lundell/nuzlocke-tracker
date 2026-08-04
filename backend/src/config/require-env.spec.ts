import { requireEnv } from './require-env';

describe('requireEnv', () => {
  const KEY = 'REQUIRE_ENV_SPEC_TEST_VAR';

  afterEach(() => {
    delete process.env[KEY];
  });

  it('returns the value when set', () => {
    process.env[KEY] = 'a-value';

    expect(requireEnv(KEY)).toBe('a-value');
  });

  it('throws when unset', () => {
    delete process.env[KEY];

    expect(() => requireEnv(KEY)).toThrow(/REQUIRE_ENV_SPEC_TEST_VAR/);
  });

  it('throws when set to an empty string', () => {
    process.env[KEY] = '';

    expect(() => requireEnv(KEY)).toThrow();
  });
});
