import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { checkDestination } from './check-destination';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('checkDestination', () => {
  let tree: Tree;
  let projectConfig: ProjectConfiguration;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, {
      directory: 'my-lib',
    });
    projectConfig = readProjectConfiguration(tree, 'my-lib');
  });

  it('should throw an error if the path is not explicit', async () => {
    const schema: NormalizedSchema = {
      projectName: 'my-lib',
      destination: '../apps/not-an-app',
      importPath: undefined,
      updateImportPath: true,
      relativeToRootDestination: '',
    };

    expect(() => {
      checkDestination(tree, schema, schema.destination);
    }).toThrow(
      `Invalid destination: [${schema.destination}] - Please specify explicit path.`
    );
  });

  it('should throw an error if the path already exists', async () => {
    await libraryGenerator(tree, {
      directory: 'my-other-lib',
    });

    const schema: NormalizedSchema = {
      projectName: 'my-lib',
      destination: 'my-other-lib',
      importPath: undefined,
      updateImportPath: true,
      relativeToRootDestination: 'my-other-lib',
    };

    expect(() => {
      checkDestination(tree, schema, schema.destination);
    }).toThrow(
      `Invalid destination: [${schema.destination}] - Path is not empty.`
    );
  });

  it('should NOT throw an error if the path is available', async () => {
    const schema: NormalizedSchema = {
      projectName: 'my-lib',
      destination: 'my-other-lib',
      importPath: undefined,
      updateImportPath: true,
      relativeToRootDestination: 'my-other-lib',
    };

    expect(() => {
      checkDestination(tree, schema, schema.destination);
    }).not.toThrow();
  });
});
