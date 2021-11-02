// Force module scoping
export default {};

jest.mock('eslint', () => ({
  ESLint: jest.fn(),
}));

const { ESLint } = require('eslint');
(<jest.SpyInstance>ESLint).mockImplementation(() => ({
  lintFiles: (args: string[]) => args,
}));

const { lint } = require('./eslint-utils');

describe('eslint-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create the ESLint instance with the proper parameters', async () => {
    await lint('./.eslintrc.json', <any>{
      fix: true,
      cache: true,
      cacheLocation: '/root/cache',
    }).catch(() => {});

    expect(ESLint).toHaveBeenCalledWith({
      overrideConfigFile: './.eslintrc.json',
      fix: true,
      cache: true,
      cacheLocation: '/root/cache',
      ignorePath: undefined,
      useEslintrc: true,
      errorOnUnmatchedPattern: false,
    });
  });

  it('should create the ESLint instance with the proper parameters', async () => {
    await lint(undefined, <any>{
      fix: true,
      cache: true,
      cacheLocation: '/root/cache',
    }).catch(() => {});

    expect(ESLint).toHaveBeenCalledWith({
      overrideConfigFile: undefined,
      fix: true,
      cache: true,
      cacheLocation: '/root/cache',
      ignorePath: undefined,
      useEslintrc: true,
      errorOnUnmatchedPattern: false,
    });
  });

  describe('noEslintrc', () => {
    it('should create the ESLint instance with "useEslintrc" set to false', async () => {
      await lint(undefined, <any>{
        fix: true,
        cache: true,
        cacheLocation: '/root/cache',
        noEslintrc: true,
      }).catch(() => {});

      expect(ESLint).toHaveBeenCalledWith({
        overrideConfigFile: undefined,
        fix: true,
        cache: true,
        cacheLocation: '/root/cache',
        ignorePath: undefined,
        useEslintrc: false,
        errorOnUnmatchedPattern: false,
      });
    });
  });
});
