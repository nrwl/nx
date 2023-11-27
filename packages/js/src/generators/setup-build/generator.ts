import {
  ensurePackage,
  formatFiles,
  joinPathFragments,
  normalizePath,
  readJson,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  updateJson,
  updateProjectConfiguration,
  writeJson,
  type GeneratorCallback,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import type { PackageJson } from 'nx/src/utils/package-json';
import { relative } from 'path';
import {
  defaultBuildTargetName,
  defaultEntryPointFiles,
  defaultTsConfigFiles,
  type JsPluginOptions,
} from '../../plugins/plugin';
import { getImportPath } from '../../utils/get-import-path';
import {
  determinePackageDependencies,
  determinePackageEntryFields,
} from '../../utils/package-json/package-json-metadata';
import { addSwcConfig } from '../../utils/swc/add-swc-config';
import { addSwcDependencies } from '../../utils/swc/add-swc-dependencies';
import { getRootTsConfigPathInTree } from '../../utils/typescript/ts-config';
import { nxVersion } from '../../utils/versions';
import type { SetupBuildGeneratorSchema } from './schema';

export async function setupBuildGenerator(
  tree: Tree,
  options: SetupBuildGeneratorSchema
): Promise<GeneratorCallback> {
  if (options.publishable && !options.importPath) {
    throw new Error(
      `To set up a publishable library, you must provide the "--importPath" option with the library name currently used to import it.`
    );
  } else if (options.importPath) {
    const { compilerOptions } = readJson(tree, getRootTsConfigPathInTree(tree));

    if (!compilerOptions.paths?.[options.importPath]) {
      throw new Error(
        `The provided import path "${options.importPath}" does not exist in the root tsconfig. Please provide the existing import path for "${options.project}".`
      );
    }
  }

  const tasks: GeneratorCallback[] = [];
  const project = readProjectConfiguration(tree, options.project);
  const buildTarget = options.buildTarget ?? 'build';
  const prevBuildOptions = project.targets?.[buildTarget]?.options;
  options.importPath ??= getImportPath(tree, options.project);

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
      const nxJson = readNxJson(tree);
      const jsPlugin = nxJson.plugins?.find((p) =>
        typeof p === 'string'
          ? p === '@nx/js/plugin'
          : p.plugin === '@nx/js/plugin'
      );

      if (jsPlugin && options.publishable) {
        const pluginOptions: JsPluginOptions =
          typeof jsPlugin === 'string' ? {} : jsPlugin.options ?? {};

        if (
          (pluginOptions.buildTargetName &&
            buildTarget !== pluginOptions.buildTargetName) ||
          buildTarget !== defaultBuildTargetName
        ) {
          // target is different, so it's not gonna be merged with the
          // plugin-generated target, add the full target
          addTscBuildTarget(tree, project, buildTarget, mainFile, tsConfigFile);
        } else {
          // target is the same, check if the entrypoint or tsconfig are different
          // from those configured in the plugin
          const relativeMainPath = normalizePath(
            relative(project.root, mainFile)
          );
          const isDifferentEntryPoint = isEntryPointHandledByPlugin(
            relativeMainPath,
            pluginOptions
          );
          if (isDifferentEntryPoint) {
            pluginOptions.packageMainFiles = [
              ...(pluginOptions.packageMainFiles ?? defaultEntryPointFiles),
              relativeMainPath,
            ];
          }

          const relativeTsConfigPath = normalizePath(
            relative(project.root, tsConfigFile)
          );
          const isDifferentTsConfig = isTsConfigHandledByPlugin(
            relativeTsConfigPath,
            pluginOptions
          );
          if (isDifferentTsConfig) {
            const configuredTsConfigFiles =
              pluginOptions.tsConfigFiles ?? defaultTsConfigFiles;
            const hasTsConfigJson =
              configuredTsConfigFiles.includes('tsconfig.json');
            pluginOptions.tsConfigFiles = hasTsConfigJson
              ? [
                  ...configuredTsConfigFiles.filter(
                    (f) => f !== 'tsconfig.json'
                  ),
                  relativeTsConfigPath,
                  'tsconfig.json',
                ]
              : [...configuredTsConfigFiles, relativeTsConfigPath];
          }

          if (isDifferentEntryPoint || isDifferentTsConfig) {
            if (typeof jsPlugin === 'string') {
              nxJson.plugins = nxJson.plugins.filter(
                (p) => p !== '@nx/js/plugin'
              );
              nxJson.plugins.push({
                plugin: '@nx/js/plugin',
                options: pluginOptions,
              });
            } else {
              jsPlugin.options = pluginOptions;
            }

            writeJson(tree, 'nx.json', nxJson);
          }
        }
      } else {
        addTscBuildTarget(tree, project, buildTarget, mainFile, tsConfigFile);
      }

      break;
    }
    case 'swc': {
      const outputPath = joinPathFragments('dist', project.root);
      project.targets[buildTarget] = {
        executor: `@nx/js:swc`,
        outputs: ['{options.outputPath}'],
        options: {
          outputPath,
          main: mainFile,
          tsConfig: tsConfigFile,
          assets: [],
        },
      };
      updateProjectConfiguration(tree, options.project, project);
      addSwcDependencies(tree);
      addSwcConfig(tree, project.root, 'es6');
    }
  }

  setupPackageJson(tree, project, options);

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

