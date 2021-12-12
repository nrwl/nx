import {
  formatFiles,
  getProjects,
  parseTargetString,
  ProjectConfiguration,
  Target,
  TargetConfiguration,
  targetToTargetString,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export default async function convertWebpackBrowserBuildTargetToDelegateBuild(
  host: Tree
) {
  const projects = getProjects(host);

  for (const [projectName, project] of projects) {
    const webpackBrowserTargets = Object.values(project.targets || {}).filter(
      (target) => target.executor === '@nrwl/angular:webpack-browser'
    );
    for (const target of webpackBrowserTargets) {
      const configurationOptions = getTargetConfigurationOptions(target);
      const buildTargetName = getBuildTargetNameFromOptions(
        target.options,
        configurationOptions
      );
      if (buildTargetName) {
        target.executor = '@nrwl/angular:delegate-build';
        updateTargetsOptions(project, target, buildTargetName);
        updateTargetsConfigurations(
          project,
          projectName,
          target,
          buildTargetName,
          configurationOptions
        );
      }
    }

    updateProjectConfiguration(host, projectName, project);
  }

  await formatFiles(host);
}

function cleanupBuildTargetProperties(options: {
  tsConfig: string;
  outputPath: string;
}): void {
  delete options.tsConfig;
  delete options.outputPath;
}

function extractConfigurationBuildTarget(
  project: string,
  target: string,
  configuration: string,
  buildTarget: string
): Target {
  if (buildTarget) {
    const buildTargetObj = parseTargetString(buildTarget);
    return {
      ...buildTargetObj,
      configuration: buildTargetObj.configuration ?? configuration,
    };
  }

  return {
    project: project,
    target: target,
    configuration: configuration,
  };
}

function getBuildTargetNameFromOptions(
  baseOptions: any,
  configurationOptions: Map<string, any>
): string {
  if (baseOptions.buildTarget) {
    return parseTargetString(baseOptions.buildTarget).target;
  }
  for (const [, options] of configurationOptions) {
    if (options.buildTarget) {
      return parseTargetString(options.buildTarget).target;
    }
  }
}

function getTargetConfigurationOptions(
  target: TargetConfiguration
): Map<string, any> {
  const targets = new Map<string, any>();
  if (target.configurations) {
    for (const [name, options] of Object.entries(target.configurations)) {
      if (options !== undefined) {
        targets.set(name, options);
      }
    }
  }

  return targets;
}

function updateTargetsConfigurations(
  project: ProjectConfiguration,
  projectName: string,
  target: TargetConfiguration,
  buildTargetName: string,
  configurationOptions: any
) {
  for (const [configurationName, options] of configurationOptions) {
    const { buildTarget, tsConfig, outputPath, ...delegateTargetOptions } =
      options;

    const configurationBuildTarget = extractConfigurationBuildTarget(
      projectName,
      buildTargetName,
      configurationName,
      buildTarget
    );
    if (!project.targets[buildTargetName].configurations) {
      project.targets[buildTargetName].configurations = {};
    }
    // Update build target configuration options by overwriting them
    const buildTargetConfigurations =
      project.targets[buildTargetName].configurations;
    buildTargetConfigurations[configurationBuildTarget.configuration] = {
      ...buildTargetConfigurations[configurationBuildTarget.configuration],
      ...delegateTargetOptions,
    };
    // Delete options already present in the source target
    cleanupBuildTargetProperties(
      buildTargetConfigurations[configurationBuildTarget.configuration]
    );
    // Update source target configuration with buildTarget
    target.configurations[configurationName] = {
      buildTarget: targetToTargetString(configurationBuildTarget),
      tsConfig,
      outputPath,
    };
  }
}

function updateTargetsOptions(
  project: ProjectConfiguration,
  target: TargetConfiguration,
  buildTargetName: string
) {
  if (target.options) {
    const { buildTarget, tsConfig, outputPath, ...delegateTargetOptions } =
      target.options;
    // Update build target options by overwriting them
    project.targets[buildTargetName].options = {
      ...project.targets[buildTargetName].options,
      ...delegateTargetOptions,
    };
    // Delete options already present in the source target
    cleanupBuildTargetProperties(project.targets[buildTargetName].options);
    // Update source target options to only contain what it needs
    target.options = {
      buildTarget,
      tsConfig,
      outputPath,
    };
  }
}
