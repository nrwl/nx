import {
  addProjectConfiguration,
  NxJsonConfiguration,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema, Schema } from '../schema';
import { normalizeSchema } from './normalize-schema';

describe('normalizeSchema', () => {
  let tree: Tree;
  let projectConfiguration: ProjectConfiguration;
  const schema: Schema = {
    destination: '/my/library',
    projectName: 'my-library',
    projectNameAndRootFormat: 'as-provided',
    updateImportPath: true,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, schema.projectName, {
      root: 'libs/my-library',
      projectType: 'library',
      targets: {},
    });

    projectConfiguration = readProjectConfiguration(tree, schema.projectName);
  });

  it('should calculate importPath, projectName and relativeToRootDestination correctly', async () => {
    const expected: NormalizedSchema = {
      newProjectName: 'my-library',
      projectName: 'my-library',
      relativeToRootDestination: 'my/library',
      projectNameAndRootFormat: 'as-provided',
      updateImportPath: false,
    };

    const result = await normalizeSchema(tree, schema, projectConfiguration);

    expect(result).toEqual(expected);
  });

  it('should normalize destination and derive projectName correctly', async () => {
    const expected: NormalizedSchema = {
      newProjectName: 'my-library',
      projectName: 'my-library',
      relativeToRootDestination: 'my/library',
      projectNameAndRootFormat: 'as-provided',
      updateImportPath: false,
    };

    const result = await normalizeSchema(
      tree,
      { ...schema, destination: './my/library' },
      projectConfiguration
    );

    expect(result).toEqual(expected);
  });

  it('should use provided import path', async () => {
    const expected: NormalizedSchema = {
      importPath: '@proj/my-awesome-library',
      newProjectName: 'my-library',
      projectName: 'my-library',
      relativeToRootDestination: 'my/library',
      projectNameAndRootFormat: 'as-provided',
      updateImportPath: true,
    };

    const result = await normalizeSchema(
      tree,
      { ...schema, importPath: expected.importPath },
      projectConfiguration
    );

    expect(result).toEqual(expected);
  });

  it('should honor custom workspace layouts', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.workspaceLayout = { appsDir: 'apps', libsDir: 'packages' };
      return json;
    });

    const result = await normalizeSchema(
      tree,
      { ...schema, projectNameAndRootFormat: 'derived' },
      projectConfiguration
    );

    expect(result.relativeToRootDestination).toEqual('packages/my/library');
  });
});
