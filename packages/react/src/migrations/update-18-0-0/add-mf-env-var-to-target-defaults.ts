import {
  getProjects,
  type Tree,
  type ProjectConfiguration,
  joinPathFragments,
  formatFiles,
} from '@nx/devkit';
import { addMfEnvToTargetDefaultInputs } from '../../utils/add-mf-env-to-inputs';

export default async function (tree: Tree) {
  const bundler = hasModuleFederationProject(tree);
  if (!bundler) {
    return;
  }
  addMfEnvToTargetDefaultInputs(tree, bundler);

  await formatFiles(tree);
}

function hasModuleFederationProject(tree: Tree) {
  const projects = getProjects(tree);
  for (const project of projects.values()) {
    const targets = project.targets || {};
    for (const [_, target] of Object.entries(targets)) {
      if (
        tree.exists(
          joinPathFragments(project.root, 'module-federation.config.ts')
        ) ||
        tree.exists(
          joinPathFragments(project.root, 'module-federation.config.js')
        )
      ) {
        if (target.executor === '@nx/webpack:webpack') {
          return 'webpack';
        } else if (target.executor === '@nx/rspack:rspack') {
          return 'rspack';
        }
      }
    }
  }
  return false;
}
