import type { ExecutorContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import * as fs from 'fs';
import { resolve } from 'path';
import type { Schema } from './schema';

const formattedReports = 'formatted report 1';
const mockFormatter = {
  format: jest.fn().mockReturnValue(formattedReports),
};
const mockLoadFormatter = jest.fn().mockReturnValue(mockFormatter);
const mockIsPathIgnored = jest.fn().mockReturnValue(Promise.resolve(false));
const mockOutputFixes = jest.fn();

const VALID_ESLINT_VERSION = '7.6';

let mockReports: any[] = [{ results: [], usedDeprecatedRules: [] }];
const mockLintFiles = jest.fn().mockImplementation(() => mockReports);

class MockESLint {
  static version = VALID_ESLINT_VERSION;
  static outputFixes = mockOutputFixes;
  static getErrorResults = jest.requireActual('eslint').ESLint.getErrorResults;
  loadFormatter = mockLoadFormatter;
  isPathIgnored = mockIsPathIgnored;
  lintFiles = mockLintFiles;
  calculateConfigForFile(file: string) {
    return { file: file };
  }
}

const mockResolveAndInstantiateESLint = jest.fn().mockReturnValue(
  Promise.resolve({
    ESLint: MockESLint,
    eslint: new MockESLint(),
  })
);

jest.mock('./utility/eslint-utils', () => {
  return {
    resolveAndInstantiateESLint: mockResolveAndInstantiateESLint,
  };
});
import lintExecutor from './lint.impl';

let mockChdir = jest.fn().mockImplementation(() => {});

function createValidRunBuilderOptions(
  additionalOptions: Partial<Schema> = {}
): Schema {
  return {
    lintFilePatterns: [],
    eslintConfig: null,
    fix: true,
    cache: true,
    cacheLocation: 'cacheLocation1',
    cacheStrategy: 'content',
    format: 'stylish',
    force: false,
    silent: false,
    ignorePath: null,
    outputFile: null,
    maxWarnings: -1,
    noEslintrc: false,
    quiet: false,
    hasTypeAwareRules: false,
    rulesdir: [],
    resolvePluginsRelativeTo: null,
    reportUnusedDisableDirectives: null,
    printConfig: null,
    errorOnUnmatchedPattern: true,
    ...additionalOptions,
  };
}

function setupMocks() {
  jest.resetModules();
  jest.clearAllMocks();
  jest.spyOn(process, 'chdir').mockImplementation(mockChdir);
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
}

describe('Linter Builder', () => {
  let mockContext: ExecutorContext;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('eslint');
    MockESLint.version = VALID_ESLINT_VERSION;
    mockReports = [{ results: [], usedDeprecatedRules: [] }];
    const projectName = 'proj';
    mockContext = {
      projectName,
      root: tempFs.tempDir,
      cwd: tempFs.tempDir,
      projectGraph: {
        nodes: {
          [projectName]: {
            type: 'app',
            name: projectName,
            data: {
              root: `apps/${projectName}`,
              sourceRoot: `apps/${projectName}/src`,
              targets: {},
            },
          },
        },
        dependencies: {
          [projectName]: [],
        },
      },
      projectsConfigurations: {
        version: 2,
        projects: {
          [projectName]: {
            root: `apps/${projectName}`,
            sourceRoot: `apps/${projectName}/src`,
            targets: {},
          },
        },
      },
      nxJsonConfiguration: {},
      isVerbose: false,
    };
    mockLintFiles.mockImplementation(() => mockReports);
  });

  afterAll(() => {
    tempFs.cleanup();
    jest.restoreAllMocks();
  });

  it('should throw if the eslint version is not supported', async () => {
    MockESLint.version = '1.6';
    setupMocks();
    const result = lintExecutor(createValidRunBuilderOptions(), mockContext);
    await expect(result).rejects.toThrow(
      /ESLint must be version 7.6 or higher/
    );
  });

  it('should not throw if the eslint version is supported', async () => {
    setupMocks();
    const result = lintExecutor(createValidRunBuilderOptions(), mockContext);
    await expect(result).resolves.not.toThrow();
  });

  it('should invoke the linter with the options that were passed to the builder', async () => {
    setupMocks();
    await lintExecutor(
      createValidRunBuilderOptions({
        lintFilePatterns: [],
        eslintConfig: './.eslintrc.json',
        fix: true,
        cache: true,
        cacheLocation: 'cacheLocation1',
        format: 'stylish',
        force: false,
        silent: false,
        ignorePath: null,
        maxWarnings: null,
        outputFile: null,
        quiet: false,
        reportUnusedDisableDirectives: null,
      }),
      mockContext
    );
    expect(mockResolveAndInstantiateESLint).toHaveBeenCalledWith(
      resolve(mockContext.root, '.eslintrc.json'),
      {
        lintFilePatterns: [],
        eslintConfig: './.eslintrc.json',
        fix: true,
        cache: true,
        cacheLocation: 'cacheLocation1/proj',
        cacheStrategy: 'content',
        format: 'stylish',
        force: false,
        silent: false,
        ignorePath: null,
        maxWarnings: null,
        outputFile: null,
        quiet: false,
        noEslintrc: false,
        rulesdir: [],
        resolvePluginsRelativeTo: null,
        reportUnusedDisableDirectives: null,
      },
      false
    );
  });

  it('should execute correctly from another working directory than root', async () => {
    setupMocks();
    await lintExecutor(createValidRunBuilderOptions(), {
      ...mockContext,
      cwd: 'apps/project/',
    });
    expect(mockChdir).toHaveBeenCalledWith(mockContext.root);
  });

  it('should throw if no reports generated', async () => {
    mockReports = [];
    setupMocks();
    const result = lintExecutor(
      createValidRunBuilderOptions({
        lintFilePatterns: ['includedFile1'],
      }),
      mockContext
    );
    await expect(result).rejects.toThrow(
      /Invalid lint configuration. Nothing to lint. Please check your lint target pattern/
    );
  });

  it('should throw if pattern excluded', async () => {
    mockReports = [];
    setupMocks();
    mockIsPathIgnored.mockReturnValue(Promise.resolve(true));
    const result = lintExecutor(
      createValidRunBuilderOptions({
        lintFilePatterns: ['includedFile1'],
      }),
      mockContext
    );
    await expect(result).rejects.toThrow(
      `All files matching the following patterns are ignored:\n- 'includedFile1'\n\nPlease check your '.eslintignore' file.`
    );
    mockIsPathIgnored.mockReturnValue(Promise.resolve(false));
  });

  it('should not throw if no reports generated and errorOnUnmatchedPattern is false', async () => {
    mockReports = [];
    setupMocks();
    const result = lintExecutor(
      createValidRunBuilderOptions({
        lintFilePatterns: ['includedFile1'],
        errorOnUnmatchedPattern: false,
      }),
      mockContext
    );
    await expect(result).resolves.not.toThrow();
  });

  it('should not throw if pattern excluded and errorOnUnmatchedPattern is false', async () => {
    mockReports = [];
    setupMocks();
    mockIsPathIgnored.mockReturnValue(Promise.resolve(true));
    const result = lintExecutor(
      createValidRunBuilderOptions({
        lintFilePatterns: ['includedFile1'],
        errorOnUnmatchedPattern: false,
      }),
      mockContext
    );
    await expect(result).resolves.not.toThrow();
    mockIsPathIgnored.mockReturnValue(Promise.resolve(false));
  });

  it('should create a new instance of the formatter with the selected user option', async () => {
    setupMocks();
    await lintExecutor(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
      }),
      mockContext
    );
    expect(mockLoadFormatter).toHaveBeenCalledWith('json');
    await lintExecutor(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'html',
      }),
      mockContext
    );
    expect(mockLoadFormatter).toHaveBeenCalledWith('html');
  });

  it('should pass all the reports to the fix engine, even if --fix is false', async () => {
    setupMocks();
    await lintExecutor(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        fix: false,
      }),
      mockContext
    );
    expect(mockOutputFixes).toHaveBeenCalled();
  });

  it('should ignore any positional parameters', async () => {
    setupMocks();
    const result = lintExecutor(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        _: 'some-random-text',
      }),
      mockContext
    );
    await expect(result).resolves.not.toThrow();
  });

  describe('bundled results', () => {
    it('should log if there are errors or warnings', async () => {
      mockReports = [
        {
          errorCount: 1,
          warningCount: 4,
          results: [],
          usedDeprecatedRules: [],
        },
        {
          errorCount: 3,
          warningCount: 6,
          results: [],
          usedDeprecatedRules: [],
        },
      ];
      setupMocks();
      await lintExecutor(
        createValidRunBuilderOptions({
          eslintConfig: './.eslintrc.json',
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
        }),
        mockContext
      );
      expect(console.info).toHaveBeenCalledWith(
        '✖ 14 problems (4 errors, 10 warnings)\n'
      );
    });

    it('should log fixable errors or warnings', async () => {
      mockReports = [
        {
          errorCount: 2,
          warningCount: 4,
          fixableErrorCount: 1,
          fixableWarningCount: 2,
          results: [],
          usedDeprecatedRules: [],
        },
        {
          errorCount: 3,
          warningCount: 6,
          fixableErrorCount: 2,
          fixableWarningCount: 4,
          results: [],
          usedDeprecatedRules: [],
        },
      ];
      setupMocks();
      await lintExecutor(
        createValidRunBuilderOptions({
          eslintConfig: './.eslintrc.json',
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
        }),
        mockContext
      );
      expect(console.info).toHaveBeenCalledWith(
        '✖ 15 problems (5 errors, 10 warnings)\n'
      );
      expect(console.info).toHaveBeenCalledWith(
        '  3 errors and 6 warnings are potentially fixable with the `--fix` option.\n'
      );
    });

    it('should intercept the error from `@typescript-eslint` regarding missing parserServices and provide a more detailed user-facing message logging the project name when the eslint config is not provided and cannnot be found', async () => {
      setupMocks();
      tempFs.createFileSync('apps/proj/src/some-file.ts', '');

      mockLintFiles.mockImplementation(() => {
        throw new Error(
          `Error while loading rule '@typescript-eslint/await-thenable': You have used a rule which requires parserServices to be generated. You must therefore provide a value for the "parserOptions.project" property for @typescript-eslint/parser.
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts`
        );
      });

      await lintExecutor(
        createValidRunBuilderOptions({
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
        }),
        mockContext
      );
      expect(console.error).toHaveBeenCalledWith(
        `
Error: You have attempted to use the lint rule "@typescript-eslint/await-thenable" which requires the full TypeScript type-checker to be available, but you do not have "parserOptions.project" configured to point at your project tsconfig.json files in the relevant TypeScript file "overrides" block of your ESLint config for the project "proj"
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts

Please see https://nx.dev/recipes/tips-n-tricks/eslint for full guidance on how to resolve this issue.
`
      );
    });

    it('should intercept the error from `@typescript-eslint` regarding missing parserServices and provide a more detailed user-facing message logging the provided config', async () => {
      setupMocks();

      mockLintFiles.mockImplementation(() => {
        throw new Error(
          `Error while loading rule '@typescript-eslint/await-thenable': You have used a rule which requires parserServices to be generated. You must therefore provide a value for the "parserOptions.project" property for @typescript-eslint/parser.
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts`
        );
      });

      await lintExecutor(
        createValidRunBuilderOptions({
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
          eslintConfig: './.eslintrc.json',
        }),
        mockContext
      );
      expect(console.error).toHaveBeenCalledWith(
        `
Error: You have attempted to use the lint rule "@typescript-eslint/await-thenable" which requires the full TypeScript type-checker to be available, but you do not have "parserOptions.project" configured to point at your project tsconfig.json files in the relevant TypeScript file "overrides" block of your ESLint config ".eslintrc.json"
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts

Please see https://nx.dev/recipes/tips-n-tricks/eslint for full guidance on how to resolve this issue.
`
      );
    });

    it('should intercept the error from `@typescript-eslint` regarding missing parserServices and provide a more detailed user-facing message logging the found flat config', async () => {
      setupMocks();
      tempFs.createFileSync('apps/proj/eslint.config.js', '');
      tempFs.createFileSync('apps/proj/src/some-file.ts', '');

      mockLintFiles.mockImplementation(() => {
        throw new Error(
          `Error while loading rule '@typescript-eslint/await-thenable': You have used a rule which requires parserServices to be generated. You must therefore provide a value for the "parserOptions.project" property for @typescript-eslint/parser.
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts`
        );
      });

      await lintExecutor(
        createValidRunBuilderOptions({
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
        }),
        mockContext
      );
      expect(console.error).toHaveBeenCalledWith(
        `
Error: You have attempted to use the lint rule "@typescript-eslint/await-thenable" which requires the full TypeScript type-checker to be available, but you do not have "parserOptions.project" configured to point at your project tsconfig.json files in the relevant TypeScript file "overrides" block of your ESLint config "apps/proj/eslint.config.js"
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts

Please see https://nx.dev/recipes/tips-n-tricks/eslint for full guidance on how to resolve this issue.
`
      );
    });

    it('should intercept the error from `@typescript-eslint` regarding missing parserServices and provide a more detailed user-facing message logging the found flat config at the workspace root', async () => {
      setupMocks();
      tempFs.createFileSync('eslint.config.js', '');
      tempFs.createFileSync('apps/proj/src/some-file.ts', '');

      mockLintFiles.mockImplementation(() => {
        throw new Error(
          `Error while loading rule '@typescript-eslint/await-thenable': You have used a rule which requires parserServices to be generated. You must therefore provide a value for the "parserOptions.project" property for @typescript-eslint/parser.
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts`
        );
      });

      await lintExecutor(
        createValidRunBuilderOptions({
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
        }),
        mockContext
      );
      expect(console.error).toHaveBeenCalledWith(
        `
Error: You have attempted to use the lint rule "@typescript-eslint/await-thenable" which requires the full TypeScript type-checker to be available, but you do not have "parserOptions.project" configured to point at your project tsconfig.json files in the relevant TypeScript file "overrides" block of your ESLint config "eslint.config.js"
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts

Please see https://nx.dev/recipes/tips-n-tricks/eslint for full guidance on how to resolve this issue.
`
      );
    });

    it('should intercept the error from `@typescript-eslint` regarding missing parserServices and provide a more detailed user-facing message logging the found old config', async () => {
      setupMocks();
      tempFs.createFileSync('apps/proj/.eslintrc.json', '{}');
      tempFs.createFileSync('apps/proj/src/some-file.ts', '');

      mockLintFiles.mockImplementation(() => {
        throw new Error(
          `Error while loading rule '@typescript-eslint/await-thenable': You have used a rule which requires parserServices to be generated. You must therefore provide a value for the "parserOptions.project" property for @typescript-eslint/parser.
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts`
        );
      });

      await lintExecutor(
        createValidRunBuilderOptions({
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
        }),
        mockContext
      );
      expect(console.error).toHaveBeenCalledWith(
        `
Error: You have attempted to use the lint rule "@typescript-eslint/await-thenable" which requires the full TypeScript type-checker to be available, but you do not have "parserOptions.project" configured to point at your project tsconfig.json files in the relevant TypeScript file "overrides" block of your ESLint config "apps/proj/.eslintrc.json"
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts

Please see https://nx.dev/recipes/tips-n-tricks/eslint for full guidance on how to resolve this issue.
`
      );
    });

    it('should intercept the error from `@typescript-eslint` regarding missing parserServices and provide a more detailed user-facing message logging the found old config at the workspace root', async () => {
      setupMocks();
      tempFs.createFileSync('.eslintrc.json', '{}');
      tempFs.createFileSync('apps/proj/src/some-file.ts', '');

      mockLintFiles.mockImplementation(() => {
        throw new Error(
          `Error while loading rule '@typescript-eslint/await-thenable': You have used a rule which requires parserServices to be generated. You must therefore provide a value for the "parserOptions.project" property for @typescript-eslint/parser.
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts`
        );
      });

      await lintExecutor(
        createValidRunBuilderOptions({
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
        }),
        mockContext
      );
      expect(console.error).toHaveBeenCalledWith(
        `
Error: You have attempted to use the lint rule "@typescript-eslint/await-thenable" which requires the full TypeScript type-checker to be available, but you do not have "parserOptions.project" configured to point at your project tsconfig.json files in the relevant TypeScript file "overrides" block of your ESLint config ".eslintrc.json"
Occurred while linting ${mockContext.root}/apps/proj/src/some-file.ts

Please see https://nx.dev/recipes/tips-n-tricks/eslint for full guidance on how to resolve this issue.
`
      );
    });

    it('should log if there are no warnings or errors', async () => {
      mockReports = [
        {
          errorCount: 0,
          warningCount: 0,
          results: [],
          usedDeprecatedRules: [],
        },
        {
          errorCount: 0,
          warningCount: 0,
          results: [],
          usedDeprecatedRules: [],
        },
      ];
      setupMocks();
      await lintExecutor(
        createValidRunBuilderOptions({
          eslintConfig: './.eslintrc.json',
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
        }),
        mockContext
      );
      expect(console.info).not.toHaveBeenCalledWith(
        '✖ 0 problems (0 errors, 0 warnings)\n'
      );
      expect(console.info).not.toHaveBeenCalledWith(
        '  0 errors and 0 warnings are potentially fixable with the `--fix` option.\n'
      );
      expect(console.info).toHaveBeenCalledWith('✔ All files pass linting\n');
    });

    it('should not log warnings if the quiet flag was passed', async () => {
      mockReports = [
        {
          errorCount: 1,
          warningCount: 4,
          results: [],
          usedDeprecatedRules: [],
          suppressedMessages: [],
          messages: [
            {
              ruleId: 'mock',
              severity: 2,
              message: 'Mock error 1.',
            },
            {
              ruleId: 'mock',
              severity: 1,
              message: 'Mock warning 1.',
            },
            {
              ruleId: 'mock',
              severity: 1,
              message: 'Mock warning 2.',
            },
            {
              ruleId: 'mock',
              severity: 1,
              message: 'Mock warning 3.',
            },
            {
              ruleId: 'mock',
              severity: 1,
              message: 'Mock warning 4.',
            },
          ],
        },
        {
          errorCount: 3,
          warningCount: 6,
          results: [],
          usedDeprecatedRules: [],
          suppressedMessages: [],
          messages: [
            {
              ruleId: 'mock',
              severity: 2,
              message: 'Mock error 1.',
            },
            {
              ruleId: 'mock',
              severity: 2,
              message: 'Mock error 2.',
            },
            {
              ruleId: 'mock',
              severity: 2,
              message: 'Mock error 3.',
            },
            {
              ruleId: 'mock',
              severity: 1,
              message: 'Mock warning 1.',
            },
            {
              ruleId: 'mock',
              severity: 1,
              message: 'Mock warning 2.',
            },
            {
              ruleId: 'mock',
              severity: 1,
              message: 'Mock warning 3.',
            },
            {
              ruleId: 'mock',
              severity: 1,
              message: 'Mock warning 4.',
            },
            {
              ruleId: 'mock',
              severity: 1,
              message: 'Mock warning 5.',
            },
            {
              ruleId: 'mock',
              severity: 1,
              message: 'Mock warning 6.',
            },
          ],
        },
      ];
      setupMocks();
      await lintExecutor(
        createValidRunBuilderOptions({
          eslintConfig: './.eslintrc.json',
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
          quiet: true,
        }),
        mockContext
      );
      expect(console.info).toHaveBeenCalledWith(
        '✖ 4 problems (4 errors, 0 warnings)\n'
      );
    });
    it('should not log if the silent flag was passed', async () => {
      mockReports = [
        {
          errorCount: 1,
          warningCount: 4,
          results: [],
          usedDeprecatedRules: [],
        },
        {
          errorCount: 3,
          warningCount: 6,
          results: [],
          usedDeprecatedRules: [],
        },
      ];
      setupMocks();
      await lintExecutor(
        createValidRunBuilderOptions({
          eslintConfig: './.eslintrc.json',
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: true,
        }),
        mockContext
      );
      expect(console.info).not.toHaveBeenCalledWith(
        '✖ 14 problems (4 errors, 10 warnings)\n'
      );
    });
  });

  it('should be a success if there are no errors and maxWarnings is set to -1', async () => {
    mockReports = [
      {
        errorCount: 0,
        warningCount: 4,
        results: [],
        usedDeprecatedRules: [],
      },
      {
        errorCount: 0,
        warningCount: 6,
        results: [],
        usedDeprecatedRules: [],
      },
    ];
    setupMocks();
    const output = await lintExecutor(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        maxWarnings: -1,
      }),
      mockContext
    );
    expect(output.success).toBeTruthy();
  });

  it('should be a failure if there are more warnings than the set maxWarnings', async () => {
    mockReports = [
      {
        errorCount: 0,
        warningCount: 4,
        results: [],
        usedDeprecatedRules: [],
      },
      {
        errorCount: 0,
        warningCount: 6,
        results: [],
        usedDeprecatedRules: [],
      },
    ];
    setupMocks();
    const output = await lintExecutor(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        maxWarnings: 3,
      }),
      mockContext
    );
    expect(output.success).toBe(false);
    expect(console.info).toHaveBeenCalledWith(
      'ESLint found too many warnings (maximum: 3).'
    );
  });

  it('should be a success if there are errors but the force flag is true', async () => {
    mockReports = [
      {
        errorCount: 2,
        warningCount: 4,
        results: [],
        usedDeprecatedRules: [],
      },
      {
        errorCount: 3,
        warningCount: 6,
        results: [],
        usedDeprecatedRules: [],
      },
    ];
    setupMocks();
    const output = await lintExecutor(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        force: true,
      }),
      mockContext
    );
    expect(output.success).toBeTruthy();
  });

  it('should be a failure if there are errors and the force flag is false', async () => {
    mockReports = [
      {
        errorCount: 2,
        warningCount: 4,
        results: [],
        usedDeprecatedRules: [],
      },
      {
        errorCount: 3,
        warningCount: 6,
        results: [],
        usedDeprecatedRules: [],
      },
    ];
    setupMocks();
    const output = await lintExecutor(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        force: false,
      }),
      mockContext
    );
    expect(output.success).toBeFalsy();
  });

  it('should write the lint results to the output file, if specified', async () => {
    setupMocks();

    await lintExecutor(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        force: false,
        outputFile: 'a/b/c/outputFile1',
      }),
      mockContext
    );

    expect(
      fs.readFileSync(`${mockContext.root}/a/b/c/outputFile1`, 'utf-8')
    ).toEqual(formattedReports);
  });

  it('should not attempt to write the lint results to the output file, if not specified', async () => {
    setupMocks();
    jest.spyOn(fs, 'writeFileSync').mockImplementation();
    await lintExecutor(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        force: false,
      }),
      mockContext
    );
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should print the ESLint configuration for a specified file if printConfiguration is specified', async () => {
    setupMocks();
    jest.spyOn(console, 'log');
    const result = await lintExecutor(
      createValidRunBuilderOptions({
        lintFilePatterns: [],
        eslintConfig: './.eslintrc.json',
        fix: true,
        cache: true,
        cacheLocation: 'cacheLocation1',
        format: 'stylish',
        force: false,
        silent: false,
        ignorePath: null,
        maxWarnings: null,
        outputFile: null,
        quiet: false,
        reportUnusedDisableDirectives: null,
        printConfig: 'test-source.ts',
      }),
      mockContext
    );
    expect(console.log).toHaveBeenCalledWith('{\n "file": "test-source.ts"\n}');
    expect(result).toEqual({ success: true });
  });

  it('should pass path to eslint.config.js to resolveAndInstantiateESLint if it is unspecified and we are using flag configuration', async () => {
    setupMocks();
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    await lintExecutor(createValidRunBuilderOptions(), mockContext);
    expect(mockResolveAndInstantiateESLint).toHaveBeenCalledWith(
      `${mockContext.root}/apps/proj/eslint.config.js`,
      {
        lintFilePatterns: [],
        eslintConfig: 'apps/proj/eslint.config.js',
        fix: true,
        cache: true,
        cacheLocation: 'cacheLocation1/proj',
        cacheStrategy: 'content',
        format: 'stylish',
        force: false,
        silent: false,
        ignorePath: null,
        maxWarnings: -1,
        outputFile: null,
        quiet: false,
        noEslintrc: false,
        rulesdir: [],
        resolvePluginsRelativeTo: null,
        reportUnusedDisableDirectives: null,
      },
      true
    );
  });
});
