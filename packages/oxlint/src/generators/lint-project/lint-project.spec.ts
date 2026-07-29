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

  it('does not add a second target when run twice', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib-a', {
      root: 'libs/lib-a',
      sourceRoot: 'libs/lib-a/src',
      projectType: 'library',
      targets: {},
    });

    const options = {
      project: 'lib-a',
      addPlugin: false,
      skipPackageJson: true,
      skipFormat: true,
    };
    await lintProjectGeneratorInternal(tree, options);
    await lintProjectGeneratorInternal(tree, options);

    const { targets } = readProjectConfiguration(tree, 'lib-a');
    const oxlintTargets = Object.entries(targets).filter(
      ([, target]) => target.executor === '@nx/oxlint:lint'
    );
    expect(oxlintTargets.map(([name]) => name)).toEqual(['lint']);
  });

  it('leaves a hand-tuned Oxlint target alone', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib-a', {
      root: 'libs/lib-a',
      sourceRoot: 'libs/lib-a/src',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/oxlint:lint',
          options: { lintFilePatterns: ['libs/lib-a/src'], typeAware: true },
        },
      },
    });

    await lintProjectGeneratorInternal(tree, {
      project: 'lib-a',
      addPlugin: false,
      skipPackageJson: true,
      skipFormat: true,
    });

    const { targets } = readProjectConfiguration(tree, 'lib-a');
    expect(targets.lint.options).toEqual({
      lintFilePatterns: ['libs/lib-a/src'],
      typeAware: true,
    });
    expect(targets.oxlint).toBeUndefined();
  });
});
