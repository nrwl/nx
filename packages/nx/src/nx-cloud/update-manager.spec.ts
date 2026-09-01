import { compareBundleVersions } from './update-manager';

describe('compareBundleVersions', () => {
  // Normalizes -0 to 0 so antisymmetry can be asserted with Object.is.
  const sign = (n: number) => Math.sign(n) || 0;

  it('orders calver tags by numeric segment, not lexically', () => {
    // '15' < '5' lexically, so a string comparison would invert this.
    expect(sign(compareBundleVersions('2510.28.15', '2510.28.5'))).toBe(1);
    expect(sign(compareBundleVersions('2510.28.5', '2510.28.15'))).toBe(-1);
  });

  it('compares higher-order segments first', () => {
    expect(sign(compareBundleVersions('2511.1.0', '2510.99.99'))).toBe(1);
    expect(sign(compareBundleVersions('2510.30.1', '2510.28.5'))).toBe(1);
    expect(sign(compareBundleVersions('2510.28.5', '2510.30.1'))).toBe(-1);
  });

  it('treats identical versions as equal so a waiter adopts them', () => {
    expect(compareBundleVersions('2510.30.1', '2510.30.1')).toBe(0);
  });

  it('treats a missing trailing segment as lower', () => {
    expect(sign(compareBundleVersions('2510.28', '2510.28.1'))).toBe(-1);
    expect(sign(compareBundleVersions('2510.28.1', '2510.28'))).toBe(1);
  });

  it('falls back to lexical ordering for non-numeric segments', () => {
    expect(sign(compareBundleVersions('2510.28.rc1', '2510.28.rc2'))).toBe(-1);
    expect(sign(compareBundleVersions('2510.28.5', '2510.28.rc1'))).toBe(-1);
  });

  it('orders deterministically regardless of argument order', () => {
    const versions = ['2510.28.5', '2510.28.15', '2511.1.0', '2510.30.1'];
    for (const a of versions) {
      for (const b of versions) {
        expect(sign(compareBundleVersions(a, b))).toBe(
          sign(-compareBundleVersions(b, a))
        );
      }
    }
  });

  it('sorts a set of installed bundles highest-first', () => {
    const installed = ['2510.28.5', '2511.1.0', '2510.28.15', '2510.30.1'];
    installed.sort((a, b) => compareBundleVersions(b, a));
    expect(installed).toEqual([
      '2511.1.0',
      '2510.30.1',
      '2510.28.15',
      '2510.28.5',
    ]);
  });
});
