import { GeneratorCallback, Tree, ensurePackage } from '@nx/devkit';
import type { StorybookConfigurationOptions } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function generateStorybookConfiguration(
  tree: Tree,
  options: StorybookConfigurationOptions
): Promise<GeneratorCallback> {
  const { configurationGenerator } = ensurePackage<
    typeof import('@nx/storybook')
  >('@nx/storybook', nxVersion);
  return await configurationGenerator(tree, {
    project: options.project,
    uiFramework: '@storybook/angular',
    // `@nx/storybook` is not a dependency here, so it resolves to the published
    // package, whose schema types `linter` from an `@nx/eslint` that predates
    // oxlint. Safe to coerce: the storybook generator ignores this option and
    // decides from `findEslintFile`.
    linter: options.linter === 'eslint' ? 'eslint' : 'none',
    tsConfiguration: options.tsConfiguration,
    interactionTests: options.interactionTests,
    configureStaticServe: options.configureStaticServe,
    skipFormat: true,
    addPlugin: false,
    addExplicitTargets: true,
  });
}
