import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import { joinPathFragments, updateProjectConfiguration } from '@nrwl/devkit';

import { SetupTailwindOptions } from '../schema';

export function updateProject(
  tree: Tree,
  config: ProjectConfiguration,
  options: SetupTailwindOptions
) {
  if (config?.targets?.build?.executor === '@nrwl/web:webpack') {
    config.targets.build.options ??= {};
    config.targets.build.options.postcssConfig = joinPathFragments(
      config.root,
      'postcss.config.js'
    );
    updateProjectConfiguration(tree, options.project, config);
  }
}
