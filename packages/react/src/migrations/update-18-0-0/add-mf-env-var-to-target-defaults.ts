import {
  getProjects,
  type Tree,
  type ProjectConfiguration,
  joinPathFragments,
  formatFiles,
} from '@nx/devkit';
import { addMfEnvToTargetDefaultInputs } from '../../utils/add-mf-env-to-inputs';

export default async function (tree: Tree) {
  if (!hasModuleFederationProject(tree)) {
    return;
  }
  addMfEnvToTargetDefaultInputs(tree);

  await formatFiles(tree);
}

function hasModuleFederationProject(tree: Tree) {
  const projects = getProjects(tree);
  for (const project of projects.values()) {
    const targets = project.targets || {};
    for (const [_, target] of Object.entries(targets)) {
      if (
        target.executor === '@nx/webpack:webpack' &&
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
