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
      if (targetConfig.executor !== '@nx/eslint:lint') {
        continue;
      }

      needsUpdate = true;
      if (projectConfiguration.targets[targetName].options?.lintFilePatterns) {
        const rootPattern = getLintRoot(projectConfiguration);
        const nonRootPatterns = projectConfiguration.targets[
          targetName
        ].options.lintFilePatterns.filter(
          (p) => !p.startsWith(rootPattern) && !p.startsWith('{projectRoot}')
        );

        if (
          nonRootPatterns.length === 0 &&
          rootPattern === projectConfiguration.root
        ) {
          // delete the lintFilePatterns option if it's the only option and matches the root of the project
          delete projectConfiguration.targets[targetName].options
            .lintFilePatterns;
          if (
            Object.keys(projectConfiguration.targets[targetName].options)
              .length === 0
          ) {
            delete projectConfiguration.targets[targetName].options;
          }
        } else {
          projectConfiguration.targets[targetName].options.lintFilePatterns = [
            rootPattern,
            ...nonRootPatterns,
          ];
        }
      }
    }

    if (needsUpdate) {
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  }

  await formatFiles(tree);
}

function getLintRoot({ root, sourceRoot }: ProjectConfiguration): string {
  if (root === '' || root === '.') {
    return sourceRoot || './src';
  }
  return root;
}
