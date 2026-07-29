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
    // `@nx/storybook`'s schema types `linter` from the *published* `@nx/eslint`,
    // whose `LinterType` predates oxlint, so `'oxlint'` does not typecheck here
    // until that version ships. Coercing is safe: the storybook generator never
    // reads this option — it decides what to do from `findEslintFile` instead —
    // so all three values produce identical output.
    linter: options.linter === 'eslint' ? 'eslint' : 'none',
    tsConfiguration: options.tsConfiguration,
    interactionTests: options.interactionTests,
    configureStaticServe: options.configureStaticServe,
    skipFormat: true,
    addPlugin: false,
    addExplicitTargets: true,
  });
}
