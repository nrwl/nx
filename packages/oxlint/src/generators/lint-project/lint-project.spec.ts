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

  it('falls through to a further name when lint and oxlint are both taken', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib-a', {
      root: 'libs/lib-a',
      sourceRoot: 'libs/lib-a/src',
      projectType: 'library',
      targets: {
        lint: { executor: '@nx/eslint:lint' },
        oxlint: { executor: 'nx:run-commands' },
      },
    });

    await lintProjectGeneratorInternal(tree, {
      project: 'lib-a',
      addPlugin: false,
      skipPackageJson: true,
      skipFormat: true,
    });

    const { targets } = readProjectConfiguration(tree, 'lib-a');
    // The user asked for an Oxlint target; declining to add one at all would be
    // a silent no-op reported as success.
    const oxlintTargets = Object.entries(targets)
      .filter(([, t]) => t.executor === '@nx/oxlint:lint')
      .map(([name]) => name);
    expect(oxlintTargets).toEqual(['oxlint-lint']);
    expect(targets.lint.executor).toEqual('@nx/eslint:lint');
    expect(targets.oxlint.executor).toEqual('nx:run-commands');
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
