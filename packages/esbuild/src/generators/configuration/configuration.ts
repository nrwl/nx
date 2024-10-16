import {
  formatFiles,
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { getImportPath } from '@nx/js/src/utils/get-import-path';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { basename, dirname, join, normalize, relative } from 'node:path/posix';
import { mergeTargetConfigurations } from 'nx/src/devkit-internals';
import { PackageJson } from 'nx/src/utils/package-json';
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
  // TODO(esbuild): consider add exports and use module
  const project = readProjectConfiguration(tree, options.project);
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
  } = mergedTarget.options;
  const mainName = basename(main).replace(/\.[tj]s$/, '');
  const mainDir = dirname(main);
  const relativeDeclarationDir = relative(
    join(tree.root, declarationRootDir),
    join(tree.root, mainDir)
  );
  const relativeOutputPath = relative(
    join(tree.root, project.root),
    join(tree.root, outputPath)
  );
  const outputDir = `./${normalize(relativeOutputPath)}`;
  const outputDeclarationDir = `./${join(
    relativeOutputPath,
    relativeDeclarationDir
  )}`;

  const packageJsonPath = joinPathFragments(project.root, 'package.json');
  if (tree.exists(packageJsonPath) && isTsSolutionSetup) {
    if (!relativeOutputPath.startsWith('../')) {
      updateJson<PackageJson>(tree, packageJsonPath, (json) => {
        // the output is contained within the project root
        json.main = `${outputDir}/${outputFileName}`;
        json.types = `${outputDeclarationDir}/${mainName}.d.ts`;

        return json;
      });
    }
  } else if (!tree.exists(packageJsonPath)) {
    const importPath =
      options.importPath || getImportPath(tree, options.project);
    const packageJson: PackageJson = {
      name: importPath,
      version: '0.0.1',
    };
    if (isTsSolutionSetup && !relativeOutputPath.startsWith('../')) {
      // the output is contained within the project root
      packageJson.main = `${outputDir}/${outputFileName}`;
      packageJson.types = `${outputDeclarationDir}/${outputFileName}.d.ts`;
    }

    writeJson(tree, packageJsonPath, packageJson);
  }
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
