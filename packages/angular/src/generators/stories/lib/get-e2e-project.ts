import type {
  NxJsonProjectConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { readProjectConfiguration } from '@nrwl/devkit';

export function getE2EProject(
  tree: Tree,
  e2eProjectName: string
): ProjectConfiguration {
  let e2eProject: ProjectConfiguration;
  try {
    e2eProject = readProjectConfiguration(tree, e2eProjectName);
  } catch {
    e2eProject = undefined;
  }

  return e2eProject;
}
