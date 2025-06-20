import { normalizeOptions } from './normalize-options';

describe('normalizeOptions', () => {
  it('should apply defaults and override undefined user options', () => {
    const defaults = { a: 1, b: 2, c: 3 };
    const user = { a: 10 };
    const result = normalizeOptions<typeof defaults>(user, defaults);
    expect(result).toEqual({ a: 10, b: 2, c: 3 });
  });

  it('should handle empty user options', () => {
    const defaults = { a: 1, b: 2 };
    expect(normalizeOptions(undefined, defaults)).toEqual(defaults);
    expect(normalizeOptions({}, defaults)).toEqual(defaults);
  });

  it('should work with partial defaults (Partial<T>)', () => {
    const defaults = { a: 1 } as Partial<{ a: number; b: number }>;
    const user = { b: 2 };
    const result = normalizeOptions(user, defaults);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should return an empty object if both options and defaults are empty', () => {
    expect(normalizeOptions({}, {})).toEqual({});
    expect(normalizeOptions(undefined, {})).toEqual({});
  });

  it('should not modify the original options or defaults objects', () => {
    const defaults = { a: 1, b: 2 };
    const user = { a: 10 };
    const originalDefaults = { ...defaults };
    const originalUser = { ...user };

    normalizeOptions(user, defaults);

    expect(defaults).toEqual(originalDefaults);
    expect(user).toEqual(originalUser);
  });

  it('should not deep merge nested objects, that should be done per option if needed or handled by the consuming code', () => {
    const defaults = { a: { x: 1, y: 2 }, b: 2 };
    const user = { a: { x: 10 } };
    const result = normalizeOptions(user, defaults);
    expect(result).toEqual({ a: { x: 10 }, b: 2 });
  });
});
