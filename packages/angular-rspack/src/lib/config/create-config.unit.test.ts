import {
  _createConfig,
  createConfig,
  handleConfigurations,
} from './create-config';
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
    skipTypeChecking: false,
  };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('NGRS_CONFIG', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create config for mode "production" if env variable NODE_ENV is "production"', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(_createConfig(configBase)).resolves.toStrictEqual([
      expect.objectContaining({ mode: 'production' }),
    ]);
  }, 10000);

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
              i18n: expect.objectContaining({}),
              isPlatformServer: false,
              pluginOptions: expect.objectContaining({
                ...rest,
                outputPath: {
                  base: join(process.cwd(), 'dist'),
                  browser: join(process.cwd(), 'dist', 'browser'),
                  server: join(process.cwd(), 'dist', 'server'),
                  media: join(process.cwd(), 'dist', 'browser', 'media'),
                },
                index: expect.objectContaining({
                  input: join(process.cwd(), 'src/index.html'),
                  output: 'index.html',
                }),
                tsConfig: join(process.cwd(), 'tsconfig.base.json'),
                sourceMap: {
                  scripts: false,
                  styles: false,
                  hidden: false,
                  vendor: false,
                },
                optimization: true,
                advancedOptimizations: true,
                useTsProjectReferences: false,
                polyfills: [],
                globalScripts: scripts,
                globalStyles: styles,
                devServer: expect.objectContaining({
                  host: 'localhost',
                  port: 4200,
                }),
              }),
            },
          ]),
        }),
      ]);
    });

    it('should create i18n options correctly', async () => {
      await expect(
        createConfig({
          options: {
            ...configBase,
            i18nMetadata: {
              locales: {
                fr: {
                  translation: 'src/locale/messages.fr.xlf',
                },
              },
              sourceLocale: 'en-GB',
            },
          },
        })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          mode: 'development',
          devServer: expect.objectContaining({
            port: 4200,
          }),
          plugins: expect.arrayContaining([
            expect.objectContaining({
              i18n: expect.objectContaining({
                hasDefinedSourceLocale: true,
                locales: {
                  'en-GB': expect.objectContaining({
                    subPath: 'en-GB',
                    dataPath: expect.stringContaining(
                      '@angular/common/locales/global/en-GB.js'
                    ),
                  }),
                  fr: expect.objectContaining({
                    subPath: 'fr',
                    files: [
                      expect.objectContaining({
                        path: 'src/locale/messages.fr.xlf',
                      }),
                    ],
                  }),
                },
              }),
              pluginOptions: expect.objectContaining({}),
            }),
          ]),
        }),
      ]);
    });

    it('should create config even when known unsupported options are provided and warn about them', async () => {
      const warnSpy = vi.spyOn(console, 'warn');

      await expect(
        createConfig({
          options: {
            ...configBase,
            clearScreen: true,
            devServer: { allowedHosts: ['localhost'] },
          },
        })
      ).resolves.not.toContain([
        expect.objectContaining({
          clearScreen: true,
          devServer: expect.objectContaining({
            allowedHosts: ['localhost'],
          }),
        }),
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        `The following options are not yet supported:
  "clearScreen"
`
      );
    });

    it('should create config from options with a custom root', async () => {
      const customRoot = join(process.cwd(), 'custom-root');

      await expect(
        createConfig({
          options: { ...configBase, root: customRoot },
        })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          mode: 'development',
          devServer: expect.objectContaining({
            port: 4200,
          }),
          plugins: expect.arrayContaining([
            {
              i18n: expect.objectContaining({}),
              isPlatformServer: false,
              pluginOptions: expect.objectContaining({
                outputPath: {
                  base: join(customRoot, 'dist'),
                  browser: join(customRoot, 'dist', 'browser'),
                  server: join(customRoot, 'dist', 'server'),
                  media: join(customRoot, 'dist', 'browser', 'media'),
                },
                index: expect.objectContaining({
                  input: join(customRoot, 'src/index.html'),
                  output: 'index.html',
                }),
                tsConfig: join(customRoot, 'tsconfig.base.json'),
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
              i18n: expect.objectContaining({}),
              isPlatformServer: false,
              pluginOptions: expect.objectContaining({
                ...rest,
                outputPath: {
                  base: join(process.cwd(), 'dist'),
                  browser: join(process.cwd(), 'dist', 'browser'),
                  server: join(process.cwd(), 'dist', 'server'),
                  media: join(process.cwd(), 'dist', 'browser', 'media'),
                },
                index: expect.objectContaining({
                  input: join(process.cwd(), 'src/index.html'),
                  output: 'index.html',
                }),
                tsConfig: join(process.cwd(), 'tsconfig.base.json'),
                sourceMap: {
                  scripts: false,
                  styles: false,
                  hidden: false,
                  vendor: false,
                },
                polyfills: [],
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
            devServer: { port: 8080 },
          },
        })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          devServer: expect.objectContaining({
            port: 8080,
            client: expect.objectContaining({
              webSocketURL: expect.objectContaining({
                port: 8080,
              }),
            }),
          }),
        }),
      ]);
    });

    it('should allow changing the devServer host', async () => {
      await expect(
        createConfig({
          options: {
            ...configBase,
            devServer: { host: '0.0.0.0' },
          },
        })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          devServer: expect.objectContaining({
            host: '0.0.0.0',
            client: expect.objectContaining({
              webSocketURL: expect.objectContaining({
                hostname: '0.0.0.0',
              }),
            }),
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

    it('should successfully merge multiple configurations', () => {
      const config = handleConfigurations(
        {
          options: {
            ...configBase,
            i18nMetadata: {
              locales: {
                fr: {
                  translation: 'src/locale/messages.fr.xlf',
                },
                de: {
                  translation: 'src/locale/messages.de.xlf',
                },
              },
              sourceLocale: 'en-GB',
            },
          },
        },
        {
          fr: {
            options: {
              localize: ['fr'],
            },
          },
          de: {
            options: {
              localize: ['de'],
            },
          },
        },
        ['fr', 'de']
      );
      expect(config).toStrictEqual(
        expect.objectContaining({
          mergedConfigurationBuildOptions: expect.objectContaining({
            localize: ['fr', 'de'],
          }),
        })
      );
    });
  });
});
