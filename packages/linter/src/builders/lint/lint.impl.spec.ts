import { schema, JsonObject } from '@angular-devkit/core';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import * as path from 'path';
import { Architect } from '@angular-devkit/architect';
import { logging } from '@angular-devkit/core';
import * as fs from 'fs';

const formattedReports = ['formatted report 1'];
const mockFormatter = jest.fn().mockReturnValue(formattedReports);
const mockGetFormatter = jest.fn().mockReturnValue(mockFormatter);
const mockOutputFixes = jest.fn();
const loggerSpy = jest.fn();

class MockCliEngine {
  executeOnFiles = jest.fn().mockImplementation(() => 'some report');
  static getFormatter = mockGetFormatter;
  static outputFixes = mockOutputFixes;
}

let mockEslintVersion = '6.5';
let mockReports: any[] = [{ results: [], usedDeprecatedRules: [] }];
function mockEslint() {
  jest.doMock('./utility/eslint-utils', () => ({
    lint: jest.fn().mockReturnValue(mockReports),
    loadESLint: () => ({
      CLIEngine: MockCliEngine,
      Linter: {
        version: mockEslintVersion,
      },
    }),
  }));
}

function mockCreateProgram() {
  jest.doMock('./utility/ts-utils', () => ({
    createProgram: jest.fn().mockImplementation((path) => path + '-program'),
  }));
}

function setupMocks() {
  jest.resetModules();
  jest.clearAllMocks();
  jest.spyOn(process, 'chdir').mockImplementation(() => {});
  mockEslint();
  mockCreateProgram();
}

async function runBuilder(options: JsonObject) {
  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  const testArchitectHost = new TestingArchitectHost('/root', '/root');
  await testArchitectHost.addBuilderFromPackage(
    path.join(__dirname, '../../..')
  );
  const architect = new Architect(testArchitectHost, registry);
  const logger = new logging.Logger('');
  logger.subscribe(loggerSpy);
  const run = await architect.scheduleBuilder('@nrwl/linter:lint', options, {
    logger,
  });

  return run.result;
}

