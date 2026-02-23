import {
  buildImportNeedsOptionsResult,
  buildImportNeedsPluginSelectionResult,
  buildImportSuccessResult,
  buildImportErrorResult,
  determineImportErrorCode,
  getImportErrorHints,
} from './ai-output';

describe('import ai-output', () => {
  describe('buildImportNeedsOptionsResult', () => {
    it('should list missing fields and all available options', () => {
      const result = buildImportNeedsOptionsResult(['ref', 'destination']);
      expect(result.stage).toBe('needs_input');
      expect(result.success).toBe(false);
      expect(result.inputType).toBe('import_options');
      expect(result.missingFields).toEqual(['ref', 'destination']);
      expect(Object.keys(result.availableOptions)).toEqual([
        'sourceRepository',
        'ref',
        'source',
        'destination',
      ]);
      expect(result.availableOptions.source.required).toBe(false);
      expect(result.availableOptions.ref.required).toBe(true);
    });

    it('should include source repo in example command when provided', () => {
      const result = buildImportNeedsOptionsResult(
        ['ref'],
        'https://github.com/org/repo'
      );
      expect(result.exampleCommand).toContain('https://github.com/org/repo');
    });
  });

  describe('buildImportNeedsPluginSelectionResult', () => {
    it('should include detected plugins and import result details', () => {
      const result = buildImportNeedsPluginSelectionResult({
        detectedPlugins: [
          { name: '@nx/vite', reason: 'vite detected in dependencies' },
          { name: '@nx/jest', reason: 'jest detected in dependencies' },
        ],
        sourceRepository: 'https://github.com/org/repo',
        ref: 'main',
        source: '.',
        destination: 'apps/my-app',
      });
      expect(result.stage).toBe('needs_input');
      expect(result.success).toBe(false);
      expect(result.inputType).toBe('plugins');
      expect(result.detectedPlugins).toHaveLength(2);
      expect(result.detectedPlugins[0].name).toBe('@nx/vite');
      expect(result.result.sourceRepository).toBe(
        'https://github.com/org/repo'
      );
      expect(result.result.destination).toBe('apps/my-app');
      expect(result.options).toContain('--plugins=skip');
      expect(result.options).toContain('--plugins=all');
      expect(result.exampleCommand).toContain('apps/my-app');
      expect(result.exampleCommand).toContain('@nx/vite');
    });
  });

  describe('buildImportSuccessResult', () => {
    it('should include import details and next steps', () => {
      const result = buildImportSuccessResult({
        sourceRepository: 'https://github.com/org/repo',
        ref: 'main',
        source: 'apps/my-app',
        destination: 'apps/my-app',
        pluginsInstalled: ['@nx/vite'],
      });
      expect(result.stage).toBe('complete');
      expect(result.success).toBe(true);
      expect(result.result.sourceRepository).toBe(
        'https://github.com/org/repo'
      );
      expect(result.result.pluginsInstalled).toEqual(['@nx/vite']);
      expect(result.userNextSteps.steps.length).toBeGreaterThan(0);
    });

    it('should include warnings when provided', () => {
      const result = buildImportSuccessResult({
        sourceRepository: 'repo',
        ref: 'main',
        source: '.',
        destination: 'apps/dest',
        pluginsInstalled: [],
        warnings: [
          {
            type: 'package_manager_mismatch',
            message: 'Source uses yarn, workspace uses pnpm',
            hint: 'Check features',
          },
        ],
      });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('package_manager_mismatch');
    });
  });

  describe('buildImportErrorResult', () => {
    it('should include error code and hints', () => {
      const result = buildImportErrorResult(
        'Clone failed',
        'CLONE_FAILED',
        '/tmp/error.log'
      );
      expect(result.stage).toBe('error');
      expect(result.errorCode).toBe('CLONE_FAILED');
      expect(result.hints.length).toBeGreaterThan(0);
      expect(result.errorLogPath).toBe('/tmp/error.log');
    });
  });

  describe('determineImportErrorCode', () => {
    it('should map error messages to correct codes', () => {
      expect(
        determineImportErrorCode(new Error('You have uncommitted changes'))
      ).toBe('UNCOMMITTED_CHANGES');
      expect(determineImportErrorCode(new Error('Failed to clone repo'))).toBe(
        'CLONE_FAILED'
      );
      expect(
        determineImportErrorCode(
          new Error('source directory does not exist in repo')
        )
      ).toBe('SOURCE_NOT_FOUND');
      expect(
        determineImportErrorCode(
          new Error('Destination directory is not empty')
        )
      ).toBe('DESTINATION_NOT_EMPTY');
      expect(determineImportErrorCode(new Error('Something unexpected'))).toBe(
        'UNKNOWN'
      );
    });
  });

  describe('getImportErrorHints', () => {
    it('should return hints for each error code', () => {
      const codes = [
        'UNCOMMITTED_CHANGES',
        'CLONE_FAILED',
        'SOURCE_NOT_FOUND',
        'DESTINATION_NOT_EMPTY',
        'INVALID_DESTINATION',
        'FILTER_FAILED',
        'MERGE_FAILED',
        'PACKAGE_INSTALL_ERROR',
        'PLUGIN_INIT_ERROR',
        'UNKNOWN',
      ] as const;
      for (const code of codes) {
        expect(getImportErrorHints(code).length).toBeGreaterThan(0);
      }
    });
  });
});
