import * as fs from 'fs';
import type { Schema } from './schema';
import type { ExecutorContext } from '@nrwl/devkit';

jest.spyOn(fs, 'mkdirSync').mockImplementation();
jest.spyOn(fs, 'writeFileSync').mockImplementation();

const formattedReports = ['formatted report 1'];
const mockFormatter = {
  format: jest.fn().mockReturnValue(formattedReports),
};
const mockLoadFormatter = jest.fn().mockReturnValue(mockFormatter);
const mockIsPathIgnored = jest.fn().mockReturnValue(Promise.resolve(false));
const mockOutputFixes = jest.fn();

const VALID_ESLINT_VERSION = '7.6';

class MockESLint {
  static version = VALID_ESLINT_VERSION;
  static outputFixes = mockOutputFixes;
  loadFormatter = mockLoadFormatter;
  isPathIgnored = mockIsPathIgnored;
}

let mockReports: any[] = [{ results: [], usedDeprecatedRules: [] }];
let mockLint = jest.fn().mockImplementation(() => mockReports);
jest.mock('./utility/eslint-utils', () => {
  return {
    lint: mockLint,
    loadESLint: jest.fn().mockReturnValue(
      Promise.resolve({
        ESLint: MockESLint,
      })
    ),
  };
});
import lintExecutor from './lint.impl';

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
    ...additionalOptions,
  };
}

function setupMocks() {
  jest.resetModules();
  jest.clearAllMocks();
  jest.spyOn(process, 'chdir').mockImplementation(() => {});
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
}

describe('Linter Builder', () => {
  let mockContext: ExecutorContext;
  beforeEach(() => {
    MockESLint.version = VALID_ESLINT_VERSION;
    mockReports = [{ results: [], usedDeprecatedRules: [] }];
    const projectName = 'proj';
    mockContext = {
      projectName,
      root: '/root',
      cwd: '/root',
      workspace: {
        version: 2,
        projects: {
          [projectName]: {
            root: `apps/${projectName}`,
            sourceRoot: `apps/${projectName}/src`,
            targets: {},
          },
        },
        npmScope: 'test',
      },
      isVerbose: false,
    };
    mockLint.mockImplementation(() => mockReports);
  });

  afterAll(() => {
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
      }),
      mockContext
    );
    expect(mockLint).toHaveBeenCalledWith('/root/.eslintrc.json', {
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
    });
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
      expect(console.error).toHaveBeenCalledWith(
        'Lint errors found in the listed files.\n'
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Lint warnings found in the listed files.\n'
      );
    });

    it('should intercept the error from `@typescript-eslint` regarding missing parserServices and provide a more detailed user-facing message', async () => {
      setupMocks();

      mockLint.mockImplementation(() => {
        throw new Error(
          `Error while loading rule '@typescript-eslint/await-thenable': You have used a rule which requires parserServices to be generated. You must therefore provide a value for the "parserOptions.project" property for @typescript-eslint/parser.`
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
Error: You have attempted to use a lint rule which requires the full TypeScript type-checker to be available, but you do not have \`parserOptions.project\` configured to point at your project tsconfig.json files in the relevant TypeScript file "overrides" block of your project ESLint config \`apps/proj/.eslintrc.json\`

Please see https://nx.dev/guides/eslint for full guidance on how to resolve this issue.
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
      expect(console.error).not.toHaveBeenCalledWith(
        'Lint errors found in the listed files.\n'
      );
      expect(console.warn).not.toHaveBeenCalledWith(
        'Lint warnings found in the listed files.\n'
      );
      expect(console.info).toHaveBeenCalledWith('All files pass linting.\n');
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
      expect(console.error).toHaveBeenCalledWith(
        'Lint errors found in the listed files.\n'
      );
      expect(console.warn).not.toHaveBeenCalledWith(
        'Lint warnings found in the listed files.\n'
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
      expect(console.error).not.toHaveBeenCalledWith(
        'Lint errors found in the listed files.\n'
      );
      expect(console.warn).not.toHaveBeenCalledWith(
        'Lint warnings found in the listed files.\n'
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

  it('should attempt to write the lint results to the output file, if specified', async () => {
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
    expect(fs.mkdirSync).toHaveBeenCalledWith('/root/a/b/c', {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/root/a/b/c/outputFile1',
      formattedReports
    );
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
});
