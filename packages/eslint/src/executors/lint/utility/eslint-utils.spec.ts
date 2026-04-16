jest.mock('eslint', () => ({
  loadESLint: undefined,
}));

jest.mock('eslint/use-at-your-own-risk', () => ({
  LegacyESLint: jest.fn(),
}));

const { LegacyESLint } = require('eslint/use-at-your-own-risk');
import {
  resolveAndInstantiateESLint,
  getSuppressionsFilePath,
  validateSuppressionOptions,
} from './eslint-utils';
import * as resolveEslintClassModule from '../../../utils/resolve-eslint-class';
import type { SuppressionsContext } from './eslint-utils';

describe('eslint-utils', () => {
  beforeEach(() => {
    const eslintModule = require('eslint');
    eslintModule.loadESLint = undefined;

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create the ESLint instance with the proper parameters', async () => {
    await resolveAndInstantiateESLint('./.eslintrc.json', <any>{
      fix: true,
      cache: true,
      cacheLocation: '/root/cache',
      cacheStrategy: 'content',
    }).catch(() => {});

    expect(LegacyESLint).toHaveBeenCalledWith({
      overrideConfigFile: './.eslintrc.json',
      fix: true,
      cache: true,
      cacheLocation: '/root/cache',
      cacheStrategy: 'content',
      ignorePath: undefined,
      useEslintrc: true,
      resolvePluginsRelativeTo: undefined,
      rulePaths: [],
      errorOnUnmatchedPattern: false,
    });
  });

  it('should create the ESLint instance with the proper parameters', async () => {
    await resolveAndInstantiateESLint(undefined, <any>{
      fix: true,
      cache: true,
      cacheLocation: '/root/cache',
      cacheStrategy: 'content',
    }).catch(() => {});

    expect(LegacyESLint).toHaveBeenCalledWith({
      overrideConfigFile: undefined,
      fix: true,
      cache: true,
      cacheLocation: '/root/cache',
      cacheStrategy: 'content',
      ignorePath: undefined,
      useEslintrc: true,
      resolvePluginsRelativeTo: undefined,
      rulePaths: [],
      errorOnUnmatchedPattern: false,
    });
  });

  it('should create the ESLint instance with loadESLint when available', async () => {
    const LoadedESLintClass = jest.fn();
    jest
      .spyOn(resolveEslintClassModule, 'resolveESLintClass')
      .mockResolvedValue(LoadedESLintClass as any);

    await resolveAndInstantiateESLint('./.eslintrc.json', {} as any);

    expect(resolveEslintClassModule.resolveESLintClass).toHaveBeenCalledWith({
      useFlatConfigOverrideVal: false,
    });
    expect(LoadedESLintClass).toHaveBeenCalledWith({
      overrideConfigFile: './.eslintrc.json',
      fix: false,
      cache: false,
      cacheLocation: undefined,
      cacheStrategy: undefined,
      errorOnUnmatchedPattern: false,

      ignorePath: undefined,
      reportUnusedDisableDirectives: undefined,
      resolvePluginsRelativeTo: undefined,
      rulePaths: [],
      useEslintrc: true,
    });
    expect(LegacyESLint).not.toHaveBeenCalled();
  });

  describe('noEslintrc', () => {
    it('should create the ESLint instance with "useEslintrc" set to false', async () => {
      await resolveAndInstantiateESLint(undefined, <any>{
        fix: true,
        cache: true,
        cacheLocation: '/root/cache',
        noEslintrc: true,
      }).catch(() => {});

      expect(LegacyESLint).toHaveBeenCalledWith({
        overrideConfigFile: undefined,
        fix: true,
        cache: true,
        cacheLocation: '/root/cache',
        cacheStrategy: undefined,
        ignorePath: undefined,
        useEslintrc: false,
        resolvePluginsRelativeTo: undefined,
        rulePaths: [],
        errorOnUnmatchedPattern: false,
      });
    });
  });

  describe('rulesdir', () => {
    it('should create the ESLint instance with "rulePaths" set to the given value for rulesdir', async () => {
      const extraRuleDirectories = ['./some-rules', '../some-more-rules'];
      await resolveAndInstantiateESLint(undefined, {
        fix: true,
        cache: true,
        cacheLocation: '/root/cache',
        cacheStrategy: 'content',
        rulesdir: extraRuleDirectories,
      } as any).catch(() => {});

      expect(LegacyESLint).toHaveBeenCalledWith({
        overrideConfigFile: undefined,
        fix: true,
        cache: true,
        cacheLocation: '/root/cache',
        cacheStrategy: 'content',
        ignorePath: undefined,
        useEslintrc: true,
        resolvePluginsRelativeTo: undefined,
        rulePaths: extraRuleDirectories,
        errorOnUnmatchedPattern: false,
      });
    });
  });

  describe('resolvePluginsRelativeTo', () => {
    it('should create the ESLint instance with "resolvePluginsRelativeTo" set to the given value for resolvePluginsRelativeTo', async () => {
      await resolveAndInstantiateESLint(undefined, {
        fix: true,
        cache: true,
        cacheLocation: '/root/cache',
        cacheStrategy: 'content',
        resolvePluginsRelativeTo: './some-path',
      } as any).catch(() => {});

      expect(LegacyESLint).toHaveBeenCalledWith({
        overrideConfigFile: undefined,
        fix: true,
        cache: true,
        cacheLocation: '/root/cache',
        cacheStrategy: 'content',
        ignorePath: undefined,
        useEslintrc: true,
        resolvePluginsRelativeTo: './some-path',
        rulePaths: [],
        errorOnUnmatchedPattern: false,
      });
    });
  });

  describe('reportUnusedDisableDirectives', () => {
    it('should create the ESLint instance with "reportUnusedDisableDirectives" set to the given value for reportUnusedDisableDirectives', async () => {
      await resolveAndInstantiateESLint(undefined, {
        reportUnusedDisableDirectives: 'error',
      } as any).catch(() => {});

      expect(LegacyESLint).toHaveBeenCalledWith({
        cache: false,
        cacheLocation: undefined,
        cacheStrategy: undefined,
        errorOnUnmatchedPattern: false,
        fix: false,
        ignorePath: undefined,
        overrideConfigFile: undefined,
        reportUnusedDisableDirectives: 'error',
        resolvePluginsRelativeTo: undefined,
        rulePaths: [],
        useEslintrc: true,
      });
    });

    it('should create a ESLint instance with no "reportUnusedDisableDirectives" if it is undefined', async () => {
      await resolveAndInstantiateESLint(undefined, {} as any);

      expect(LegacyESLint).toHaveBeenCalledWith(
        expect.objectContaining({
          reportUnusedDisableDirectives: undefined,
        })
      );
    });
  });

  describe('ESLint Flat Config', () => {
    it('should throw if a non eslint.config.cjs or eslint.config.cjs file is used with ESLint Flat Config', async () => {
      await expect(
        resolveAndInstantiateESLint('./.eslintrc.json', {} as any, true)
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"When using the new Flat Config with ESLint, all configs must be named eslint.config.js or eslint.config.cjs and .eslintrc files may not be used. See https://eslint.org/docs/latest/use/configure/configuration-files"`
      );
    });

    it('should throw if invalid options are used with ESLint Flat Config', async () => {
      await expect(
        resolveAndInstantiateESLint(
          undefined,
          {
            useEslintrc: false,
          } as any,
          true
        )
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"For Flat Config, the \`useEslintrc\` option is not applicable. See https://eslint.org/docs/latest/use/configure/configuration-files-new"`
      );

      await expect(
        resolveAndInstantiateESLint(
          undefined,
          {
            resolvePluginsRelativeTo: './some-path',
          } as any,
          true
        )
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"For Flat Config, ESLint removed \`resolvePluginsRelativeTo\` and so it is not supported as an option. See https://eslint.org/docs/latest/use/configure/configuration-files-new"`
      );

      await expect(
        resolveAndInstantiateESLint(
          undefined,
          {
            ignorePath: './some-path',
          } as any,
          true
        )
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"For Flat Config, ESLint removed \`ignorePath\` and so it is not supported as an option. See https://eslint.org/docs/latest/use/configure/configuration-files-new"`
      );
    });

    it('should resolve flat ESLint v9+ using loadESLint when available', async () => {
      const LoadedESLintClass: jest.Mock & { version?: string } = jest.fn();
      LoadedESLintClass.version = '9.0.0';
      jest
        .spyOn(resolveEslintClassModule, 'resolveESLintClass')
        .mockResolvedValue(LoadedESLintClass as any);

      await resolveAndInstantiateESLint(
        'eslint.config.mjs',
        {
          quiet: true,
        } as any,
        true
      );

      expect(resolveEslintClassModule.resolveESLintClass).toHaveBeenCalledWith({
        useFlatConfigOverrideVal: true,
      });
      expect(LoadedESLintClass).toHaveBeenCalledWith({
        overrideConfigFile: 'eslint.config.mjs',
        fix: false,
        cache: false,
        cacheLocation: undefined,
        cacheStrategy: undefined,
        errorOnUnmatchedPattern: false,

        ruleFilter: expect.any(Function),
      });
      expect(LegacyESLint).not.toHaveBeenCalled();
    });
  });

  describe('validateSuppressionOptions', () => {
    function createContext(
      overrides: Partial<SuppressionsContext> = {}
    ): SuppressionsContext {
      return {
        suppressAll: false,
        suppressRule: undefined,
        suppressionsLocation: undefined,
        pruneSuppressions: false,
        cwd: '/root',
        ...overrides,
      };
    }

    it('should not throw when no suppression options are set', () => {
      expect(() => validateSuppressionOptions(createContext())).not.toThrow();
    });

    it('should not throw when only suppressAll is set', () => {
      expect(() =>
        validateSuppressionOptions(createContext({ suppressAll: true }))
      ).not.toThrow();
    });

    it('should not throw when only suppressRule is set', () => {
      expect(() =>
        validateSuppressionOptions(
          createContext({ suppressRule: ['no-console'] })
        )
      ).not.toThrow();
    });

    it('should not throw when only pruneSuppressions is set', () => {
      expect(() =>
        validateSuppressionOptions(createContext({ pruneSuppressions: true }))
      ).not.toThrow();
    });

    it('should throw when suppressAll and suppressRule are used together', () => {
      expect(() =>
        validateSuppressionOptions(
          createContext({
            suppressAll: true,
            suppressRule: ['no-console'],
          })
        )
      ).toThrow(
        'The suppressAll option and the suppressRule option cannot be used together.'
      );
    });

    it('should throw when suppressAll and pruneSuppressions are used together', () => {
      expect(() =>
        validateSuppressionOptions(
          createContext({
            suppressAll: true,
            pruneSuppressions: true,
          })
        )
      ).toThrow(
        'The suppressAll option and the pruneSuppressions option cannot be used together.'
      );
    });

    it('should throw when suppressRule and pruneSuppressions are used together', () => {
      expect(() =>
        validateSuppressionOptions(
          createContext({
            suppressRule: ['no-console'],
            pruneSuppressions: true,
          })
        )
      ).toThrow(
        'The suppressRule option and the pruneSuppressions option cannot be used together.'
      );
    });
  });

  describe('getSuppressionsFilePath', () => {
    it('should return a resolved path ending with the provided custom location', () => {
      const result = getSuppressionsFilePath(
        'custom-suppressions.json',
        '/project'
      );
      expect(result).toBe('/project/custom-suppressions.json');
    });

    it('should return a path ending with a fallback filename when no location is provided and SuppressionsService is unavailable', () => {
      const result = getSuppressionsFilePath(undefined, '/project');
      expect(result).toContain('/project/');
      expect(result).toContain('eslint-suppressions.json');
    });

    it('should always return a string, never null', () => {
      const result = getSuppressionsFilePath(undefined, '/project');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
