import { describe, expect, vi } from 'vitest';
import { styleTransform } from './setup-compilation.ts';
import { setupCompilation } from './setup-compilation.ts';
import path from 'node:path';
import rsBuildMockConfig from '../../mocks/fixtures/integration/minimal/rsbuild.mock.config.ts';
import { ComponentStylesheetBundler } from '@angular/build/src/tools/esbuild/angular/component-stylesheets';
import { workspaceRoot } from 'nx/src/utils/workspace-root';

vi.mock('../utils/load-compiler-cli', async (importOriginal) => {
  const original =
    (await importOriginal()) as typeof import('@angular/compiler-cli');
  return {
    ...original,
    loadCompilerCli: async () => {
      return import('@angular/compiler-cli');
    },
  };
});

describe('styleTransform', () => {
  it('should call component stylesheet bundler and return the css contents for modern browsers', async () => {
    const componentStylesheetBundler = new ComponentStylesheetBundler(
      {
        workspaceRoot,
        target: ['chrome133.0'],
        outputNames: {
          media: '[name]',
          bundles: '[name]',
        },
        inlineFonts: false,
        sourcemap: false,
        cacheOptions: {
          path: '',
          basePath: '',
          enabled: false,
        },
        optimization: false,
      },
      'css',
      false
    );
    const code = `
      h1 {
        font-size: 40px;
        code {
          font-face: Roboto Mono;
        }
      }
    `;

    const transformStyles = styleTransform(componentStylesheetBundler);
    const contents = await transformStyles(code, '');
    expect(contents).toMatchInlineSnapshot(`
      "/* angular:styles/component:css;592f34f9ac48ea19451aae3dd366efc0192c0cb126186ed755223c4c22e86e79; */
      h1 {
        font-size: 40px;
      }
      h1 code {
        font-face: Roboto Mono;
      }
      "
    `);
  });

  it('should call component stylesheet bundler and return the css contents for legacy browsers', async () => {
    const componentStylesheetBundler = new ComponentStylesheetBundler(
      {
        workspaceRoot,
        target: ['chrome111.0'],
        outputNames: {
          media: '[name]',
          bundles: '[name]',
        },
        inlineFonts: false,
        sourcemap: false,
        cacheOptions: {
          path: '',
          basePath: '',
          enabled: false,
        },
        optimization: false,
      },
      'css',
      false
    );
    const code = `
      h1 {
        font-size: 40px;
        code {
          font-face: Roboto Mono;
        }
      }
    `;

    const transformStyles = styleTransform(componentStylesheetBundler);
    const contents = await transformStyles(code, '');
    expect(contents).toMatchInlineSnapshot(`
      "/* angular:styles/component:css;592f34f9ac48ea19451aae3dd366efc0192c0cb126186ed755223c4c22e86e79; */
      h1 {
        font-size: 40px;
      }
      h1 code {
        font-face: Roboto Mono;
      }
      "
    `);
  });
});

describe('setupCompilation', () => {
  const fixturesDir = path.join(
    process.cwd(),
    'mocks',
    'fixtures',
    'integration',
    'minimal'
  );

  it('should create compiler options form rsBuildConfig tsconfigPath', async () => {
    await expect(
      setupCompilation(rsBuildMockConfig, {
        root: '',
        tsConfig: 'irrelevant-if-tsconfig-is-in-rsbuild-config',
        aot: true,
        inlineStyleLanguage: 'css',
        fileReplacements: [],
      })
    ).resolves.toStrictEqual(
      expect.objectContaining({
        compilerOptions: expect.objectContaining({
          configFilePath: expect.stringMatching(/tsconfig.mock.json$/),
        }),
        rootNames: [expect.stringMatching(/mock.main.ts$/)],
      })
    );
  });

  it('should create compiler options form ts compiler options if rsBuildConfig tsconfigPath is undefined', async () => {
    await expect(
      setupCompilation(
        {
          ...rsBuildMockConfig,
          source: {
            ...rsBuildMockConfig.source,
            tsconfigPath: undefined,
          },
        },
        {
          root: '',
          tsConfig: path.join(fixturesDir, 'tsconfig.other.mock.json'),
          aot: true,
          inlineStyleLanguage: 'css',
          fileReplacements: [],
        }
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        compilerOptions: expect.objectContaining({}),
        rootNames: [expect.stringMatching(/other\/mock.main.ts$/)],
      })
    );
  });
});
