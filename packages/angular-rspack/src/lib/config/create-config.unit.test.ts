import { _createConfig, createConfig } from './create-config';
import { beforeEach, expect } from 'vitest';
import { AngularRspackPluginOptions } from '../models';
import { join } from 'node:path';

describe('createConfig', () => {
  const configBase: AngularRspackPluginOptions = {
    browser: './src/main.ts',
    index: './src/index.html',
    tsConfig: './tsconfig.base.json',
    outputPath: './dist',
    inlineStyleLanguage: 'css',
    polyfills: [],
    styles: [],
    assets: [],
    fileReplacements: [],
    optimization: true,
    outputHashing: 'all',
    scripts: [],
    aot: true,
    hasServer: false,
    skipTypeChecking: false,
  };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('NGRS_CONFIG', '');
  });

  it('should create config for mode "production" if env variable NODE_ENV is "production"', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(_createConfig(configBase)).resolves.toStrictEqual([
      expect.objectContaining({ mode: 'production' }),
    ]);
  });

  it.each(['development', 'not-production'])(
    'should create config for mode "development" if env variable NODE_ENV is "%s"',
    async (nodeEnv) => {
      vi.stubEnv('NODE_ENV', nodeEnv);

      await expect(_createConfig(configBase)).resolves.toStrictEqual([
        expect.objectContaining({ mode: 'development' }),
      ]);
    }
  );

  describe('createConfig', () => {
    const runCreateConfig = () => {
      return createConfig(
        { options: configBase },
        {
          development: {
            options: {
              browser: './src/dev.main.ts',
              skipTypeChecking: true,
            },
          },
          production: {
            options: {
              browser: './src/prod.main.ts',
              skipTypeChecking: false,
            },
          },
        }
      );
    };

    it('should create config from options', async () => {
      const { scripts, styles, ...rest } = configBase;

      await expect(
        createConfig({ options: configBase })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          mode: 'development',
          devServer: expect.objectContaining({
            port: 4200,
          }),
          plugins: expect.arrayContaining([
            {
              pluginOptions: expect.objectContaining({
                ...rest,
                outputPath: {
                  base: join(process.cwd(), 'dist'),
                  browser: join(process.cwd(), 'dist', 'browser'),
                  server: join(process.cwd(), 'dist', 'server'),
                  media: join(process.cwd(), 'dist', 'browser', 'media'),
                },
                index: expect.objectContaining({
                  input: expect.stringMatching(/\/src\/index\.html$/),
                  insertionOrder: [
                    ['polyfills', true],
                    ['main', true],
                  ],
                  output: 'index.html',
                }),
                sourceMap: {
                  scripts: true,
                  styles: true,
                  hidden: false,
                  vendor: false,
                },
                optimization: true,
                advancedOptimizations: true,
                useTsProjectReferences: false,
                polyfills: ['zone.js'],
                globalScripts: scripts,
                globalStyles: styles,
                devServer: {
                  port: 4200,
                },
              }),
            },
          ]),
        }),
      ]);
    });

    it('should allow turning off optimizations', async () => {
      const { scripts, styles, ...rest } = configBase;
      await expect(
        createConfig({ options: { ...configBase, optimization: false } })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          mode: 'development',
          devServer: expect.objectContaining({
            port: 4200,
          }),
          plugins: expect.arrayContaining([
            {
              pluginOptions: expect.objectContaining({
                ...rest,
                outputPath: {
                  base: join(process.cwd(), 'dist'),
                  browser: join(process.cwd(), 'dist', 'browser'),
                  server: join(process.cwd(), 'dist', 'server'),
                  media: join(process.cwd(), 'dist', 'browser', 'media'),
                },
                index: expect.objectContaining({
                  input: expect.stringMatching(/\/src\/index\.html$/),
                  insertionOrder: [
                    ['polyfills', true],
                    ['main', true],
                  ],
                  output: 'index.html',
                }),
                sourceMap: {
                  scripts: true,
                  styles: true,
                  hidden: false,
                  vendor: false,
                },
                polyfills: ['zone.js'],
                optimization: false,
                advancedOptimizations: false,
              }),
            },
          ]),
        }),
      ]);
    });

    it('should allow changing the devServer port', async () => {
      await expect(
        createConfig({
          options: {
            ...configBase,
            devServer: {
              port: 8080,
            },
          },
        })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          devServer: expect.objectContaining({
            port: 8080,
          }),
        }),
      ]);
    });

    it.each([
      ['development', 'dev', true],
      ['production', 'prod', false],
    ])(
      'should create config for mode "development" if env variable NGRS_CONFIG is "%s"',
      async (configuration, fileNameSegment, skipTypeChecking) => {
        vi.stubEnv('NGRS_CONFIG', configuration);

        const config = await runCreateConfig();

        const plugins = config[0].plugins;
        const NgRspackPlugin = plugins?.find(
          (plugin) => plugin?.constructor.name === 'NgRspackPlugin'
        );
        expect(NgRspackPlugin).toBeDefined();
        expect(
          // @ts-expect-error - TS cannot index correctly because of multiple potential types
          NgRspackPlugin['pluginOptions'] as AngularRspackPluginOptions
        ).toEqual(
          expect.objectContaining({
            browser: `./src/${fileNameSegment}.main.ts`,
            skipTypeChecking,
          })
        );
      }
    );
  });
});
