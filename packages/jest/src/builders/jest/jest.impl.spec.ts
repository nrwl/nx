import { Architect } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import * as path from 'path';
import { JestBuilderOptions } from './schema';

describe('Jest Builder', () => {
  let architect: Architect;
  let runCLI: jest.Mock<any>;

  beforeEach(async () => {
    jest.resetModules();

    runCLI = jest.fn();
    jest.doMock('jest', () => ({
      runCLI,
    }));

    const registry = new schema.CoreSchemaRegistry();
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);
    const testArchitectHost = new TestingArchitectHost('/root', '/root');

    architect = new Architect(testArchitectHost, registry);
    await testArchitectHost.addBuilderFromPackage(
      path.join(__dirname, '../../..')
    );

    runCLI.mockReturnValue(
      Promise.resolve({
        results: {
          success: true,
        },
      })
    );
  });

  describe('when the jest config file is untouched', () => {
    beforeEach(() => {
      jest.doMock(
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
      const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
        jestConfig: './jest.config.js',
        tsConfig: './tsconfig.test.json',
        watch: false,
      });
      expect(await run.result).toEqual(
        jasmine.objectContaining({
          success: true,
        })
      );
      expect(runCLI).toHaveBeenCalledWith(
        {
          _: [],
          testPathPattern: [],
          watch: false,
        },
        ['/root/jest.config.js']
      );
    });

    it('should send appropriate options to jestCLI when testFile is specified', async () => {
      const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
        testFile: 'lib.spec.ts',
        jestConfig: './jest.config.js',
        tsConfig: './tsconfig.test.json',
        codeCoverage: false,
        runInBand: true,
        testNamePattern: 'should load',
        testPathPattern: ['/test/path'],
        colors: false,
        reporters: ['/test/path'],
        verbose: false,
        coverageReporters: 'test',
        coverageDirectory: '/test/path',
        watch: false,
      });
      expect(await run.result).toEqual(
        jasmine.objectContaining({
          success: true,
        })
      );

      expect(runCLI).toHaveBeenCalledWith(
        {
          _: ['lib.spec.ts'],
          coverage: false,
          runInBand: true,
          testNamePattern: 'should load',
          testPathPattern: ['/test/path'],
          colors: false,
          reporters: ['/test/path'],
          verbose: false,
          coverageReporters: 'test',
          coverageDirectory: '/test/path',
          watch: false,
        },
        ['/root/jest.config.js']
      );
    });

    it('should send appropriate options to jestCLI when findRelatedTests is specified', async () => {
      const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
        findRelatedTests: 'file1.ts,file2.ts',
        jestConfig: './jest.config.js',
        tsConfig: './tsconfig.test.json',
        codeCoverage: false,
        runInBand: true,
        testNamePattern: 'should load',
        watch: false,
      });
      expect(await run.result).toEqual(
        jasmine.objectContaining({
          success: true,
        })
      );

      expect(runCLI).toHaveBeenCalledWith(
        {
          _: ['file1.ts', 'file2.ts'],
          coverage: false,
          findRelatedTests: true,
          runInBand: true,
          testNamePattern: 'should load',
          testPathPattern: [],
          watch: false,
        },
        ['/root/jest.config.js']
      );
    });

    it('should send other options to jestCLI', async () => {
      const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
        jestConfig: './jest.config.js',
        tsConfig: './tsconfig.test.json',
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
        coverageReporters: 'test',
        coverageDirectory: '/test/path',
        testResultsProcessor: 'results-processor',
        updateSnapshot: true,
        useStderr: true,
        watch: false,
        watchAll: false,
        testLocationInResults: true,
      });
      expect(await run.result).toEqual(
        jasmine.objectContaining({
          success: true,
        })
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
          coverageReporters: 'test',
          coverageDirectory: '/test/path',
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
      const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
        jestConfig: './jest.config.js',
        tsConfig: './tsconfig.test.json',
        maxWorkers: '50%',
      });
      expect(await run.result).toEqual(
        jasmine.objectContaining({
          success: true,
        })
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
      const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
        jestConfig: './jest.config.js',
        tsConfig: './tsconfig.test.json',
        setupFile: './test-setup.ts',
        watch: false,
      });
      expect(await run.result).toEqual(
        jasmine.objectContaining({
          success: true,
        })
      );
      expect(runCLI).toHaveBeenCalledWith(
        {
          _: [],
          setupFilesAfterEnv: ['/root/test-setup.ts'],
          testPathPattern: [],
          watch: false,
        },
        ['/root/jest.config.js']
      );
    });

    it('should return the proper result', async (done) => {
      const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
        jestConfig: './jest.config.js',
        tsConfig: './tsconfig.test.json',
        watch: false,
      });
      expect(await run.result).toEqual(
        jasmine.objectContaining({
          success: true,
        })
      );
      done();
    });
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
      await architect.scheduleBuilder('@nrwl/jest:jest', {
        jestConfig: './jest.config.js',
        tsConfig: './tsconfig.test.json',
        setupFile: './test-setup.ts',
        watch: false,
      });

      expect(runCLI).toHaveBeenCalledWith(
        {
          _: [],
          setupFilesAfterEnv: ['/root/test-setup.ts'],
          testPathPattern: [],
          watch: false,
        },
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
      const options: JestBuilderOptions = {
        jestConfig: './jest.config.js',
        tsConfig: './tsconfig.test.json',
        watch: false,
      };

      const run = await architect.scheduleBuilder('@nrwl/jest:jest', options);
      expect(await run.result).toEqual(
        jasmine.objectContaining({
          success: true,
        })
      );
      expect(runCLI).toHaveBeenCalledWith(
        {
          _: [],
          testPathPattern: [],
          watch: false,
        },
        ['/root/jest.config.js']
      );
    });
  });

  describe('when the user tries to use babel-jest AND ts-jest', () => {
    beforeEach(() => {
      jest.doMock(
        '/root/jest.config.js',
        () => ({
          transform: {
            '^.+\\.tsx?$': 'ts-jest',
            '^.+\\.jsx?$': 'babel-jest',
          },
        }),
        { virtual: true }
      );
    });

    it('should throw an appropriate error', async () => {
      const options: JestBuilderOptions = {
        jestConfig: './jest.config.js',
        tsConfig: './tsconfig.test.json',
        watch: false,
      };

      const run = await architect.scheduleBuilder('@nrwl/jest:jest', options);
      await expect(run.result).rejects.toThrow(
        /Using babel-jest and ts-jest together is not supported/
      );
    });
  });
});
