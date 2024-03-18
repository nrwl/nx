import { replaceNrwlPackageWithNxPackage } from './replace-package';

import { Tree } from 'nx/src/generators/tree';
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  writeJson,
  readJson,
} from 'nx/src/devkit-exports';

describe('replaceNrwlPackageWithNxPackage', () => {
  let tree: Tree;
  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();

    tree.write('README.txt', 'old-package');

    writeJson(tree, 'package.json', {
      name: 'source-code',
      dependencies: {
        'old-package': '0.0.1',
      },
      devDependencies: {
        'old-package': '0.0.1',
      },
    });

    writeJson(tree, 'packages/package1/package.json', {
      name: 'package1',
      dependencies: {
        'old-package': '0.0.1',
      },
      devDependencies: {
        'old-package': '0.0.1',
      },
      peerDependencies: {
        'old-package': '0.0.1',
      },
      optionalDependencies: {
        'old-package': '0.0.1',
      },
    });

    addProjectConfiguration(tree, 'proj1', {
      name: 'proj1',
      root: 'proj1',
      targets: {
        build: {
          executor: 'old-package:build',
          options: {
            key: 'value',
          },
        },
      },
      generators: {
        'old-package': {
          app: {
            key: 'value',
          },
        },
      },
    });

    addProjectConfiguration(tree, 'proj2', {
      name: 'proj2',
      root: 'proj2',
    });

    updateNxJson(tree, {
      generators: {
        'old-package': {
          app: {
            key: 'value',
          },
        },
      },
      targetDefaults: {
        build: {
          executor: 'old-package:build',
          options: {
            key: 'value',
          },
        },
      },
    });

    replaceNrwlPackageWithNxPackage(tree, 'old-package', 'new-package');
  });

  it('should update targets in the project configuration', () => {
    expect(readProjectConfiguration(tree, 'proj1')).toEqual({
      $schema: '../node_modules/nx/schemas/project-schema.json',
      generators: {
        'new-package': {
          app: {
            key: 'value',
          },
        },
      },
      name: 'proj1',
      root: 'proj1',
      targets: {
        build: {
          executor: 'new-package:build',
          options: {
            key: 'value',
          },
        },
      },
    });
    expect(readProjectConfiguration(tree, 'proj2')).toEqual({
      $schema: '../node_modules/nx/schemas/project-schema.json',
      name: 'proj2',
      root: 'proj2',
    });
  });

  it('should replace package in nx.json', () => {
    expect(readNxJson(tree)).toEqual({
      generators: {
        'new-package': {
          app: {
            key: 'value',
          },
        },
      },
      targetDefaults: {
        build: {
          executor: 'new-package:build',
          options: {
            key: 'value',
          },
        },
      },
    });
  });

  it('should replace package in package.json files', () => {
    expect(readJson(tree, 'package.json')).toEqual({
      name: 'source-code',
      dependencies: {
        'new-package': '0.0.1',
      },
      devDependencies: {
        'new-package': '0.0.1',
      },
    });
    expect(readJson(tree, 'packages/package1/package.json')).toEqual({
      name: 'package1',
      dependencies: {
        'new-package': '0.0.1',
      },
      devDependencies: {
        'new-package': '0.0.1',
      },
      peerDependencies: {
        'new-package': '0.0.1',
      },
      optionalDependencies: {
        'new-package': '0.0.1',
      },
    });
  });

  it('should handle broken package.json files', () => {
    tree.write('package.json', '{ broken: "json ');

    expect(() =>
      replaceNrwlPackageWithNxPackage(tree, 'old-package', 'new-package')
    ).not.toThrow();
  });

  it('should replace any mentions in files', () => {
    expect(tree.read('README.txt').toString()).toContain('new-package');
    expect(tree.read('README.txt').toString()).not.toContain('old-package');
  });
});
