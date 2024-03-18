import {
  addDependenciesToPackageJson,
  getProjects,
  joinPathFragments,
  Tree,
} from '@nx/devkit';

export async function update(tree: Tree) {
  const projects = getProjects(tree);
  const missingDeps = {};

  for (const [, config] of projects) {
    if (
      config.targets?.build?.executor === '@nrwl/next:build' &&
      tree.exists(joinPathFragments(config.root, 'next.config.js'))
    ) {
      const nextConfigContent = tree.read(
        joinPathFragments(config.root, 'next.config.js'),
        'utf-8'
      );

      if (nextConfigContent.includes('@nrwl/next/plugins/with-less')) {
        missingDeps['less'] = '3.12.2';
      }

      if (nextConfigContent.includes('@nrwl/next/plugins/with-stylus')) {
        missingDeps['stylus'] = '^0.55.0';
      }
    }
  }

  return addDependenciesToPackageJson(tree, {}, missingDeps);
}

export default update;
