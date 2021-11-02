import * as fs from 'fs';

const formattedReports = ['formatted report 1'];
const mockFormatter = jest.fn().mockReturnValue(formattedReports);
const mockGetFormatter = jest.fn().mockReturnValue(mockFormatter);
const mockOutputFixes = jest.fn();

const mockCreateProgram = jest
  .fn()
  .mockImplementation((path) => `${path}-program`);
jest.mock('./utility/ts-utils', () => ({
  createProgram: mockCreateProgram,
}));

let mockReports: any[] = [{ results: [], usedDeprecatedRules: [] }];
const mockLint = jest.fn().mockImplementation(() => mockReports);
jest.mock('./utility/eslint-utils', () => ({
  lint: mockLint,
  loadESLint: () => ({
    CLIEngine: MockCliEngine,
    Linter: {
      version: mockEslintVersion,
    },
  }),
}));

jest.spyOn(fs, 'writeFileSync').mockImplementation();
const mockCreateDirectory = jest.fn();
jest.mock('../eslint/utility/create-directory', () => ({
  createDirectory: mockCreateDirectory,
}));

class MockCliEngine {
  executeOnFiles = jest.fn().mockImplementation(() => 'some report');
  static getFormatter = mockGetFormatter;
  static outputFixes = mockOutputFixes;
}

let mockEslintVersion = '6.5';

import lintExecutor from './lint.impl';
import { ExecutorContext } from '@nrwl/tao/src/shared/workspace';
import { Schema } from './schema';

function setupMocks() {
  jest.resetModules();
  jest.clearAllMocks();
  jest.spyOn(process, 'chdir').mockImplementation(() => {});
  jest.spyOn(console, 'info');
  jest.spyOn(console, 'warn');
  jest.spyOn(console, 'error');
}

