import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { migrateDefaultsGenerator } from '@nrwl/storybook';
import storybookConfigurationGenerator from '../storybook-configuration/storybook-configuration';
import type { StorybookMigrateDefault5to6Schema } from './schema';

export function storybookMigrateDefaults5To6Generator(
  tree: Tree,
  options: StorybookMigrateDefault5to6Schema
): GeneratorCallback {
  return migrateDefaultsGenerator(tree, {
    name: options.name,
    all: options.all,
    keepOld: options.keepOld,
  });
}

export default storybookConfigurationGenerator;
