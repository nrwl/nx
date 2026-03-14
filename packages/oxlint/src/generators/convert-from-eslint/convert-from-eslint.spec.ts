import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { convertFromEslintGenerator } from './convert-from-eslint';

describe('convertFromEslintGenerator', () => {
  it('adds oxlint target from eslint target', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib-a', {
      root: 'libs/lib-a',
      sourceRoot: 'libs/lib-a/src',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['{projectRoot}'],
          },
        },
      },
    });

    await convertFromEslintGenerator(tree, {
      skipPackageJson: true,
      skipFormat: true,
      addExplicitTargets: true,
    });

    const updated = readProjectConfiguration(tree, 'lib-a');
    expect(updated.targets.oxlint).toEqual({
      executor: '@nx/oxlint:lint',
      options: {
        lintFilePatterns: ['{projectRoot}'],
      },
    });
  });
});
