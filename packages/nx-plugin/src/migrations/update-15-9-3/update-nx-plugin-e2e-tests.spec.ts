import {
  logger,
  ProjectGraph,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator } from '@nrwl/workspace';
import { updateNxPluginE2eTests } from './update-nx-plugin-e2e-tests';

let projectGraph: ProjectGraph;

jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('Nx Plugin Migration - ensureNxProject usage in e2e tests', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should not update anything if test does not have references to ensureNxProject', async () => {
    await setup(tree, 'my-lib');

    const expected = tree.read('libs/my-lib/tests/empty-test.spec.ts', 'utf-8');
    await updateNxPluginE2eTests(tree);

    expect(tree.read('libs/my-lib/tests/empty-test.spec.ts', 'utf-8')).toEqual(
      expected
    );
  });

  it('should update calls to ensureNxProject and use project instead of package name', async () => {
    await setup(tree, 'my-lib');

    await updateNxPluginE2eTests(tree);

    expect(
      tree.read('libs/my-lib/tests/test.spec.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should be idempotent', async () => {
    await setup(tree, 'my-lib');

    await updateNxPluginE2eTests(tree);
    await updateNxPluginE2eTests(tree);

    expect(
      tree.read('libs/my-lib/tests/test.spec.ts', 'utf-8')
    ).toMatchSnapshot();
  });
});

async function setup(tree: Tree, name: string) {
  await libraryGenerator(tree, { name });
  const projectConfig = readProjectConfiguration(tree, name);
  projectConfig.targets['e2e'] = {
    executor: '@nrwl/nx-plugin:e2e',
    options: {
      jestConfig: `libs/${name}/jest.config.ts`,
    },
  };
  updateProjectConfiguration(tree, name, projectConfig);

  tree.write(
    `libs/${name}/tests/test.spec.ts`,
    `import { runNxCommandAsync, uniq } from '@nrwl/nx-plugin/testing';

import { ensureNxProject } from '@nrwl/devkit';

describe('${name} e2e', () => {
  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(() => {
    ensureNxProject('@lib/${name}', 'dist/packages/${name}');
  });

  beforeAll(async () => {
    await ensureNxProject('@lib/${name}', 'dist/packages/${name}');
  });

  afterAll(() => {
    // nx reset kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    runNxCommandAsync('reset');
  });
});
`
  );

  tree.write(
    `libs/${name}/tests/empty-test.spec.ts`,
    `import { runNxCommandAsync, uniq } from '@nrwl/nx-plugin/testing';

describe('${name} e2e', () => {
  afterAll(() => {
    // nx reset kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    runNxCommandAsync('reset');
  });
});
`
  );

  projectGraph = {
    dependencies: {},
    nodes: {
      [name]: {
        name,
        type: 'lib',
        data: projectConfig,
      } as any,
    },
  };
}
