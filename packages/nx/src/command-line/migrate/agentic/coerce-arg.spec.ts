import { coerceAgenticArg } from './coerce-arg';

describe('coerceAgenticArg', () => {
  it('passes undefined through', () => {
    expect(coerceAgenticArg(undefined)).toBeUndefined();
  });

  it('maps truthy variants to true', () => {
    expect(coerceAgenticArg(true)).toBe(true);
    expect(coerceAgenticArg('')).toBe(true);
    expect(coerceAgenticArg('true')).toBe(true);
    expect(coerceAgenticArg('yes')).toBe(true);
  });

  it('maps falsy variants to false', () => {
    expect(coerceAgenticArg(false)).toBe(false);
    expect(coerceAgenticArg('false')).toBe(false);
    expect(coerceAgenticArg('no')).toBe(false);
  });

  it('passes recognized agent ids through unchanged', () => {
    expect(coerceAgenticArg('claude-code')).toBe('claude-code');
    expect(coerceAgenticArg('codex')).toBe('codex');
    expect(coerceAgenticArg('opencode')).toBe('opencode');
  });

  it('passes unknown strings through (upstream `.check` validates them)', () => {
    expect(coerceAgenticArg('whatever')).toBe('whatever');
  });

  it('falls back to undefined for unexpected types', () => {
    expect(coerceAgenticArg(42 as unknown)).toBeUndefined();
    expect(coerceAgenticArg(null as unknown)).toBeUndefined();
  });
});
