import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'path';
import { NormalizedSchema } from '../schema';
import { updateReadme } from './update-readme';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('updateReadme', () => {
  let tree: Tree;
  let schema: NormalizedSchema;

  beforeEach(async () => {
    schema = {
      projectName: 'my-lib',
      destination: 'shared/my-destination',
      importPath: '@proj/shared-my-destination',
      updateImportPath: true,
      newProjectName: 'shared-my-destination',
      relativeToRootDestination: 'libs/shared/my-destination',
    };

    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should handle README.md not existing', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
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
