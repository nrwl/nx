import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { lintProjectGeneratorInternal } from './lint-project';

describe('lintProjectGeneratorInternal', () => {
  it('adds explicit target when plugin is disabled', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib-a', {
      root: 'libs/lib-a',
      sourceRoot: 'libs/lib-a/src',
      projectType: 'library',
      targets: {},
    });

    await lintProjectGeneratorInternal(tree, {
      project: 'lib-a',
      addPlugin: false,
      skipPackageJson: true,
      skipFormat: true,
    });

    const project = readProjectConfiguration(tree, 'lib-a');
    expect(project.targets.oxlint).toBeDefined();
  });
});
