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
    await libraryGenerator(tree, { name: 'my-lib' });
    projectConfig = readProjectConfiguration(tree, 'my-lib');
  });

  it('should copy all files and delete the source folder', async () => {
    const schema: NormalizedSchema = {
      projectName: 'my-lib',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'libs/my-destination',
    };

    moveProjectFiles(tree, schema, projectConfig);

    const destinationChildren = tree.children('libs/my-destination');
    expect(destinationChildren.length).toBeGreaterThan(0);
    expect(tree.exists('libs/my-lib')).toBeFalsy();
    expect(tree.children('libs')).not.toContain('my-lib');
  });
});
