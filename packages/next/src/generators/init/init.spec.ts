import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, Tree, ProjectGraph } from '@nx/devkit';

import { nextInitGenerator } from './init';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
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

  it('should add react dependencies', async () => {
    await nextInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nx/react']).toBeUndefined();
    expect(packageJson.devDependencies['@nx/next']).toBeDefined();
    expect(packageJson.dependencies['next']).toBeDefined();
  });
});
