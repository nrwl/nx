jest.mock('eslint/use-at-your-own-risk', () => ({
  LegacyESLint: jest.fn(),
}));

const { LegacyESLint } = require('eslint/use-at-your-own-risk');
import { resolveAndInstantiateESLint } from './eslint-utils';

describe('eslint-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    it('should throw if a non eslint.config.js or eslint.config.cjs file is used with ESLint Flat Config', async () => {
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
  });
});
