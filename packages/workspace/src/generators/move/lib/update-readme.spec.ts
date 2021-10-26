import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { join } from 'path';
import { libraryGenerator } from '../../library/library';
import { NormalizedSchema } from '../schema';
import { updateReadme } from './update-readme';

describe('updateReadme', () => {
  let tree: Tree;
  let schema: NormalizedSchema;

  beforeEach(async () => {
    schema = {
      projectName: 'my-lib',
      destination: 'shared/my-destination',
      importPath: '@proj/shared/my-destination',
      updateImportPath: true,
      newProjectName: 'shared-my-destination',
      relativeToRootDestination: 'libs/shared/my-destination',
    };

    tree = createTreeWithEmptyWorkspace();
  });

  it('should handle README.md not existing', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      standaloneConfig: false,
    });
    const readmePath = join(schema.relativeToRootDestination, 'README.md');
    tree.delete(readmePath);

    expect(() => {
      updateReadme(tree, schema);
    }).not.toThrow();
  });

  it('should update README.md contents', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      standaloneConfig: false,
    });
    // This step is usually handled elsewhere
    tree.rename(
      'libs/my-lib/README.md',
      'libs/shared/my-destination/README.md'
    );

    updateReadme(tree, schema);

    const content = tree
      .read('/libs/shared/my-destination/README.md')
      .toString('utf8');
    expect(content).toMatch('# shared-my-destination');
    expect(content).toMatch('nx test shared-my-destination');
  });
});
