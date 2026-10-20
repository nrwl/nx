import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  type Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './remove-scam-generator-defaults';

describe('remove-scam-generator-defaults', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove flat and nested defaults of the removed generators from nx.json', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular:scam': { type: 'component' },
        '@nx/angular:scam-directive': { type: 'directive' },
        '@nx/angular:scam-pipe': { skipTests: true },
        '@nx/angular:scam-to-standalone': { skipFormat: true },
        '@nx/angular:component': { type: 'component' },
        '@nx/angular': {
          scam: { type: 'component' },
          'scam-directive': { type: 'directive' },
          'scam-pipe': { skipTests: true },
          'scam-to-standalone': { skipFormat: true },
          pipe: { typeSeparator: '.' },
        },
      },
    });

    const result = await migration(tree);

    expect(readNxJson(tree).generators).toEqual({
      '@nx/angular:component': { type: 'component' },
      '@nx/angular': { pipe: { typeSeparator: '.' } },
    });
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should drop the nested collection the removal leaves empty', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular': { scam: { type: 'component' } },
        '@schematics/angular:component': { type: 'component' },
      },
    });

    await migration(tree);

    expect(readNxJson(tree).generators).toEqual({
      '@schematics/angular:component': { type: 'component' },
    });
  });

  it('should remove the defaults from project.json and drop the emptied generators', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      generators: {
        '@nx/angular:scam': { type: 'component' },
        '@nx/angular': { 'scam-directive': { type: 'directive' } },
      },
    });

    await migration(tree);

    expect(readJson(tree, 'apps/app1/project.json')).not.toHaveProperty(
      'generators'
    );
  });

  it('should drop the emptied generators from a package.json project', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      workspaces: ['libs/*'],
    }));
    writeJson(tree, 'libs/lib1/package.json', {
      name: 'lib1',
      nx: { generators: { '@nx/angular:scam-pipe': { skipTests: true } } },
    });

    await migration(tree);

    expect(readJson(tree, 'libs/lib1/package.json').nx).not.toHaveProperty(
      'generators'
    );
  });

  it('should remove the defaults from angular.json projects', async () => {
    writeJson(tree, 'angular.json', {
      version: 1,
      projects: {
        app1: {
          root: '',
          projectType: 'application',
          schematics: { '@nx/angular:scam': { type: 'component' } },
        },
        app2: {
          root: 'projects/app2',
          projectType: 'application',
          generators: {
            '@nx/angular': { 'scam-pipe': { skipTests: true } },
            '@schematics/angular:component': { style: 'scss' },
          },
        },
      },
    });

    await migration(tree);

    const { projects } = readJson(tree, 'angular.json');
    expect(projects.app1).not.toHaveProperty('schematics');
    expect(projects.app2.generators).toEqual({
      '@schematics/angular:component': { style: 'scss' },
    });
    expect(readJson(tree, 'package.json')).not.toHaveProperty('nx');
  });

  it('should not change files without defaults for the removed generators', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular:component': { type: 'component' },
        '@nx/angular': { pipe: { typeSeparator: '.' } },
      },
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      generators: { '@nx/angular:directive': { type: 'directive' } },
    });
    const nxJsonContent = tree.read('nx.json', 'utf-8');
    const projectJsonContent = tree.read('apps/app1/project.json', 'utf-8');

    const result = await migration(tree);

    expect(tree.read('nx.json', 'utf-8')).toBe(nxJsonContent);
    expect(tree.read('apps/app1/project.json', 'utf-8')).toBe(
      projectJsonContent
    );
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should not throw on a non-object collection entry', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular': null,
        '@nx/angular:scam': { type: 'component' },
      },
    });

    await migration(tree);

    expect(readNxJson(tree).generators).toEqual({ '@nx/angular': null });
  });
});
