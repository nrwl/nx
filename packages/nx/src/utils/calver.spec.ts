import { compareCalver, eq, gt, gte, lt, lte } from './calver';

describe('calver', () => {
  // Normalizes -0 to 0 so antisymmetry can be asserted with Object.is.
  const sign = (n: number) => Math.sign(n) || 0;

  describe('compareCalver', () => {
    it('orders segments numerically, not lexically', () => {
      // '15' < '5' lexically, so a string comparison would invert this.
      expect(sign(compareCalver('2510.28.15', '2510.28.5'))).toBe(1);
      expect(sign(compareCalver('2510.28.5', '2510.28.15'))).toBe(-1);
    });

    it('compares higher-order segments first', () => {
      expect(sign(compareCalver('2511.1.0', '2510.99.99'))).toBe(1);
      expect(sign(compareCalver('2510.30.1', '2510.28.5'))).toBe(1);
      expect(sign(compareCalver('2510.28.5', '2510.30.1'))).toBe(-1);
    });

    it('treats identical tags as equal', () => {
      expect(compareCalver('2510.30.1', '2510.30.1')).toBe(0);
    });

    it('treats a missing trailing segment as lower', () => {
      expect(sign(compareCalver('2510.28', '2510.28.1'))).toBe(-1);
      expect(sign(compareCalver('2510.28.1', '2510.28'))).toBe(1);
    });

    it('falls back to lexical ordering for non-numeric segments', () => {
      expect(sign(compareCalver('2510.28.rc1', '2510.28.rc2'))).toBe(-1);
      expect(sign(compareCalver('2510.28.5', '2510.28.rc1'))).toBe(-1);
    });

    it('orders deterministically regardless of argument order', () => {
      const versions = ['2510.28.5', '2510.28.15', '2511.1.0', '2510.30.1'];
      for (const a of versions) {
        for (const b of versions) {
          expect(sign(compareCalver(a, b))).toBe(sign(-compareCalver(b, a)));
        }
      }
    });

    it('sorts highest-first when used as a descending comparator', () => {
      const installed = ['2510.28.5', '2511.1.0', '2510.28.15', '2510.30.1'];
      installed.sort((a, b) => compareCalver(b, a));
      expect(installed).toEqual([
        '2511.1.0',
        '2510.30.1',
        '2510.28.15',
        '2510.28.5',
      ]);
    });
  });

  describe('predicates', () => {
    it('gt is strict', () => {
      expect(gt('2510.30.1', '2510.28.5')).toBe(true);
      expect(gt('2510.28.5', '2510.30.1')).toBe(false);
      expect(gt('2510.30.1', '2510.30.1')).toBe(false);
    });

    it('gte admits equality, which is what lets a waiter adopt', () => {
      expect(gte('2510.30.1', '2510.28.5')).toBe(true);
      expect(gte('2510.30.1', '2510.30.1')).toBe(true);
      expect(gte('2510.28.5', '2510.30.1')).toBe(false);
    });

    it('lt is strict', () => {
      expect(lt('2510.28.5', '2510.30.1')).toBe(true);
      expect(lt('2510.30.1', '2510.28.5')).toBe(false);
      expect(lt('2510.30.1', '2510.30.1')).toBe(false);
    });

    it('lte admits equality', () => {
      expect(lte('2510.28.5', '2510.30.1')).toBe(true);
      expect(lte('2510.30.1', '2510.30.1')).toBe(true);
      expect(lte('2510.30.1', '2510.28.5')).toBe(false);
    });

    it('eq matches only identical ordering', () => {
      expect(eq('2510.30.1', '2510.30.1')).toBe(true);
      expect(eq('2510.30.1', '2510.28.5')).toBe(false);
    });
  });
});
