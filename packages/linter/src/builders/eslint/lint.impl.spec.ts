import { Architect } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { logging, schema } from '@angular-devkit/core';
import * as fs from 'fs';
import { Schema } from './schema';

const formattedReports = ['formatted report 1'];
const mockFormatter = {
  format: jest.fn().mockReturnValue(formattedReports),
};
const mockLoadFormatter = jest.fn().mockReturnValue(mockFormatter);
const mockOutputFixes = jest.fn();
const loggerSpy = jest.fn();

const VALID_ESLINT_VERSION = '7.6';

class MockESLint {
  static version = VALID_ESLINT_VERSION;
  static outputFixes = mockOutputFixes;
  loadFormatter = mockLoadFormatter;
}

let mockReports: any[] = [{ results: [], usedDeprecatedRules: [] }];
function mockEslint() {
  jest.doMock('./utility/eslint-utils', () => {
    return {
      lint: jest.fn().mockReturnValue(mockReports),
      loadESLint: jest.fn().mockReturnValue(
        Promise.resolve({
          ESLint: MockESLint,
        })
      ),
    };
  });
}

function createValidRunBuilderOptions(
  additionalOptions: Partial<Schema> = {}
): Schema {
  return {
    lintFilePatterns: [],
    eslintConfig: './.eslintrc.json',
    fix: true,
    cache: true,
    cacheLocation: 'cacheLocation1',
    format: 'stylish',
    force: false,
    silent: false,
    ignorePath: null,
    outputFile: null,
    maxWarnings: -1,
    quiet: false,
    ...additionalOptions,
  };
}

function setupMocks() {
  jest.resetModules();
  jest.clearAllMocks();
  jest.spyOn(process, 'chdir').mockImplementation(() => {});
  mockEslint();
}

async function runBuilder(options: Schema) {
  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);

  const testArchitectHost = new TestingArchitectHost('/root', '/root');
  const builderName = '@angular-eslint/builder:lint';

  /**
   * Require in the implementation from src so that we don't need
   * to run a build before tests run and it is dynamic enough
   * to come after jest does its mocking
   */
  const { default: builderImplementation } = require('./lint.impl');
  testArchitectHost.addBuilder(builderName, builderImplementation);

  const architect = new Architect(testArchitectHost, registry);
  const logger = new logging.Logger('');
  logger.subscribe(loggerSpy);

  const run = await architect.scheduleBuilder(builderName, options, {
    logger,
  });

  return run.result;
}

describe('Linter Builder', () => {
  beforeEach(() => {
    MockESLint.version = VALID_ESLINT_VERSION;
    mockReports = [{ results: [], usedDeprecatedRules: [] }];
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should throw if the eslint version is not supported', async () => {
    MockESLint.version = '1.6';
    setupMocks();
    const result = runBuilder(createValidRunBuilderOptions());
    await expect(result).rejects.toThrow(
      /ESLint must be version 7.6 or higher/
    );
  });

  it('should not throw if the eslint version is supported', async () => {
    setupMocks();
    const result = runBuilder(createValidRunBuilderOptions());
    await expect(result).resolves.not.toThrow();
  });

  it('should invoke the linter with the options that were passed to the builder', async () => {
    setupMocks();
    const { lint } = require('./utility/eslint-utils');
    await runBuilder(
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
      })
    );
    expect(lint).toHaveBeenCalledWith('/root/.eslintrc.json', {
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
    });
  });

  it('should throw if no reports generated', async () => {
    mockReports = [];
    setupMocks();
    const result = runBuilder(
      createValidRunBuilderOptions({
        lintFilePatterns: ['includedFile1'],
      })
    );
    await expect(result).rejects.toThrow(
      /Invalid lint configuration. Nothing to lint./
    );
  });

  it('should create a new instance of the formatter with the selected user option', async () => {
    setupMocks();
    await runBuilder(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
      })
    );
    expect(mockLoadFormatter).toHaveBeenCalledWith('json');
    await runBuilder(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'html',
      })
    );
    expect(mockLoadFormatter).toHaveBeenCalledWith('html');
  });

  it('should pass all the reports to the fix engine, even if --fix is false', async () => {
    setupMocks();
    await runBuilder(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        fix: false,
      })
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
      await runBuilder(
        createValidRunBuilderOptions({
          eslintConfig: './.eslintrc.json',
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
        })
      );
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
      await runBuilder(
        createValidRunBuilderOptions({
          eslintConfig: './.eslintrc.json',
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
        })
      );
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

    it('should not log warnings if the quiet flag was passed', async () => {
      mockReports = [
        {
          errorCount: 1,
          warningCount: 4,
          results: [],
          usedDeprecatedRules: [],
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
      await runBuilder(
        createValidRunBuilderOptions({
          eslintConfig: './.eslintrc.json',
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: false,
          quiet: true,
        })
      );
      console.log('FPPP', loggerSpy.mock.calls);
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
      expect(flattenedCalls).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Lint warnings found in the listed files.'
          ),
        })
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
      await runBuilder(
        createValidRunBuilderOptions({
          eslintConfig: './.eslintrc.json',
          lintFilePatterns: ['includedFile1'],
          format: 'json',
          silent: true,
        })
      );
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
    const output = await runBuilder(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        maxWarnings: -1,
      })
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
    const output = await runBuilder(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        force: true,
      })
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
    const output = await runBuilder(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        force: false,
      })
    );
    expect(output.success).toBeFalsy();
  });

  it('should attempt to write the lint results to the output file, if specified', async () => {
    setupMocks();
    jest.spyOn(fs, 'writeFileSync').mockImplementation();
    jest.mock('@nrwl/workspace', () => ({
      createDirectory: jest.fn(),
    }));
    const { createDirectory } = require('@nrwl/workspace');
    await runBuilder(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        force: false,
        outputFile: 'a/b/c/outputFile1',
      })
    );
    expect(createDirectory).toHaveBeenCalledWith('/root/a/b/c');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/root/a/b/c/outputFile1',
      formattedReports
    );
  });

  it('should not attempt to write the lint results to the output file, if not specified', async () => {
    setupMocks();
    jest.spyOn(fs, 'writeFileSync').mockImplementation();
    await runBuilder(
      createValidRunBuilderOptions({
        eslintConfig: './.eslintrc.json',
        lintFilePatterns: ['includedFile1'],
        format: 'json',
        silent: true,
        force: false,
      })
    );
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
