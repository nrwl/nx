import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  stripIndents,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { getImportPath } from '@nx/js/src/utils/get-import-path';

import { rollupInitGenerator } from '../init/init';
import { RollupExecutorOptions } from '../../executors/rollup/schema';
import { RollupProjectSchema } from './schema';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/add-build-target-defaults';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { hasPlugin } from '../../utils/has-plugin';
import { RollupWithNxPluginOptions } from '../../plugins/with-nx/with-nx-options';

export async function configurationGenerator(
  tree: Tree,
  options: RollupProjectSchema
) {
  const tasks: GeneratorCallback[] = [];
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  tasks.push(await rollupInitGenerator(tree, { ...options, skipFormat: true }));

  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(tree, options));
  }

  if (hasPlugin(tree)) {
    createRollupConfig(tree, options);
  } else {
    options.buildTarget ??= 'build';
    checkForTargetConflicts(tree, options);
    addBuildTarget(tree, options);
  }

  addPackageJson(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function createRollupConfig(tree: Tree, options: RollupProjectSchema) {
  const project = readProjectConfiguration(tree, options.project);
  const buildOptions: RollupWithNxPluginOptions = {
    outputPath: joinPathFragments(
      offsetFromRoot(project.root),
      'dist',
      project.root === '.' ? project.name : project.root
    ),
    compiler: options.compiler ?? 'babel',
    main: options.main ?? './src/index.ts',
    tsConfig: options.tsConfig ?? './tsconfig.lib.json',
  };

  tree.write(
    joinPathFragments(project.root, 'rollup.config.js'),
    stripIndents`
      const { withNx } = require('@nx/rollup/with-nx');
      
      module.exports = withNx({
        main: '${buildOptions.main}',
        outputPath: '${buildOptions.outputPath}',
        tsConfig: '${buildOptions.tsConfig}',
        compiler: '${buildOptions.compiler}',
        format: ${JSON.stringify(options.format ?? ['esm'])},
        assets:[{ input: '.', output: '.', glob:'*.md'}],
      }, {
        // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
        // e.g. 
        // output: { sourcemap: true },
      });`
  );
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

function addPackageJson(tree: Tree, options: RollupProjectSchema) {
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
}

function addBuildTarget(tree: Tree, options: RollupProjectSchema) {
  addBuildTargetDefaults(tree, '@nx/rollup:rollup', options.buildTarget);
  const project = readProjectConfiguration(tree, options.project);
  const prevBuildOptions = project.targets?.[options.buildTarget]?.options;

  const buildOptions: RollupExecutorOptions = {
    main:
      options.main ??
      prevBuildOptions?.main ??
      joinPathFragments(project.root, 'src/index.ts'),
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
        options: buildOptions,
      },
    },
  });
}

export default configurationGenerator;
