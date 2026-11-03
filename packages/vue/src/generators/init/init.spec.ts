import { ProjectGraph, readJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { vueInitGenerator } from './init';

let projectGraph: ProjectGraph;
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add vue dependencies', async () => {
    await vueInitGenerator(tree, { skipFormat: false });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toMatchSnapshot();
  });

  it('should not overwrite an existing vue version (keepExistingVersions defaults to true)', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = { ...(json.dependencies ?? {}), vue: '3.4.0' };
      return json;
    });

    // Invoked without `keepExistingVersions` (as application/library
    // generators do); the init should default it to true rather than bump.
    await vueInitGenerator(tree, { skipFormat: true });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies.vue).toBe('3.4.0');
  });
});
