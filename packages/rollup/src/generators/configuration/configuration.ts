import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  GeneratorCallback,
  runTasksInSerial,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { getImportPath } from '@nx/js/src/utils/get-import-path';

import { rollupInitGenerator } from '../init/init';
import { RollupExecutorOptions } from '../../executors/rollup/schema';
import { RollupProjectSchema } from './schema';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/add-build-target-defaults';
import { ensureDependencies } from '../../utils/ensure-dependencies';

export async function configurationGenerator(
  tree: Tree,
  options: RollupProjectSchema
) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(await rollupInitGenerator(tree, { ...options, skipFormat: true }));
  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(tree, options));
  }

  options.buildTarget ??= 'build';
  checkForTargetConflicts(tree, options);
  addBuildTarget(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function checkForTargetConflicts(tree: Tree, options: RollupProjectSchema) {
  if (options.skipValidation) return;
  const project = readProjectConfiguration(tree, options.project);
  if (project.targets?.[options.buildTarget]) {
    throw new Error(
      `Project "${options.project}" already has a ${options.buildTarget} target. Pass --skipValidation to ignore this error.`
    );
  }
}

function addBuildTarget(tree: Tree, options: RollupProjectSchema) {
  addBuildTargetDefaults(tree, '@nx/rollup:rollup', options.buildTarget);
  const project = readProjectConfiguration(tree, options.project);
  const packageJsonPath = joinPathFragments(project.root, 'package.json');

  if (!tree.exists(packageJsonPath)) {
    const importPath =
      options.importPath || getImportPath(tree, options.project);
    writeJson(tree, packageJsonPath, {
      name: importPath,
      version: '0.0.1',
    });
  }

  const prevBuildOptions = project.targets?.[options.buildTarget]?.options;

  const buildOptions: RollupExecutorOptions = {
    main:
      options.main ??
      prevBuildOptions?.main ??
      joinPathFragments(project.root, 'src/main.ts'),
    outputPath:
      prevBuildOptions?.outputPath ??
      joinPathFragments(
        'dist',
        project.root === '.' ? project.name : project.root
      ),
    tsConfig:
      options.tsConfig ??
      prevBuildOptions?.tsConfig ??
      joinPathFragments(project.root, 'tsconfig.lib.json'),
    additionalEntryPoints: prevBuildOptions?.additionalEntryPoints,
    generateExportsField: prevBuildOptions?.generateExportsField,
    compiler: options.compiler ?? 'babel',
    project: `${project.root}/package.json`,
    external: options.external,
    format: options.format,
  };

  if (options.rollupConfig) {
    buildOptions.rollupConfig = options.rollupConfig;
  }

  if (tree.exists(joinPathFragments(project.root, 'README.md'))) {
    buildOptions.assets = [
      {
        glob: `${project.root}/README.md`,
        input: '.',
        output: '.',
      },
    ];
  }

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      [options.buildTarget]: {
        executor: '@nx/rollup:rollup',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: buildOptions,
        configurations: {
          production: {
            optimization: true,
            sourceMap: false,
            namedChunks: false,
            extractLicenses: true,
            vendorChunk: false,
          },
        },
      },
    },
  });
}

export default configurationGenerator;
