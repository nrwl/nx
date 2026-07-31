import {
  addProjectConfiguration,
  logger,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
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

  it('warns naming the project when the target name is taken by something else', async () => {
    const tree = createTreeWithEslintProject();
    const config = readProjectConfiguration(tree, 'lib-a');
    config.targets.oxlint = {
      executor: 'nx:run-commands',
      options: { command: 'echo hi' },
    };
    updateProjectConfiguration(tree, 'lib-a', config);
    // A second project converts cleanly, so the aggregate "nothing converted"
    // warning cannot be what reports lib-a being skipped.
    addProjectConfiguration(tree, 'lib-b', {
      root: 'libs/lib-b',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: { lintFilePatterns: ['{projectRoot}'] },
        },
      },
    });
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await convertFromEslintGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
      addExplicitTargets: true,
    });

    expect(warn.mock.calls.flat().join('\n')).toContain('lib-a');
    // lib-a's hand-written target must survive untouched.
    expect(readProjectConfiguration(tree, 'lib-a').targets.oxlint).toEqual({
      executor: 'nx:run-commands',
      options: { command: 'echo hi' },
    });
    warn.mockRestore();
  });

  it('does not claim there was no ESLint target when re-run on a converted tree', async () => {
    const tree = createTreeWithEslintProject();
    const run = () =>
      convertFromEslintGenerator(tree, {
        skipPackageJson: true,
        skipFormat: true,
        addExplicitTargets: true,
      });

    await run();
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    await run();

    expect(warn.mock.calls.flat().join('\n')).not.toContain(
      'no project has an explicit @nx/eslint:lint target'
    );
    warn.mockRestore();
  });

  it('reports the narrowed project, not the workspace, when --project has no ESLint target', async () => {
    // lib-a does have one, so the workspace-wide claim would be false.
    const tree = createTreeWithEslintProject();
    addProjectConfiguration(tree, 'lib-b', {
      root: 'libs/lib-b',
      projectType: 'library',
      targets: {},
    });
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await convertFromEslintGenerator(tree, {
      project: 'lib-b',
      skipPackageJson: true,
      skipFormat: true,
      addExplicitTargets: true,
    });

    const warnings = warn.mock.calls.flat().join('\n');
    expect(warnings).not.toContain('no project has an explicit');
    expect(warnings).toContain('lib-b');
    warn.mockRestore();
  });

  it('registers the plugin by default', async () => {
    const tree = createTreeWithEslintProject();

    await convertFromEslintGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
      addExplicitTargets: true,
    });

    expect(readNxJson(tree).plugins).toContainEqual(
      expect.objectContaining({ plugin: '@nx/oxlint' })
    );
  });

  it('honours useInferencePlugins: false instead of registering the plugin', async () => {
    const tree = createTreeWithEslintProject();
    updateNxJson(tree, { ...readNxJson(tree), useInferencePlugins: false });

    await convertFromEslintGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
      addExplicitTargets: true,
    });

    const nxJson = readNxJson(tree);
    expect(nxJson.plugins ?? []).not.toContainEqual(
      expect.objectContaining({ plugin: '@nx/oxlint' })
    );
    // The explicit targets this generator adds are executor targets, so they
    // are cached only if init took the targetDefaults branch.
    expect(nxJson.targetDefaults['@nx/oxlint:lint']).toMatchObject({
      cache: true,
    });
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
