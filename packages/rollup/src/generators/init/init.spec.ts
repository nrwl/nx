import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree, readJson, ProjectGraph } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion, rollupVersion } from '../../utils/versions';

import { rollupInitGenerator } from './init';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('rollupInitGenerator', () => {
  let tree: Tree;

  beforeEach(async () => {
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should install deps', async () => {
    await rollupInitGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: { '@nx/rollup': nxVersion, rollup: rollupVersion },
    });
  });
});
