import * as devkitExports from 'nx/src/devkit-exports';
import { createTree } from 'nx/src/generators/testing-utils/create-tree';
import type { Tree } from 'nx/src/generators/tree';
import { readJson, writeJson } from 'nx/src/generators/utils/json';
import type { PackageJson } from 'nx/src/utils/package-json';
import {
  addDependenciesToPackageJson,
  ensurePackage,
  getDependencyVersionFromPackageJson,
} from './package-json';

// Mock fs for catalog tests
jest.mock('fs', () => require('memfs').fs);
jest.mock('node:fs', () => require('memfs').fs);

// Mock yaml reading functions
jest.mock('nx/src/devkit-internals', () => ({
  ...jest.requireActual('nx/src/devkit-internals'),
  readYamlFile: jest.fn((path: string) => {
    const { vol } = require('memfs');
    try {
      const content = vol.readFileSync(path, 'utf8');
      return require('@zkochan/js-yaml').load(content);
    } catch (error) {
      throw new Error(`Cannot read YAML file at ${path}`);
    }
  }),
}));

describe('addDependenciesToPackageJson', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
    writeJson(tree, 'package.json', {
      dependencies: {
        react: 'latest',
      },
      devDependencies: {
        jest: 'latest',
      },
    });
  });

  it('should not add dependency if it is not greater', () => {
    writeJson(tree, 'package.json', {
      dependencies: {
        tslib: '^2.0.0',
      },
      devDependencies: {
        jest: '28.1.3',
      },
    });
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        tslib: '^2.3.0',
      },
      { jest: '28.1.1' }
    );

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: { tslib: '^2.3.0' },
      devDependencies: { jest: '28.1.3' },
    });
    expect(installTask).toBeDefined();
  });

  it('should add dependencies to the package.json', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        'react-dom': 'latest',
      },
      {}
    );
    expect(readJson(tree, 'package.json').dependencies).toEqual({
      react: 'latest',
      'react-dom': 'latest',
    });

    expect(installTask).toBeDefined();
  });

  it('should overwrite existing dependencies in the package.json if the version tag is greater', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        react: 'next',
      },
      {}
    );
    expect(readJson(tree, 'package.json').dependencies).toEqual({
      react: 'next',
    });
    expect(installTask).toBeDefined();
  });

  it('should add devDependencies to the package.json', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/react': 'latest',
      }
    );
    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      jest: 'latest',
      '@nx/react': 'latest',
    });
    expect(installTask).toBeDefined();
  });

  it('should overwrite existing devDependencies in the package.json if the version tag is greater', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        jest: 'next',
      }
    );
    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      jest: 'next',
    });
    expect(installTask).toBeDefined();
  });

  it('should overwrite dependencies when they exist in devDependencies or vice versa and the version tag is greater', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': 'latest',
      },
      devDependencies: {
        '@nx/next': 'latest',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': 'next',
      },
      {
        '@nx/angular': 'next',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': 'next',
    });
    expect(devDependencies).toEqual({
      '@nx/next': 'next',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite dependencies when they exist in devDependencies or vice versa and the version tag is lesser', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': 'next',
      },
      devDependencies: {
        '@nx/next': 'next',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': 'latest',
      },
      {
        '@nx/angular': 'latest',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': 'next',
    });
    expect(devDependencies).toEqual({
      '@nx/next': 'next',
    });
    expect(installTask).toBeDefined();
  });

  it('should overwrite dependencies when they exist in devDependencies or vice versa and the version is greater', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': '14.0.0',
      },
      devDependencies: {
        '@nx/next': '14.0.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': '14.1.0',
      },
      {
        '@nx/angular': '14.1.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.1.0',
    });
    expect(devDependencies).toEqual({
      '@nx/next': '14.1.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite dependencies when they exist in devDependencies or vice versa and the version is lesser', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': '14.1.0',
      },
      devDependencies: {
        '@nx/next': '14.1.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': '14.0.0',
      },
      {
        '@nx/angular': '14.0.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.1.0',
    });
    expect(devDependencies).toEqual({
      '@nx/next': '14.1.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite dependencies when they exist in "dependencies" and one of the versions is lesser', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': '14.2.0',
        '@nx/cypress': '14.1.1',
      },
      devDependencies: {
        '@nx/next': '14.0.0',
        '@nx/vite': '14.1.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/angular': '14.1.0',
      },
      {
        '@nx/next': '14.1.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.2.0',
      '@nx/cypress': '14.1.1',
    });
    expect(devDependencies).toEqual({
      '@nx/next': '14.1.0',
      '@nx/vite': '14.1.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite dependencies when they exist in "devDependencies" and one of the versions is lesser', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': '14.0.0',
        '@nx/cypress': '14.1.1',
      },
      devDependencies: {
        '@nx/next': '14.2.0',
        '@nx/vite': '14.1.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/angular': '14.1.0',
      },
      {
        '@nx/next': '14.1.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.1.0',
      '@nx/cypress': '14.1.1',
    });
    expect(devDependencies).toEqual({
      '@nx/next': '14.2.0',
      '@nx/vite': '14.1.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should only overwrite dependencies when their version is greater', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': '14.0.0',
      },
      devDependencies: {
        '@nx/next': '14.1.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': '14.0.0',
      },
      {
        '@nx/angular': '14.1.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.1.0',
    });
    expect(devDependencies).toEqual({
      '@nx/next': '14.1.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should overwrite dependencies when their version is not in a semver format', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': 'github:reponame/packageNameOne',
        '@nx/vite': 'git://github.com/npm/cli.git#v14.2.0', // this format is parsable
      },
      devDependencies: {
        '@nx/next': '14.1.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': 'github:reponame/packageNameTwo',
        '@nx/cypress':
          'git+https://username@github.com/reponame/packagename.git',
        '@nx/vite': '14.0.1',
      },
      {
        '@nx/angular': '14.1.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.1.0',
      '@nx/cypress': 'git+https://username@github.com/reponame/packagename.git',
      '@nx/vite': 'git://github.com/npm/cli.git#v14.2.0',
    });
    expect(devDependencies).toEqual({
      '@nx/next': 'github:reponame/packageNameTwo',
    });
    expect(installTask).toBeDefined();
  });

  it('should add additional dependencies when they dont exist in devDependencies or vice versa and not update the ones that do exist', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': 'latest',
      },
      devDependencies: {
        '@nx/next': 'latest',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': 'next',
        '@nx/cypress': 'latest',
      },
      {
        '@nx/angular': 'next',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': 'next',
      '@nx/cypress': 'latest',
    });
    expect(devDependencies).toEqual({
      '@nx/next': 'next',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite dependencies when they exist in devDependencies or vice versa and the new version is tilde', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        tslib: '2.4.0',
      },
      devDependencies: {
        nx: '15.0.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        tslib: '~2.3.0',
      },
      {
        nx: '15.0.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      tslib: '2.4.0',
    });
    expect(devDependencies).toEqual({
      nx: '15.0.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should allow existing versions to be kept', () => {
    writeJson(tree, 'package.json', {
      dependencies: {
        foo: '1.0.0',
      },
    });

    addDependenciesToPackageJson(
      tree,
      {
        foo: '2.0.0',
      },
      {},
      undefined,
      true
    );

    const result = readJson(tree, 'package.json');
    expect(result.dependencies).toEqual({
      foo: '1.0.0',
    });
  });

  describe('catalog support', () => {
    beforeEach(() => {
      jest.spyOn(devkitExports, 'detectPackageManager').mockReturnValue('pnpm');
      tree.root = '/test-workspace';
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should update existing catalog dependencies in pnpm workspace', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - packages/*
catalog:
  react: ^18.0.0
`
      );

      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:' },
      });

      addDependenciesToPackageJson(tree, { react: '^18.2.0' }, {});

      const result = readJson(tree, 'package.json');
      expect(result.dependencies).toEqual({ react: 'catalog:' });

      const workspace = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(workspace).toContain('react: "^18.2.0"');
    });

    it('should add new dependencies as regular dependencies when no existing catalog reference', () => {
      writeJson(tree, 'package.json', { dependencies: {} });

      addDependenciesToPackageJson(tree, { lodash: '^4.17.21' }, {});

      const result = readJson(tree, 'package.json');
      expect(result.dependencies).toEqual({ lodash: '^4.17.21' });
    });

    it('should use direct dependencies with unsupported package managers', () => {
      jest.spyOn(devkitExports, 'detectPackageManager').mockReturnValue('npm');
      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:' },
      });

      addDependenciesToPackageJson(tree, { react: '^18.0.0' }, {});

      const result = readJson(tree, 'package.json');
      expect(result.dependencies).toEqual({ react: '^18.0.0' });
    });

    it('should handle mixed catalog and direct dependencies', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `packages:\n  - packages/*\ncatalog:\n  react: ^18.0.0`
      );

      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:', lodash: '^4.17.20' },
      });

      addDependenciesToPackageJson(
        tree,
        { react: '^18.2.0', lodash: '^4.17.21' },
        {}
      );

      const result = readJson(tree, 'package.json');
      expect(result.dependencies).toEqual({
        react: 'catalog:',
        lodash: '^4.17.21',
      });

      const workspace = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(workspace).toContain('react: "^18.2.0"');
    });

    it('should preserve existing catalog references when updating with direct versions', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `packages:\n  - packages/*\ncatalog:\n  react: ^18.0.0`
      );

      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:' },
      });

      addDependenciesToPackageJson(tree, { react: '^18.2.0' }, {});

      const result = readJson(tree, 'package.json');
      expect(result.dependencies).toEqual({ react: 'catalog:' });

      const workspace = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(workspace).toContain('react: "^18.2.0"');
    });

    it('should update only the specific catalog when package exists in multiple catalogs', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `packages:\n  - packages/*\ncatalog:\n  react: ^18.0.0\ncatalogs:\n  dev:\n    react: ^17.0.0`
      );

      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:dev' },
      });

      addDependenciesToPackageJson(tree, { react: '^18.2.0' }, {});

      const result = readJson(tree, 'package.json');
      expect(result.dependencies).toEqual({ react: 'catalog:dev' });

      const workspace = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(workspace).toMatch(/catalogs:\s*dev:\s*react: "?\^18\.2\.0"?/);
      expect(workspace).toMatch(/catalog:\s*react: "?\^18\.0\.0"?/);
    });

    it('should filter catalog dependencies using version comparison logic', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `packages:\n  - packages/*\ncatalog:\n  react: ^18.2.0`
      );
      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:' },
      });

      addDependenciesToPackageJson(tree, { react: '^18.1.0' }, {});

      const result = readJson(tree, 'package.json');
      expect(result.dependencies).toEqual({ react: 'catalog:' });

      const workspace = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(workspace).toContain('react: ^18.2.0');
    });

    it('should handle named catalog references', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `packages:\n  - packages/*\ncatalogs:\n  dev:\n    jest: ^28.0.0`
      );

      writeJson(tree, 'package.json', {
        devDependencies: { jest: 'catalog:dev' },
      });

      addDependenciesToPackageJson(tree, {}, { jest: '^29.0.0' });

      const result = readJson(tree, 'package.json');
      expect(result.devDependencies).toEqual({ jest: 'catalog:dev' });

      const workspace = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(workspace).toContain('jest: "^29.0.0"');
    });

    it('should resolve catalog references for version comparison', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `packages:\n  - packages/*\ncatalog:\n  react: ^18.2.0`
      );

      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:' },
      });

      addDependenciesToPackageJson(tree, { react: '^18.1.0' }, {});

      const result = readJson(tree, 'package.json');
      expect(result.dependencies).toEqual({ react: 'catalog:' });

      const workspace = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(workspace).toContain('react: ^18.2.0');
    });

    it('should throw an error for invalid catalog references', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `packages:\n  - packages/*\ncatalog: {}`
      );

      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:nonexistent' },
      });

      expect(() =>
        addDependenciesToPackageJson(tree, { react: '^18.2.0' }, {})
      ).toThrow(
        "Failed to resolve catalog reference 'catalog:nonexistent' for package 'react'"
      );
    });
  });
});

describe('getDependencyVersionFromPackageJson', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should get single package version from root package.json', () => {
    writeJson(tree, 'package.json', {
      dependencies: { react: '^18.2.0' },
      devDependencies: { jest: '^29.0.0' },
    });

    const reactVersion = getDependencyVersionFromPackageJson(tree, 'react');
    const jestVersion = getDependencyVersionFromPackageJson(tree, 'jest');

    expect(reactVersion).toBe('^18.2.0');
    expect(jestVersion).toBe('^29.0.0');
  });

  it('should return null for non-existent package', () => {
    writeJson(tree, 'package.json', {
      dependencies: { react: '^18.2.0' },
    });

    const version = getDependencyVersionFromPackageJson(tree, 'non-existent');
    expect(version).toBeNull();
  });

  it('should prioritize dependencies over devDependencies', () => {
    writeJson(tree, 'package.json', {
      dependencies: { react: '^18.0.0' },
      devDependencies: { react: '^18.2.0' },
    });

    const version = getDependencyVersionFromPackageJson(tree, 'react');
    expect(version).toBe('^18.0.0');
  });

  it('should read from specific package.json path', () => {
    writeJson(tree, 'packages/my-lib/package.json', {
      dependencies: { '@my/util': '^1.0.0' },
    });

    const version = getDependencyVersionFromPackageJson(
      tree,
      '@my/util',
      'packages/my-lib/package.json'
    );
    expect(version).toBe('^1.0.0');
  });

  it('should work with pre-loaded package.json object', () => {
    const packageJson: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { react: '^18.2.0' },
      devDependencies: { jest: '^29.0.0' },
    };
    writeJson(tree, 'package.json', packageJson);

    const reactVersion = getDependencyVersionFromPackageJson(
      tree,
      'react',
      packageJson
    );
    const jestVersion = getDependencyVersionFromPackageJson(
      tree,
      'jest',
      packageJson
    );

    expect(reactVersion).toBe('^18.2.0');
    expect(jestVersion).toBe('^29.0.0');
  });

  describe('with catalog references', () => {
    beforeEach(() => {
      jest.spyOn(devkitExports, 'detectPackageManager').mockReturnValue('pnpm');
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - packages/*
catalog:
  react: "^18.2.0"
  lodash: "^4.17.21"
catalogs:
  frontend:
    vue: "^3.3.0"
`
      );
    });

    it('should resolve catalog reference for single package', () => {
      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:' },
      });

      const version = getDependencyVersionFromPackageJson(tree, 'react');
      expect(version).toBe('^18.2.0');
    });

    it('should resolve named catalog reference', () => {
      writeJson(tree, 'package.json', {
        dependencies: { vue: 'catalog:frontend' },
      });

      const version = getDependencyVersionFromPackageJson(tree, 'vue');
      expect(version).toBe('^3.3.0');
    });

    it('should return null when catalog reference cannot be resolved', () => {
      writeJson(tree, 'package.json', {
        dependencies: { unknown: 'catalog:' },
      });

      const version = getDependencyVersionFromPackageJson(tree, 'unknown');
      expect(version).toBeNull();
    });

    it('should work with pre-loaded package.json', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: { react: 'catalog:' },
      };
      writeJson(tree, 'package.json', packageJson);

      const version = getDependencyVersionFromPackageJson(
        tree,
        'react',
        packageJson
      );

      expect(version).toBe('^18.2.0');
    });
  });
});

describe('ensurePackage', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should return package when present', async () => {
    writeJson(tree, 'package.json', {});

    expect(ensurePackage('@nx/devkit', '>=15.0.0')).toEqual(
      require('@nx/devkit')
    ); // return void
  });
});
