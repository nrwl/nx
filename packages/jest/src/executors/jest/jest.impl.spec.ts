const runCLI = jest.fn();
jest.mock('jest', () => ({ runCLI }));

jest.mock('@nrwl/workspace/src/core/project-graph', () => ({
  ...jest.requireActual('@nrwl/workspace/src/core/project-graph'),
  createProjectGraph: jest.fn(),
}));

const calculateProjectTargetDependencies = jest.fn();
const createTmpJestConfig = jest.fn();
const createTmpTsConfig = jest.fn();
const shouldUpdateDependencyPaths = jest.fn();
jest.mock('@nrwl/workspace/src/utilities/buildable-libs-utils', () => ({
  calculateProjectTargetDependencies,
  createTmpJestConfig,
  createTmpTsConfig,
  shouldUpdateDependencyPaths,
}));

const ts = { findConfigFile: jest.fn() };
jest.mock('typescript', () => ({ findConfigFile: ts.findConfigFile, sys: {} }));

import { ExecutorContext } from '@nrwl/tao/src/shared/workspace';
import { ProjectType } from '@nrwl/workspace/src/core/project-graph';
import { jestExecutor } from './jest.impl';
import { JestExecutorOptions } from './schema';

describe('Jest Executor', () => {
  let mockContext: ExecutorContext;
  const defaultOptions: JestExecutorOptions = {
    jestConfig: './jest.config.js',
    testPathPattern: [],
  };

  beforeEach(() => {
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
      },
      target: {
        executor: '@nrwl/jest:jest',
      },
      cwd: '/root',
      isVerbose: true,
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('project with no dependencies', () => {
    beforeEach(() => {
      calculateProjectTargetDependencies.mockReturnValue({
        target: {
          type: ProjectType.app,
          name: 'proj',
        },
        dependencies: [],
      });
    });

    describe('when the jest config file is untouched', () => {
      beforeEach(() => {
        jest.mock(
          '/root/jest.config.js',
          () => ({
            transform: {
              '^.+\\.[tj]sx?$': 'ts-jest',
            },
          }),
          { virtual: true }
        );
      });

      it('should send appropriate options to jestCLI', async () => {
        await jestExecutor(
          {
            ...defaultOptions,
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
            ...defaultOptions,
            testFile: 'lib.spec.ts',
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
            ...defaultOptions,
            codeCoverage: true,
            bail: 1,
            color: false,
            ci: true,
            detectOpenHandles: true,
            json: true,
            maxWorkers: 2,
            onlyChanged: true,
            outputFile: 'abc.txt',
            passWithNoTests: true,
            showConfig: true,
            silent: true,
            testNamePattern: 'test',
            testPathPattern: ['/test/path'],
            colors: false,
            reporters: ['/test/path'],
            verbose: false,
            coverageReporters: ['test'],
            coverageDirectory: '/test/coverage',
            testResultsProcessor: 'results-processor',
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
            json: true,
            maxWorkers: 2,
            onlyChanged: true,
            outputFile: 'abc.txt',
            passWithNoTests: true,
            showConfig: true,
            silent: true,
            testNamePattern: 'test',
            testPathPattern: ['/test/path'],
            colors: false,
            verbose: false,
            reporters: ['/test/path'],
            coverageReporters: ['test'],
            coverageDirectory: '/root/test/coverage',
            testResultsProcessor: 'results-processor',
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

      it('should not update jest config nor tsconfig', async () => {
        await jestExecutor({ ...defaultOptions }, mockContext);

        expect(runCLI).toHaveBeenCalledWith(expect.any(Object), [
          '/root/jest.config.js',
        ]);
        expect(createTmpJestConfig).not.toHaveBeenCalled();
        expect(createTmpTsConfig).not.toHaveBeenCalled();
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
  });

  describe('project with dependencies', () => {
    const projecTargetDependencies = {
      target: {
        type: ProjectType.app,
        name: 'proj',
        data: { root: '/root/proj' },
      },
      dependencies: [{ outputs: ['dist/lib1'] }, { outputs: ['dist/lib2'] }],
    };

    beforeEach(() => {
      jest.resetModules();
      jest.mock(
        '/root/jest.config.js',
        () => ({
          transform: {
            '^.+\\.[tj]sx?$': 'ts-jest',
          },
          globals: {
            'ts-jest': {
              tsconfig: '<rootDir>/tsconfig.spec.json',
            },
          },
        }),
        { virtual: true }
      );

      calculateProjectTargetDependencies.mockReturnValue(
        projecTargetDependencies
      );

      shouldUpdateDependencyPaths.mockReturnValue(true);
      createTmpJestConfig.mockReturnValue('/tmp/jest.config.generated.json');
      createTmpTsConfig.mockReturnValue('/tmp/tsconfig.spec.generated.json');
      ts.findConfigFile.mockReturnValue('/root/tsconfig.spec.json');
    });

    it('should not update jest config nor tsconfig when the deps paths should not be updated', async () => {
      shouldUpdateDependencyPaths.mockReturnValue(false);

      await jestExecutor({ ...defaultOptions }, mockContext);

      expect(runCLI).toHaveBeenCalledWith(expect.any(Object), [
        '/root/jest.config.js',
      ]);
      expect(createTmpJestConfig).not.toHaveBeenCalled();
      expect(createTmpTsConfig).not.toHaveBeenCalled();
    });

    it('should update tsconfig paths and the jest config', async () => {
      await jestExecutor({ ...defaultOptions }, mockContext);

      expect(runCLI).toHaveBeenCalledWith(expect.any(Object), [
        '/tmp/jest.config.generated.json',
      ]);
      expect(createTmpTsConfig).toHaveBeenCalledWith(
        '/root/tsconfig.spec.json',
        '/root',
        projecTargetDependencies.target.data.root,
        projecTargetDependencies.dependencies
      );
      expect(createTmpJestConfig).toHaveBeenCalledWith(
        '/root',
        projecTargetDependencies.target.data.root,
        expect.objectContaining({
          globals: {
            'ts-jest': { tsconfig: '/tmp/tsconfig.spec.generated.json' },
          },
          transformIgnorePatterns: expect.arrayContaining([
            '/dist/lib1/',
            '/dist/lib2/',
          ]),
        })
      );
    });

    it('should respect existing rootDir', async () => {
      jest.doMock(
        '/root/jest.config.js',
        () => ({
          transform: {
            '^.+\\.[tj]sx?$': 'ts-jest',
          },
          globals: {
            'ts-jest': {
              tsconfig: '<rootDir>/tsconfig.spec.json',
            },
          },
          rootDir: '/other-root',
        }),
        { virtual: true }
      );

      await jestExecutor({ ...defaultOptions }, mockContext);

      expect(createTmpJestConfig).toHaveBeenCalledWith(
        '/root',
        projecTargetDependencies.target.data.root,
        expect.objectContaining({ rootDir: '/other-root' })
      );
    });

    it('should respect existing transformIgnorePatterns', async () => {
      jest.doMock(
        '/root/jest.config.js',
        () => ({
          transform: {
            '^.+\\.[tj]sx?$': 'ts-jest',
          },
          globals: {
            'ts-jest': {
              tsconfig: '<rootDir>/tsconfig.spec.json',
            },
          },
          transformIgnorePatterns: ['/pattern/'],
        }),
        { virtual: true }
      );

      await jestExecutor({ ...defaultOptions }, mockContext);

      expect(createTmpJestConfig).toHaveBeenCalledWith(
        '/root',
        projecTargetDependencies.target.data.root,
        expect.objectContaining({
          transformIgnorePatterns: ['/pattern/', '/dist/lib1/', '/dist/lib2/'],
        })
      );
    });

    describe('when using babel-jest', () => {
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

      it('should not update the ts-jest tsconfig property in the jest config', async () => {
        await jestExecutor({ ...defaultOptions }, mockContext);

        expect(runCLI).toHaveBeenCalledWith(expect.any(Object), [
          '/tmp/jest.config.generated.json',
        ]);
        expect(createTmpTsConfig).toHaveBeenCalled();
        expect(createTmpJestConfig).toHaveBeenCalledWith(
          '/root',
          projecTargetDependencies.target.data.root,
          expect.not.objectContaining({
            globals: {
              'ts-jest': { tsconfig: expect.any(String) },
            },
          })
        );
      });
    });
  });
});
