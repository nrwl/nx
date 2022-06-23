import {
  logger,
  Tree,
  formatFiles,
  updateProjectConfiguration,
  getProjects,
  TargetConfiguration,
  ProjectConfiguration,
  Target,
  convertNxGenerator,
} from '@nrwl/devkit';
import { findStorybookAndBuildTargetsAndCompiler } from '../../utils/utilities';

export async function changeStorybookTargetsGenerator(tree: Tree) {
  let changesMade = false;
  let changesMadeToAtLeastOne = false;
  const projects = getProjects(tree);
  [...projects.entries()].forEach(([projectName, projectConfiguration]) => {
    changesMade = false;
    const { storybookBuildTarget, storybookTarget, ngBuildTarget } =
      findStorybookAndBuildTargetsAndCompiler(projectConfiguration.targets);
    if (
      projectName &&
      storybookTarget &&
      projectConfiguration?.targets?.[storybookTarget]?.options?.uiFramework ===
        '@storybook/angular'
    ) {
      projectConfiguration.targets[storybookTarget] = updateStorybookTarget(
        projectConfiguration,
        storybookTarget,
        projectName,
        ngBuildTarget,
        storybookBuildTarget
      );
      changesMade = true;
      changesMadeToAtLeastOne = true;
      projectConfiguration.targets[storybookBuildTarget] =
        updateStorybookBuildTarget(
          projectConfiguration,
          projectName,
          ngBuildTarget,
          storybookBuildTarget
        );
    } else {
      logger.warn(`Could not find a Storybook target for ${projectName}.`);
    }
    if (changesMade) {
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  });

  if (changesMadeToAtLeastOne) {
    await formatFiles(tree);
  }
}

function updateStorybookTarget(
  projectConfiguration: ProjectConfiguration,
  storybookTarget: string,
  projectName: string,
  buildTarget: string,
  storybookBuildTarget: string
): TargetConfiguration {
  const oldStorybookTargetConfig: TargetConfiguration =
    projectConfiguration?.targets?.[storybookTarget];
  const newStorybookTargetConfig: TargetConfiguration = {
    executor: '@storybook/angular:start-storybook',
    options: {
      port: oldStorybookTargetConfig.options.port,
      configDir: oldStorybookTargetConfig.options.config?.configFolder,
      browserTarget: undefined,
      compodoc: false,
    },
    configurations: oldStorybookTargetConfig.configurations,
  };

  const { project, target } = parseTargetStringCustom(
    oldStorybookTargetConfig.options.projectBuildConfig
  );
  if (project && target) {
    newStorybookTargetConfig.options.browserTarget =
      oldStorybookTargetConfig.options.projectBuildConfig;
  } else {
    newStorybookTargetConfig.options.browserTarget = `${projectName}:${
      buildTarget ? buildTarget : storybookBuildTarget
    }`;
  }

  const {
    uiFramework,
    outputPath,
    config,
    projectBuildConfig,
    ...optionsToCopy
  } = oldStorybookTargetConfig.options;

  newStorybookTargetConfig.options = {
    ...optionsToCopy,
    ...newStorybookTargetConfig.options,
  };

  return newStorybookTargetConfig;
}

function updateStorybookBuildTarget(
  projectConfiguration: ProjectConfiguration,
  projectName: string,
  buildTarget: string,
  storybookBuildTarget: string
): TargetConfiguration {
  const oldStorybookBuildTargetConfig: TargetConfiguration =
    projectConfiguration?.targets?.[storybookBuildTarget];
  const newStorybookBuildTargetConfig: TargetConfiguration = {
    executor: '@storybook/angular:build-storybook',
    outputs: oldStorybookBuildTargetConfig.outputs,
    options: {
      outputDir: oldStorybookBuildTargetConfig.options.outputPath,
      configDir: oldStorybookBuildTargetConfig.options.config?.configFolder,
      browserTarget: undefined,
      compodoc: false,
    },
    configurations: oldStorybookBuildTargetConfig.configurations,
  };

  const { project, target } = parseTargetStringCustom(
    oldStorybookBuildTargetConfig.options.projectBuildConfig
  );
  if (project && target) {
    newStorybookBuildTargetConfig.options.browserTarget =
      oldStorybookBuildTargetConfig.options.projectBuildConfig;
  } else {
    newStorybookBuildTargetConfig.options.browserTarget = `${projectName}:${
      buildTarget ? buildTarget : storybookBuildTarget
    }`;
  }

  const {
    uiFramework,
    outputPath,
    config,
    projectBuildConfig,
    ...optionsToCopy
  } = oldStorybookBuildTargetConfig.options;

  newStorybookBuildTargetConfig.options = {
    ...optionsToCopy,
    ...newStorybookBuildTargetConfig.options,
  };

  return newStorybookBuildTargetConfig;
}

function parseTargetStringCustom(targetString: string): Target {
  const [project, target, configuration] = targetString.split(':');

  return {
    project,
    target,
    configuration,
  };
}

export default changeStorybookTargetsGenerator;
export const changeStorybookTargetsSchematic = convertNxGenerator(
  changeStorybookTargetsGenerator
);
