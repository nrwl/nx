import { ProjectGraph, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { vueInitGenerator } from './init';

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

  it('should add vue dependencies', async () => {
    await vueInitGenerator(tree, { skipFormat: false });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toMatchSnapshot();
  });
});
