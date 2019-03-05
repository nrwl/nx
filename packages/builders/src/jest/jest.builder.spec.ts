import JestBuilder from './jest.builder';
import { normalize } from '@angular-devkit/core';
jest.mock('jest');
const { runCLI } = require('jest');
import * as path from 'path';

describe('Jest Builder', () => {
  let builder: JestBuilder;

  beforeEach(() => {
    builder = new JestBuilder();
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
            tsConfig: path.join(
              '<rootDir>',
              path.relative(root, './tsconfig.test.json')
            ),
            stringifyContentPathRegex: '\\.html$',
            astTransformers: [
              'jest-preset-angular/InlineHtmlStripStylesTransformer'
            ]
          }
        }),
        watch: false
      },
      ['./jest.config.js']
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
          watch: false,
          codeCoverage: true,
          ci: true,
          updateSnapshot: true,
          onlyChanged: true,
          passWithNoTests: true,
          bail: true,
          silent: true,
          runInBand: true,
          maxWorkers: 2,
          testNamePattern: 'test'
        }
      })
      .toPromise();
    expect(runCLI).toHaveBeenCalledWith(
      {
        globals: JSON.stringify({
          'ts-jest': {
            tsConfig: path.join(
              '<rootDir>',
              path.relative(root, './tsconfig.test.json')
            ),
            stringifyContentPathRegex: '\\.html$',
            astTransformers: [
              'jest-preset-angular/InlineHtmlStripStylesTransformer'
            ]
          }
        }),
        watch: false,
        coverage: true,
        ci: true,
        updateSnapshot: true,
        onlyChanged: true,
        passWithNoTests: true,
        bail: true,
        silent: true,
        runInBand: true,
        maxWorkers: 2,
        testNamePattern: 'test'
      },
      ['./jest.config.js']
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
            tsConfig: path.join(
              '<rootDir>',
              path.relative(root, './tsconfig.test.json')
            ),
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
      ['./jest.config.js']
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
