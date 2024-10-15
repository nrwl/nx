import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { readTsConfig } from '@nx/js';
import { getImportPath } from '@nx/js/src/utils/get-import-path';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import * as posix from 'node:path/posix';
import type { PackageJson } from 'nx/src/utils/package-json';
import { RollupExecutorOptions } from '../../executors/rollup/schema';
import { RollupWithNxPluginOptions } from '../../plugins/with-nx/with-nx-options';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { hasPlugin } from '../../utils/has-plugin';
import { rollupInitGenerator } from '../init/init';
import { RollupProjectSchema } from './schema';

let ts: typeof import('typescript');

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

  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  let outputConfig: OutputConfig;
  if (hasPlugin(tree)) {
    outputConfig = createRollupConfig(tree, options, isTsSolutionSetup);
  } else {
    options.buildTarget ??= 'build';
    checkForTargetConflicts(tree, options);
    outputConfig = addBuildTarget(tree, options);
  }

  updatePackageJson(tree, options, outputConfig, isTsSolutionSetup);
  if (isTsSolutionSetup) {
    updateTsConfig(tree, options);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

type OutputConfig = {
  main: string;
  outputPath: string;
};
function createRollupConfig(
  tree: Tree,
  options: RollupProjectSchema,
  isTsSolutionSetup: boolean
): OutputConfig {
  const project = readProjectConfiguration(tree, options.project);
  const main = options.main
    ? `./${posix.relative(project.root, options.main)}`
    : './src/index.ts';
  const outputPath = isTsSolutionSetup
    ? './dist'
    : joinPathFragments(
        offsetFromRoot(project.root),
        'dist',
        project.root === '.' ? project.name : project.root
      );

  const buildOptions: RollupWithNxPluginOptions = {
    outputPath,
    compiler: options.compiler ?? 'babel',
    main,
    tsConfig: options.tsConfig
      ? `./${posix.relative(project.root, options.tsConfig)}`
      : './tsconfig.lib.json',
  };

  tree.write(
    joinPathFragments(project.root, 'rollup.config.js'),
    `const { withNx } = require('@nx/rollup/with-nx');

module.exports = withNx(
  {
    main: '${buildOptions.main}',
    outputPath: '${buildOptions.outputPath}',
    tsConfig: '${buildOptions.tsConfig}',
    compiler: '${buildOptions.compiler}',
    format: ${JSON.stringify(options.format ?? ['esm'])},${
      !isTsSolutionSetup
        ? `
    assets: [{ input: '.', output: '.', glob:'*.md' }],`
        : ''
    }
  },
  {
    // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
    // e.g.
    // output: { sourcemap: true },
  }
);
`
  );

  return {
    main: joinPathFragments(project.root, main),
    outputPath: joinPathFragments(project.root, outputPath),
  };
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

function updatePackageJson(
  tree: Tree,
  options: RollupProjectSchema,
  outputConfig: OutputConfig,
  isTsSolutionSetup: boolean
) {
  const project = readProjectConfiguration(tree, options.project);

  const { main, outputPath } = outputConfig;
  const mainName = posix.basename(main).replace(/\.[tj]s$/, '');
  const relativeOutputPath = posix.relative(
    posix.join(tree.root, project.root),
    posix.join(tree.root, outputPath)
  );
  const outputDir = `./${posix.normalize(relativeOutputPath)}`;
  const formats = options.format ?? ['esm'];

  const packageJsonPath = joinPathFragments(project.root, 'package.json');
  if (tree.exists(packageJsonPath) && isTsSolutionSetup) {
    if (!relativeOutputPath.startsWith('../')) {
      updateJson(tree, packageJsonPath, (json) => {
        // the output is contained within the project root
        updatePackageJsonFields(json, outputDir, mainName, formats);
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
      // fully matches the new setup
      updatePackageJsonFields(packageJson, outputDir, mainName, formats);
    }
    writeJson(tree, packageJsonPath, packageJson);
  }
}

function addBuildTarget(
  tree: Tree,
  options: RollupProjectSchema
): OutputConfig {
  addBuildTargetDefaults(tree, '@nx/rollup:rollup', options.buildTarget);
  const project = readProjectConfiguration(tree, options.project);
  const prevBuildOptions = project.targets?.[options.buildTarget]?.options;

  options.tsConfig ??=
    prevBuildOptions?.tsConfig ??
    joinPathFragments(project.root, 'tsconfig.lib.json');
  const main =
    options.main ??
    prevBuildOptions?.main ??
    joinPathFragments(project.root, 'src/index.ts');
  const outputPath =
    prevBuildOptions?.outputPath ??
    joinPathFragments(
      'dist',
      project.root === '.' ? project.name : project.root
    );

  const buildOptions: RollupExecutorOptions = {
    main,
    outputPath,
    tsConfig: options.tsConfig,
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

  return { main, outputPath };
}

function updateTsConfig(tree: Tree, options: RollupProjectSchema): void {
  const project = readProjectConfiguration(tree, options.project);
  const tsconfigPath =
    options.tsConfig ?? joinPathFragments(project.root, 'tsconfig.lib.json');
  if (!tree.exists(tsconfigPath)) {
    throw new Error(
      `The '${tsconfigPath}' file doesn't exist. Provide the 'tsConfig' option with the correct path pointing to the tsconfig file to use for builds.`
    );
  }

  if (!ts) {
    ts = ensureTypescript();
  }

  const parsedTsConfig = readTsConfig(tsconfigPath, {
    ...ts.sys,
    readFile: (p) => tree.read(p, 'utf-8'),
    fileExists: (p) => tree.exists(p),
  });

  updateJson(tree, tsconfigPath, (json) => {
    if (parsedTsConfig.options.module === ts.ModuleKind.NodeNext) {
      json.compilerOptions ??= {};
      json.compilerOptions.module = 'esnext';
      json.compilerOptions.moduleResolution = 'bundler';
    }

    return json;
  });
}

function updatePackageJsonFields(
  packageJson: PackageJson,
  outputDir: string,
  mainName: string,
  formats: RollupProjectSchema['format']
) {
  if (formats.includes('cjs')) {
    packageJson.main = `${outputDir}/${mainName}.cjs.js`;
    packageJson.types = `${outputDir}/${mainName}.cjs.d.ts`;
  } else if (formats.includes('esm')) {
    packageJson.main = `${outputDir}/${mainName}.esm.js`;
    packageJson.types = `${outputDir}/${mainName}.esm.d.ts`;
  }
  if (formats.includes('esm')) {
    packageJson.module = `${outputDir}/${mainName}.esm.js`;
  }
}

export default configurationGenerator;
