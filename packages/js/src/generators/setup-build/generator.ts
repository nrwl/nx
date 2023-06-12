import {
  convertNxGenerator,
  ensurePackage,
  formatFiles,
  type GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  type Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { addSwcConfig } from '../../utils/swc/add-swc-config';
import { addSwcDependencies } from '../../utils/swc/add-swc-dependencies';
import { nxVersion } from '../../utils/versions';
import { SetupBuildGeneratorSchema } from './schema';

export async function setupBuildGenerator(
  tree: Tree,
  options: SetupBuildGeneratorSchema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  const project = readProjectConfiguration(tree, options.project);
  const buildTarget = options.buildTarget ?? 'build';

  project.targets ??= {};

  let mainFile: string;
  if (options.main) {
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
  if (options.tsConfig) {
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
      const { esbuildProjectGenerator } = ensurePackage(
        '@nx/esbuild',
        nxVersion
      );
      const task = await esbuildProjectGenerator(tree, {
        main: mainFile,
        buildTarget: options.buildTarget,
        project: options.project,
        skipFormat: true,
      });
      tasks.push(task);
      break;
    }
    case 'rollup': {
      const { rollupProjectGenerator } = ensurePackage('@nx/rollup', nxVersion);
      const task = await rollupProjectGenerator(tree, {
        buildTarget: options.buildTarget,
        main: mainFile,
        project: options.project,
        skipFormat: true,
        compiler: 'tsc',
      });
      tasks.push(task);
      break;
    }
    case 'tsc': {
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
      updateProjectConfiguration(tree, options.project, project);
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

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

export default setupBuildGenerator;
export const setupBuildSchematic = convertNxGenerator(setupBuildGenerator);
