import { normalizeExtensions } from './normalize-extensions';

describe('normalizeExtensions', () => {
  it('returns undefined for non-arrays', () => {
    expect(normalizeExtensions(undefined)).toBeUndefined();
    expect(normalizeExtensions(null as any)).toBeUndefined();
    expect(normalizeExtensions('foo' as any)).toBeUndefined();
  });

  it('returns empty array as is', () => {
    expect(normalizeExtensions([])).toEqual([]);
  });

  it('normalizes, trims, strips dots, lowercases, and dedupes', () => {
    expect(
      normalizeExtensions([
        '  .JS ',
        'js',
        'TS',
        '.ts',
        'Ts',
        'tsx',
        ' TSX ',
        '',
        '.',
        '  ',
      ])
    ).toEqual(['js', 'ts', 'tsx']);
  });

  it('filters out empty/invalid after normalization', () => {
    expect(normalizeExtensions(['', '   ', '.', '...'])).toEqual([]);
  });
});
