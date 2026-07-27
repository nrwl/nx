import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertFromEslintGenerator } from './convert-from-eslint.js';

function createTreeWithEslintProject() {
  const tree = createTreeWithEmptyWorkspace();
  addProjectConfiguration(tree, 'lib-a', {
    root: 'libs/lib-a',
    sourceRoot: 'libs/lib-a/src',
    projectType: 'library',
    targets: {
      lint: {
        executor: '@nx/eslint:lint',
        options: { lintFilePatterns: ['{projectRoot}'] },
      },
    },
  });
  return tree;
}

describe('convertFromEslintGenerator', () => {
  it('adds an oxlint target alongside the eslint target', async () => {
    const tree = createTreeWithEslintProject();

    await convertFromEslintGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
      addExplicitTargets: true,
    });

    const updated = readProjectConfiguration(tree, 'lib-a');
    expect(updated.targets.oxlint).toEqual({
      executor: '@nx/oxlint:lint',
      options: { lintFilePatterns: ['{projectRoot}'] },
    });
  });

  it('leaves the existing eslint target untouched', async () => {
    const tree = createTreeWithEslintProject();

    await convertFromEslintGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
      addExplicitTargets: true,
    });

    expect(readProjectConfiguration(tree, 'lib-a').targets.lint).toEqual({
      executor: '@nx/eslint:lint',
      options: { lintFilePatterns: ['{projectRoot}'] },
    });
  });

  it('returns the install callback so oxlint actually gets installed', async () => {
    const tree = createTreeWithEslintProject();

    const task = await convertFromEslintGenerator(tree, {
      skipFormat: true,
      addExplicitTargets: true,
    });

    expect(typeof task).toEqual('function');
  });
});
