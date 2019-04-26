// import JestBuilder from './jest.impl';
import { normalize, schema } from '@angular-devkit/core';
import {
  TestLogger,
  TestingArchitectHost
} from '@angular-devkit/architect/testing';
jest.mock('jest');
const { runCLI } = require('jest');
import * as path from 'path';
import { Architect } from '@angular-devkit/architect';

describe('Jest Builder', () => {
  let architect: Architect;

  beforeEach(async () => {
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
          success: true
        }
      })
    );
  });

  it('should send appropriate options to jestCLI', async () => {
    const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
      jestConfig: './jest.config.js',
      tsConfig: './tsconfig.test.json',
      watch: false
    });
    expect(await run.result).toEqual(
      jasmine.objectContaining({
        success: true
      })
    );
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

  it('should send appropriate options to jestCLI when testFile is specified', async () => {
    const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
      testFile: 'lib.spec.ts',
      jestConfig: './jest.config.js',
      tsConfig: './tsconfig.test.json',
      codeCoverage: false,
      runInBand: true,
      testNamePattern: 'should load',
      watch: false
    });
    expect(await run.result).toEqual(
      jasmine.objectContaining({
        success: true
      })
    );

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

  it('should send other options to jestCLI', async () => {
    const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
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
    });
    expect(await run.result).toEqual(
      jasmine.objectContaining({
        success: true
      })
    );
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

  it('should send the main to runCLI', async () => {
    const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
      jestConfig: './jest.config.js',
      tsConfig: './tsconfig.test.json',
      setupFile: './test.ts',
      watch: false
    });
    expect(await run.result).toEqual(
      jasmine.objectContaining({
        success: true
      })
    );
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
        setupTestFrameworkScriptFile: '/root/test.ts',
        watch: false
      },
      ['/root/jest.config.js']
    );
  });

  it('should return the proper result', async done => {
    const run = await architect.scheduleBuilder('@nrwl/jest:jest', {
      jestConfig: './jest.config.js',
      tsConfig: './tsconfig.test.json',
      watch: false
    });
    expect(await run.result).toEqual(
      jasmine.objectContaining({
        success: true
      })
    );
    done();
  });
});
