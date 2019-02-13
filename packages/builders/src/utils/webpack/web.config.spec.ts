import { getSystemPath, normalize, Path } from '@angular-devkit/core';
import { getWebConfig as getWebPartial } from './web.config';
import { WebBuildBuilderOptions } from '../../web/build/web-build.builder';
import { createConsoleLogger } from '@angular-devkit/core/node';
import { Logger } from '@angular-devkit/core/src/logger';
import * as ts from 'typescript';
import { SourceMapDevToolPlugin } from 'webpack';

describe('getWebConfig', () => {
  let input: WebBuildBuilderOptions;
  let logger: Logger;
  let mockCompilerOptions: any;

  beforeEach(() => {
    input = {
      main: 'main.ts',
      index: 'index.html',
      budgets: [],
      baseHref: '/',
      deployUrl: '/',
      sourceMap: {
        scripts: true,
        styles: true,
        hidden: false,
        vendors: false
      },
      optimization: {
        scripts: false,
        styles: false
      },
      styles: [],
      scripts: [],
      outputPath: 'dist',
      tsConfig: 'tsconfig.json',
      fileReplacements: [],
      root: getSystemPath(normalize(__dirname)),
      sourceRoot: normalize('packages/builders')
    };
    logger = createConsoleLogger();

    mockCompilerOptions = {
      target: 'es2015',
      paths: { path: ['mapped/path'] }
    };

    spyOn(ts, 'readConfigFile').and.callFake(() => ({
      config: {
        compilerOptions: mockCompilerOptions
      }
    }));
  });

  it('should resolve the browser main field', () => {
    const result = getWebPartial(input, logger);
    expect(result.resolve.mainFields).toContain('browser');
  });

  it('should use the style-loader to load styles', () => {
    const result = getWebPartial(input, logger);
    expect(
      result.module.rules.find(rule => rule.test.test('styles.css')).use[0]
        .loader
    ).toEqual('style-loader');
    expect(
      result.module.rules.find(rule => rule.test.test('styles.scss')).use[0]
        .loader
    ).toEqual('style-loader');
  });

  describe('polyfills', () => {
    it('should set the polyfills entry', () => {
      const result = getWebPartial(
        {
          ...input,
          polyfills: 'polyfills.ts'
        },
        logger
      );
      expect(result.entry.polyfills).toEqual(['polyfills.ts']);
    });
  });

  describe('es2015 polyfills', () => {
    it('should set the es2015-polyfills entry', () => {
      const result = getWebPartial(
        {
          ...input,
          es2015Polyfills: 'polyfills.es2015.ts'
        },
        logger
      );
      expect(result.entry['es2015-polyfills']).toEqual(['polyfills.es2015.ts']);
    });
  });
});
