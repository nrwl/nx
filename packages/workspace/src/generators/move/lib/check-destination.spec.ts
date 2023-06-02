import {
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Schema } from '../schema';
import { checkDestination } from './check-destination';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('checkDestination', () => {
  let tree: Tree;
  let projectConfig: ProjectConfiguration;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, { name: 'my-lib' });
    projectConfig = readProjectConfiguration(tree, 'my-lib');
  });

  it('should throw an error if the path is not explicit', async () => {
    const schema: Schema = {
      projectName: 'my-lib',
      destination: '../apps/not-an-app',
      importPath: undefined,
      updateImportPath: true,
    };

    expect(() => {
      checkDestination(tree, schema, projectConfig);
    }).toThrow(
      `Invalid destination: [${schema.destination}] - Please specify explicit path.`
    );
  });

  it('should throw an error if the path already exists', async () => {
    await libraryGenerator(tree, {
      name: 'my-other-lib',
    });

    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'my-other-lib',
      importPath: undefined,
      updateImportPath: true,
    };

    expect(() => {
      checkDestination(tree, schema, projectConfig);
    }).toThrow(
      `Invalid destination: [${schema.destination}] - Path is not empty.`
    );
  });

  it('should NOT throw an error if the path is available', async () => {
    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'my-other-lib',
      importPath: undefined,
      updateImportPath: true,
    };

    expect(() => {
      checkDestination(tree, schema, projectConfig);
    }).not.toThrow();
  });
});
