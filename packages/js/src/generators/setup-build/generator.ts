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

  switch (options.bundler) {
    case 'vite': {
      const { viteConfigurationGenerator } = ensurePackage(
        '@nx/vite',
        nxVersion
      );
      const task = await viteConfigurationGenerator(tree, {
        buildTarget: options.buildTarget,
        project: options.project,
        newProject: true,
        uiFramework: 'none',
        includeVitest: false,
        includeLib: true,
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
  if (!ts) {
    ts = ensureTypescript();
  }

  let main = options.main;
  const tsconfig = readTsConfig(options.tsConfig, {
    ...ts.sys,
    readFile: (p) => tree.read(p, 'utf-8'),
    fileExists: (p) => tree.exists(p),
  });

  let {
    rootDir: tsRootDir = project.root,
    outDir: tsOutDir,
    outFile: tsOutFile,
  } = tsconfig.options;

  if (tsOutFile) {
    main = join(project.root, basename(tsOutFile));
    tsOutDir = dirname(tsOutFile);
  }

  if (!tsOutDir) {
    tsOutDir = project.root;
  }

  const mainName = basename(main).replace(/\.[tj]s$/, '');
  const mainDir = dirname(main);
  const relativeMainDir = relative(
    join(tree.root, tsRootDir),
    join(tree.root, mainDir)
  );
  const relativeOutputPath = relative(
    join(tree.root, project.root),
    join(tree.root, tsOutDir)
  );
  const outputDir = `./${join(relativeOutputPath, relativeMainDir)}`;

  const packageJsonPath = joinPathFragments(project.root, 'package.json');
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
    const importPath = getImportPath(tree, options.project);
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

function updatePackageJsonForSwc(
  tree: Tree,
  options: SetupBuildGeneratorSchema,
  project: ProjectConfiguration
) {
  const { main, outputPath } = project.targets[options.buildTarget].options;
  const mainName = basename(main).replace(/\.[tj]s$/, '');
  const relativeOutputPath = relative(
    join(tree.root, project.root),
    join(tree.root, outputPath)
  );
  const outputDir = `./${normalize(relativeOutputPath)}`;

  const packageJsonPath = joinPathFragments(project.root, 'package.json');
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
  } else if (!tree.exists(packageJsonPath)) {
    const importPath = getImportPath(tree, options.project);
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
