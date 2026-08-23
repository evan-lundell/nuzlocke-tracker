import { parseTypeLockMode } from './type-lock';

describe('parseTypeLockMode', () => {
  it('returns PRIMARY when config.mode is PRIMARY', () => {
    expect(parseTypeLockMode({ mode: 'PRIMARY' })).toBe('PRIMARY');
  });

  it('returns PICK when config.mode is PICK', () => {
    expect(parseTypeLockMode({ mode: 'PICK' })).toBe('PICK');
  });

  it('defaults to PICK when config is null', () => {
    expect(parseTypeLockMode(null)).toBe('PICK');
  });

  it('defaults to PICK when config is undefined', () => {
    expect(parseTypeLockMode(undefined)).toBe('PICK');
  });

  it('defaults to PICK when config is not an object', () => {
    expect(parseTypeLockMode('PRIMARY')).toBe('PICK');
  });

  it('defaults to PICK when config.mode is an unrecognized value', () => {
    expect(parseTypeLockMode({ mode: 'something-else' })).toBe('PICK');
  });
});
