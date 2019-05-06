import { getWebConfig as getWebPartial } from './web.config';
import { createConsoleLogger } from '@angular-devkit/core/node';
import { Logger } from '@angular-devkit/core/src/logger';
import * as ts from 'typescript';
import { WebBuildBuilderOptions } from '../builders/build/build.impl';

describe('getWebConfig', () => {
  let input: WebBuildBuilderOptions;
  let logger: Logger;
  let root: string;
  let sourceRoot: string;
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
      fileReplacements: []
    };
    root = '/root';
    sourceRoot = '/root/apps/app';
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
    const result = getWebPartial(root, sourceRoot, input, logger);
    expect(result.resolve.mainFields).toContain('browser');
  });

  it('should use the style-loader to load styles', () => {
    const result = getWebPartial(root, sourceRoot, input, logger);
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
        root,
        sourceRoot,
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
        root,
        sourceRoot,
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
