import { getWebConfig as getWebPartial } from './web.config';
jest.mock('tsconfig-paths-webpack-plugin');
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { createConsoleLogger } from '@angular-devkit/core/node';
import { Logger } from '@angular-devkit/core/src/logger';
import * as ts from 'typescript';
import { WebBuildBuilderOptions } from '../builders/build/build.impl';
import { join } from 'path';

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
    root = join(__dirname, '../../../..');
    sourceRoot = join(root, 'apps/app');
    logger = createConsoleLogger();

    mockCompilerOptions = {
      target: 'es2015',
      paths: { path: ['mapped/path'] }
    };
    (<any>TsConfigPathsPlugin).mockImplementation(
      function MockPathsPlugin() {}
    );

    spyOn(ts, 'readConfigFile').and.callFake(() => ({
      config: {
        compilerOptions: mockCompilerOptions
      }
    }));
  });

  it('should resolve the browser main field', () => {
    const result = getWebPartial(root, sourceRoot, input, logger, false, false);
    expect(result.resolve.mainFields).toContain('browser');
  });

  it('should use the style-loader to load styles', () => {
    const result = getWebPartial(root, sourceRoot, input, logger, false, false);
    expect(
      result.module.rules.find(rule => rule.test.test('styles.css')).use[0]
        .loader
    ).toEqual('style-loader');
    expect(
      result.module.rules.find(rule => rule.test.test('styles.scss')).use[0]
        .loader
    ).toEqual('style-loader');
  });

  describe('without differential loading', () => {
    describe('polyfills', () => {
      it('should set the polyfills entry', () => {
        const result = getWebPartial(
          root,
          sourceRoot,
          {
            ...input,
            polyfills: 'polyfills.ts'
          },
          logger,
          false,
          false
        );
        expect(result.entry.polyfills).toEqual(['polyfills.ts']);
      });
    });

    describe('es2015 polyfills', () => {
      it('should set the es2015-polyfills', () => {
        const result = getWebPartial(
          root,
          sourceRoot,
          {
            ...input,
            es2015Polyfills: 'polyfills.es2015.ts'
          },
          logger,
          false,
          false
        );
        expect(result.entry['polyfills-es5']).toEqual(['polyfills.es2015.ts']);
      });
    });
  });

  describe('with differential loading', () => {
    describe('polyfills', () => {
      it('should be in both polyfills', () => {
        const es2015Config = getWebPartial(
          root,
          sourceRoot,
          {
            ...input,
            polyfills: 'polyfills.ts'
          },
          logger,
          true,
          true
        );
        expect(es2015Config.entry.polyfills).toContain('polyfills.ts');
        const es5Config = getWebPartial(
          root,
          sourceRoot,
          {
            ...input,
            polyfills: 'polyfills.ts'
          },
          logger,
          false,
          true
        );
        expect(es5Config.entry.polyfills).toContain('polyfills.ts');
      });
    });

    describe('es2015Polyfills', () => {
      it('should be in es5 polyfills', () => {
        const es5Config = getWebPartial(
          root,
          sourceRoot,
          {
            ...input,
            polyfills: 'polyfills.ts',
            es2015Polyfills: 'polyfills.es2015.ts'
          },
          logger,
          false,
          true
        );
        expect(es5Config.entry.polyfills).toContain('polyfills.es2015.ts');
      });
    });

    describe('safari polyfills', () => {
      it('should be in es2015 polyfills', () => {
        const es2015Config = getWebPartial(
          root,
          sourceRoot,
          {
            ...input,
            polyfills: 'polyfills.ts'
          },
          logger,
          true,
          true
        );
        expect(es2015Config.entry.polyfills).toContain(
          require.resolve(
            '@nrwl/web/src/utils/build-angular/angular-cli-files/models/safari-nomodule.js'
          )
        );
      });
    });
  });
});