describe('Linter Builder', () => {
  let mockContext: ExecutorContext;
  const defaultOptions: Omit<Schema, 'config' | 'tsConfig'> = {
    format: 'stylish',
    linter: 'eslint',
    maxWarnings: -1,
    files: [],
    exclude: [],
    quiet: false,
    silent: false,
    force: false,
  };
  beforeEach(() => {
    mockEslintVersion = '6.5';
    mockReports = [{ results: [], usedDeprecatedRules: [] }];
    mockContext = {
      root: '/root',
      cwd: 'cwd',
      workspace: {
        version: 2,
        projects: {},
        npmScope: 'test',
      },
      isVerbose: false,
    };
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });
  it('should throw if the eslint version is not supported', async () => {
    mockEslintVersion = '1.6';
    setupMocks();
    const result = lintExecutor(
      {
        ...defaultOptions,
        linter: 'eslint',
        config: './.eslintrc.json',
        files: [],
      },
      mockContext
    );
    await expect(result).rejects.toThrow(
      /ESLint must be version 6.1 or higher/
    );
  });

  it('should not throw if the eslint version is supported', async () => {
    mockEslintVersion = '6.1';
    setupMocks();
    const result = lintExecutor(
      {
        ...defaultOptions,
        linter: 'eslint',
        config: './.eslintrc.json',
        files: [],
      },
      mockContext
    );
    await expect(result).resolves.not.toThrow();
  });
  it('should throw if linter is tslint', async () => {
    setupMocks();
    const result = lintExecutor(
      {
        ...defaultOptions,
        linter: 'tslint',
        config: './.eslintrc.json',
        files: [],
      },
      mockContext
    );
    await expect(result).rejects.toThrow(
      /'tslint' option is no longer supported/
    );
  });

  describe('has tsconfig', () => {
    it('should invoke the linter with the correct options when sending a single tsconfig', async () => {
      setupMocks();
      await lintExecutor(
        {
          ...defaultOptions,
          linter: 'eslint',
          config: './.eslintrc.json',
          tsConfig: './tsconfig.json',
        },
        mockContext
      );
      expect(mockCreateProgram).toHaveBeenCalledTimes(1);
      expect(mockCreateProgram).toHaveBeenCalledWith('/root/tsconfig.json');
      expect(mockLint).toHaveBeenCalledTimes(1);
      expect(mockLint).toHaveBeenCalledWith(
        '/root',
        '/root/.eslintrc.json',
        expect.anything(),
        expect.any(Set),
        '/root/tsconfig.json-program',
        ['/root/tsconfig.json-program']
      );
    });
    it('should invoke the linter with the correct options when sending multiple tsconfigs', async () => {
      setupMocks();
      await lintExecutor(
        {
          ...defaultOptions,
          linter: 'eslint',
          config: './.eslintrc.json',
          tsConfig: ['./tsconfig.json', './tsconfig2.json'],
        },
        mockContext
      );
      expect(mockCreateProgram).toHaveBeenCalledTimes(2);
      expect(mockCreateProgram).toHaveBeenNthCalledWith(
        1,
        '/root/tsconfig.json'
      );
      expect(mockCreateProgram).toHaveBeenNthCalledWith(
        2,
        '/root/tsconfig2.json'
      );
      expect(mockLint).toHaveBeenCalledTimes(2);
      expect(mockLint).toHaveBeenNthCalledWith(
        1,
        '/root',
        '/root/.eslintrc.json',
        expect.anything(),
        expect.any(Set),
        '/root/tsconfig.json-program',
        ['/root/tsconfig.json-program', '/root/tsconfig2.json-program']
      );
      expect(mockLint).toHaveBeenNthCalledWith(
        2,
        '/root',
        '/root/.eslintrc.json',
        expect.anything(),
        expect.any(Set),
        '/root/tsconfig2.json-program',
        ['/root/tsconfig.json-program', '/root/tsconfig2.json-program']
      );
    });
    it('should invoke the linter with the correct options when sending no tsconfig', async () => {
      setupMocks();
      await lintExecutor(
        {
          ...defaultOptions,
          linter: 'eslint',
          config: './.eslintrc.json',
          files: [],
        },
        mockContext
      );
      expect(mockCreateProgram).not.toHaveBeenCalled();
      expect(mockLint).toHaveBeenCalledTimes(1);
      expect(mockLint).toHaveBeenCalledWith(
        '/root',
        '/root/.eslintrc.json',
        expect.anything(),
        expect.any(Set)
      );
    });
  });

  it('should invoke the linter with the options that were passed to the builder', async () => {
    setupMocks();
    await lintExecutor(
      {
        ...defaultOptions,
        linter: 'eslint',
        config: './.eslintrc.json',
        files: ['includedFile1'],
        exclude: ['excludedFile1'],
        fix: true,
        cache: true,
        cacheLocation: 'cacheLocation1',
      },
      mockContext
    );
    expect(mockLint).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        config: './.eslintrc.json',
        files: ['includedFile1'],
        exclude: ['excludedFile1'],
        fix: true,
        cache: true,
        cacheLocation: 'cacheLocation1',
        force: false,
        format: 'stylish',
        linter: 'eslint',
        silent: false,
        quiet: false,
        maxWarnings: -1,
      },
      expect.any(Set)
    );
  });

  it('should throw if no reports generated', async () => {
    mockReports = [];
    setupMocks();
    const result = lintExecutor(
      {
        ...defaultOptions,
        linter: 'eslint',
        config: './.eslintrc.json',
        files: ['includedFile1'],
      },
      mockContext
    );
    await expect(result).rejects.toThrow(
      /Invalid lint configuration. Nothing to lint./
    );
  });
  it('should create a new instance of the formatter with the selected user option', async () => {
    setupMocks();
    await lintExecutor(
      {
        ...defaultOptions,
        linter: 'eslint',
        config: './.eslintrc.json',
        files: ['includedFile1'],
        format: 'json',
      },
      mockContext
    );
    expect(mockGetFormatter).toHaveBeenCalledWith('json');
    await lintExecutor(
      {
        ...defaultOptions,
        linter: 'eslint',
        config: './.eslintrc.json',
        files: ['includedFile1'],
        format: 'html',
      },
      mockContext
    );
    expect(mockGetFormatter).toHaveBeenCalledWith('html');
  });
  it('should pass all the reports to the fix engine, even if --fix is false', async () => {
    setupMocks();
    await lintExecutor(
      {
        ...defaultOptions,
        linter: 'eslint',
        config: './.eslintrc.json',
        files: ['includedFile1'],
        format: 'json',
        fix: false,
      },
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
        {
          ...defaultOptions,
          linter: 'eslint',
          config: './.eslintrc.json',
          files: ['includedFile1'],
          format: 'json',
          silent: false,
        },
        mockContext
      );
      expect(console.error).toHaveBeenCalledWith(
        'Lint errors found in the listed files.\n'
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Lint warnings found in the listed files.\n'
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
      const output = await lintExecutor(
        {
          ...defaultOptions,
          linter: 'eslint',
          config: './.eslintrc.json',
          files: ['includedFile1'],
          format: 'json',
          silent: false,
        },
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

    it('should attempt to write the lint results to the output file, if specified', async () => {
      setupMocks();
      await lintExecutor(
        {
          ...defaultOptions,
          linter: 'eslint',
          config: './.eslintrc.json',
          files: ['includedFile1'],
          outputFile: 'a/b/c/outputFile1',
        },
        mockContext
      );
      expect(mockCreateDirectory).toHaveBeenCalledWith('/root/a/b/c');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/root/a/b/c/outputFile1',
        formattedReports
      );
    });
    it('should not attempt to write the lint results to the output file, if not specified', async () => {
      setupMocks();
      jest.spyOn(fs, 'writeFileSync').mockImplementation();
      await lintExecutor(
        {
          ...defaultOptions,
          linter: 'eslint',
          config: './.eslintrc.json',
          files: ['includedFile1'],
        },
        mockContext
      );
      expect(fs.writeFileSync).not.toHaveBeenCalled();
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
      const output = await lintExecutor(
        {
          ...defaultOptions,
          linter: 'eslint',
          config: './.eslintrc.json',
          files: ['includedFile1'],
          format: 'json',
          silent: true,
        },
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

  it('should be a success if there are no errors', async () => {
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
      {
        ...defaultOptions,
        linter: 'eslint',
        config: './.eslintrc.json',
        files: ['includedFile1'],
        format: 'json',
        silent: true,
      },
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
      {
        ...defaultOptions,
        linter: 'eslint',
        config: './.eslintrc.json',
        files: ['includedFile1'],
        format: 'json',
        silent: true,
        force: true,
      },
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
      {
        ...defaultOptions,
        linter: 'eslint',
        config: './.eslintrc.json',
        files: ['includedFile1'],
        format: 'json',
        silent: true,
        force: false,
      },
      mockContext
    );
    expect(output.success).toBeFalsy();
  });
  it('should be a failure if there are no errors, but there are more warnings than allowed by maxWarnings', async () => {
    mockReports = [
      {
        errorCount: 0,
        warningCount: 1,
        results: [],
        usedDeprecatedRules: [],
      },
      {
        errorCount: 0,
        warningCount: 1,
        results: [],
        usedDeprecatedRules: [],
      },
    ];
    setupMocks();
    const output = await lintExecutor(
      {
        ...defaultOptions,
        tsConfig: 'tsconfig.json',
        linter: 'eslint',
        config: './.eslintrc.json',
        files: ['includedFile1'],
        format: 'json',
        silent: true,
        force: false,
        maxWarnings: 1,
      },
      mockContext
    );
    expect(output.success).toBeFalsy();
  });
});
