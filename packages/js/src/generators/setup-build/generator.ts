import {
  ensurePackage,
  formatFiles,
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
  writeJson,
  type GeneratorCallback,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { basename, dirname, join, normalize, relative } from 'node:path/posix';
import { mergeTargetConfigurations } from 'nx/src/devkit-internals';
import type { PackageJson } from 'nx/src/utils/package-json';
import { ensureProjectIsIncludedInPluginRegistrations } from '../..//utils/typescript/plugin';
import { getImportPath } from '../../utils/get-import-path';
import { addSwcConfig } from '../../utils/swc/add-swc-config';
import { addSwcDependencies } from '../../utils/swc/add-swc-dependencies';
import { ensureTypescript } from '../../utils/typescript/ensure-typescript';
import { readTsConfig } from '../../utils/typescript/ts-config';
import { isUsingTsSolutionSetup } from '../../utils/typescript/ts-solution-setup';
import { nxVersion } from '../../utils/versions';
import { SetupBuildGeneratorSchema } from './schema';

let ts: typeof import('typescript');

export async function setupBuildGenerator(
  tree: Tree,
  options: SetupBuildGeneratorSchema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  const project = readProjectConfiguration(tree, options.project);
  options.buildTarget ??= 'build';
  const prevBuildOptions = project.targets?.[options.buildTarget]?.options;

  project.targets ??= {};

  let mainFile: string;
  if (prevBuildOptions?.main) {
    mainFile = prevBuildOptions.main;
  } else if (options.main) {
    mainFile = options.main;
  } else {
    const root = project.sourceRoot ?? project.root;
    for (const f of [
      joinPathFragments(root, 'main.ts'),
      joinPathFragments(root, 'main.js'),
      joinPathFragments(root, 'index.ts'),
      joinPathFragments(root, 'index.js'),
    ]) {
      if (tree.exists(f)) {
        mainFile = f;
        break;
      }
    }
  }
  if (!mainFile || !tree.exists(mainFile)) {
    throw new Error(
      `Cannot locate a main file for ${options.project}. Please specify one using --main=<file-path>.`
    );
  }
  options.main = mainFile;

  let tsConfigFile: string;
  if (prevBuildOptions?.tsConfig) {
    tsConfigFile = prevBuildOptions.tsConfig;
  } else if (options.tsConfig) {
    tsConfigFile = options.tsConfig;
  } else {
    for (const f of [
      'tsconfig.lib.json',
      'tsconfig.app.json',
      'tsconfig.json',
    ]) {
      const candidate = joinPathFragments(project.root, f);
      if (tree.exists(candidate)) {
        tsConfigFile = candidate;
        break;
      }
    }
  }
  if (!tsConfigFile || !tree.exists(tsConfigFile)) {
    throw new Error(
      `Cannot locate a tsConfig file for ${options.project}. Please specify one using --tsConfig=<file-path>.`
    );
  }
  options.tsConfig = tsConfigFile;

  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  const nxJson = readNxJson(tree);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  switch (options.bundler) {
    case 'vite': {
      const { viteConfigurationGenerator } = ensurePackage(
        '@nx/vite',
        nxVersion
      );
      const task = await viteConfigurationGenerator(tree, {
        buildTarget: options.buildTarget,
        project: options.project,
        newProject: false,
        uiFramework: 'none',
        includeVitest: false,
        includeLib: true,
        addPlugin,
        skipFormat: true,
      });
      tasks.push(task);
      break;
    }
    case 'esbuild': {
      const { configurationGenerator } = ensurePackage(
        '@nx/esbuild',
        nxVersion
      );
      const task = await configurationGenerator(tree, {
        main: mainFile,
        buildTarget: options.buildTarget,
        project: options.project,
        skipFormat: true,
        skipValidation: true,
      });
      tasks.push(task);
      break;
    }
    case 'rollup': {
      const { configurationGenerator } = ensurePackage('@nx/rollup', nxVersion);
      const task = await configurationGenerator(tree, {
        buildTarget: options.buildTarget,
        main: mainFile,
        tsConfig: tsConfigFile,
        project: options.project,
        compiler: 'tsc',
        format: ['cjs', 'esm'],
        addPlugin,
        skipFormat: true,
        skipValidation: true,
      });
      tasks.push(task);
      break;
    }
    case 'tsc': {
      if (isTsSolutionSetup) {
        const nxJson = readNxJson(tree);
        ensureProjectIsIncludedInPluginRegistrations(
          nxJson,
          project.root,
          options.buildTarget
        );
        updateNxJson(tree, nxJson);
        updatePackageJsonForTsc(tree, options, project);
      } else {
        addBuildTargetDefaults(tree, '@nx/js:tsc');

        const outputPath = joinPathFragments('dist', project.root);
        project.targets[options.buildTarget] = {
          executor: `@nx/js:tsc`,
          outputs: ['{options.outputPath}'],
          options: {
            outputPath,
            main: mainFile,
            tsConfig: tsConfigFile,
            assets: [],
          },
        };
        updateProjectConfiguration(tree, options.project, project);
      }
      break;
    }
    case 'swc': {
      addBuildTargetDefaults(tree, '@nx/js:swc');

      const outputPath = isTsSolutionSetup
        ? joinPathFragments(project.root, 'dist')
        : joinPathFragments('dist', project.root);
      project.targets[options.buildTarget] = {
        executor: `@nx/js:swc`,
        outputs: ['{options.outputPath}'],
        options: {
          outputPath,
          main: mainFile,
          tsConfig: tsConfigFile,
        },
      };

      if (isTsSolutionSetup) {
        project.targets[options.buildTarget].options.stripLeadingPaths = true;
      } else {
        project.targets[options.buildTarget].options.assets = [];
      }

      updateProjectConfiguration(tree, options.project, project);
      tasks.push(addSwcDependencies(tree));
      addSwcConfig(tree, project.root, 'es6');
      if (isTsSolutionSetup) {
        updatePackageJsonForSwc(tree, options, project);
      }
    }
  }

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

export default setupBuildGenerator;

function updatePackageJsonForTsc(
  tree: Tree,
  options: SetupBuildGeneratorSchema,
  project: ProjectConfiguration
) {
  let main: string;
  let rootDir: string;
  let outputPath: string;
  if (project.targets?.[options.buildTarget]) {
    const mergedTarget = mergeTargetDefaults(
      tree,
      project,
      options.buildTarget
    );
    ({ main, rootDir, outputPath } = mergedTarget.options);
  } else {
    main = options.main;

    if (!ts) {
      ts = ensureTypescript();
    }

    const tsconfig = readTsConfig(options.tsConfig, {
      ...ts.sys,
      readFile: (p) => tree.read(p, 'utf-8'),
      fileExists: (p) => tree.exists(p),
    });

    ({ rootDir = project.root, outDir: outputPath } = tsconfig.options);
    const tsOutFile = tsconfig.options.outFile;

    if (tsOutFile) {
      main = join(project.root, basename(tsOutFile));
      outputPath = dirname(tsOutFile);
    }

    if (!outputPath) {
      outputPath = project.root;
    }
  }

  const mainName = basename(main).replace(/\.[tj]s$/, '');
  const mainDir = dirname(main);
  const relativeMainDir = relative(
    join(tree.root, rootDir),
    join(tree.root, mainDir)
  );
  const relativeOutputPath = relative(
    join(tree.root, project.root),
    join(tree.root, outputPath)
  );
  const outputDir = `./${join(relativeOutputPath, relativeMainDir)}`;

  const packageJsonPath = joinPathFragments(project.root, 'package.json');
  updatePackageJson(
    tree,
    packageJsonPath,
    options.project,
    outputDir,
    mainName,
    relativeOutputPath
  );
}

function updatePackageJsonForSwc(
  tree: Tree,
  options: SetupBuildGeneratorSchema,
  project: ProjectConfiguration
) {
  const mergedTarget = mergeTargetDefaults(tree, project, options.buildTarget);
  const { main, outputPath } = mergedTarget.options;
  const mainName = basename(main).replace(/\.[tj]s$/, '');
  const relativeOutputPath = relative(
    join(tree.root, project.root),
    join(tree.root, outputPath)
  );
  const outputDir = `./${normalize(relativeOutputPath)}`;

  const packageJsonPath = joinPathFragments(project.root, 'package.json');
  updatePackageJson(
    tree,
    packageJsonPath,
    options.project,
    outputDir,
    mainName,
    relativeOutputPath
  );
}

function updatePackageJson(
  tree: Tree,
  packageJsonPath: string,
  projectName: string,
  outputDir: string,
  mainName: string,
  relativeOutputPath: string
) {
  // TODO(tsc): consider add exports and use module
  if (tree.exists(packageJsonPath)) {
    if (!relativeOutputPath.startsWith('../')) {
      // the output is contained within the project root, we ensure the main
      // and types fields are set accordingly
      updateJson(tree, packageJsonPath, (json) => {
        json.main = `${outputDir}/${mainName}.js`;
        json.types = `${outputDir}/${mainName}.d.ts`;
        return json;
      });
    }
  } else {
    const importPath = getImportPath(tree, projectName);
    const packageJson: PackageJson = {
      name: importPath,
      version: '0.0.1',
    };
    if (!relativeOutputPath.startsWith('../')) {
      // the output is contained within the project root, we ensure the main
      // and types fields are set accordingly
      packageJson.main = `${outputDir}/${mainName}.js`;
      packageJson.types = `${outputDir}/${mainName}.d.ts`;
    }

    writeJson(tree, packageJsonPath, packageJson);
  }
}

function mergeTargetDefaults(
  tree: Tree,
  project: ProjectConfiguration,
  buildTarget: string
) {
  const nxJson = readNxJson(tree);
  const projectTarget = project.targets[buildTarget];

  return mergeTargetConfigurations(
    projectTarget,
    (projectTarget.executor
      ? nxJson.targetDefaults?.[projectTarget.executor]
      : undefined) ?? nxJson.targetDefaults?.[buildTarget]
  );
}
