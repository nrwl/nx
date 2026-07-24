import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AngularRspackPluginOptions } from '../models';
import * as postcssConfiguration from '../utils/postcss-configuration';
import { handleConfigurations } from './config-utils/user-defined-config-helpers';
import { _createConfig, createConfig } from './create-config';

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
    deleteOutputPath: false,
  };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('NGRS_CONFIG', '');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create config for mode "production" when optimization=true', async () => {
    await expect(_createConfig(configBase)).resolves.toStrictEqual([
      expect.objectContaining({ mode: 'production' }),
    ]);
  }, 10000);

  it('should create config for mode "development" when optimization=false', async () => {
    await expect(
      _createConfig({ ...configBase, optimization: false })
    ).resolves.toStrictEqual([
      expect.objectContaining({ mode: 'development' }),
    ]);
  });

  it('should derive the TS transpilation rule semantics from the tsconfig', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-config-swc-'));
    try {
      await writeFile(
        join(root, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            target: 'ES2022',
          },
          files: [],
        })
      );
      const configs = await _createConfig({
        ...configBase,
        root,
        tsConfig: join(root, 'tsconfig.json'),
      });

      const tsRule = configs[0].module?.rules?.find(
        (rule) =>
          typeof rule === 'object' &&
          rule !== null &&
          (
            rule as { use?: Array<{ loader?: string }> }
          ).use?.[0]?.loader?.includes('swc-loader')
      ) as unknown as {
        use: Array<{
          options: {
            jsc: {
              parser: { decorators?: boolean };
              transform?: {
                legacyDecorator?: boolean;
                decoratorMetadata?: boolean;
                useDefineForClassFields?: boolean;
              };
            };
          };
        }>;
      };

      expect(tsRule).toBeDefined();
      expect(tsRule.use[0].options.jsc.parser.decorators).toBe(true);
      expect(tsRule.use[0].options.jsc.transform).toMatchObject({
        legacyDecorator: true,
        decoratorMetadata: true,
        useDefineForClassFields: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('should derive the TS transpilation rule semantics from an overridden tsconfig', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-config-swc-override-'));
    try {
      await writeFile(
        join(root, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            experimentalDecorators: true,
            target: 'ES2022',
          },
          files: [],
        })
      );
      await writeFile(
        join(root, 'tsconfig.custom.json'),
        JSON.stringify({
          compilerOptions: { target: 'ES2022' },
          files: [],
        })
      );
      const configs = await _createConfig(
        { ...configBase, root, tsConfig: join(root, 'tsconfig.json') },
        { resolve: { tsConfig: join(root, 'tsconfig.custom.json') } }
      );

      const tsRule = configs[0].module?.rules?.find(
        (rule) =>
          typeof rule === 'object' &&
          rule !== null &&
          (
            rule as { use?: Array<{ loader?: string }> }
          ).use?.[0]?.loader?.includes('swc-loader')
      ) as unknown as {
        use: Array<{
          options: { jsc: { transform?: { legacyDecorator?: boolean } } };
        }>;
      };

      expect(tsRule).toBeDefined();
      // The override tsconfig omits experimentalDecorators, so the rule uses
      // standard decorator semantics even though options.tsConfig enables the
      // legacy ones.
      expect(tsRule.use[0].options.jsc.transform).toMatchObject({
        legacyDecorator: false,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('should split the TS transpilation rules by extension for JSX support', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-config-swc-jsx-'));
    try {
      await writeFile(
        join(root, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: { target: 'ES2022', jsx: 'react-jsx' },
          files: [],
        })
      );
      const configs = await _createConfig({
        ...configBase,
        root,
        tsConfig: join(root, 'tsconfig.json'),
      });

      const swcRules = (configs[0].module?.rules ?? []).filter(
        (rule) =>
          typeof rule === 'object' &&
          rule !== null &&
          (
            rule as { use?: Array<{ loader?: string }> }
          ).use?.[0]?.loader?.includes('swc-loader')
      ) as unknown as Array<{
        use: Array<{
          options: {
            jsc: {
              parser: { tsx?: boolean };
              transform?: { react?: { runtime?: string } };
            };
          };
        }>;
      }>;

      expect(swcRules).toHaveLength(2);
      expect(swcRules[0].use[0].options.jsc.parser.tsx).toBe(false);
      expect(swcRules[1].use[0].options.jsc.parser.tsx).toBe(true);
      expect(swcRules[1].use[0].options.jsc.transform?.react).toMatchObject({
        runtime: 'automatic',
      });
      // The tsconfig is parsed once; both rules share the same transform.
      expect(swcRules[0].use[0].options.jsc.transform).toBe(
        swcRules[1].use[0].options.jsc.transform
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('should share the license inputs between the browser and server configs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-config-ssr-'));
    try {
      await mkdir(join(root, 'src'), { recursive: true });
      await writeFile(join(root, 'src', 'main.server.ts'), '');
      await writeFile(join(root, 'src', 'server.ts'), '');

      const configs = await _createConfig({
        ...configBase,
        root,
        server: './src/main.server.ts',
        ssr: { entry: './src/server.ts' },
      });

      expect(configs).toHaveLength(2);
      const [browserPlugin, serverPlugin] = configs.map((config) =>
        config.plugins?.find(
          (plugin) => plugin?.constructor.name === 'NgRspackPlugin'
        )
      );
      expect(browserPlugin['sharedLicenseInputs']).toBeInstanceOf(Map);
      expect(browserPlugin['sharedLicenseInputs']).toBe(
        serverPlugin['sharedLicenseInputs']
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 10000);

  it('should share one Angular compilation between the browser and server configs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-config-ssr-'));
    try {
      await mkdir(join(root, 'src'), { recursive: true });
      await writeFile(join(root, 'src', 'main.server.ts'), '');
      await writeFile(join(root, 'src', 'server.ts'), '');

      const configs = await _createConfig({
        ...configBase,
        root,
        server: './src/main.server.ts',
        ssr: { entry: './src/server.ts' },
      });

      expect(configs).toHaveLength(2);
      const [browserPlugin, serverPlugin] = configs.map((config) =>
        config.plugins?.find(
          (plugin) => plugin?.constructor.name === 'NgRspackPlugin'
        )
      );
      expect(browserPlugin['sharedAngularPlugin']).toBeDefined();
      expect(browserPlugin['sharedAngularPlugin']).toBe(
        serverPlugin['sharedAngularPlugin']
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 10000);

  it('should wire the server entry loader with the engine manifest inputs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-config-ssr-'));
    try {
      await mkdir(join(root, 'src'), { recursive: true });
      await writeFile(join(root, 'src', 'main.server.ts'), '');
      await writeFile(join(root, 'src', 'server.ts'), '');
      // The engine wiring is only set up when @angular/ssr is installed.
      const ssrPackageDir = join(root, 'node_modules', '@angular', 'ssr');
      await mkdir(ssrPackageDir, { recursive: true });
      await writeFile(
        join(ssrPackageDir, 'package.json'),
        JSON.stringify({
          name: '@angular/ssr',
          version: '0.0.0',
          main: 'index.js',
        })
      );
      await writeFile(join(ssrPackageDir, 'index.js'), '');

      const configs = await _createConfig({
        ...configBase,
        root,
        server: './src/main.server.ts',
        ssr: { entry: './src/server.ts' },
        baseHref: '/app/',
        security: { allowedHosts: ['example.com'] },
      });

      expect(configs).toHaveLength(2);
      const serverExportsRule = configs[1].module?.rules?.find(
        (rule) =>
          typeof rule === 'object' &&
          rule !== null &&
          'loader' in rule &&
          typeof rule.loader === 'string' &&
          rule.loader.includes('platform-server-exports')
      ) as { options: Record<string, unknown> } | undefined;

      expect(serverExportsRule).toBeDefined();
      expect(serverExportsRule.options.engineWiring).toMatchObject({
        mainServerEntry: join(root, 'src', 'main.server.ts'),
        baseHref: '/app/',
        browserOutputRelativePath: join('..', 'browser'),
        indexOutputName: 'index.html',
        allowedHosts: ['example.com'],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 10000);

  it('should reject an output mode when @angular/ssr is not installed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-config-ssr-'));
    try {
      await mkdir(join(root, 'src'), { recursive: true });
      await writeFile(join(root, 'src', 'main.server.ts'), '');
      await writeFile(join(root, 'src', 'server.ts'), '');

      await expect(
        _createConfig({
          ...configBase,
          root,
          server: './src/main.server.ts',
          ssr: { entry: './src/server.ts' },
          outputMode: 'server',
        })
      ).rejects.toThrow(
        'The "outputMode" option requires the "@angular/ssr" package to be installed.'
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 10000);

  it('should reject locale inlining when an output mode is set', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-config-ssr-'));
    try {
      await mkdir(join(root, 'src'), { recursive: true });
      await writeFile(join(root, 'src', 'main.server.ts'), '');
      await writeFile(join(root, 'src', 'server.ts'), '');

      await expect(
        _createConfig({
          ...configBase,
          root,
          server: './src/main.server.ts',
          ssr: { entry: './src/server.ts' },
          outputMode: 'server',
          localize: ['fr'],
          i18nMetadata: {
            sourceLocale: 'en-US',
            locales: { fr: { translation: [] } },
          },
        })
      ).rejects.toThrow(
        'Locale inlining ("localize") is not supported when "outputMode" is set. Please build each locale separately.'
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 10000);

  it('should define a runtime import.meta.url for the server bundle', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-config-ssr-'));
    try {
      await mkdir(join(root, 'src'), { recursive: true });
      await writeFile(join(root, 'src', 'main.server.ts'), '');
      await writeFile(join(root, 'src', 'server.ts'), '');

      const configs = await _createConfig({
        ...configBase,
        root,
        server: './src/main.server.ts',
        ssr: { entry: './src/server.ts' },
      });

      const findImportMetaUrlDefine = (config: (typeof configs)[0]) =>
        config.plugins?.find(
          (plugin) =>
            plugin?.constructor.name === 'DefinePlugin' &&
            'import.meta.url' in
              ((plugin as unknown as { _args: Record<string, string>[] })
                ._args[0] ?? {})
        );
      expect(findImportMetaUrlDefine(configs[1])).toBeDefined();
      expect(findImportMetaUrlDefine(configs[0])).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 10000);

  it('should not create a shared Angular compilation for a browser-only build', async () => {
    const configs = await _createConfig(configBase);

    expect(configs).toHaveLength(1);
    const browserPlugin = configs[0].plugins?.find(
      (plugin) => plugin?.constructor.name === 'NgRspackPlugin'
    );
    expect(browserPlugin['sharedAngularPlugin']).toBeUndefined();
  }, 10000);

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
      ).resolves.toMatchObject([
        expect.objectContaining({
          mode: 'production',
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
                optimization: {
                  fonts: {
                    inline: true,
                  },
                  styles: {
                    minify: true,
                    inlineCritical: true,
                  },
                  scripts: true,
                },
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
          mode: 'production',
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

    it('should create config from options with a custom root', async () => {
      const customRoot = join(process.cwd(), 'custom-root');
      vi.spyOn(
        postcssConfiguration,
        'generateSearchDirectories'
      ).mockResolvedValue([]);

      await expect(
        createConfig({
          options: { ...configBase, root: customRoot },
        })
      ).resolves.toMatchObject([
        expect.objectContaining({
          mode: 'production',
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
      ).resolves.toMatchObject([
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
                optimization: {
                  fonts: {
                    inline: false,
                  },
                  styles: {
                    minify: false,
                    inlineCritical: false,
                  },
                  scripts: false,
                },
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
              webSocketURL: 'auto://0.0.0.0:0/ng-cli-ws',
            }),
          }),
        }),
      ]);
    });

    it('should set default watchOptions with aggregateTimeout of 50ms', async () => {
      await expect(
        createConfig({ options: configBase })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          watchOptions: expect.objectContaining({
            aggregateTimeout: 50,
          }),
        }),
      ]);
    });

    it('should allow overriding watchOptions.aggregateTimeout', async () => {
      await expect(
        createConfig({
          options: {
            ...configBase,
            watchOptions: { aggregateTimeout: 200 },
          },
        })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          watchOptions: expect.objectContaining({
            aggregateTimeout: 200,
          }),
        }),
      ]);
    });

    it('should merge watchOptions with poll option', async () => {
      await expect(
        createConfig({
          options: {
            ...configBase,
            poll: 1000,
            watchOptions: { aggregateTimeout: 100 },
          },
        })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          watchOptions: expect.objectContaining({
            aggregateTimeout: 100,
            poll: 1000,
            ignored: '**/node_modules/**',
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
          NgRspackPlugin['pluginOptions'] as AngularRspackPluginOptions
        ).toEqual(
          expect.objectContaining({
            browser: `./src/${fileNameSegment}.main.ts`,
            skipTypeChecking,
          })
        );
      }
    );

    it('should merge user stats options via rspackConfigOverrides', async () => {
      const config = await createConfig({
        options: configBase,
        rspackConfigOverrides: {
          stats: { all: false, chunks: false },
        },
      });

      expect(config[0].stats).toEqual(
        expect.objectContaining({ all: false, chunks: false })
      );
    });

    it('should allow user to fully override stats options', async () => {
      const customStats = {
        all: false,
        assets: true,
        errors: true,
        warnings: true,
      };

      const config = await createConfig({
        options: configBase,
        rspackConfigOverrides: {
          stats: customStats,
        },
      });

      expect(config[0].stats).toEqual(expect.objectContaining(customStats));
    });

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
