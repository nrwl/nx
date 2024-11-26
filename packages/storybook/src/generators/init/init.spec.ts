import {
  readJson,
  type NxJsonConfiguration,
  type Tree,
  ProjectGraph,
  updateNxJson,
  readNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { initGenerator } from './init';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));
describe('@nx/storybook:init', () => {
  let tree: Tree;

  beforeEach(() => {
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add build-storybook to cacheable operations if NX_ADD_PLUGINS=false', async () => {
    await initGenerator(tree, {
      addPlugin: false,
    });
    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults['build-storybook'].cache).toEqual(true);
    delete process.env.NX_ADD_PLUGINS;
  });

  it('should add storybook-static to .gitignore', async () => {
    tree.write('.gitignore', '');
    await initGenerator(tree, {
      addPlugin: true,
    });
    expect(tree.read('.gitignore', 'utf-8')).toContain('storybook-static');
  });

  it('should not add storybook-static to .gitignore if it already exists', async () => {
    tree.write(
      '.gitignore',
      `
    storybook-static
    dist
    node_modules
  `
    );
    await initGenerator(tree, {
      addPlugin: true,
    });
    expect(tree.read('.gitignore', 'utf-8')).toMatchSnapshot();
  });

  it('should not duplicate cacheable operations in nx.json', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.tasksRunnerOptions ??= {};
    nxJson.tasksRunnerOptions.default ??= {};
    nxJson.tasksRunnerOptions.default.options ??= {};
    nxJson.tasksRunnerOptions.default.options.cacheableOperations = [
      'build-storybook',
    ];
    updateNxJson(tree, nxJson);

    // ACT
    await initGenerator(tree, {
      addPlugin: false,
    });

    // ASSERT
    const updatedNxJson = readNxJson(tree);
    expect(updatedNxJson.tasksRunnerOptions.default.options.cacheableOperations)
      .toMatchInlineSnapshot(`
      [
        "build-storybook",
      ]
    `);
  });
});
