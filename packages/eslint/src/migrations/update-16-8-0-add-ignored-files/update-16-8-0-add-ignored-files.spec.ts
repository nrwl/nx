import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, readJson, Tree, writeJson } from '@nx/devkit';

import update from './update-16-8-0-add-ignored-files';

describe('update-16-8-0-add-ignored-files migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.eslintrc.json', '{}');
  });

  it('should run successfully when eslint config is not present', async () => {
    addProjectConfiguration(tree, 'my-pkg', {
      root: 'packages/my-pkg',
      sourceRoot: 'packages/my-pkg/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/vite:build',
          options: {},
        },
      },
    });

    expect(() => update(tree)).not.toThrow();
  });

  it.each`
    executor                 | expectedPattern
    ${'@nx/vite:build'}      | ${'{projectRoot}/vite.config.{js,ts,mjs,mts}'}
    ${'@nx/vite:test'}       | ${'{projectRoot}/vite.config.{js,ts,mjs,mts}'}
    ${'@nx/esbuild:esbuild'} | ${'{projectRoot}/esbuild.config.{js,ts,mjs,mts}'}
    ${'@nx/rollup:rollup'}   | ${'{projectRoot}/rollup.config.{js,ts,mjs,mts}'}
  `(
    'should add ignoredFiles to projects using vite, esbuild, and rollup',
    async ({ executor, expectedPattern }) => {
      addProjectConfiguration(tree, 'my-pkg', {
        root: 'packages/my-pkg',
        sourceRoot: 'packages/my-pkg/src',
        projectType: 'library',
        targets: {
          build: {
            executor,
            options: {},
          },
        },
      });
      writeJson(tree, `packages/my-pkg/.eslintrc.json`, {
        root: true,
        ignorePatterns: ['!**/*'],
        plugins: ['@nx'],
        overrides: [
          {
            files: ['*.json'],
            parser: 'jsonc-eslint-parser',
            rules: {
              '@nx/dependency-checks': 'error',
            },
          },
        ],
      });

      update(tree);

      expect(readJson(tree, 'packages/my-pkg/.eslintrc.json')).toEqual({
        root: true,
        ignorePatterns: ['!**/*'],
        plugins: ['@nx'],
        overrides: [
          {
            files: ['*.json'],
            parser: 'jsonc-eslint-parser',
            rules: {
              '@nx/dependency-checks': [
                'error',
                {
                  ignoredFiles: [expectedPattern],
                },
              ],
            },
          },
        ],
      });
    }
  );

  it('should retain existing severity', () => {
    addProjectConfiguration(tree, 'my-pkg', {
      root: 'packages/my-pkg',
      sourceRoot: 'packages/my-pkg/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/vite:build',
          options: {},
        },
      },
    });
    writeJson(tree, `packages/my-pkg/.eslintrc.json`, {
      root: true,
      ignorePatterns: ['!**/*'],
      plugins: ['@nx'],
      overrides: [
        {
          files: ['*.json'],
          parser: 'jsonc-eslint-parser',
          rules: {
            '@nx/dependency-checks': 'warn',
          },
        },
      ],
    });

    update(tree);

    expect(readJson(tree, 'packages/my-pkg/.eslintrc.json')).toEqual({
      root: true,
      ignorePatterns: ['!**/*'],
      plugins: ['@nx'],
      overrides: [
        {
          files: ['*.json'],
          parser: 'jsonc-eslint-parser',
          rules: {
            '@nx/dependency-checks': [
              'warn',
              {
                ignoredFiles: ['{projectRoot}/vite.config.{js,ts,mjs,mts}'],
              },
            ],
          },
        },
      ],
    });
  });

  it('should retain existing options', () => {
    addProjectConfiguration(tree, 'my-pkg', {
      root: 'packages/my-pkg',
      sourceRoot: 'packages/my-pkg/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/vite:build',
          options: {},
        },
      },
    });
    writeJson(tree, `packages/my-pkg/.eslintrc.json`, {
      root: true,
      ignorePatterns: ['!**/*'],
      plugins: ['@nx'],
      overrides: [
        {
          files: ['*.json'],
          parser: 'jsonc-eslint-parser',
          rules: {
            '@nx/dependency-checks': [
              'error',
              {
                checkVersionMismatches: false,
              },
            ],
          },
        },
      ],
    });

    update(tree);

    expect(readJson(tree, 'packages/my-pkg/.eslintrc.json')).toEqual({
      root: true,
      ignorePatterns: ['!**/*'],
      plugins: ['@nx'],
      overrides: [
        {
          files: ['*.json'],
          parser: 'jsonc-eslint-parser',
          rules: {
            '@nx/dependency-checks': [
              'error',
              {
                checkVersionMismatches: false,
                ignoredFiles: ['{projectRoot}/vite.config.{js,ts,mjs,mts}'],
              },
            ],
          },
        },
      ],
    });
  });
});
