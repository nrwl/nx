import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { Tree, readJson, ProjectGraph } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion, rollupVersion } from '../../utils/versions';

import { rollupInitGenerator } from './init';

let projectGraph: ProjectGraph;
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi.fn().mockImplementation(async () => {
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
