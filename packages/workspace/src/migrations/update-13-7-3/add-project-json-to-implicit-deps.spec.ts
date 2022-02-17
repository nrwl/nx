import { NxJsonConfiguration, readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';
import addProjectJsonToImplicitDeps from './add-project-json-to-implicit-deps';

describe('addProjectJsonToImplicitDeps', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it("should not add implicit dependencies if extends preset json's", () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      npmScope: 'scope',
      extends: '@nrwl/workspace/presets/core.json',
    });
    addProjectJsonToImplicitDeps(tree);
    const result = readJson(tree, 'nx.json');
    expect(result).toEqual({
      npmScope: 'scope',
      extends: '@nrwl/workspace/presets/core.json',
    });
  });

  it('should add implicit dependencies if missing', () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      npmScope: 'scope',
    });
    addProjectJsonToImplicitDeps(tree);
    const result = readJson(tree, 'nx.json');
    expect(result).toEqual({
      npmScope: 'scope',
      implicitDependencies: {
        'apps/**/project.json': {
          tags: '*',
        },
        'libs/**/project.json': {
          tags: '*',
        },
      },
    });
  });

  it('should update implicit dependencies if available', () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      npmScope: 'scope',
      implicitDependencies: {
        'package.json': {
          dependencies: '*',
          devDependencies: '*',
        },
        '.eslintrc.json': '*',
      },
    });
    addProjectJsonToImplicitDeps(tree);
    const result = readJson(tree, 'nx.json');
    expect(result).toEqual({
      npmScope: 'scope',
      implicitDependencies: {
        'package.json': {
          dependencies: '*',
          devDependencies: '*',
        },
        '.eslintrc.json': '*',
        'apps/**/project.json': {
          tags: '*',
        },
        'libs/**/project.json': {
          tags: '*',
        },
      },
    });
  });

  it('should use workspaceLayout folder names if available', () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      npmScope: 'scope',
      workspaceLayout: { appsDir: 'appz', libsDir: 'libz' },
    });
    addProjectJsonToImplicitDeps(tree);
    const result = readJson(tree, 'nx.json');
    expect(result).toEqual({
      npmScope: 'scope',
      workspaceLayout: { appsDir: 'appz', libsDir: 'libz' },
      implicitDependencies: {
        'appz/**/project.json': {
          tags: '*',
        },
        'libz/**/project.json': {
          tags: '*',
        },
      },
    });
  });

  it('should create single entry is apps and libs folder are same', () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      npmScope: 'scope',
      workspaceLayout: { appsDir: 'packages', libsDir: 'packages' },
    });
    addProjectJsonToImplicitDeps(tree);
    const result = readJson(tree, 'nx.json');
    expect(result).toEqual({
      npmScope: 'scope',
      workspaceLayout: { appsDir: 'packages', libsDir: 'packages' },
      implicitDependencies: {
        'packages/**/project.json': {
          tags: '*',
        },
      },
    });
  });

  it('should not update implicit dependencies for apps or libs if already set', () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      npmScope: 'scope',
      implicitDependencies: {
        'package.json': {
          dependencies: '*',
          devDependencies: '*',
        },
        '.eslintrc.json': '*',
        'apps/**/project.json': ['testing'],
      },
    });
    addProjectJsonToImplicitDeps(tree);
    const result = readJson(tree, 'nx.json');
    expect(result).toEqual({
      npmScope: 'scope',
      implicitDependencies: {
        'package.json': {
          dependencies: '*',
          devDependencies: '*',
        },
        '.eslintrc.json': '*',
        'apps/**/project.json': ['testing'],
        'libs/**/project.json': {
          tags: '*',
        },
      },
    });
  });
});
