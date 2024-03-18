import {
  getProjects,
  type Tree,
  type ProjectConfiguration,
  joinPathFragments,
  formatFiles,
} from '@nx/devkit';
import { addMfEnvToTargetDefaultInputs } from '../../generators/utils/add-mf-env-to-inputs';

export default async function (tree: Tree) {
  if (!isWebpackBrowserUsed(tree)) {
    return;
  }
  addMfEnvToTargetDefaultInputs(tree);

  await formatFiles(tree);
}

function isWebpackBrowserUsed(tree: Tree) {
  const projects = getProjects(tree);
  for (const project of projects.values()) {
    const targets = project.targets || {};
    for (const [_, target] of Object.entries(targets)) {
      if (
        target.executor === '@nx/angular:webpack-browser' &&
        (tree.exists(
          joinPathFragments(project.root, 'module-federation.config.ts')
        ) ||
          tree.exists(
            joinPathFragments(project.root, 'module-federation.config.js')
          ))
      ) {
        return true;
      }
    }
  }
  return false;
}
