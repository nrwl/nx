jest.mock('./deduce-default-base', () => ({
  deduceDefaultBase: jest.fn(() => 'main'),
}));

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  NxJsonConfiguration,
  TargetDefaultEntry,
} from '../../../config/nx-json';
import { readJsonFile, writeJsonFile } from '../../../utils/fileutils';
import {
  createNxJsonFile,
  createNxJsonFromTurboJson,
  extractErrorName,
  readErrorStderr,
  toErrorString,
  upsertTargetDefaultEntry,
} from './utils';

describe('utils', () => {
  describe('createNxJsonFile', () => {
    it('reuses the same unfiltered target entry across topological and cacheable passes', () => {
      const repoRoot = mkdtempSync(join(tmpdir(), 'nx-init-utils-'));
      try {
        writeJsonFile(join(repoRoot, 'nx.json'), {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          targetDefaults: [
            { target: 'build', projects: 'tag:web', dependsOn: ['^filtered'] },
          ],
        });

        createNxJsonFile(repoRoot, ['build'], ['build'], {});

        expect(
          readJsonFile<NxJsonConfiguration>(join(repoRoot, 'nx.json'))
        ).toMatchObject({
          targetDefaults: [
            { target: 'build', projects: 'tag:web', dependsOn: ['^filtered'] },
            { target: 'build', dependsOn: ['^build'], cache: true },
          ],
        });
      } finally {
        rmSync(repoRoot, { recursive: true, force: true });
      }
    });

    it('preserves an explicit cache setting on an existing unfiltered target entry', () => {
      const repoRoot = mkdtempSync(join(tmpdir(), 'nx-init-utils-'));
      try {
        writeJsonFile(join(repoRoot, 'nx.json'), {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          targetDefaults: [{ target: 'build', cache: false }],
        });

        createNxJsonFile(repoRoot, [], ['build'], {});

        expect(
          readJsonFile<NxJsonConfiguration>(join(repoRoot, 'nx.json'))
        ).toMatchObject({
          targetDefaults: [{ target: 'build', cache: false }],
        });
      } finally {
        rmSync(repoRoot, { recursive: true, force: true });
      }
    });
  });

  describe('upsertTargetDefaultEntry', () => {
    it('merges into an existing unfiltered target entry', () => {
      const entries: TargetDefaultEntry[] = [{ target: 'build', cache: true }];

      upsertTargetDefaultEntry(entries, 'build', { dependsOn: ['^build'] });

      expect(entries).toEqual([
        { target: 'build', cache: true, dependsOn: ['^build'] },
      ]);
    });

    it('appends a new unfiltered entry instead of merging into a filtered one', () => {
      const entries: TargetDefaultEntry[] = [
        { target: 'build', projects: 'tag:web', cache: true },
      ];

      upsertTargetDefaultEntry(entries, 'build', { dependsOn: ['^build'] });

      expect(entries).toEqual([
        { target: 'build', projects: 'tag:web', cache: true },
        { target: 'build', dependsOn: ['^build'] },
      ]);
    });
  });

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
          targetDefaults: [
            {
              target: 'build',
              dependsOn: ['^build'],
              cache: true,
            },
          ],
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
          targetDefaults: [
            {
              target: 'build',
              outputs: ['{projectRoot}/dist/**', '{projectRoot}/.next/**'],
              cache: true,
            },
          ],
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
          targetDefaults: [
            {
              target: 'build',
              inputs: [
                '{projectRoot}/src/**/*.tsx',
                '{projectRoot}/test/**/*.tsx',
              ],
              cache: true,
            },
          ],
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
          targetDefaults: [
            { target: 'build', cache: true },
            { target: 'dev', cache: false },
          ],
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
          targetDefaults: [
            {
              target: 'build',
              dependsOn: ['^build'],
              cache: true,
            },
          ],
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
          targetDefaults: [
            {
              target: 'build',
              dependsOn: ['^build'],
              outputs: ['{projectRoot}/dist/**'],
              inputs: ['{projectRoot}/src/**/*'],
              cache: true,
            },
            {
              target: 'test',
              dependsOn: ['build'],
              outputs: ['{projectRoot}/coverage/**'],
              cache: true,
            },
            { target: 'dev', cache: false },
          ],
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
          targetDefaults: [
            {
              target: 'build',
              dependsOn: ['^build'],
              inputs: ['{projectRoot}/**/*', '{projectRoot}/.env*'],
              outputs: [
                '{projectRoot}/.next/**',
                '!{projectRoot}/.next/cache/**',
              ],
              cache: true,
            },
            {
              target: 'lint',
              dependsOn: ['^lint'],
              cache: true,
            },
            {
              target: 'check-types',
              dependsOn: ['^check-types'],
              cache: true,
            },
            { target: 'dev', cache: false },
          ],
        },
      },
    ])('$description', ({ turbo, nx }) => {
      expect(createNxJsonFromTurboJson(turbo)).toEqual(nx);
    });
  });

  describe('toErrorString', () => {
    it('returns error.message when present', () => {
      expect(toErrorString(new Error('boom'))).toBe('boom');
    });

    it('returns "Error" for bare new Error() instead of empty string', () => {
      expect(toErrorString(new Error())).toBe('Error');
    });

    it('returns "Unknown error" for null/undefined', () => {
      expect(toErrorString(null)).toBe('Unknown error');
      expect(toErrorString(undefined)).toBe('Unknown error');
    });

    it('coerces primitive throws', () => {
      expect(toErrorString('str')).toBe('str');
      expect(toErrorString(42)).toBe('42');
    });

    it('includes own-property code when message is empty', () => {
      const e = new Error('') as Error & { code?: string };
      e.code = 'E404';
      expect(toErrorString(e)).toContain('E404');
    });

    it('serializes plain objects', () => {
      expect(toErrorString({ foo: 'bar' })).toBe('{"foo":"bar"}');
    });

    it('falls through to toString() for unserializable objects', () => {
      const circular: any = {};
      circular.self = circular;
      expect(toErrorString(circular)).toBe('[object Object]');
    });
  });

  describe('readErrorStderr', () => {
    it('returns string stderr as-is', () => {
      expect(readErrorStderr({ stderr: 'hello' })).toBe('hello');
    });

    it('decodes Buffer stderr to utf8', () => {
      expect(readErrorStderr({ stderr: Buffer.from('boom', 'utf8') })).toBe(
        'boom'
      );
    });

    it('returns "" when stderr is absent or nullish', () => {
      expect(readErrorStderr({})).toBe('');
      expect(readErrorStderr(null)).toBe('');
      expect(readErrorStderr({ stderr: null })).toBe('');
    });
  });

  describe('extractErrorName', () => {
    it('prefers Node e.code when set', () => {
      expect(extractErrorName({ code: 'EACCES' }, 'stderr E404')).toBe(
        'EACCES'
      );
    });

    it.each([
      ['npm error code E404', 'E404'],
      ['npm error code ERESOLVE', 'ERESOLVE'],
      ['npm error code EINTEGRITY sha512 failure', 'EINTEGRITY'],
      ['ERR_PNPM_PEER_DEP_ISSUES Unmet peer deps', 'ERR_PNPM_PEER_DEP_ISSUES'],
    ])('extracts %s as %s', (stderr, expected) => {
      expect(extractErrorName({}, stderr)).toBe(expected);
    });

    it('falls back to error.name for plain Errors', () => {
      expect(extractErrorName(new TypeError('x'), '')).toBe('TypeError');
    });

    it('returns typeof for non-Error throws', () => {
      expect(extractErrorName('str', '')).toBe('string');
      expect(extractErrorName(42, '')).toBe('number');
    });
  });
});
