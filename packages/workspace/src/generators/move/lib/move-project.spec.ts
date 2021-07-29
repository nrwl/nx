import {
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { moveProject } from '@nrwl/workspace/src/generators/move/lib/move-project';
import { libraryGenerator } from '../../library/library';
import { NormalizedSchema } from '../schema';

describe('moveProject', () => {
  let tree: Tree;
  let projectConfig: ProjectConfiguration;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, { name: 'my-lib', standaloneConfig: false });
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

    moveProject(tree, schema, projectConfig);

    const destinationChildren = tree.children('libs/my-destination');
    expect(destinationChildren.length).toBeGreaterThan(0);
    expect(tree.exists('libs/my-lib')).toBeFalsy();
    expect(tree.children('libs')).not.toContain('my-lib');
  });
});
