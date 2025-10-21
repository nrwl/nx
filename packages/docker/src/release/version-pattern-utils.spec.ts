import { interpolateVersionPattern } from './version-pattern-utils';
import * as gitUtils from 'nx/src/utils/git-utils';

jest.mock('nx/src/utils/git-utils');

describe('version-pattern-utils', () => {
  const mockGetLatestCommitSha =
    gitUtils.getLatestCommitSha as jest.MockedFunction<
      typeof gitUtils.getLatestCommitSha
    >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLatestCommitSha.mockReturnValue(
      'abc123456789def0123456789abcdef012345678'
    );
  });

  describe('interpolateVersionPattern', () => {
    it('should interpolate projectName token', () => {
      const result = interpolateVersionPattern('{projectName}', {
        projectName: 'my-app',
      });
      expect(result).toBe('my-app');
    });

    it('should interpolate commitSha token', () => {
      const result = interpolateVersionPattern('{commitSha}', {});
      expect(result).toBe('abc123456789def0123456789abcdef012345678');
    });

    it('should interpolate shortCommitSha token', () => {
      const result = interpolateVersionPattern('{shortCommitSha}', {});
      expect(result).toBe('abc1234');
    });

    it('should use provided commitSha when available', () => {
      const result = interpolateVersionPattern('{commitSha}', {
        commitSha: 'custom-sha',
      });
      expect(result).toBe('custom-sha');
    });

    it('should use provided shortCommitSha when available', () => {
      const result = interpolateVersionPattern('{shortCommitSha}', {
        shortCommitSha: 'short',
      });
      expect(result).toBe('short');
    });

    it('should interpolate currentDate token with ISO format by default', () => {
      const testDate = new Date('2024-01-15T10:30:45.000Z');
      const result = interpolateVersionPattern('{currentDate}', {
        currentDate: testDate,
      });
      expect(result).toBe('2024-01-15T10:30:45.000Z');
    });

    it('should interpolate currentDate with custom format YYYY.MM.DD', () => {
      const testDate = new Date('2024-01-15T10:30:45.000Z');
      const result = interpolateVersionPattern('{currentDate|YYYY.MM.DD}', {
        currentDate: testDate,
      });
      expect(result).toBe('2024.01.15');
    });

    it('should interpolate currentDate with custom format YY.MM.DD', () => {
      const testDate = new Date('2024-01-15T10:30:45.000Z');
      const result = interpolateVersionPattern('{currentDate|YY.MM.DD}', {
        currentDate: testDate,
      });
      expect(result).toBe('24.01.15');
    });

    it('should interpolate currentDate with custom format YYMM.DD', () => {
      const testDate = new Date('2024-01-15T10:30:45.000Z');
      const result = interpolateVersionPattern('{currentDate|YYMM.DD}', {
        currentDate: testDate,
      });
      expect(result).toBe('2401.15');
    });

    it('should interpolate currentDate with time format HH:mm:ss', () => {
      const testDate = new Date('2024-01-15T10:30:45.000Z');
      const result = interpolateVersionPattern('{currentDate|HH:mm:ss}', {
        currentDate: testDate,
      });
      expect(result).toBe('10:30:45');
    });

    it('should handle complex patterns with multiple tokens', () => {
      const testDate = new Date('2024-01-15T10:30:45.000Z');
      const result = interpolateVersionPattern(
        '{projectName}-{currentDate|YYMM.DD}.{shortCommitSha}',
        {
          projectName: 'api',
          currentDate: testDate,
        }
      );
      expect(result).toBe('api-2401.15.abc1234');
    });

    it('should keep unknown tokens unchanged', () => {
      const result = interpolateVersionPattern('{unknownToken}', {
        projectName: 'my-app',
      });
      expect(result).toBe('{unknownToken}');
    });

    it('should handle empty pattern', () => {
      const result = interpolateVersionPattern('', {
        projectName: 'my-app',
      });
      expect(result).toBe('');
    });

    it('should handle pattern without tokens', () => {
      const result = interpolateVersionPattern('1.2.3', {
        projectName: 'my-app',
      });
      expect(result).toBe('1.2.3');
    });

    it('should handle missing projectName', () => {
      const result = interpolateVersionPattern('{projectName}', {});
      expect(result).toBe('');
    });

    it('should use current date when not provided', () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-07-25'));
      const result = interpolateVersionPattern('{currentDate|YYYY}', {});

      // Should be current year
      const year = new Date().getFullYear().toString();
      expect(result).toBe(year);
    });

    it('should handle malformed date format tokens gracefully', () => {
      const testDate = new Date('2024-01-15T10:30:45.000Z');
      const result = interpolateVersionPattern('{currentDate|invalid}', {
        currentDate: testDate,
      });
      // Should keep unknown format identifiers as-is
      expect(result).toBe('invalid');
    });

    it('should handle nested braces in format', () => {
      const result = interpolateVersionPattern('{projectName}-{version}', {
        projectName: 'app-{prod}',
      });
      expect(result).toBe('app-{prod}-{version}');
    });

    it('should substitute versionActionsVersion token when provided', () => {
      const result = interpolateVersionPattern(
        '{projectName}-{versionActionsVersion}',
        {
          projectName: 'app',
          versionActionsVersion: '1.2.3',
        }
      );
      expect(result).toBe('app-1.2.3');
    });

    it('should return versionActionsVersion when pattern is just versionActionsVersion token', () => {
      const result = interpolateVersionPattern('{versionActionsVersion}', {
        versionActionsVersion: '4.5.6',
      });
      expect(result).toBe('4.5.6');
    });

    it('should handle special characters in projectName', () => {
      const result = interpolateVersionPattern('{projectName}', {
        projectName: '@org/package-name',
      });
      expect(result).toBe('@org/package-name');
    });

    it('should handle month edge cases correctly', () => {
      // December (month 11 in JS, should be 12 in output)
      const december = new Date('2024-12-01T00:00:00.000Z');
      const resultDec = interpolateVersionPattern('{currentDate|MM}', {
        currentDate: december,
      });
      expect(resultDec).toBe('12');

      // January (month 0 in JS, should be 01 in output)
      const january = new Date('2024-01-01T00:00:00.000Z');
      const resultJan = interpolateVersionPattern('{currentDate|MM}', {
        currentDate: january,
      });
      expect(resultJan).toBe('01');
    });

    it('should pad single digit values correctly', () => {
      const testDate = new Date('2024-01-05T03:07:09.000Z');
      const result = interpolateVersionPattern(
        '{currentDate|YYYY-MM-DD HH:mm:ss}',
        {
          currentDate: testDate,
        }
      );
      expect(result).toBe('2024-01-05 03:07:09');
    });

    describe('environment variable interpolation', () => {
      const originalEnv = process.env;

      beforeEach(() => {
        process.env = { ...originalEnv };
      });

      afterEach(() => {
        process.env = originalEnv;
      });

      it('should interpolate environment variables', () => {
        process.env.BUILD_NUMBER = '123';
        const result = interpolateVersionPattern(
          'build-{env.BUILD_NUMBER}',
          {}
        );
        expect(result).toBe('build-123');
      });

      it('should handle multiple environment variables', () => {
        process.env.STAGE = 'QA';
        process.env.BUILD_NUMBER = '456';
        const result = interpolateVersionPattern(
          'build-{env.STAGE}.{env.BUILD_NUMBER}',
          {}
        );
        expect(result).toBe('build-QA.456');
      });

      it('should keep unknown environment variables as-is', () => {
        const result = interpolateVersionPattern(
          'build-{env.NON_EXISTENT_VAR}',
          {}
        );
        expect(result).toBe('build-{env.NON_EXISTENT_VAR}');
      });

      it('should combine environment variables with other tokens', () => {
        process.env.TASK = 'builder';
        const result = interpolateVersionPattern(
          '{projectName}-{env.TASK}-{shortCommitSha}',
          {
            projectName: 'api',
          }
        );
        expect(result).toBe('api-builder-abc1234');
      });

      it('should handle environment variables with underscores and numbers', () => {
        process.env.MY_VAR_123 = 'test-value';
        const result = interpolateVersionPattern('prefix-{env.MY_VAR_123}', {});
        expect(result).toBe('prefix-test-value');
      });

      it('should handle empty environment variable values', () => {
        process.env.EMPTY_VAR = '';
        const result = interpolateVersionPattern(
          'prefix-{env.EMPTY_VAR}-suffix',
          {}
        );
        expect(result).toBe('prefix--suffix');
      });

      it('should handle environment variables in complex patterns', () => {
        process.env.VERSION = '2.1.0';
        process.env.ENVIRONMENT = 'production';
        const testDate = new Date('2024-01-15T10:30:45.000Z');
        const result = interpolateVersionPattern(
          '{env.VERSION}-{projectName}-{env.ENVIRONMENT}-{currentDate|YYYY.MM.DD}',
          {
            projectName: 'webapp',
            currentDate: testDate,
          }
        );
        expect(result).toBe('2.1.0-webapp-production-2024.01.15');
      });

      it('should handle undefined environment variables', () => {
        delete process.env.UNDEFINED_VAR;
        const result = interpolateVersionPattern(
          'build-{env.UNDEFINED_VAR}',
          {}
        );
        expect(result).toBe('build-{env.UNDEFINED_VAR}');
      });
    });
  });
});
