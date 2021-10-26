import {
  addProjectConfiguration,
  NxJsonConfiguration,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { NormalizedSchema, Schema } from '../schema';
import { normalizeSchema } from './normalize-schema';

describe('normalizeSchema', () => {
  let tree: Tree;
  let projectConfiguration: ProjectConfiguration;
  const schema: Schema = {
    destination: '/my/library',
    projectName: 'my-library',
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

  it('should calculate importPath, projectName and relativeToRootDestination correctly', () => {
    const expected: NormalizedSchema = {
      destination: 'my/library',
      importPath: '@proj/my/library',
      newProjectName: 'my-library',
      projectName: 'my-library',
      relativeToRootDestination: 'libs/my/library',
      updateImportPath: true,
    };

    const result = normalizeSchema(tree, schema, projectConfiguration);

    expect(result).toEqual(expected);
  });

  it('should use provided import path', () => {
    const expected: NormalizedSchema = {
      destination: 'my/library',
      importPath: '@proj/my-awesome-library',
      newProjectName: 'my-library',
      projectName: 'my-library',
      relativeToRootDestination: 'libs/my/library',
      updateImportPath: true,
    };

    const result = normalizeSchema(
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

    const result = normalizeSchema(tree, schema, projectConfiguration);

    expect(result.relativeToRootDestination).toEqual('packages/my/library');
  });
});