describe('Linter Builder', () => {
  beforeEach(() => {
    mockEslintVersion = '6.5';
    mockReports = [{ results: [], usedDeprecatedRules: [] }];
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });
  it('should throw if the eslint version is not supported', async () => {
    mockEslintVersion = '1.6';
    setupMocks();
    const result = runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: [],
    });
    await expect(result).rejects.toThrow(
      /ESLint must be version 6.1 or higher/
    );
  });

  it('should not throw if the eslint version is supported', async () => {
    mockEslintVersion = '6.1';
    setupMocks();
    const result = runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: [],
    });
    await expect(result).resolves.not.toThrow();
  });
  it('should throw if linter is tslint', async () => {
    setupMocks();
    const result = runBuilder({
      linter: 'tslint',
      config: './.eslintrc',
      files: [],
    });
    await expect(result).rejects.toThrow(
      /'tslint' option is no longer supported/
    );
  });

  describe('has tsconfig', () => {
    it('should invoke the linter with the correct options when sending a single tsconfig', async () => {
      setupMocks();
      const { lint } = require('./utility/eslint-utils');
      const { createProgram } = require('./utility/ts-utils');
      await runBuilder({
        linter: 'eslint',
        config: './.eslintrc',
        tsConfig: './tsconfig.json',
      });
      expect(createProgram).toHaveBeenCalledTimes(1);
      expect(createProgram).toHaveBeenCalledWith('/root/tsconfig.json');
      expect(lint).toHaveBeenCalledTimes(1);
      expect(lint).toHaveBeenCalledWith(
        '/root',
        '/root/.eslintrc',
        expect.anything(),
        expect.any(Set),
        '/root/tsconfig.json-program',
        ['/root/tsconfig.json-program']
      );
    });
    it('should invoke the linter with the correct options when sending multiple tsconfigs', async () => {
      setupMocks();
      const { lint } = require('./utility/eslint-utils');
      const { createProgram } = require('./utility/ts-utils');
      await runBuilder({
        linter: 'eslint',
        config: './.eslintrc',
        tsConfig: ['./tsconfig.json', './tsconfig2.json'],
      });
      expect(createProgram).toHaveBeenCalledTimes(2);
      expect(createProgram).toHaveBeenNthCalledWith(1, '/root/tsconfig.json');
      expect(createProgram).toHaveBeenNthCalledWith(2, '/root/tsconfig2.json');
      expect(lint).toHaveBeenCalledTimes(2);
      expect(lint).toHaveBeenNthCalledWith(
        1,
        '/root',
        '/root/.eslintrc',
        expect.anything(),
        expect.any(Set),
        '/root/tsconfig.json-program',
        ['/root/tsconfig.json-program', '/root/tsconfig2.json-program']
      );
      expect(lint).toHaveBeenNthCalledWith(
        2,
        '/root',
        '/root/.eslintrc',
        expect.anything(),
        expect.any(Set),
        '/root/tsconfig2.json-program',
        ['/root/tsconfig.json-program', '/root/tsconfig2.json-program']
      );
    });
    it('should invoke the linter with the correct options when sending no tsconfig', async () => {
      setupMocks();
      const { lint } = require('./utility/eslint-utils');
      const { createProgram } = require('./utility/ts-utils');
      await runBuilder({
        linter: 'eslint',
        config: './.eslintrc',
        files: [],
      });
      expect(createProgram).not.toHaveBeenCalled();
      expect(lint).toHaveBeenCalledTimes(1);
      expect(lint).toHaveBeenCalledWith(
        '/root',
        '/root/.eslintrc',
        expect.anything(),
        expect.any(Set)
      );
    });
  });

  it('should invoke the linter with the options that were passed to the builder', async () => {
    setupMocks();
    const { lint } = require('./utility/eslint-utils');
    await runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: ['includedFile1'],
      exclude: ['excludedFile1'],
      fix: true,
      cache: true,
      cacheLocation: 'cacheLocation1',
    });
    expect(lint).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        config: './.eslintrc',
        files: ['includedFile1'],
        exclude: ['excludedFile1'],
        fix: true,
        cache: true,
        cacheLocation: 'cacheLocation1',
        force: false,
        format: 'stylish',
        linter: 'eslint',
        outputFile: undefined,
        silent: false,
        quiet: false,
        tsConfig: undefined,
        maxWarnings: -1,
      },
      expect.any(Set)
    );
  });

  it('should throw if no reports generated', async () => {
    mockReports = [];
    setupMocks();
    const result = runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: ['includedFile1'],
    });
    await expect(result).rejects.toThrow(
      /Invalid lint configuration. Nothing to lint./
    );
  });
  it('should create a new instance of the formatter with the selected user option', async () => {
    setupMocks();
    await runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: ['includedFile1'],
      format: 'json',
    });
    expect(mockGetFormatter).toHaveBeenCalledWith('json');
    await runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: ['includedFile1'],
      format: 'html',
    });
    expect(mockGetFormatter).toHaveBeenCalledWith('html');
  });
  it('should pass all the reports to the fix engine, even if --fix is false', async () => {
    setupMocks();
    await runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: ['includedFile1'],
      format: 'json',
      fix: false,
    });
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
      await runBuilder({
        linter: 'eslint',
        config: './.eslintrc',
        files: ['includedFile1'],
        format: 'json',
        silent: false,
      });
      const flattenedCalls = loggerSpy.mock.calls.reduce((logs, call) => {
        return [...logs, call[0]];
      }, []);
      expect(flattenedCalls).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Lint errors found in the listed files.'
          ),
        })
      );
      expect(flattenedCalls).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Lint warnings found in the listed files.'
          ),
        })
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
      const output = await runBuilder({
        linter: 'eslint',
        config: './.eslintrc',
        files: ['includedFile1'],
        format: 'json',
        silent: false,
      });
      const flattenedCalls = loggerSpy.mock.calls.reduce((logs, call) => {
        return [...logs, call[0]];
      }, []);
      expect(flattenedCalls).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Lint errors found in the listed files.'
          ),
        })
      );
      expect(flattenedCalls).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Lint warnings found in the listed files.'
          ),
        })
      );
      expect(flattenedCalls).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('All files pass linting.'),
        })
      );
    });

    it('should attempt to write the lint results to the output file, if specified', async () => {
      setupMocks();
      jest.spyOn(fs, 'writeFileSync').mockImplementation();
      jest.mock('@nrwl/workspace', () => ({
        createDirectory: jest.fn(),
      }));
      const { createDirectory } = require('@nrwl/workspace');
      await runBuilder({
        linter: 'eslint',
        config: './.eslintrc',
        files: ['includedFile1'],
        outputFile: 'a/b/c/outputFile1',
      });
      expect(createDirectory).toHaveBeenCalledWith('/root/a/b/c');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/root/a/b/c/outputFile1',
        formattedReports
      );
    });
    it('should not attempt to write the lint results to the output file, if not specified', async () => {
      setupMocks();
      jest.spyOn(fs, 'writeFileSync').mockImplementation();
      await runBuilder({
        linter: 'eslint',
        config: './.eslintrc',
        files: ['includedFile1'],
      });
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
      const output = await runBuilder({
        linter: 'eslint',
        config: './.eslintrc',
        files: ['includedFile1'],
        format: 'json',
        silent: true,
      });
      const flattenedCalls = loggerSpy.mock.calls.reduce((logs, call) => {
        return [...logs, call[0]];
      }, []);
      expect(flattenedCalls).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Lint errors found in the listed files.'
          ),
        })
      );
      expect(flattenedCalls).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Lint warnings found in the listed files.'
          ),
        })
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
    const output = await runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: ['includedFile1'],
      format: 'json',
      silent: true,
    });
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
    const output = await runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: ['includedFile1'],
      format: 'json',
      silent: true,
      force: true,
    });
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
    const output = await runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: ['includedFile1'],
      format: 'json',
      silent: true,
      force: false,
    });
    expect(output.success).toBeFalsy();
  });
  it('should be a failure if there are no errors, but warnings and maxWarnings is set to 0', async () => {
    mockReports = [
      {
        errorCount: 0,
        warningCount: 1,
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
    const output = await runBuilder({
      linter: 'eslint',
      config: './.eslintrc',
      files: ['includedFile1'],
      format: 'json',
      silent: true,
      force: false,
      maxWarnings: 1,
    });
    expect(output.success).toBeFalsy();
  });
});