export default setupBuildGenerator;

function setupPackageJson(
  tree: Tree,
  project: ProjectConfiguration,
  options: SetupBuildGeneratorSchema
) {
  const packageJsonPath = joinPathFragments(project.root, 'package.json');
  const shouldBePublic = options.publishable || project.root === '.';

  if (tree.exists(packageJsonPath)) {
    updateJson<PackageJson>(tree, packageJsonPath, (json) => {
      json.name = options.importPath;
      json.version = '0.0.1';
      // If the package is publishable or root/standalone, we should remove the private field.
      if (json.private && shouldBePublic) {
        delete json.private;
      }
      return {
        ...json,
        dependencies: {
          ...json.dependencies,
          ...determinePackageDependencies(options.bundler),
        },
        ...determinePackageEntryFields(options.bundler),
      };
    });
  } else {
    writeJson<PackageJson>(tree, packageJsonPath, {
      name: options.importPath,
      version: '0.0.1',
      private: !shouldBePublic ? true : undefined,
      dependencies: determinePackageDependencies(options.bundler),
      ...determinePackageEntryFields(options.bundler),
    });
  }
}

function isEntryPointHandledByPlugin(
  entryPoint: string,
  pluginOptions: JsPluginOptions
): boolean {
  return (
    (pluginOptions.packageMainFiles &&
      !pluginOptions.packageMainFiles.includes(entryPoint)) ||
    (!pluginOptions.packageMainFiles &&
      !defaultEntryPointFiles.includes(entryPoint))
  );
}

function isTsConfigHandledByPlugin(
  tsConfig: string,
  pluginOptions: JsPluginOptions
): boolean {
  return (
    (pluginOptions.tsConfigFiles &&
      !pluginOptions.tsConfigFiles.includes(tsConfig)) ||
    (!pluginOptions.tsConfigFiles && !defaultTsConfigFiles.includes(tsConfig))
  );
}

function addTscBuildTarget(
  tree: Tree,
  project: ProjectConfiguration,
  buildTarget: string,
  mainFile: string,
  tsConfigFile: string
) {
  const outputPath = joinPathFragments('dist', project.root);
  project.targets[buildTarget] = {
    executor: `@nx/js:tsc`,
    outputs: ['{options.outputPath}'],
    options: {
      outputPath,
      main: mainFile,
      tsConfig: tsConfigFile,
      assets: [],
    },
  };
  updateProjectConfiguration(tree, project.name, project);
}
