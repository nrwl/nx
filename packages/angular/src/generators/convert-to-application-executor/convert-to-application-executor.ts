import {
  addDependenciesToPackageJson,
  formatFiles,
  logger,
  readJson,
  readProjectConfiguration,
  updateProjectConfiguration,
  writeJson,
  type GeneratorCallback,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { dirname, join } from 'node:path/posix';
import { gte, lt } from 'semver';
import { getProjectsFilteredByDependencies } from '../../migrations/utils/projects';
import { allProjectTargets, allTargetOptions } from '../../utils/targets';
import { setupSsr } from '../setup-ssr/setup-ssr';
import {
  getInstalledAngularVersionInfo,
  versions,
} from '../utils/version-utils';
import type { GeneratorOptions } from './schema';

const enum Builders {
  Application = '@angular-devkit/build-angular:application',
  AppShell = '@angular-devkit/build-angular:app-shell',
  Server = '@angular-devkit/build-angular:server',
  Browser = '@angular-devkit/build-angular:browser',
  SsrDevServer = '@angular-devkit/build-angular:ssr-dev-server',
  Prerender = '@angular-devkit/build-angular:prerender',
  BrowserEsbuild = '@angular-devkit/build-angular:browser-esbuild',
  DevServer = '@angular-devkit/build-angular:dev-server',
  ExtractI18n = '@angular-devkit/build-angular:extract-i18n',
}
const enum Executors {
  Application = '@nx/angular:application',
  Server = '@nx/angular:webpack-server',
  Browser = '@nx/angular:webpack-browser',
  BrowserEsbuild = '@nx/angular:browser-esbuild',
}

const executorsToConvert = new Set<string>([
  Builders.Browser,
  Builders.BrowserEsbuild,
  Executors.Browser,
  Executors.BrowserEsbuild,
]);
const serverTargetExecutors = new Set<string>([
  Builders.Server,
  Executors.Server,
]);
const redundantExecutors = new Set<string>([
  Builders.Server,
  Builders.Prerender,
  Builders.AppShell,
  Builders.SsrDevServer,
  Executors.Server,
]);
const angularDevkitToAngularBuild = new Map<string, string>([
  [Builders.Application, '@angular/build:application'],
  [Builders.DevServer, '@angular/build:dev-server'],
  [Builders.ExtractI18n, '@angular/build:extract-i18n'],
]);

export async function convertToApplicationExecutor(
  tree: Tree,
  options: GeneratorOptions
) {
  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  if (angularMajorVersion < 17) {
    throw new Error(
      `The "convert-to-application-executor" generator is only supported in Angular >= 17.0.0. You are currently using "${angularVersion}".`
    );
  }

  const angularProjects = await getAngularProjects(tree);

  let didAnySucceed = false;
  if (options.project) {
    const project = angularProjects.get(options.project);
    if (!project) {
      throw new Error(
        `Project "${options.project}" does not exist! Please provide an existing project name.`
      );
    }

    didAnySucceed = await convertProjectTargets(
      tree,
      options.project,
      project,
      angularVersion,
      true
    );
  } else {
    for (const [projectName, project] of angularProjects) {
      logger.info(`Converting project "${projectName}"...`);
      const success = await convertProjectTargets(
        tree,
        projectName,
        project,
        angularVersion
      );

      if (success) {
        logger.info(`Project "${projectName}" converted successfully.`);
      } else {
        logger.info(
          `Project "${projectName}" could not be converted. See above for more information.`
        );
      }
      logger.info('');
      didAnySucceed = didAnySucceed || success;
    }
  }

  let task: GeneratorCallback = () => {};
  // Use @angular/build directly if not using executors that are only exposed in the angular devkit
  if (
    didAnySucceed &&
    angularMajorVersion >= 18 &&
    !hasAngularDevkitOnlyExecutors(angularProjects)
  ) {
    for (const [projectName, project] of angularProjects) {
      for (const target of allProjectTargets(project)) {
        if (angularDevkitToAngularBuild.has(target.executor)) {
          target.executor = angularDevkitToAngularBuild.get(target.executor);
        }
      }
      updateProjectConfiguration(tree, projectName, project);
    }

    task = installAngularBuildPackage(tree);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return task;
}

async function convertProjectTargets(
  tree: Tree,
  projectName: string,
  project: ProjectConfiguration,
  angularVersion: string,
  isProvidedProject = false
): Promise<boolean> {
  function warnIfProvided(message: string): void {
    if (isProvidedProject) {
      logger.warn(message);
    }
  }

  if (project.projectType !== 'application') {
    warnIfProvided(
      `The provided project "${projectName}" is not an application. Skipping conversion.`
    );
    return false;
  }

  const { buildTargetName, serverTargetName } = getTargetsToConvert(
    project.targets,
    angularVersion
  );
  if (!buildTargetName) {
    warnIfProvided(
      `The provided project "${projectName}" does not have any targets using on of the ` +
        `'${Builders.Browser}', '${Builders.BrowserEsbuild}', '${Executors.Browser}' ` +
        `and '${Executors.BrowserEsbuild}' executors. Skipping conversion.`
    );
    return false;
  }

  const useNxExecutor =
    project.targets[buildTargetName].executor.startsWith('@nx/angular:');
  const newExecutor = useNxExecutor
    ? Executors.Application
    : Builders.Application;

  const buildTarget = project.targets[buildTargetName];
  buildTarget.executor = newExecutor;

  if (gte(angularVersion, '17.1.0') && buildTarget.outputs) {
    buildTarget.outputs = buildTarget.outputs.map((output) =>
      output === '{options.outputPath}' ? '{options.outputPath.base}' : output
    );
  }

  for (const [, options] of allTargetOptions(buildTarget)) {
    if (options['index'] === '') {
      options['index'] = false;
    }

    // Rename and transform options
    options['browser'] = options['main'];
    if (serverTargetName && typeof options['browser'] === 'string') {
      options['server'] = dirname(options['browser']) + '/main.server.ts';
    }
    options['serviceWorker'] =
      options['ngswConfigPath'] ?? options['serviceWorker'];

    if (typeof options['polyfills'] === 'string') {
      options['polyfills'] = [options['polyfills']];
    }

    let outputPath = options['outputPath'];
    if (lt(angularVersion, '17.1.0')) {
      options['outputPath'] = outputPath?.replace(/\/browser\/?$/, '');
    } else if (typeof outputPath === 'string') {
      if (!/\/browser\/?$/.test(outputPath)) {
        logger.warn(
          `The output location of the browser build has been updated from "${outputPath}" to ` +
            `"${join(outputPath, 'browser')}". ` +
            'You might need to adjust your deployment pipeline or, as an alternative, ' +
            'set outputPath.browser to "" in order to maintain the previous functionality.'
        );
      } else {
        outputPath = outputPath.replace(/\/browser\/?$/, '');
      }

      options['outputPath'] = {
        base: outputPath,
      };

      if (typeof options['resourcesOutputPath'] === 'string') {
        const media = options['resourcesOutputPath'].replaceAll('/', '');
        if (media && media !== 'media') {
          options['outputPath'] = {
            base: outputPath,
            media: media,
          };
        }
      }
    }

    // Delete removed options
    if (lt(angularVersion, '17.3.0')) {
      delete options['deployUrl'];
    }
    delete options['vendorChunk'];
    delete options['commonChunk'];
    delete options['resourcesOutputPath'];
    delete options['buildOptimizer'];
    delete options['main'];
    delete options['ngswConfigPath'];
  }

  // Merge browser and server tsconfig
  if (serverTargetName) {
    const browserTsConfigPath = buildTarget?.options?.tsConfig;
    const serverTsConfigPath = project.targets['server']?.options?.tsConfig;

    if (typeof browserTsConfigPath !== 'string') {
      logger.warn(
        `Cannot update project "${projectName}" to use the application executor ` +
          `as the browser tsconfig cannot be located.`
      );
    }

    if (typeof serverTsConfigPath !== 'string') {
      logger.warn(
        `Cannot update project "${projectName}" to use the application executor ` +
          `as the server tsconfig cannot be located.`
      );
    }

    const browserTsConfigJson = readJson(tree, browserTsConfigPath);
    const serverTsConfigJson = readJson(tree, serverTsConfigPath);

    const files = new Set([
      ...(browserTsConfigJson.files ?? []),
      ...(serverTsConfigJson.files ?? []),
    ]);

    // Server file will be added later by the setup-ssr generator
    files.delete('server.ts');

    browserTsConfigJson.files = Array.from(files);
    browserTsConfigJson.compilerOptions ?? {};
    browserTsConfigJson.compilerOptions.types = Array.from(
      new Set([
        ...(browserTsConfigJson.compilerOptions.types ?? []),
        ...(serverTsConfigJson.compilerOptions?.types ?? []),
      ])
    );

    // Delete server tsconfig
    tree.delete(serverTsConfigPath);
  }

  // Update project main tsconfig
  const projectRootTsConfigPath = join(project.root, 'tsconfig.json');
  if (tree.exists(projectRootTsConfigPath)) {
    const rootTsConfigJson = readJson(tree, projectRootTsConfigPath);
    rootTsConfigJson.compilerOptions ?? {};
    rootTsConfigJson.compilerOptions.esModuleInterop = true;
    rootTsConfigJson.compilerOptions.downlevelIteration = undefined;
    rootTsConfigJson.compilerOptions.allowSyntheticDefaultImports = undefined;
    writeJson(tree, projectRootTsConfigPath, rootTsConfigJson);
  }

  // Update server file
  const ssrMainFile = project.targets['server']?.options?.['main'];
  if (typeof ssrMainFile === 'string') {
    tree.delete(ssrMainFile);
    // apply changes so the setup-ssr generator can access the updated project
    updateProjectConfiguration(tree, projectName, project);
    await setupSsr(tree, { project: projectName, skipFormat: true });
    // re-read project configuration as it might have changed
    project = readProjectConfiguration(tree, projectName);
  }

  // Delete all redundant targets
  for (const [targetName, target] of Object.entries(project.targets)) {
    if (redundantExecutors.has(target.executor)) {
      delete project.targets[targetName];
    }
  }

  updateProjectConfiguration(tree, projectName, project);
  return true;
}

function getTargetsToConvert(
  targets: Record<string, TargetConfiguration>,
  angularVersion: string
): {
  buildTargetName?: string;
  serverTargetName?: string;
} {
  let buildTargetName: string;
  let serverTargetName: string;
  for (const target of Object.keys(targets)) {
    if (
      targets[target].executor === Executors.Application ||
      targets[target].executor === Builders.Application
    ) {
      logger.warn(
        'The project is already using the application builder. Skipping conversion.'
      );
      return {};
    }

    // build target
    if (executorsToConvert.has(targets[target].executor)) {
      for (const [, options] of allTargetOptions(targets[target])) {
        if (lt(angularVersion, '17.3.0') && options.deployUrl) {
          logger.warn(
            `The project is using the "deployUrl" option which is not available in the application builder. Skipping conversion.`
          );
          return {};
        }
        if (options.customWebpackConfig) {
          logger.warn(
            `The project is using a custom webpack configuration which is not supported by the esbuild-based application executor. Skipping conversion.`
          );
          return {};
        }
      }

      if (buildTargetName) {
        logger.warn(
          'The project has more than one build target. Skipping conversion.'
        );
        return {};
      }
      buildTargetName = target;
    }

    // server target
    if (serverTargetExecutors.has(targets[target].executor)) {
      if (targets[target].executor === '@nx/angular:webpack-server') {
        for (const [, options] of allTargetOptions(targets[target])) {
          if (options.customWebpackConfig) {
            logger.warn(
              `The project is using a custom webpack configuration which is not supported by the esbuild-based application executor. Skipping conversion.`
            );
            return {};
          }
        }
      }

      if (serverTargetName) {
        logger.warn(
          'The project has more than one server target. Skipping conversion.'
        );
        return {};
      }
      serverTargetName = target;
    }
  }

  return { buildTargetName, serverTargetName };
}

// Determine if there's any usage of executors only available in the angular devkit
function hasAngularDevkitOnlyExecutors(
  projects: Map<string, ProjectConfiguration>
): boolean {
  for (const [, project] of projects) {
    for (const [, target] of Object.entries(project.targets ?? {})) {
      if (
        !target.executor ||
        (target.executor && angularDevkitToAngularBuild.has(target.executor))
      ) {
        continue;
      }

      if (
        target.executor.startsWith('@angular-devkit/build-angular:') ||
        target.executor.startsWith('@nx/angular:')
      ) {
        return true;
      }
    }
  }
  return false;
}

function installAngularBuildPackage(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    {},
    { '@angular/build': versions(tree).angularDevkitVersion },
    undefined,
    true
  );
}

async function getAngularProjects(
  tree: Tree
): Promise<Map<string, ProjectConfiguration>> {
  return (
    await getProjectsFilteredByDependencies(tree, ['npm:@angular/core'])
  ).reduce((projects, { project }) => {
    projects.set(project.name, project);
    return projects;
  }, new Map<string, ProjectConfiguration>());
}

export default convertToApplicationExecutor;
