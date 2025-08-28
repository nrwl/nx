import { isRange, satisfiesRange } from './semver';

describe('semver utils', () => {
  describe('isRange', () => {
    it('should return true for caret ranges', () => {
      expect(isRange('^1.0.0')).toBe(true);
      expect(isRange('^1.2.3')).toBe(true);
      expect(isRange('^0.1.0')).toBe(true);
    });

    it('should return true for tilde ranges', () => {
      expect(isRange('~1.0.0')).toBe(true);
      expect(isRange('~1.2.3')).toBe(true);
      expect(isRange('~0.1.0')).toBe(true);
    });

    it('should return true for wildcard ranges', () => {
      expect(isRange('*')).toBe(true);
      expect(isRange('1.x')).toBe(true);
      expect(isRange('1.X')).toBe(true);
      expect(isRange('1.2.x')).toBe(true);
      expect(isRange('1.2.X')).toBe(true);
      expect(isRange('1.*')).toBe(true);
      expect(isRange('1.2.*')).toBe(true);
    });

    it('should return true for comparison ranges', () => {
      expect(isRange('>1.0.0')).toBe(true);
      expect(isRange('>=1.0.0')).toBe(true);
      expect(isRange('<1.0.0')).toBe(true);
      expect(isRange('<=1.0.0')).toBe(true);
      expect(isRange('=1.0.0')).toBe(true);
    });

    it('should return true for hyphen ranges', () => {
      expect(isRange('1.0.0 - 2.0.0')).toBe(true);
      expect(isRange('1.2.3-4.5.6')).toBe(true);
      expect(isRange('1.0.0-2.0.0')).toBe(true);
    });

    it('should return true for OR ranges', () => {
      expect(isRange('1.0.0 || 2.0.0')).toBe(true);
      expect(isRange('^1.0.0 || ^2.0.0')).toBe(true);
    });

    it('should return true for incomplete version strings', () => {
      expect(isRange('1')).toBe(true);
      expect(isRange('1.2')).toBe(true);
    });

    it('should return false for exact versions', () => {
      expect(isRange('1.0.0')).toBe(false);
      expect(isRange('1.2.3')).toBe(false);
      expect(isRange('0.1.0')).toBe(false);
      expect(isRange('10.20.30')).toBe(false);
    });

    it('should return false for build metadata versions', () => {
      expect(isRange('1.0.0+build.1')).toBe(false);
      expect(isRange('1.2.3+20230101')).toBe(false);
    });

    it('should return false for empty or invalid strings', () => {
      expect(isRange('')).toBe(false);
      expect(isRange('invalid')).toBe(false);
    });
  });

  describe('satisfiesRange', () => {
    it('should return true when version satisfies caret range', () => {
      expect(satisfiesRange('1.2.3', '^1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.5', '^1.0.0')).toBe(true);
      expect(satisfiesRange('1.9.9', '^1.0.0')).toBe(true);
    });

    it('should return false when version does not satisfy caret range', () => {
      expect(satisfiesRange('2.0.0', '^1.0.0')).toBe(false);
      expect(satisfiesRange('0.9.9', '^1.0.0')).toBe(false);
    });

    it('should return true when version satisfies tilde range', () => {
      expect(satisfiesRange('1.0.5', '~1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.9', '~1.0.0')).toBe(true);
    });

    it('should return false when version does not satisfy tilde range', () => {
      expect(satisfiesRange('1.1.0', '~1.0.0')).toBe(false);
      expect(satisfiesRange('2.0.0', '~1.0.0')).toBe(false);
    });

    it('should return true when version satisfies comparison range', () => {
      expect(satisfiesRange('1.2.0', '>1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.0', '>=1.0.0')).toBe(true);
      expect(satisfiesRange('0.9.0', '<1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.0', '<=1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.0', '=1.0.0')).toBe(true);
    });

    it('should return false when version does not satisfy comparison range', () => {
      expect(satisfiesRange('1.0.0', '>1.0.0')).toBe(false);
      expect(satisfiesRange('0.9.0', '>=1.0.0')).toBe(false);
      expect(satisfiesRange('1.0.0', '<1.0.0')).toBe(false);
      expect(satisfiesRange('1.0.1', '<=1.0.0')).toBe(false);
      expect(satisfiesRange('1.0.1', '=1.0.0')).toBe(false);
    });

    it('should return true when version satisfies hyphen range', () => {
      expect(satisfiesRange('1.5.0', '1.0.0 - 2.0.0')).toBe(true);
      expect(satisfiesRange('1.0.0', '1.0.0 - 2.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '1.0.0 - 2.0.0')).toBe(true);
    });

    it('should return false when version does not satisfy hyphen range', () => {
      expect(satisfiesRange('0.9.0', '1.0.0 - 2.0.0')).toBe(false);
      expect(satisfiesRange('2.0.1', '1.0.0 - 2.0.0')).toBe(false);
    });

    it('should return true when version satisfies OR range', () => {
      expect(satisfiesRange('1.0.0', '1.0.0 || 2.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '1.0.0 || 2.0.0')).toBe(true);
      expect(satisfiesRange('1.2.0', '^1.0.0 || ^2.0.0')).toBe(true);
      expect(satisfiesRange('2.5.0', '^1.0.0 || ^2.0.0')).toBe(true);
    });

    it('should return false when version does not satisfy OR range', () => {
      expect(satisfiesRange('3.0.0', '1.0.0 || 2.0.0')).toBe(false);
      expect(satisfiesRange('0.9.0', '^1.0.0 || ^2.0.0')).toBe(false);
      expect(satisfiesRange('3.0.0', '^1.0.0 || ^2.0.0')).toBe(false);
    });

    it('should return false for invalid ranges', () => {
      expect(satisfiesRange('1.0.0', 'invalid-range')).toBe(false);
      expect(satisfiesRange('1.0.0', 'not-a-range')).toBe(false);
    });

    it('should handle prerelease versions', () => {
      expect(satisfiesRange('1.0.0-alpha', '^1.0.0-alpha')).toBe(true);
      expect(satisfiesRange('1.0.0-beta.1', '^1.0.0-alpha')).toBe(true);
      expect(satisfiesRange('1.0.0-alpha', '^1.0.0')).toBe(false);
    });

    it('should handle build metadata', () => {
      expect(satisfiesRange('1.0.0+build.1', '^1.0.0')).toBe(true);
      expect(satisfiesRange('1.2.3+20230101', '^1.0.0')).toBe(true);
    });
  });
});
