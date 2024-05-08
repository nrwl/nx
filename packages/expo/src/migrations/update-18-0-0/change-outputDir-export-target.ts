import {
  Tree,
  getProjects,
  offsetFromRoot,
  updateProjectConfiguration,
} from '@nx/devkit';

/**
 * Remove the offset from the outputDir of the export target
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, config] of projects.entries()) {
    if (config.targets?.['export']?.executor === '@nx/expo:export') {
      const target = config.targets['export'];
      if (target.options?.outputDir) {
        const offset = offsetFromRoot(config.root);
        target.options.outputDir = target.options.outputDir.replace(offset, '');
        target.outputs = ['{options.outputDir}'];
        updateProjectConfiguration(tree, projectName, config);
      }
    }
    if (config.targets?.['export-web']?.executor === '@nx/expo:export') {
      delete config.targets['export-web'];
      updateProjectConfiguration(tree, projectName, config);
    }
  }
}
