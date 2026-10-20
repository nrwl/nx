import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { monorepoGenerator } from './convert-to-monorepo';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');
// nx-ignore-next-line
const { applicationGenerator: reactAppGenerator } = require('@nx/react');
// nx-ignore-next-line
const { applicationGenerator: nextAppGenerator } = require('@nx/next');

describe('monorepo generator', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should convert root JS lib', async () => {
    // Files that should not move
    tree.write('.gitignore', '');
    tree.write('README.md', '');
    tree.write('tools/scripts/custom_script.sh', '');

    await libraryGenerator(tree, {
      name: 'my-lib',
      directory: '.',
      rootProject: true,
    });
    await libraryGenerator(tree, { directory: 'other-lib' });

    await monorepoGenerator(tree, {
      appsDir: 'apps',
      libsDir: 'packages',
    });

    expect(readProjectConfiguration(tree, 'my-lib')).toMatchObject({
      sourceRoot: 'packages/my-lib/src',
      targets: {
        build: {
          executor: '@nx/js:tsc',
          options: {
            main: 'packages/my-lib/src/index.ts',
            tsConfig: 'packages/my-lib/tsconfig.lib.json',
          },
        },
      },
    });
    expect(readProjectConfiguration(tree, 'other-lib')).toMatchObject({
      name: 'other-lib',
      sourceRoot: 'packages/other-lib/src',
    });

    // Did not move files that don't belong to root project
    expect(tree.exists('.gitignore')).toBeTruthy();
    expect(tree.exists('README.md')).toBeTruthy();
    expect(tree.exists('tools/scripts/custom_script.sh')).toBeTruthy();

    // Extracted base config files
    expect(tree.exists('tsconfig.base.json')).toBeTruthy();
  });

  it('should convert root React app (Vite, Vitest)', async () => {
    await reactAppGenerator(tree, {
      name: 'demo',
      directory: '.',
      style: 'css',
      bundler: 'vite',
      unitTestRunner: 'vitest',
      e2eTestRunner: 'none',
      linter: 'eslint',
      rootProject: true,
    });

    await monorepoGenerator(tree, {});

    expect(readProjectConfiguration(tree, 'demo')).toMatchObject({
      sourceRoot: 'apps/demo/src',
    });

    // Extracted base config files
    expect(tree.exists('tsconfig.base.json')).toBeTruthy();
  });

  it.each([
    ['its default name', false],
    ['the name it gets next to a workspace config', true],
  ])(
    'should move the root project Jest config with %s',
    async (_, withWorkspaceConfig) => {
      await reactAppGenerator(tree, {
        name: 'demo',
        directory: '.',
        style: 'css',
        bundler: 'vite',
        unitTestRunner: 'jest',
        e2eTestRunner: 'none',
        linter: 'eslint',
        rootProject: true,
      });
      const generatedConfig = ['jest.config.ts', 'jest.config.cts'].find((f) =>
        tree.exists(f)
      );
      const workspaceConfig = `export default async () => ({ projects: await getJestProjectsAsync() });`;
      if (withWorkspaceConfig) {
        tree.rename(generatedConfig, 'jest.config.app.cts');
        tree.write('jest.config.ts', workspaceConfig);
        updateJson(tree, 'tsconfig.spec.json', (json) => {
          json.include = [
            ...json.include.map((p: string) =>
              p.replace(/^jest\.config\./, 'jest.config.app.')
            ),
            'src/unit/jest.config.app.ts',
          ];
          return json;
        });
        const project = readProjectConfiguration(tree, 'demo');
        project.targets.test = {
          command: 'jest --config jest.config.app.cts',
        };
        project.targets['test-coverage'] = {
          command: 'jest --config ./jest.config.app.cts --coverage',
        };
        updateProjectConfiguration(tree, 'demo', project);
      } else {
        tree.rename(generatedConfig, 'jest.config.cts');
      }

      await monorepoGenerator(tree, {});

      expect(tree.exists('apps/demo/jest.config.cts')).toBe(true);
      if (withWorkspaceConfig) {
        const { targets } = readProjectConfiguration(tree, 'demo');
        expect(targets.test.command).toBe('jest');
        expect(targets['test-coverage'].command).toBe(
          'jest --config apps/demo/jest.config.cts --coverage'
        );
        expect(
          readJson(tree, 'apps/demo/tsconfig.spec.json').include
        ).toContain('src/unit/jest.config.app.ts');
      }
      expect(readJson(tree, 'apps/demo/tsconfig.spec.json').include).toContain(
        'jest.config.cts'
      );
      expect(
        tree.children('').filter((f) => f.startsWith('jest.config.'))
      ).toEqual(withWorkspaceConfig ? ['jest.config.ts'] : []);
      if (withWorkspaceConfig) {
        expect(tree.read('jest.config.ts', 'utf-8')).toContain(workspaceConfig);
      }
    }
  );

  it('should respect nested libraries', async () => {
    await reactAppGenerator(tree, {
      name: 'demo',
      directory: '.',
      style: 'css',
      bundler: 'vite',
      unitTestRunner: 'vitest',
      e2eTestRunner: 'none',
      linter: 'eslint',
      rootProject: true,
    });

    await libraryGenerator(tree, {
      name: 'my-lib',
      directory: 'inner/my-lib',
      style: 'css',
      bundler: 'vite',
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      linter: 'eslint',
      rootProject: true,
    });

    await monorepoGenerator(tree, {});

    expect(tree.exists('libs/inner/my-lib/tsconfig.json')).toBeTruthy();
    expect(tree.exists('libs/inner/my-lib/src/index.ts')).toBeTruthy();
  });

  it('should convert root Next.js app with existing libraries', async () => {
    await nextAppGenerator(tree, {
      name: 'demo',
      directory: '.',
      style: 'css',
      unitTestRunner: 'jest',
      e2eTestRunner: 'none',
      appDir: true,
      src: true,
      linter: 'eslint',
      rootProject: true,
    });
    await libraryGenerator(tree, { directory: 'util' });

    await monorepoGenerator(tree, {});

    expect(readProjectConfiguration(tree, 'demo')).toMatchObject({
      sourceRoot: 'apps/demo/src',
    });
    expect(tree.read('apps/demo/src/app/page.tsx', 'utf-8')).toContain('demo');
    expect(readProjectConfiguration(tree, 'util')).toMatchObject({
      sourceRoot: 'libs/util/src',
    });
    expect(tree.read('libs/util/src/lib/util.ts', 'utf-8')).toContain('util');

    // Extracted base config files
    expect(tree.exists('tsconfig.base.json')).toBeTruthy();
    expect(tree.exists('jest.preset.js')).toBeTruthy();
  });
});
