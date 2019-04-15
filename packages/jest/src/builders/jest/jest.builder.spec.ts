import JestBuilder from './jest.builder';
import { normalize } from '@angular-devkit/core';
import { TestLogger } from '@angular-devkit/architect/testing';
jest.mock('jest');
const { runCLI } = require('jest');
import * as path from 'path';

describe('Jest Builder', () => {
  let builder: JestBuilder;

  beforeEach(() => {
    builder = new JestBuilder({
      host: <any>{},
      logger: new TestLogger('test'),
      workspace: <any>{
        root: '/root'
      },
      architect: <any>{}
    });
    runCLI.mockReturnValue(
      Promise.resolve({
        results: {
          success: true
        }
      })
    );
  });

  it('should send appropriate options to jestCLI', () => {
    const root = normalize('/root');
    builder
      .run({
        root,
        builder: '',
        projectType: 'application',
        options: {
          jestConfig: './jest.config.js',
          tsConfig: './tsconfig.test.json',
          watch: false
        }
      })
      .toPromise();
    expect(runCLI).toHaveBeenCalledWith(
      {
        globals: JSON.stringify({
          'ts-jest': {
            tsConfig: '/root/tsconfig.test.json',
            diagnostics: {
              warnOnly: true
            },
            stringifyContentPathRegex: '\\.html$',
            astTransformers: [
              'jest-preset-angular/InlineHtmlStripStylesTransformer'
            ]
          }
        }),
        watch: false
      },
      ['/root/jest.config.js']
    );
  });

  it('should send appropriate options to jestCLI when testFile is specified', () => {
    const root = normalize('/root');

    builder
      .run({
        root,
        builder: '',
        projectType: 'application',
        options: {
          testFile: 'lib.spec.ts',
          jestConfig: './jest.config.js',
          tsConfig: './tsconfig.test.json',
          codeCoverage: false,
          runInBand: true,
          testNamePattern: 'should load',
          watch: false
        }
      })
      .toPromise();
    expect(runCLI).toHaveBeenCalledWith(
      {
        _: ['lib.spec.ts'],
        globals: JSON.stringify({
          'ts-jest': {
            tsConfig: '/root/tsconfig.test.json',
            diagnostics: {
              warnOnly: true
            },
            stringifyContentPathRegex: '\\.html$',
            astTransformers: [
              'jest-preset-angular/InlineHtmlStripStylesTransformer'
            ]
          }
        }),
        coverage: false,
        runInBand: true,
        testNamePattern: 'should load',
        watch: false
      },
      ['/root/jest.config.js']
    );
  });

  it('should send other options to jestCLI', () => {
    const root = normalize('/root');
    builder
      .run({
        root,
        builder: '',
        projectType: 'application',
        options: {
          jestConfig: './jest.config.js',
          tsConfig: './tsconfig.test.json',
          codeCoverage: true,
          bail: true,
          color: false,
          ci: true,
          json: true,
          maxWorkers: 2,
          onlyChanged: true,
          outputFile: 'abc.txt',
          passWithNoTests: true,
          silent: true,
          testNamePattern: 'test',
          updateSnapshot: true,
          useStderr: true,
          watch: false,
          watchAll: false
        }
      })
      .toPromise();
    expect(runCLI).toHaveBeenCalledWith(
      {
        globals: JSON.stringify({
          'ts-jest': {
            tsConfig: '/root/tsconfig.test.json',
            diagnostics: {
              warnOnly: true
            },
            stringifyContentPathRegex: '\\.html$',
            astTransformers: [
              'jest-preset-angular/InlineHtmlStripStylesTransformer'
            ]
          }
        }),
        coverage: true,
        bail: true,
        color: false,
        ci: true,
        json: true,
        maxWorkers: 2,
        onlyChanged: true,
        outputFile: 'abc.txt',
        passWithNoTests: true,
        silent: true,
        testNamePattern: 'test',
        updateSnapshot: true,
        useStderr: true,
        watch: false,
        watchAll: false
      },
      ['/root/jest.config.js']
    );
  });

  it('should send the main to runCLI', () => {
    const root = normalize('/root');
    builder
      .run({
        root,
        builder: '@nrwl/builders:jest',
        projectType: 'application',
        options: {
          jestConfig: './jest.config.js',
          tsConfig: './tsconfig.test.json',
          setupFile: './test.ts',
          watch: false
        }
      })
      .toPromise();
    expect(runCLI).toHaveBeenCalledWith(
      {
        globals: JSON.stringify({
          'ts-jest': {
            tsConfig: '/root/tsconfig.test.json',
            diagnostics: {
              warnOnly: true
            },
            stringifyContentPathRegex: '\\.html$',
            astTransformers: [
              'jest-preset-angular/InlineHtmlStripStylesTransformer'
            ]
          }
        }),
        setupTestFrameworkScriptFile: path.join(
          '<rootDir>',
          path.relative(root, './test.ts')
        ),
        watch: false
      },
      ['/root/jest.config.js']
    );
  });

  it('should return the proper result', async done => {
    const root = normalize('/root');
    const result = await builder
      .run({
        root,
        builder: '',
        projectType: 'application',
        options: {
          jestConfig: './jest.config.js',
          tsConfig: './tsconfig.test.json',
          watch: false
        }
      })
      .toPromise();
    expect(result).toEqual({
      success: true
    });
    done();
  });
});
