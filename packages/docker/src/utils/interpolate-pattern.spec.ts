import { interpolatePattern, interpolateObject } from './interpolate-pattern';

describe('interpolate-pattern', () => {
  describe('interpolatePattern', () => {
    it('should interpolate simple tokens', () => {
      const result = interpolatePattern('{projectName}', {
        projectName: 'my-app',
      });
      expect(result).toBe('my-app');
    });

    it('should interpolate multiple tokens', () => {
      const result = interpolatePattern('{projectName}-{version}', {
        projectName: 'my-app',
        version: '1.0.0',
      });
      expect(result).toBe('my-app-1.0.0');
    });

    it('should keep unknown tokens unchanged', () => {
      const result = interpolatePattern('{unknownToken}', {
        projectName: 'my-app',
      });
      expect(result).toBe('{unknownToken}');
    });

    it('should handle empty pattern', () => {
      const result = interpolatePattern('', {
        projectName: 'my-app',
      });
      expect(result).toBe('');
    });

    it('should handle pattern without tokens', () => {
      const result = interpolatePattern('1.2.3', {
        projectName: 'my-app',
      });
      expect(result).toBe('1.2.3');
    });

    it('should handle missing token values', () => {
      const result = interpolatePattern('{projectName}', {});
      expect(result).toBe('{projectName}');
    });

    describe('date formatting', () => {
      it('should interpolate currentDate with ISO format by default', () => {
        const testDate = new Date('2024-01-15T10:30:45.000Z');
        const result = interpolatePattern('{currentDate}', {
          currentDate: testDate,
        });
        expect(result).toBe('2024-01-15T10:30:45.000Z');
      });

      it('should interpolate currentDate with custom format YYYY.MM.DD', () => {
        const testDate = new Date('2024-01-15T10:30:45.000Z');
        const result = interpolatePattern('{currentDate|YYYY.MM.DD}', {
          currentDate: testDate,
        });
        expect(result).toBe('2024.01.15');
      });

      it('should interpolate currentDate with custom format YY.MM.DD', () => {
        const testDate = new Date('2024-01-15T10:30:45.000Z');
        const result = interpolatePattern('{currentDate|YY.MM.DD}', {
          currentDate: testDate,
        });
        expect(result).toBe('24.01.15');
      });

      it('should interpolate currentDate with time format HH:mm:ss', () => {
        const testDate = new Date('2024-01-15T10:30:45.000Z');
        const result = interpolatePattern('{currentDate|HH:mm:ss}', {
          currentDate: testDate,
        });
        expect(result).toBe('10:30:45');
      });

      it('should pad single digit values correctly', () => {
        const testDate = new Date('2024-01-05T03:07:09.000Z');
        const result = interpolatePattern('{currentDate|YYYY-MM-DD HH:mm:ss}', {
          currentDate: testDate,
        });
        expect(result).toBe('2024-01-05 03:07:09');
      });
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
        const result = interpolatePattern('build-{env.BUILD_NUMBER}', {});
        expect(result).toBe('build-123');
      });

      it('should handle multiple environment variables', () => {
        process.env.STAGE = 'QA';
        process.env.BUILD_NUMBER = '456';
        const result = interpolatePattern(
          'build-{env.STAGE}.{env.BUILD_NUMBER}',
          {}
        );
        expect(result).toBe('build-QA.456');
      });

      it('should keep unknown environment variables as-is', () => {
        const result = interpolatePattern('build-{env.NON_EXISTENT_VAR}', {});
        expect(result).toBe('build-{env.NON_EXISTENT_VAR}');
      });

      it('should combine environment variables with other tokens', () => {
        process.env.TASK = 'builder';
        const result = interpolatePattern('{projectName}-{env.TASK}', {
          projectName: 'api',
        });
        expect(result).toBe('api-builder');
      });

      it('should handle empty environment variable values', () => {
        process.env.EMPTY_VAR = '';
        const result = interpolatePattern('prefix-{env.EMPTY_VAR}-suffix', {});
        expect(result).toBe('prefix--suffix');
      });
    });
  });

  describe('interpolateObject', () => {
    it('should interpolate strings in objects', () => {
      const result = interpolateObject(
        {
          name: '{projectName}',
          version: '1.0.0',
        },
        { projectName: 'my-app' }
      );
      expect(result).toEqual({
        name: 'my-app',
        version: '1.0.0',
      });
    });

    it('should interpolate strings in arrays', () => {
      const result = interpolateObject(
        ['--tag', '{imageRef}', '--build-arg', 'VERSION={version}'],
        { imageRef: 'my-app:latest', version: '1.0.0' }
      );
      expect(result).toEqual([
        '--tag',
        'my-app:latest',
        '--build-arg',
        'VERSION=1.0.0',
      ]);
    });

    it('should interpolate nested objects', () => {
      const result = interpolateObject(
        {
          build: {
            args: ['--tag', '{imageRef}'],
            env: {
              APP_NAME: '{projectName}',
            },
          },
        },
        { imageRef: 'my-app:latest', projectName: 'my-app' }
      );
      expect(result).toEqual({
        build: {
          args: ['--tag', 'my-app:latest'],
          env: {
            APP_NAME: 'my-app',
          },
        },
      });
    });

    it('should preserve non-string values', () => {
      const result = interpolateObject(
        {
          name: '{projectName}',
          port: 3000,
          enabled: true,
          config: null,
        },
        { projectName: 'my-app' }
      );
      expect(result).toEqual({
        name: 'my-app',
        port: 3000,
        enabled: true,
        config: null,
      });
    });

    it('should handle arrays of objects', () => {
      const result = interpolateObject(
        [
          { name: '{projectName}-web', port: 3000 },
          { name: '{projectName}-api', port: 8080 },
        ],
        { projectName: 'my-app' }
      );
      expect(result).toEqual([
        { name: 'my-app-web', port: 3000 },
        { name: 'my-app-api', port: 8080 },
      ]);
    });

    it('should return primitive values unchanged', () => {
      expect(interpolateObject('simple string', {})).toBe('simple string');
      expect(interpolateObject(123, {})).toBe(123);
      expect(interpolateObject(true, {})).toBe(true);
      expect(interpolateObject(null, {})).toBe(null);
    });

    it('should interpolate string primitives', () => {
      const result = interpolateObject('{projectName}-app', {
        projectName: 'my',
      });
      expect(result).toBe('my-app');
    });
  });
});
