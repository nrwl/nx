let runCLI = jest.fn();
let readConfig = jest.fn(() =>
  Promise.resolve({
    projectConfig: {
      displayName: 'something',
    },
  })
);

jest.mock('jest', () => ({
  runCLI,
}));

jest.mock('jest-config', () => ({
  readConfig,
}));

import { ExecutorContext } from '@nrwl/devkit';
import { jestExecutor } from './jest.impl';
import { JestExecutorOptions } from './schema';

describe('Jest Executor', () => {
  let mockContext: ExecutorContext;
  const defaultOptions: Omit<JestExecutorOptions, 'jestConfig'> = {
    testPathPattern: [],
  };

  beforeEach(async () => {
    runCLI.mockReturnValue(
      Promise.resolve({
        results: {
          success: true,
        },
      })
    );

    mockContext = {
      root: '/root',
      projectName: 'proj',
      workspace: {
        version: 2,
        projects: {
          proj: {
            root: 'proj',
            targets: {
              test: {
                executor: '@nrwl/jest:jest',
              },
            },
          },
        },
        npmScope: 'test',
      },
      target: {
        executor: '@nrwl/jest:jest',
      },
      cwd: '/root',
      isVerbose: true,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('when the jest config file is untouched', () => {
    beforeEach(() => {
      jest.mock(
        '/root/jest.config.js',
        () => ({
          transform: {},
        }),
        { virtual: true }
      );
    });

    it('should send appropriate options to jestCLI', async () => {
      await jestExecutor(
        {
          ...defaultOptions,
          jestConfig: './jest.config.js',
          watch: false,
        },
        mockContext
      );
      expect(runCLI).toHaveBeenCalledWith(
        expect.objectContaining({
          _: [],
          testPathPattern: [],
          watch: false,
        }),
        ['/root/jest.config.js']
      );
    });

    it('should send appropriate options to jestCLI when testFile is specified', async () => {
      await jestExecutor(
        {
          testFile: 'lib.spec.ts',
          jestConfig: './jest.config.js',
          codeCoverage: false,
          runInBand: true,
          testNamePattern: 'should load',
          testPathPattern: ['/test/path'],
          colors: false,
          reporters: ['/test/path'],
          verbose: false,
          coverageReporters: ['test'],
          coverageDirectory: '/test/coverage',
          watch: false,
        },
        mockContext
      );

      expect(runCLI).toHaveBeenCalledWith(
        expect.objectContaining({
          _: ['lib.spec.ts'],
          coverage: false,
          runInBand: true,
          testNamePattern: 'should load',
          testPathPattern: ['/test/path'],
          colors: false,
          reporters: ['/test/path'],
          verbose: false,
          coverageReporters: ['test'],
          coverageDirectory: '/root/test/coverage',
          watch: false,
        }),
        ['/root/jest.config.js']
      );
    });

    it('should send appropriate options to jestCLI when findRelatedTests is specified', async () => {
      await jestExecutor(
        {
          ...defaultOptions,
          findRelatedTests: 'file1.ts,file2.ts',
          jestConfig: './jest.config.js',
          codeCoverage: false,
          runInBand: true,
          testNamePattern: 'should load',
          watch: false,
        },
        mockContext
      );

      expect(runCLI).toHaveBeenCalledWith(
        expect.objectContaining({
          _: ['file1.ts', 'file2.ts'],
          coverage: false,
          findRelatedTests: true,
          runInBand: true,
          testNamePattern: 'should load',
          testPathPattern: [],
          watch: false,
        }),
        ['/root/jest.config.js']
      );
    });

    it('should send other options to jestCLI', async () => {
      await jestExecutor(
        {
          jestConfig: './jest.config.js',
          codeCoverage: true,
          bail: 1,
          color: false,
          ci: true,
          detectOpenHandles: true,
          logHeapUsage: true,
          detectLeaks: true,
          json: true,
          maxWorkers: 2,
          onlyChanged: true,
          changedSince: 'origin/develop',
          outputFile: 'abc.txt',
          passWithNoTests: true,
          showConfig: true,
          silent: true,
          testNamePattern: 'test',
          testPathIgnorePatterns: ['/test/path/|/tests/e2e/'],
          testPathPattern: ['/test/path'],
          colors: false,
          reporters: ['/test/path'],
          verbose: false,
          coverageReporters: ['test'],
          coverageDirectory: '/test/coverage',
          updateSnapshot: true,
          useStderr: true,
          watch: false,
          watchAll: false,
          testLocationInResults: true,
        },
        mockContext
      );
      expect(runCLI).toHaveBeenCalledWith(
        {
          _: [],
          coverage: true,
          bail: 1,
          color: false,
          ci: true,
          detectOpenHandles: true,
          logHeapUsage: true,
          detectLeaks: true,
          json: true,
          maxWorkers: 2,
          onlyChanged: true,
          changedSince: 'origin/develop',
          outputFile: 'abc.txt',
          passWithNoTests: true,
          showConfig: true,
          silent: true,
          testNamePattern: 'test',
          testPathIgnorePatterns: ['/test/path/|/tests/e2e/'],
          testPathPattern: ['/test/path'],
          colors: false,
          verbose: false,
          reporters: ['/test/path'],
          coverageReporters: ['test'],
          coverageDirectory: '/root/test/coverage',
          updateSnapshot: true,
          useStderr: true,
          watch: false,
          watchAll: false,
          testLocationInResults: true,
        },
        ['/root/jest.config.js']
      );
    });

    it('should support passing string type for maxWorkers option to jestCLI', async () => {
      await jestExecutor(
        {
          ...defaultOptions,
          jestConfig: './jest.config.js',
          maxWorkers: '50%',
        },
        mockContext
      );
      expect(runCLI).toHaveBeenCalledWith(
        {
          _: [],
          maxWorkers: '50%',
          testPathPattern: [],
        },
        ['/root/jest.config.js']
      );
    });

    it('should send the main to runCLI', async () => {
      await jestExecutor(
        {
          ...defaultOptions,
          jestConfig: './jest.config.js',
          setupFile: './test-setup.ts',
          watch: false,
        },
        mockContext
      );
      expect(runCLI).toHaveBeenCalledWith(
        expect.objectContaining({
          _: [],
          setupFilesAfterEnv: ['/root/test-setup.ts'],
          testPathPattern: [],
          watch: false,
        }),
        ['/root/jest.config.js']
      );
    });

    describe('when the jest config file has been modified', () => {
      beforeAll(() => {
        jest.doMock(
          '/root/jest.config.js',
          () => ({
            transform: {
              '^.+\\.[tj]sx?$': 'ts-jest',
            },
            globals: { hereToStay: true, 'ts-jest': { diagnostics: false } },
          }),
          { virtual: true }
        );
      });

      it('should merge the globals property from jest config', async () => {
        await jestExecutor(
          {
            ...defaultOptions,
            jestConfig: './jest.config.js',
            setupFile: './test-setup.ts',
            watch: false,
          },
          mockContext
        );

        expect(runCLI).toHaveBeenCalledWith(
          expect.objectContaining({
            _: [],
            setupFilesAfterEnv: ['/root/test-setup.ts'],
            testPathPattern: [],
            watch: false,
          }),
          ['/root/jest.config.js']
        );
      });
    });

    describe('when we use babel-jest', () => {
      beforeEach(() => {
        jest.doMock(
          '/root/jest.config.js',
          () => ({
            transform: {
              '^.+\\.[tj]sx?$': 'babel-jest',
            },
          }),
          { virtual: true }
        );
      });

      it('should send appropriate options to jestCLI', async () => {
        const options: JestExecutorOptions = {
          ...defaultOptions,
          jestConfig: './jest.config.js',
          watch: false,
        };

        await jestExecutor(options, mockContext);
        expect(runCLI).toHaveBeenCalledWith(
          expect.objectContaining({
            _: [],
            testPathPattern: [],
            watch: false,
          }),
          ['/root/jest.config.js']
        );
      });
    });
  });

  describe('when using typescript config file', () => {
    beforeEach(() => {
      jest.doMock(
        '/root/jest.config.ts',
        () => ({
          transform: {
            '^.+\\.[tj]sx?$': 'babel-jest',
          },
        }),
        { virtual: true }
      );
      // jest.spyOn(tsNode, 'register').mockReturnValue(null)
    });

    it('should send appropriate options to jestCLI', async () => {
      await jestExecutor(
        {
          ...defaultOptions,
          jestConfig: './jest.config.ts',
          watch: false,
        },
        mockContext
      );
      expect(runCLI).toHaveBeenCalledWith(
        expect.objectContaining({
          _: [],
          testPathPattern: [],
          watch: false,
        }),
        ['/root/jest.config.ts']
      );
    });
  });
});
