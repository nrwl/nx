import { readJson, readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { updateReadme } from './update-readme';
import { Schema } from '../schema';
import { libraryGenerator } from '../../library/library';
import { getDestination } from './utils';
import { join } from 'path';

describe('updateReadme', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    schema = {
      projectName: 'my-lib',
      destination: 'shared/my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    tree = createTreeWithEmptyWorkspace();
  });

  it('should handle README.md not existing', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      standaloneConfig: false,
    });

    const projectConfig = readProjectConfiguration(tree, 'my-lib');
    const destination = getDestination(tree, schema, projectConfig);
    const readmePath = join(destination, 'README.md');
    tree.delete(readmePath);

    expect(() => {
      updateReadme(tree, schema, projectConfig);
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

    const projectConfig = readProjectConfiguration(tree, 'my-lib');

    updateReadme(tree, schema, projectConfig);

    const content = tree
      .read('/libs/shared/my-destination/README.md')
      .toString('utf8');
    expect(content).toMatch('# shared-my-destination');
    expect(content).toMatch('nx test shared-my-destination');
  });
});
