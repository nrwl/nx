import {
  logger,
  Tree,
  formatFiles,
  updateProjectConfiguration,
  getProjects,
} from '@nrwl/devkit';
import { findStorybookAndBuildTargets } from '../../utils/utilities';

export default async function setProjectBuildConfig(tree: Tree) {
  let changesMade = false;
  const projects = getProjects(tree);
  [...projects.entries()].forEach(([projectName, projectConfiguration]) => {
    const { storybookBuildTarget, storybookTarget, buildTarget } =
      findStorybookAndBuildTargets(projectConfiguration.targets);
    if (
      projectName &&
      storybookTarget &&
      projectConfiguration?.targets?.[storybookTarget]?.options?.uiFramework ===
        '@storybook/angular'
    ) {
      if (buildTarget) {
        if (
          !projectConfiguration.targets[storybookTarget].options
            .projectBuildConfig
        ) {
          projectConfiguration.targets[
            storybookTarget
          ].options.projectBuildConfig = projectName;
          changesMade = true;
        }
        if (
          storybookBuildTarget &&
          !projectConfiguration.targets[storybookBuildTarget].options
            .projectBuildConfig
        ) {
          projectConfiguration.targets[
            storybookBuildTarget
          ].options.projectBuildConfig = projectName;
          changesMade = true;
        }
      } else {
        if (storybookBuildTarget) {
          if (
            !projectConfiguration.targets[storybookTarget].options
              .projectBuildConfig
          ) {
            projectConfiguration.targets[
              storybookTarget
            ].options.projectBuildConfig = `${projectName}:${storybookBuildTarget}`;
            changesMade = true;
          }
          if (
            !projectConfiguration.targets[storybookBuildTarget].options
              .projectBuildConfig
          ) {
            projectConfiguration.targets[
              storybookBuildTarget
            ].options.projectBuildConfig = `${projectName}:${storybookBuildTarget}`;
            changesMade = true;
          }
        } else {
          logger.warn(`Could not find a build target for ${projectName}.`);
        }
      }

      if (changesMade) {
        updateProjectConfiguration(tree, projectName, projectConfiguration);
      }
    }
  });

  if (changesMade) {
    await formatFiles(tree);
  }
}
