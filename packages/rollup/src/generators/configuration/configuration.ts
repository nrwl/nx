import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readJson,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { getUpdatedPackageJsonContent, readTsConfig } from '@nx/js';
import { getImportPath } from '@nx/js/src/utils/get-import-path';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { dirname, join, relative } from 'node:path/posix';
import { mergeTargetConfigurations } from 'nx/src/devkit-internals';
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
  let outputConfig: OutputConfig | undefined;
  if (hasPlugin(tree)) {
    outputConfig = createRollupConfig(tree, options, isTsSolutionSetup);
  } else {
    options.buildTarget ??= 'build';
    checkForTargetConflicts(tree, options);
    addBuildTarget(tree, options, isTsSolutionSetup);
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
    ? `./${relative(project.root, options.main)}`
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
      ? `./${relative(project.root, options.tsConfig)}`
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
  outputConfig: OutputConfig | undefined,
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
      name: options.importPath || getImportPath(tree, options.project),
      version: '0.0.1',
    };
  }

  if (isTsSolutionSetup) {
    let main: string;
    let outputPath: string;
    if (outputConfig) {
      ({ main, outputPath } = outputConfig);
    } else {
      // target must exist if we don't receive an outputConfig
      const projectTarget = project.targets[options.buildTarget];
      const nxJson = readNxJson(tree);
      const mergedTarget = mergeTargetConfigurations(
        projectTarget,
        (projectTarget.executor
          ? nxJson.targetDefaults?.[projectTarget.executor]
          : undefined) ?? nxJson.targetDefaults?.[options.buildTarget]
      );
      ({ main, outputPath } = mergedTarget.options);
    }

    packageJson = getUpdatedPackageJsonContent(packageJson, {
      main,
      outputPath,
      projectRoot: project.root,
      rootDir: dirname(main),
      generateExportsField: true,
      packageJsonPath,
      format: options.format ?? ['esm'],
      outputFileExtensionForCjs: '.cjs.js',
      outputFileExtensionForEsm: '.esm.js',
    });

    // rollup has a specific declaration file generation not handled by the util above,
    // adjust accordingly
    const typingsFile = (packageJson.module ?? packageJson.main).replace(
      /\.js$/,
      '.d.ts'
    );
    packageJson.types = typingsFile;
    packageJson.exports['.'].types = typingsFile;
  }

  writeJson(tree, packageJsonPath, packageJson);
}

function addBuildTarget(
  tree: Tree,
  options: RollupProjectSchema,
  isTsSolutionSetup: boolean
) {
  addBuildTargetDefaults(tree, '@nx/rollup:rollup', options.buildTarget);
  const project = readProjectConfiguration(tree, options.project);
  const prevBuildOptions = project.targets?.[options.buildTarget]?.options;

  options.tsConfig ??=
    prevBuildOptions?.tsConfig ??
    joinPathFragments(project.root, 'tsconfig.lib.json');

  let outputPath = prevBuildOptions?.outputPath;
  if (!outputPath) {
    outputPath = isTsSolutionSetup
      ? joinPathFragments(project.root, 'dist')
      : joinPathFragments(
          'dist',
          project.root === '.' ? project.name : project.root
        );
  }

  const buildOptions: RollupExecutorOptions = {
    main:
      options.main ??
      prevBuildOptions?.main ??
      joinPathFragments(project.root, 'src/index.ts'),
    outputPath,
    tsConfig: options.tsConfig,
    // TODO(leo): see if we can use this when updating the package.json for the new setup
    // additionalEntryPoints: prevBuildOptions?.additionalEntryPoints,
    // generateExportsField: prevBuildOptions?.generateExportsField,
    compiler: options.compiler ?? 'babel',
    project: `${project.root}/package.json`,
    external: options.external,
    format: options.format ?? isTsSolutionSetup ? ['esm'] : undefined,
  };

  if (options.rollupConfig) {
    buildOptions.rollupConfig = options.rollupConfig;
  }

  if (!isTsSolutionSetup) {
    buildOptions.additionalEntryPoints =
      prevBuildOptions?.additionalEntryPoints;
    buildOptions.generateExportsField = prevBuildOptions?.generateExportsField;

    if (tree.exists(joinPathFragments(project.root, 'README.md'))) {
      buildOptions.assets = [
        {
          glob: `${project.root}/README.md`,
          input: '.',
          output: '.',
        },
      ];
    }
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
