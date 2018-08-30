import JestBuilder from './jest.builder';
import { normalize } from '@angular-devkit/core';
import * as jestCLI from 'jest';
import * as path from 'path';

describe('Jest Builder', () => {
  let builder: JestBuilder;

  beforeEach(() => {
    builder = new JestBuilder();
  });

  it('should send appropriate options to jestCLI', () => {
    const runCLI = spyOn(jestCLI, 'runCLI').and.returnValue(
      Promise.resolve({
        results: {
          success: true
        }
      })
    );
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
            tsConfigFile: path.relative(root, './tsconfig.test.json')
          },
          __TRANSFORM_HTML__: true
        }),
        watch: false
      },
      ['./jest.config.js']
    );
  });

  it('should send other options to jestCLI', () => {
    const runCLI = spyOn(jestCLI, 'runCLI').and.returnValue(
      Promise.resolve({
        results: {
          success: true
        }
      })
    );
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
          updateSnapshot: true
        }
      })
      .toPromise();
    expect(runCLI).toHaveBeenCalledWith(
      {
        globals: JSON.stringify({
          'ts-jest': {
            tsConfigFile: path.relative(root, './tsconfig.test.json')
          },
          __TRANSFORM_HTML__: true
        }),
        watch: false,
        coverage: true,
        ci: true,
        updateSnapshot: true
      },
      ['./jest.config.js']
    );
  });

  it('should send the main to jestCLI', () => {
    const runCLI = spyOn(jestCLI, 'runCLI').and.returnValue(
      Promise.resolve({
        results: {
          success: true
        }
      })
    );
    const root = normalize('/root');
    builder
      .run({
        root,
        builder: '',
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
            tsConfigFile: path.relative(root, './tsconfig.test.json')
          },
          __TRANSFORM_HTML__: true
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
    spyOn(jestCLI, 'runCLI').and.returnValue(
      Promise.resolve({
        results: {
          success: true
        }
      })
    );
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
