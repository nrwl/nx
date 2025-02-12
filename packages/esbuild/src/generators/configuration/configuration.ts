import {
  formatFiles,
  joinPathFragments,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { getOutputDir, getUpdatedPackageJsonContent } from '@nx/js';
import { getImportPath } from '@nx/js/src/utils/get-import-path';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { basename, dirname, join } from 'node:path/posix';
import { mergeTargetConfigurations } from 'nx/src/devkit-internals';
import { PackageJson } from 'nx/src/utils/package-json';
import { getOutExtension } from '../../executors/esbuild/lib/build-esbuild-options';
import { EsBuildExecutorOptions } from '../../executors/esbuild/schema';
import { esbuildInitGenerator } from '../init/init';
import { EsBuildProjectSchema } from './schema';

export async function configurationGenerator(
  tree: Tree,
  options: EsBuildProjectSchema
) {
  const task = await esbuildInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  options.buildTarget ??= 'build';
  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  checkForTargetConflicts(tree, options);
  addBuildTarget(tree, options, isTsSolutionSetup);
  updatePackageJson(tree, options, isTsSolutionSetup);
  await formatFiles(tree);
  return task;
}

function checkForTargetConflicts(tree: Tree, options: EsBuildProjectSchema) {
  if (options.skipValidation) return;
  const project = readProjectConfiguration(tree, options.project);
  if (project.targets?.[options.buildTarget]) {
    throw new Error(
      `Project "${options.project}" already has a ${options.buildTarget} target. Pass --skipValidation to ignore this error.`
    );
  }
}

function addBuildTarget(
  tree: Tree,
  options: EsBuildProjectSchema,
  isTsSolutionSetup: boolean
) {
  addBuildTargetDefaults(tree, '@nx/esbuild:esbuild', options.buildTarget);
  const project = readProjectConfiguration(tree, options.project);

  const prevBuildOptions = project.targets?.[options.buildTarget]?.options;
  const tsConfig = prevBuildOptions?.tsConfig ?? getTsConfigFile(tree, options);

  let outputPath = prevBuildOptions?.outputPath;
  if (!outputPath) {
    outputPath = isTsSolutionSetup
      ? joinPathFragments(project.root, 'dist')
      : joinPathFragments(
          'dist',
          project.root === '.' ? options.project : project.root
        );
  }

  const buildOptions: EsBuildExecutorOptions = {
    main: prevBuildOptions?.main ?? getMainFile(tree, options),
    outputPath,
    outputFileName: 'main.js',
    tsConfig,
    platform: options.platform,
    format: options.format,
  };

  if (isTsSolutionSetup) {
    buildOptions.declarationRootDir =
      project.sourceRoot ?? tree.exists(`${project.root}/src`)
        ? `${project.root}/src`
        : project.root;
  } else {
    buildOptions.assets = [];

    if (tree.exists(joinPathFragments(project.root, 'README.md'))) {
      buildOptions.assets.push({
        glob: `${project.root}/README.md`,
        input: '.',
        output: '.',
      });
    }
  }

  if (options.platform === 'browser') {
    buildOptions.outputHashing = 'all';
    buildOptions.minify = true;
  }

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      [options.buildTarget]: {
        executor: '@nx/esbuild:esbuild',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: buildOptions,
        configurations: {
          development: {
            minify: false,
          },
          production: {
            minify: true,
          },
        },
      },
    },
  });
}

function updatePackageJson(
  tree: Tree,
  options: EsBuildProjectSchema,
  isTsSolutionSetup: boolean
) {
  const project = readProjectConfiguration(tree, options.project);

  const packageJsonPath = join(project.root, 'package.json');
  let packageJson: PackageJson;
  if (tree.exists(packageJsonPath)) {
    if (!isTsSolutionSetup) {
      return;
    }

    packageJson = readJson(tree, packageJsonPath);
  } else {
    packageJson = {
      name: getImportPath(tree, options.project),
      version: '0.0.1',
    };
  }

  if (isTsSolutionSetup) {
    const nxJson = readNxJson(tree);
    const projectTarget = project.targets[options.buildTarget];
    const mergedTarget = mergeTargetConfigurations(
      projectTarget,
      (projectTarget.executor
        ? nxJson.targetDefaults?.[projectTarget.executor]
        : undefined) ?? nxJson.targetDefaults?.[options.buildTarget]
    );

    const {
      declarationRootDir = '.',
      main,
      outputPath,
      outputFileName,
      // the executor option defaults to [esm]
      format = ['esm'],
      esbuildOptions,
    } = mergedTarget.options;

    // can't use the declarationRootDir as rootDir because it only affects the typings,
    // not the runtime entry point
    packageJson = getUpdatedPackageJsonContent(packageJson, {
      main,
      outputPath,
      projectRoot: project.root,
      generateExportsField: true,
      packageJsonPath,
      format,
      outputFileName,
      outputFileExtensionForCjs: getOutExtension('cjs', {
        // there's very little chance that the user would have defined a custom esbuild config
        // since that's an Nx specific file that we're not generating here and we're setting up
        // the build for esbuild now
        userDefinedBuildOptions: esbuildOptions,
      }),
      outputFileExtensionForEsm: getOutExtension('esm', {
        userDefinedBuildOptions: esbuildOptions,
      }),
    });

    if (declarationRootDir !== dirname(main)) {
      // the declaration file entry point will be output to a location
      // different than the runtime entry point, adjust accodingly
      const outputDir = getOutputDir({
        main,
        outputPath,
        projectRoot: project.root,
        packageJsonPath,
        rootDir: declarationRootDir,
      });
      const mainFile = basename(options.main).replace(/\.[tj]s$/, '');
      const typingsFile = `${outputDir}${mainFile}.d.ts`;
      packageJson.types = typingsFile;
      packageJson.exports['.'].types = typingsFile;
    }
  }

  writeJson(tree, packageJsonPath, packageJson);
}

function getMainFile(tree: Tree, options: EsBuildProjectSchema) {
  const project = readProjectConfiguration(tree, options.project);
  const candidates = [
    joinPathFragments(project.root, 'src/main.ts'),
    joinPathFragments(project.root, 'src/index.ts'),
  ];
  for (const file of candidates) {
    if (tree.exists(file)) return file;
  }
  return options.main;
}

function getTsConfigFile(tree: Tree, options: EsBuildProjectSchema) {
  const project = readProjectConfiguration(tree, options.project);
  const candidates = [
    joinPathFragments(project.root, 'tsconfig.lib.json'),
    joinPathFragments(project.root, 'tsconfig.app.json'),
  ];
  for (const file of candidates) {
    if (tree.exists(file)) return file;
  }
  return options.tsConfig;
}

export default configurationGenerator;
