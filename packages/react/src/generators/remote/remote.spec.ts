import { readWorkspaceConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import remote from './remote';

describe('remote generator', () => {
  it('should not set the remote as the default project', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: false,
      style: 'css',
      unitTestRunner: 'jest',
    });

    const { defaultProject } = readWorkspaceConfiguration(tree);
    expect(defaultProject).toBeUndefined();
  });
});
