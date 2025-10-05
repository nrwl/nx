import { readJson, writeJson, type Tree } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-typescript-eslint-v8-13-0';

describe('update-typescript-eslint-v8-13-0 migration', () => {
  let tree: Tree;
  let fs: TempFs;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    fs = new TempFs('update-typescript-eslint-v8-13-0');
  });

  afterEach(() => {
    fs.cleanup();
  });

  test.each`
    pkgName
    ${'typescript-eslint'}
    ${'@typescript-eslint/eslint-plugin'}
    ${'@typescript-eslint/parser'}
    ${'@typescript-eslint/utils'}
  `('should update $pkgName to v8.13.0', async ({ pkgName }) => {
    addPackageJsonDependencies({ [pkgName]: '^8.0.0' });

    await migration(tree);

    expect(readJson(tree, 'package.json').devDependencies).toStrictEqual({
      [pkgName]: '^8.13.0',
    });
  });

  test.each`
    pkgName
    ${'typescript-eslint'}
    ${'@typescript-eslint/eslint-plugin'}
    ${'@typescript-eslint/parser'}
    ${'@typescript-eslint/utils'}
  `(
    'should support $pkgName installed as a dependency',
    async ({ pkgName }) => {
      addPackageJsonDependencies({ [pkgName]: '^8.0.0' }, false);

      await migration(tree);

      expect(readJson(tree, 'package.json').dependencies).toStrictEqual({
        [pkgName]: '^8.13.0',
      });
    }
  );

  test.each`
    pkgName
    ${'typescript-eslint'}
    ${'@typescript-eslint/eslint-plugin'}
    ${'@typescript-eslint/parser'}
    ${'@typescript-eslint/utils'}
  `(
    'should not update $pkgName to v8.13.0 when it is not installed',
    async ({ pkgName }) => {
      addPackageJsonDependencies({});

      await migration(tree);

      expect(readJson(tree, 'package.json').devDependencies).toStrictEqual({});
    }
  );

  test.each`
    pkgName
    ${'typescript-eslint'}
    ${'@typescript-eslint/eslint-plugin'}
    ${'@typescript-eslint/parser'}
    ${'@typescript-eslint/utils'}
  `(
    'should not update $pkgName to v8.13.0 when it is not on version 8.0.0 or greater',
    async ({ pkgName }) => {
      addPackageJsonDependencies({ [pkgName]: '^7.0.0' });

      await migration(tree);

      expect(readJson(tree, 'package.json').devDependencies).toStrictEqual({
        [pkgName]: '^7.0.0',
      });
    }
  );

  test.each`
    pkgName
    ${'typescript-eslint'}
    ${'@typescript-eslint/eslint-plugin'}
    ${'@typescript-eslint/parser'}
    ${'@typescript-eslint/utils'}
  `(
    'should not set $pkgName version to v8.13.0 when it is already at v8.13.0 or greater',
    async ({ pkgName }) => {
      addPackageJsonDependencies({ [pkgName]: '^8.14.0' });

      await migration(tree);

      expect(readJson(tree, 'package.json').devDependencies).toStrictEqual({
        [pkgName]: '^8.14.0',
      });
    }
  );

  function addPackageJsonDependencies(
    dependencies: Record<string, string>,
    isDev = true
  ) {
    const pkgJson: any = {
      name: 'test',
    };
    if (isDev) {
      pkgJson.devDependencies = dependencies;
    } else {
      pkgJson.dependencies = dependencies;
    }

    fs.createFileSync('package.json', JSON.stringify(pkgJson));
    writeJson(tree, 'package.json', pkgJson);
  }
});
