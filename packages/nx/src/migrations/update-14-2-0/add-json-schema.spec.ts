import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import { readJson } from '../../generators/utils/json';
import { addProjectConfiguration } from '../../generators/utils/project-configuration';
import addJsonSchema from './add-json-schema';

describe('add-json-schema >', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should update nx.json $schema', async () => {
    const nxJson = readJson(tree, 'nx.json');
    delete nxJson['$schema'];

    await addJsonSchema(tree);
    expect(readJson(tree, 'nx.json')['$schema']).toEqual(
      './node_modules/nx/schemas/nx-schema.json'
    );
  });

  it('should update workspace.json $schema', async () => {
    const workspaceJson = readJson(tree, 'workspace.json');
    delete workspaceJson['$schema'];

    await addJsonSchema(tree);
    expect(readJson(tree, 'workspace.json')['$schema']).toEqual(
      './node_modules/nx/schemas/workspace-schema.json'
    );
  });

  it('should update project.json $schema', async () => {
    addProjectConfiguration(
      tree,
      'test',
      { root: 'libs/test', sourceRoot: 'libs/test/src', targets: {} },
      true
    );
    addProjectConfiguration(
      tree,
      'test-two',
      {
        root: 'libs/nested/test-two',
        sourceRoot: 'libs/nested/test-two/src',
        targets: {},
      },
      true
    );

    await addJsonSchema(tree);
    expect(readJson(tree, 'libs/test/project.json')['$schema']).toEqual(
      '../../node_modules/nx/schemas/project-schema.json'
    );
    expect(
      readJson(tree, 'libs/nested/test-two/project.json')['$schema']
    ).toEqual('../../../node_modules/nx/schemas/project-schema.json');
  });
});
