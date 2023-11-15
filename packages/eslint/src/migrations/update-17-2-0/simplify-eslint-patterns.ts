import {
  ProjectConfiguration,
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';

export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, projectConfiguration] of projects) {
    let needsUpdate = false;

    for (const [targetName, targetConfig] of Object.entries(
      projectConfiguration.targets ?? {}
    )) {
      // this will be in a broken state after the package is globally renamed
      if (targetConfig.executor !== '@nx/eslint:lint') {
        continue;
      }

      needsUpdate = true;
      if (projectConfiguration.targets[targetName].options?.lintFilePatterns) {
        const rootPattern = getLintRoot(projectConfiguration);
        const nonRootPatterns = projectConfiguration.targets[
          targetName
        ].options.lintFilePatterns.filter((p) => !p.startsWith(rootPattern));
        projectConfiguration.targets[targetName].options.lintFilePatterns = [
          getLintRoot(projectConfiguration),
          ...nonRootPatterns,
        ];
      }
    }

    if (needsUpdate) {
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  }

  await formatFiles(tree);
}

function getLintRoot({ root, sourceRoot }: ProjectConfiguration) {
  if (root === '' || root === '.') {
    return sourceRoot || './src';
  }
  return root;
}
