jest.mock('./deduce-default-base', () => ({
  deduceDefaultBase: jest.fn(() => 'main'),
}));

import { NxJsonConfiguration } from '../../../config/nx-json';
import { createNxJsonFromTurboJson } from './utils';

describe('utils', () => {
  describe('createNxJsonFromTurboJson', () => {
    test.each<{
      description: string;
      turbo: Record<string, any>;
      nx: NxJsonConfiguration;
    }>([
      {
        description: 'empty turbo.json',
        turbo: {},
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
        },
      },
      {
        description: 'global dependencies',
        turbo: {
          globalDependencies: ['babel.config.json'],
        },
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          namedInputs: {
            sharedGlobals: ['{workspaceRoot}/babel.config.json'],
            default: ['{projectRoot}/**/*', 'sharedGlobals'],
          },
        },
      },
      {
        description: 'global env variables',
        turbo: {
          globalEnv: ['NEXT_PUBLIC_API', 'NODE_ENV'],
        },
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          namedInputs: {
            sharedGlobals: [{ env: 'NEXT_PUBLIC_API' }, { env: 'NODE_ENV' }],
            default: ['{projectRoot}/**/*', 'sharedGlobals'],
          },
        },
      },
      {
        description: 'basic task configuration with dependsOn',
        turbo: {
          tasks: {
            build: {
              dependsOn: ['^build'],
            },
          },
        },
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          targetDefaults: {
            build: {
              dependsOn: ['^build'],
              cache: true,
            },
          },
        },
      },
      {
        description: 'task configuration with outputs',
        turbo: {
          tasks: {
            build: {
              outputs: ['dist/**', '.next/**'],
            },
          },
        },
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          targetDefaults: {
            build: {
              outputs: ['{projectRoot}/dist/**', '{projectRoot}/.next/**'],
              cache: true,
            },
          },
        },
      },
      {
        description: 'task configuration with inputs',
        turbo: {
          tasks: {
            build: {
              inputs: ['src/**/*.tsx', 'test/**/*.tsx'],
            },
          },
        },
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          targetDefaults: {
            build: {
              inputs: [
                '{projectRoot}/src/**/*.tsx',
                '{projectRoot}/test/**/*.tsx',
              ],
              cache: true,
            },
          },
        },
      },
      {
        description: 'cache configuration',
        turbo: {
          tasks: {
            build: {
              cache: true,
            },
            dev: {
              cache: false,
            },
          },
        },
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          targetDefaults: {
            build: {
              cache: true,
            },
            dev: {
              cache: false,
            },
          },
        },
      },
      {
        description: 'cache directory configuration',
        turbo: {
          cacheDir: './node_modules/.cache/turbo',
        },
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          cacheDirectory: '.nx/cache',
        },
      },
      {
        description: 'skip project-specific task configurations',
        turbo: {
          tasks: {
            build: {
              dependsOn: ['^build'],
            },
            'docs#build': {
              dependsOn: ['^build'],
              outputs: ['www/**'],
            },
          },
        },
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          targetDefaults: {
            build: {
              dependsOn: ['^build'],
              cache: true,
            },
          },
        },
      },
      {
        description: 'complex configuration combining multiple features',
        turbo: {
          globalDependencies: ['babel.config.json'],
          globalEnv: ['NODE_ENV'],
          cacheDir: './node_modules/.cache/turbo',
          tasks: {
            build: {
              dependsOn: ['^build'],
              outputs: ['dist/**'],
              inputs: ['src/**/*'],
              cache: true,
            },
            test: {
              dependsOn: ['build'],
              outputs: ['coverage/**'],
              cache: true,
            },
            dev: {
              cache: false,
            },
          },
        },
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          namedInputs: {
            sharedGlobals: [
              '{workspaceRoot}/babel.config.json',
              { env: 'NODE_ENV' },
            ],
            default: ['{projectRoot}/**/*', 'sharedGlobals'],
          },
          cacheDirectory: '.nx/cache',
          targetDefaults: {
            build: {
              dependsOn: ['^build'],
              outputs: ['{projectRoot}/dist/**'],
              inputs: ['{projectRoot}/src/**/*'],
              cache: true,
            },
            test: {
              dependsOn: ['build'],
              outputs: ['{projectRoot}/coverage/**'],
              cache: true,
            },
            dev: {
              cache: false,
            },
          },
        },
      },
      {
        description: 'turbo starter with $TURBO_DEFAULT$',
        turbo: {
          $schema: 'https://turbo.build/schema.json',
          ui: 'tui',
          tasks: {
            build: {
              dependsOn: ['^build'],
              inputs: ['$TURBO_DEFAULT$', '.env*'],
              outputs: ['.next/**', '!.next/cache/**'],
            },
            lint: {
              dependsOn: ['^lint'],
            },
            'check-types': {
              dependsOn: ['^check-types'],
            },
            dev: {
              cache: false,
              persistent: true,
            },
          },
        },
        nx: {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          targetDefaults: {
            build: {
              dependsOn: ['^build'],
              inputs: ['{projectRoot}/**/*', '{projectRoot}/.env*'],
              outputs: [
                '{projectRoot}/.next/**',
                '!{projectRoot}/.next/cache/**',
              ],
              cache: true,
            },
            lint: {
              dependsOn: ['^lint'],
              cache: true,
            },
            'check-types': {
              dependsOn: ['^check-types'],
              cache: true,
            },
            dev: {
              cache: false,
            },
          },
        },
      },
    ])('$description', ({ turbo, nx }) => {
      expect(createNxJsonFromTurboJson(turbo)).toEqual(nx);
    });
  });
});
