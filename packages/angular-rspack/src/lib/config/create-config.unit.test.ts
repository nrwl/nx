import { _createConfig, createConfig } from './create-config';
import { beforeEach, expect } from 'vitest';
import { AngularRspackPluginOptions } from '../models';

describe('createConfig', () => {
  const configBase: AngularRspackPluginOptions = {
    root: '',
    browser: './src/main.ts',
    index: './src/index.html',
    tsConfig: './tsconfig.base.json',
    inlineStyleLanguage: 'css',
    polyfills: [],
    styles: [],
    assets: [],
    fileReplacements: [],
    scripts: [],
    aot: true,
    hasServer: false,
    skipTypeChecking: false,
  };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('NGRS_CONFIG', '');
  });

  it('should create config for mode "production" if env variable NODE_ENV is "production"', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(_createConfig(configBase)).toStrictEqual([
      expect.objectContaining({ mode: 'production' }),
    ]);
  });

  it.each(['development', 'not-production'])(
    'should create config for mode "development" if env variable NODE_ENV is "%s"',
    (nodeEnv) => {
      vi.stubEnv('NODE_ENV', nodeEnv);

      expect(_createConfig(configBase)).toStrictEqual([
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

    it('should create config from options', () => {
      expect(createConfig({ options: configBase })).toStrictEqual([
        expect.objectContaining({
          mode: 'development',
          devServer: expect.objectContaining({
            port: 4200,
          }),
          plugins: [
            {
              pluginOptions: {
                ...configBase,
                optimization: true,
                useTsProjectReferences: false,
                polyfills: ['zone.js'],
                devServer: {
                  port: 4200,
                },
              },
            },
          ],
        }),
      ]);
    });

    it('should allow turning off optimizations', () => {
      expect(
        createConfig({ options: { ...configBase, optimization: false } })
      ).toStrictEqual([
        expect.objectContaining({
          mode: 'development',
          devServer: expect.objectContaining({
            port: 4200,
          }),
          plugins: [
            {
              pluginOptions: {
                ...configBase,
                optimization: false,
                useTsProjectReferences: false,
                polyfills: ['zone.js'],
                devServer: {
                  port: 4200,
                },
              },
            },
          ],
        }),
      ]);
    });

    it('should allow changing the devServer port', () => {
      expect(
        createConfig({
          options: {
            ...configBase,
            devServer: {
              port: 8080,
            },
          },
        })
      ).toStrictEqual([
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
      (configuration, fileNameSegment, skipTypeChecking) => {
        vi.stubEnv('NGRS_CONFIG', configuration);

        const config = runCreateConfig();

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
