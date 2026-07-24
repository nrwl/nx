import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { lintProjectGeneratorInternal } from './lint-project.js';

describe('lintProjectGeneratorInternal', () => {
  it('adds an explicit target when the plugin is disabled', async () => {
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

    expect(readProjectConfiguration(tree, 'lib-a').targets.lint).toMatchObject({
      executor: '@nx/oxlint:lint',
    });
  });

  it('steps aside to `oxlint` when another linter owns `lint`', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib-a', {
      root: 'libs/lib-a',
      sourceRoot: 'libs/lib-a/src',
      projectType: 'library',
      targets: {
        lint: { executor: '@nx/eslint:lint' },
      },
    });

    await lintProjectGeneratorInternal(tree, {
      project: 'lib-a',
      addPlugin: false,
      skipPackageJson: true,
      skipFormat: true,
    });

    const project = readProjectConfiguration(tree, 'lib-a');
    expect(project.targets.lint.executor).toEqual('@nx/eslint:lint');
    expect(project.targets.oxlint).toMatchObject({
      executor: '@nx/oxlint:lint',
    });
  });
});
