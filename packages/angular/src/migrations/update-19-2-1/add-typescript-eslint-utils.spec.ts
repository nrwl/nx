import { readJson, updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration, {
  typescriptEslintUtilsVersion,
} from './add-typescript-eslint-utils';

describe('add-typescript-eslint-utils migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it.each`
    pkgName                                     | version
    ${'@angular-eslint/eslint-plugin'}          | ${'18.0.0'}
    ${'@angular-eslint/eslint-plugin'}          | ${'~18.0.0'}
    ${'@angular-eslint/eslint-plugin'}          | ${'^18.0.0'}
    ${'@angular-eslint/eslint-plugin'}          | ${'^19.0.0'}
    ${'@angular-eslint/eslint-plugin-template'} | ${'18.0.0'}
    ${'@angular-eslint/eslint-plugin-template'} | ${'~18.0.0'}
    ${'@angular-eslint/eslint-plugin-template'} | ${'^18.0.0'}
    ${'@angular-eslint/eslint-plugin-template'} | ${'^19.0.0'}
  `(
    'should add "@typescript-eslint/utils" as devDependencies when "$pkgName" is installed with version "$version"',
    async ({ pkgName, version }) => {
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...json.devDependencies,
          [`${[pkgName]}`]: `${version}`,
        };
        return json;
      });

      await migration(tree);

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@typescript-eslint/utils']).toBe(
        typescriptEslintUtilsVersion
      );
    }
  );

  it.each`
    pkgName                                     | version
    ${'@angular-eslint/eslint-plugin'}          | ${'17.0.0'}
    ${'@angular-eslint/eslint-plugin'}          | ${'~17.0.0'}
    ${'@angular-eslint/eslint-plugin'}          | ${'^17.0.0'}
    ${'@angular-eslint/eslint-plugin-template'} | ${'17.0.0'}
    ${'@angular-eslint/eslint-plugin-template'} | ${'~17.0.0'}
    ${'@angular-eslint/eslint-plugin-template'} | ${'^17.0.0'}
  `(
    'should not add "@typescript-eslint/utils" when "$pkgName" is installed with version "$version"',
    async ({ pkgName, version }) => {
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...json.devDependencies,
          [`${[pkgName]}`]: `${version}`,
        };
        return json;
      });

      await migration(tree);

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@typescript-eslint/utils']).toBeUndefined();
    }
  );

  it('should not add "@typescript-eslint/utils" when "@angular-eslint/eslint-plugin" and "@angular-eslint/eslint-plugin-template" are not installed', async () => {
    await migration(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@typescript-eslint/utils']).toBeUndefined();
  });
});
