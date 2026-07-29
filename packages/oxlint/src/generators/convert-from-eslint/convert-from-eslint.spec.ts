import {
  addProjectConfiguration,
  logger,
  readJson,
  readProjectConfiguration,
} from '@nx/devkit';
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

  it('adds oxlint and @nx/oxlint to devDependencies', async () => {
    const tree = createTreeWithEslintProject();

    await convertFromEslintGenerator(tree, {
      skipFormat: true,
      addExplicitTargets: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['oxlint']).toBeDefined();
    expect(devDependencies['@nx/oxlint']).toBeDefined();
  });

  it('warns when no project has an explicit ESLint target', async () => {
    // The modern default: lint targets come from `@nx/eslint/plugin`, which
    // `getProjects` cannot see, so nothing matches and nothing is added.
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib-a', {
      root: 'libs/lib-a',
      sourceRoot: 'libs/lib-a/src',
      projectType: 'library',
      targets: {},
    });
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await convertFromEslintGenerator(tree, {
      skipFormat: true,
      addExplicitTargets: true,
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Did not add any explicit Oxlint targets')
    );
    warn.mockRestore();
  });

  it('throws when the requested project does not exist', async () => {
    const tree = createTreeWithEslintProject();

    await expect(
      convertFromEslintGenerator(tree, {
        project: 'does-not-exist',
        skipFormat: true,
      })
    ).rejects.toThrow(/does-not-exist/);
  });
});
