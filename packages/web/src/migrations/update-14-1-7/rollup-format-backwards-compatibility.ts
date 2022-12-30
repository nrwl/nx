import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

/*
 *
 */
export default async function update(tree: Tree) {
  for (const [name, config] of getProjects(tree)) {
    if (config.targets?.build?.executor !== '@nrwl/web:rollup') continue;
    if (Array.isArray(config.targets.build.options?.format)) continue;

    config.targets.build.options = {
      ...config.targets.build.options,
      format: ['esm', 'cjs'],
    };

    updateProjectConfiguration(tree, name, config);
  }
  await formatFiles(tree);
}
