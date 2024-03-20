import {
  formatFiles,
  getProjects,
  installPackagesTask,
  logger,
  readJson,
  readProjectConfiguration,
  updateProjectConfiguration,
  writeJson,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { dirname, join } from 'node:path/posix';
import { gte, lt } from 'semver';
import { allTargetOptions } from '../../utils/targets';
import { setupSsr } from '../setup-ssr/setup-ssr';
import { validateProject } from '../utils/validations';
import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import type { GeneratorOptions } from './schema';

const executorsToConvert = new Set([
  '@angular-devkit/build-angular:browser',
  '@angular-devkit/build-angular:browser-esbuild',
  '@nx/angular:webpack-browser',
  '@nx/angular:browser-esbuild',
]);
const serverTargetExecutors = new Set([
  '@angular-devkit/build-angular:server',
  '@nx/angular:webpack-server',
]);
const redundantExecutors = new Set([
  '@angular-devkit/build-angular:server',
  '@angular-devkit/build-angular:prerender',
  '@angular-devkit/build-angular:app-shell',
  '@angular-devkit/build-angular:ssr-dev-server',
  '@nx/angular:webpack-server',
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

  let didAnySucceed = false;
  if (options.project) {
    validateProject(tree, options.project);
    didAnySucceed = await convertProjectTargets(
      tree,
      options.project,
      angularVersion,
      true
    );
  } else {
    const projects = getProjects(tree);
    for (const [projectName] of projects) {
      logger.info(`Converting project "${projectName}"...`);
      const success = await convertProjectTargets(
        tree,
        projectName,
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

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return didAnySucceed ? () => installPackagesTask(tree) : () => {};
}

async function convertProjectTargets(
  tree: Tree,
  projectName: string,
  angularVersion: string,
  isProvidedProject = false
): Promise<boolean> {
  function warnIfProvided(message: string): void {
    if (isProvidedProject) {
      logger.warn(message);
    }
  }

  let project = readProjectConfiguration(tree, projectName);
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
        `'@angular-devkit/build-angular:browser', '@angular-devkit/build-angular:browser-esbuild', ` +
        `'@nx/angular:browser' and '@nx/angular:browser-esbuild' executors. Skipping conversion.`
    );
    return false;
  }

  const useNxExecutor =
    project.targets[buildTargetName].executor.startsWith('@nx/angular:');
  const newExecutor = useNxExecutor
    ? '@nx/angular:application'
    : '@angular-devkit/build-angular:application';

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
      targets[target].executor === '@nx/angular:application' ||
      targets[target].executor === '@angular-devkit/build-angular:application'
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

export default convertToApplicationExecutor;
