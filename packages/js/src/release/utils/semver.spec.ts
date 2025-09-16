import { isMatchingDependencyRange } from './semver';

describe('semver utils', () => {
  describe('satisfiesRange', () => {
    it('should return true when version satisfies caret range', () => {
      expect(isMatchingDependencyRange('1.2.3', '^1.0.0')).toBe(true);
      expect(isMatchingDependencyRange('1.0.5', '^1.0.0')).toBe(true);
      expect(isMatchingDependencyRange('1.9.9', '^1.0.0')).toBe(true);
    });

    it('should return false when version does not satisfy caret range', () => {
      expect(isMatchingDependencyRange('2.0.0', '^1.0.0')).toBe(false);
      expect(isMatchingDependencyRange('0.9.9', '^1.0.0')).toBe(false);
    });

    it('should return true when version satisfies tilde range', () => {
      expect(isMatchingDependencyRange('1.0.5', '~1.0.0')).toBe(true);
      expect(isMatchingDependencyRange('1.0.9', '~1.0.0')).toBe(true);
    });

    it('should return false when version does not satisfy tilde range', () => {
      expect(isMatchingDependencyRange('1.1.0', '~1.0.0')).toBe(false);
      expect(isMatchingDependencyRange('2.0.0', '~1.0.0')).toBe(false);
    });

    it('should return true when version satisfies comparison range', () => {
      expect(isMatchingDependencyRange('1.2.0', '>1.0.0')).toBe(true);
      expect(isMatchingDependencyRange('1.0.0', '>=1.0.0')).toBe(true);
      expect(isMatchingDependencyRange('0.9.0', '<1.0.0')).toBe(true);
      expect(isMatchingDependencyRange('1.0.0', '<=1.0.0')).toBe(true);
      expect(isMatchingDependencyRange('1.0.0', '=1.0.0')).toBe(true);
    });

    it('should return false when version does not satisfy comparison range', () => {
      expect(isMatchingDependencyRange('1.0.0', '>1.0.0')).toBe(false);
      expect(isMatchingDependencyRange('0.9.0', '>=1.0.0')).toBe(false);
      expect(isMatchingDependencyRange('1.0.0', '<1.0.0')).toBe(false);
      expect(isMatchingDependencyRange('1.0.1', '<=1.0.0')).toBe(false);
      expect(isMatchingDependencyRange('1.0.1', '=1.0.0')).toBe(false);
    });

    it('should return true when version satisfies hyphen range', () => {
      expect(isMatchingDependencyRange('1.5.0', '1.0.0 - 2.0.0')).toBe(true);
      expect(isMatchingDependencyRange('1.0.0', '1.0.0 - 2.0.0')).toBe(true);
      expect(isMatchingDependencyRange('2.0.0', '1.0.0 - 2.0.0')).toBe(true);
    });

    it('should return false when version does not satisfy hyphen range', () => {
      expect(isMatchingDependencyRange('0.9.0', '1.0.0 - 2.0.0')).toBe(false);
      expect(isMatchingDependencyRange('2.0.1', '1.0.0 - 2.0.0')).toBe(false);
    });

    it('should return true when version satisfies OR range', () => {
      expect(isMatchingDependencyRange('1.0.0', '1.0.0 || 2.0.0')).toBe(true);
      expect(isMatchingDependencyRange('2.0.0', '1.0.0 || 2.0.0')).toBe(true);
      expect(isMatchingDependencyRange('1.2.0', '^1.0.0 || ^2.0.0')).toBe(true);
      expect(isMatchingDependencyRange('2.5.0', '^1.0.0 || ^2.0.0')).toBe(true);
    });

    it('should return false when version does not satisfy OR range', () => {
      expect(isMatchingDependencyRange('3.0.0', '1.0.0 || 2.0.0')).toBe(false);
      expect(isMatchingDependencyRange('0.9.0', '^1.0.0 || ^2.0.0')).toBe(
        false
      );
      expect(isMatchingDependencyRange('3.0.0', '^1.0.0 || ^2.0.0')).toBe(
        false
      );
    });

    it('should return false for invalid ranges', () => {
      expect(isMatchingDependencyRange('1.0.0', 'invalid-range')).toBe(false);
      expect(isMatchingDependencyRange('1.0.0', 'not-a-range')).toBe(false);
    });

    it('should handle prerelease versions', () => {
      expect(isMatchingDependencyRange('1.0.0-alpha', '^1.0.0-alpha')).toBe(
        true
      );
      expect(isMatchingDependencyRange('1.0.0-beta.1', '^1.0.0-alpha')).toBe(
        true
      );
      expect(isMatchingDependencyRange('1.0.0-alpha', '^1.0.0')).toBe(false);
    });

    it('should handle build metadata', () => {
      expect(isMatchingDependencyRange('1.0.0+build.1', '^1.0.0')).toBe(true);
      expect(isMatchingDependencyRange('1.2.3+20230101', '^1.0.0')).toBe(true);
    });
  });
});
