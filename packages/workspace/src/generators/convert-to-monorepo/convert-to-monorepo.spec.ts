import 'nx/src/internal-testing-utils/mock-project-graph';

import { readProjectConfiguration, Tree } from '@nx/devkit';
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

    await libraryGenerator(tree, { name: 'my-lib', rootProject: true });
    await libraryGenerator(tree, { name: 'other-lib' });

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

  it('should respect nested libraries', async () => {
    await reactAppGenerator(tree, {
      name: 'demo',
      style: 'css',
      bundler: 'vite',
      unitTestRunner: 'vitest',
      e2eTestRunner: 'none',
      linter: 'eslint',
      rootProject: true,
    });

    await libraryGenerator(tree, {
      name: 'my-lib',
      directory: 'inner',
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
      style: 'css',
      unitTestRunner: 'jest',
      e2eTestRunner: 'none',
      appDir: true,
      src: true,
      linter: 'eslint',
      rootProject: true,
    });
    await libraryGenerator(tree, { name: 'util' });

    await monorepoGenerator(tree, {});

    expect(readProjectConfiguration(tree, 'demo')).toMatchObject({
      sourceRoot: 'apps/demo',
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
