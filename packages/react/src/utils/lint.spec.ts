import { type Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { getExtraEslintDependencies } from './lint';

describe('getExtraEslintDependencies', () => {
  let tree: Tree;
  let originalFlatConfigEnv: string | undefined;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    originalFlatConfigEnv = process.env.ESLINT_USE_FLAT_CONFIG;
    delete process.env.ESLINT_USE_FLAT_CONFIG;
  });

  afterEach(() => {
    if (originalFlatConfigEnv === undefined) {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
    } else {
      process.env.ESLINT_USE_FLAT_CONFIG = originalFlatConfigEnv;
    }
  });

  function setEslintVersion(version: string) {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, eslint: version };
      return json;
    });
  }

  function setInstalledEslintVersion(version: string | undefined) {
    if (version) {
      tree.write(
        'node_modules/eslint/package.json',
        JSON.stringify({ name: 'eslint', version })
      );
    }
  }

  it.each([
    ['^10.0.0', undefined],
    ['^9.0.0 || ^10.0.0', '10.0.1'],
  ])(
    'installs import-x and react-hooks v7 for ESLint v10 workspaces (%s, installed %s)',
    (declared, installed) => {
      setEslintVersion(declared);
      setInstalledEslintVersion(installed);

      const { devDependencies } = getExtraEslintDependencies(tree);

      expect(devDependencies['eslint-plugin-import-x']).toMatch(/^\^?4\./);
      expect(devDependencies['eslint-plugin-react-hooks']).toMatch(/^7\./);
      expect(devDependencies['eslint-plugin-react']).toBeUndefined();
      expect(devDependencies['eslint-plugin-jsx-a11y']).toBeUndefined();
      expect(devDependencies['eslint-plugin-import']).toBeUndefined();
    }
  );

  it.each([
    ['^9.8.0', undefined],
    ['<10 >=9.0.0', undefined],
    ['<10 >=9.0.0', '9.39.4'],
  ])(
    'installs the legacy plugin set for ESLint v9 workspaces (%s, installed %s)',
    (declared, installed) => {
      setEslintVersion(declared);
      setInstalledEslintVersion(installed);

      const { devDependencies } = getExtraEslintDependencies(tree);

      expect(devDependencies['eslint-plugin-react']).toBeDefined();
      expect(devDependencies['eslint-plugin-jsx-a11y']).toBeDefined();
      expect(devDependencies['eslint-plugin-import']).toBeDefined();
      expect(devDependencies['eslint-plugin-react-hooks']).toMatch(/^5\./);
      expect(devDependencies['eslint-plugin-import-x']).toBeUndefined();
    }
  );

  it('defaults to the ESLint v10 set when no ESLint version is declared', () => {
    const { devDependencies } = getExtraEslintDependencies(tree);

    expect(devDependencies['eslint-plugin-import-x']).toBeDefined();
    expect(devDependencies['eslint-plugin-react']).toBeUndefined();
  });
});
