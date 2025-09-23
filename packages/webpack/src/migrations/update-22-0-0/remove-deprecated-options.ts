import {
  formatFiles,
  getProjects,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName] of projects) {
    const projectConfig = readProjectConfiguration(tree, projectName);

    let hasChanges = false;

    if (projectConfig.targets) {
      for (const [targetName, targetConfig] of Object.entries(
        projectConfig.targets
      )) {
        if (
          targetConfig.executor === '@nx/webpack:webpack' ||
          targetConfig.executor === '@nrwl/webpack:webpack'
        ) {
          if (targetConfig.options) {
            if ('deleteOutputPath' in targetConfig.options) {
              delete targetConfig.options.deleteOutputPath;
              hasChanges = true;
              console.log(
                `Removed deprecated 'deleteOutputPath' option from ${projectName}:${targetName}. Use the 'output.clean' option in Webpack configuration instead.`
              );
            }
            if ('sassImplementation' in targetConfig.options) {
              delete targetConfig.options.sassImplementation;
              hasChanges = true;
              console.log(
                `Removed deprecated 'sassImplementation' option from ${projectName}:${targetName}. This option is no longer needed.`
              );
            }
          }

          if (targetConfig.configurations) {
            for (const [configName, config] of Object.entries(
              targetConfig.configurations
            )) {
              if ('deleteOutputPath' in config) {
                delete config.deleteOutputPath;
                hasChanges = true;
                console.log(
                  `Removed deprecated 'deleteOutputPath' option from ${projectName}:${targetName}:${configName}. Use the 'output.clean' option in Webpack configuration instead.`
                );
              }
              if ('sassImplementation' in config) {
                delete config.sassImplementation;
                hasChanges = true;
                console.log(
                  `Removed deprecated 'sassImplementation' option from ${projectName}:${targetName}:${configName}. This option is no longer needed.`
                );
              }
            }
          }
        }
      }
    }

    if (hasChanges) {
      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  }

  await formatFiles(tree);
}
