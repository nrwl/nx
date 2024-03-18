import { readProjectConfiguration, type Tree } from '@nx/devkit';

export function isBuildableLibraryProject(
  tree: Tree,
  projectName: string
): boolean {
  const projectConfig = readProjectConfiguration(tree, projectName);

  return (
    projectConfig.projectType === 'library' && !!projectConfig.targets?.build
  );
}
