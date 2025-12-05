import {
  sanitizeArgs,
  sanitizeValue,
  sanitizeTarget,
  sanitizeConfiguration,
  sanitizeGeneratorName,
  sanitizeErrorMessage,
  sanitizeStackTrace,
  anonymizeProjectName,
  resetProjectNameMap,
  isKnownPlugin,
} from './sanitize';

describe('sanitize', () => {
  beforeEach(() => {
    resetProjectNameMap();
  });

  describe('sanitizeValue', () => {
    it('should return empty strings unchanged', () => {
      expect(sanitizeValue('')).toBe('');
    });

    it('should redact sensitive flag values', () => {
      expect(sanitizeValue('secret123', 'token')).toBe('[REDACTED]');
      expect(sanitizeValue('mypassword', 'password')).toBe('[REDACTED]');
      expect(sanitizeValue('key123', 'apiKey')).toBe('[REDACTED]');
    });

    it('should allow safe flag values', () => {
      // Note: sanitizeValue doesn't convert booleans when a flagName is provided
      // because the value comes as a string from CLI parsing
      expect(sanitizeValue('true', 'verbose')).toBe('true');
      expect(sanitizeValue('false', 'dry-run')).toBe('false');
      expect(sanitizeValue('production', 'configuration')).toBe('production');
    });

    it('should redact file paths', () => {
      expect(sanitizeValue('/home/user/project/src/file.ts')).toBe(
        '[REDACTED]'
      );
      expect(sanitizeValue('C:\\Users\\project\\file.ts')).toBe('[REDACTED]');
      expect(sanitizeValue('./src/components/Button.tsx')).toBe('[REDACTED]');
    });

    it('should redact URLs', () => {
      expect(sanitizeValue('https://example.com/secret/path')).toBe(
        '[REDACTED]'
      );
      expect(sanitizeValue('http://localhost:3000/api')).toBe('[REDACTED]');
    });

    it('should convert boolean strings to booleans', () => {
      expect(sanitizeValue('true')).toBe(true);
      expect(sanitizeValue('false')).toBe(false);
    });

    it('should convert numeric strings to numbers', () => {
      expect(sanitizeValue('42')).toBe(42);
      expect(sanitizeValue('3.14')).toBe(3.14);
    });

    it('should redact long alphanumeric strings (potential tokens)', () => {
      expect(
        sanitizeValue('abcdef1234567890abcdef1234567890abcdef1234567890')
      ).toBe('[REDACTED]');
    });

    it('should allow short option-like values', () => {
      expect(sanitizeValue('jest')).toBe('jest');
      expect(sanitizeValue('eslint')).toBe('eslint');
      expect(sanitizeValue('webpack')).toBe('webpack');
    });
  });

  describe('sanitizeTarget', () => {
    it('should return standard targets unchanged', () => {
      expect(sanitizeTarget('build')).toBe('build');
      expect(sanitizeTarget('test')).toBe('test');
      expect(sanitizeTarget('lint')).toBe('lint');
      expect(sanitizeTarget('serve')).toBe('serve');
      expect(sanitizeTarget('e2e')).toBe('e2e');
    });

    it('should redact custom targets', () => {
      expect(sanitizeTarget('my-custom-target')).toBe('[custom]');
      expect(sanitizeTarget('deploy-staging')).toBe('[custom]');
    });

    it('should handle empty strings', () => {
      expect(sanitizeTarget('')).toBe('');
    });
  });

  describe('sanitizeConfiguration', () => {
    it('should return standard configurations unchanged', () => {
      expect(sanitizeConfiguration('production')).toBe('production');
      expect(sanitizeConfiguration('development')).toBe('development');
      expect(sanitizeConfiguration('staging')).toBe('staging');
      expect(sanitizeConfiguration('test')).toBe('test');
      expect(sanitizeConfiguration('ci')).toBe('ci');
    });

    it('should redact custom configurations', () => {
      expect(sanitizeConfiguration('my-custom-config')).toBe('[custom]');
      expect(sanitizeConfiguration('client-a')).toBe('[custom]');
    });
  });

  describe('sanitizeGeneratorName', () => {
    it('should return known Nx generators unchanged', () => {
      expect(sanitizeGeneratorName('@nx/react:component')).toBe(
        '@nx/react:component'
      );
      expect(sanitizeGeneratorName('@nx/angular:library')).toBe(
        '@nx/angular:library'
      );
      expect(sanitizeGeneratorName('@nrwl/node:application')).toBe(
        '@nrwl/node:application'
      );
    });

    it('should redact custom generators', () => {
      expect(sanitizeGeneratorName('my-plugin:generator')).toBe('[custom]');
      expect(sanitizeGeneratorName('@company/internal:component')).toBe(
        '[custom]'
      );
    });

    it('should handle empty strings', () => {
      expect(sanitizeGeneratorName('')).toBe('');
    });
  });

  describe('isKnownPlugin', () => {
    it('should recognize @nx/ plugins', () => {
      expect(isKnownPlugin('@nx/react')).toBe(true);
      expect(isKnownPlugin('@nx/angular')).toBe(true);
    });

    it('should recognize @nrwl/ plugins', () => {
      expect(isKnownPlugin('@nrwl/node')).toBe(true);
      expect(isKnownPlugin('@nrwl/workspace')).toBe(true);
    });

    it('should not recognize other plugins', () => {
      expect(isKnownPlugin('@company/plugin')).toBe(false);
      expect(isKnownPlugin('custom-plugin')).toBe(false);
    });
  });

  describe('anonymizeProjectName', () => {
    it('should anonymize project names consistently', () => {
      const first = anonymizeProjectName('my-app');
      const second = anonymizeProjectName('my-lib');
      const firstAgain = anonymizeProjectName('my-app');

      expect(first).toBe('project-1');
      expect(second).toBe('project-2');
      expect(firstAgain).toBe('project-1'); // Same name maps to same placeholder
    });

    it('should handle empty strings', () => {
      expect(anonymizeProjectName('')).toBe('');
    });

    it('should reset correctly', () => {
      anonymizeProjectName('project-a');
      expect(anonymizeProjectName('project-a')).toBe('project-1');

      resetProjectNameMap();

      expect(anonymizeProjectName('project-a')).toBe('project-1'); // Counter reset
    });
  });

  describe('sanitizeArgs', () => {
    it('should handle empty argv', () => {
      expect(sanitizeArgs([])).toEqual({ positional: [], flags: {} });
    });

    it('should sanitize known commands', () => {
      const result = sanitizeArgs(['build']);
      expect(result.positional[0]).toBe('build');
    });

    it('should redact unknown commands', () => {
      const result = sanitizeArgs(['my-custom-command']);
      expect(result.positional[0]).toBe('[custom]');
    });

    it('should sanitize project:target:config format', () => {
      resetProjectNameMap();
      const result = sanitizeArgs(['run', 'my-app:build:production']);
      expect(result.positional[0]).toBe('run');
      expect(result.positional[1]).toBe('project-1:build:production');
    });

    it('should redact custom targets in project:target format', () => {
      resetProjectNameMap();
      const result = sanitizeArgs(['run', 'my-app:custom-target']);
      expect(result.positional[1]).toBe('project-1:[custom]');
    });

    it('should parse and sanitize flags', () => {
      const result = sanitizeArgs(['build', '--verbose', '--parallel=4']);
      expect(result.flags['verbose']).toBe(true);
      // parallel is parsed as string from CLI and sanitizeValue preserves it
      expect(result.flags['parallel']).toBe('4');
    });

    it('should redact sensitive flag values', () => {
      const result = sanitizeArgs(['build', '--token=secret123']);
      expect(result.flags['token']).toBe('[REDACTED]');
    });

    it('should handle generator commands specially', () => {
      const result = sanitizeArgs([
        'generate',
        '@nx/react:component',
        '--style=scss',
        '--name=MyComponent',
      ]);
      expect(result.positional[0]).toBe('generate');
      expect(result.positional[1]).toBe('@nx/react:component');
      expect(result.flags['style']).toBe('scss');
      // name should be redacted as it's a presence-only arg
      expect(result.flags['name']).toBe(true);
    });

    it('should redact custom generator names', () => {
      const result = sanitizeArgs(['g', '@company/plugin:generator']);
      expect(result.positional[0]).toBe('g');
      expect(result.positional[1]).toBe('[custom]');
    });

    it('should handle --no-* flags', () => {
      const result = sanitizeArgs(['build', '--no-cache']);
      expect(result.flags['cache']).toBe(false);
    });

    it('should handle --flag=value format', () => {
      const result = sanitizeArgs(['build', '--configuration=production']);
      expect(result.flags['configuration']).toBe('production');
    });

    it('should handle --flag value format', () => {
      const result = sanitizeArgs(['build', '--configuration', 'production']);
      expect(result.flags['configuration']).toBe('production');
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should redact Unix file paths', () => {
      const message = 'Error in /home/user/project/src/file.ts';
      expect(sanitizeErrorMessage(message)).toBe('Error in [REDACTED]');
    });

    it('should redact Windows file paths', () => {
      const message = 'Error in C:\\Users\\name\\project\\file.ts';
      expect(sanitizeErrorMessage(message)).toBe('Error in [REDACTED]');
    });

    it('should keep node_modules paths', () => {
      const message =
        'Error in /Users/name/project/node_modules/@nx/react/index.js';
      expect(sanitizeErrorMessage(message)).toContain('node_modules/@nx/react');
    });

    it('should redact potential tokens', () => {
      const message =
        'Token invalid: abcdef1234567890abcdef1234567890abcdef1234567890';
      expect(sanitizeErrorMessage(message)).toBe('Token invalid: [REDACTED]');
    });

    it('should redact email addresses', () => {
      const message = 'Contact user@example.com for support';
      expect(sanitizeErrorMessage(message)).toBe(
        'Contact [REDACTED] for support'
      );
    });

    it('should redact URLs', () => {
      const message = 'Failed to fetch https://api.example.com/secret/endpoint';
      expect(sanitizeErrorMessage(message)).toContain('https://[REDACTED]');
    });
  });

  describe('sanitizeStackTrace', () => {
    it('should keep node_modules paths in stack traces', () => {
      const stack = `Error: Something failed
    at Function.run (/Users/name/project/node_modules/@nx/react/src/index.js:10:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

      const sanitized = sanitizeStackTrace(stack);
      expect(sanitized).toContain('node_modules/@nx/react');
      expect(sanitized).not.toContain('/Users/name/project');
    });

    it('should redact user paths but keep line numbers', () => {
      const stack = `Error: Test error
    at myFunction (/Users/name/secret/project/src/app.ts:42:10)`;

      const sanitized = sanitizeStackTrace(stack);
      expect(sanitized).not.toContain('/Users/name');
      expect(sanitized).not.toContain('secret');
    });

    it('should handle empty stack traces', () => {
      expect(sanitizeStackTrace('')).toBe('');
    });
  });
});
