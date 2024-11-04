import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { moveProjectFiles } from './move-project-files';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('moveProject', () => {
  let tree: Tree;
  let projectConfig: ProjectConfiguration;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, {
      directory: 'my-lib',
    });
    projectConfig = readProjectConfiguration(tree, 'my-lib');
  });

  it('should copy all files and delete the source folder', async () => {
    const schema: NormalizedSchema = {
      projectName: 'my-lib',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'my-destination',
    };

    moveProjectFiles(tree, schema, projectConfig);

    const destinationChildren = tree.children('my-destination');
    expect(destinationChildren.length).toBeGreaterThan(0);
    expect(tree.exists('my-lib')).toBeFalsy();
  });
});
