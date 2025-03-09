import { createConfig, withConfigurations } from './create-config';
import { beforeEach, expect } from 'vitest';
import { AngularRspackPluginOptions } from '../models';

describe('createConfig', () => {
  const configBase: AngularRspackPluginOptions = {
    root: '',
    browser: './src/main.ts',
    index: './src/index.html',
    tsconfigPath: './tsconfig.base.json',
    inlineStylesExtension: 'css',
    polyfills: [],
    styles: [],
    assets: [],
    fileReplacements: [],
    scripts: [],
    jit: false,
    hasServer: false,
    skipTypeChecking: false,
  };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('NGRS_CONFIG', '');
  });

  it('should create config for mode "production" if env variable NODE_ENV is "production"', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(createConfig(configBase)).toStrictEqual([
      expect.objectContaining({ mode: 'production' }),
    ]);
  });

  it.each(['development', 'not-production'])(
    'should create config for mode "development" if env variable NODE_ENV is "%s"',
    (nodeEnv) => {
      vi.stubEnv('NODE_ENV', nodeEnv);

      expect(createConfig(configBase)).toStrictEqual([
        expect.objectContaining({ mode: 'development' }),
      ]);
    }
  );

  describe('withConfigurations', () => {
    const runWithConfigurations = () => {
      return withConfigurations(
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
      expect(withConfigurations({ options: configBase })).toStrictEqual([
        expect.objectContaining({
          mode: 'development',
          plugins: [
            {
              pluginOptions: {
                ...configBase,
                useTsProjectReferences: false,
                polyfills: ['zone.js'],
              },
            },
          ],
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

        const config = runWithConfigurations();

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
