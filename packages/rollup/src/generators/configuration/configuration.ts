import {
  readTargetDefaultsForTarget,
  mergeTargetConfigurations,
  type PackageJson,
} from '@nx/devkit/internal';
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
import { getUpdatedPackageJsonContent, readTsConfig } from '@nx/js';
import {
  getImportPath,
  createTreeParseConfigHost,
  ensureTypescript,
  getDefinedCustomConditionName,
  isUsingTsSolutionSetup,
  TS_SOLUTION_SETUP_TSCONFIG_INPUT,
} from '@nx/js/internal';
import { dirname, join, relative } from 'node:path/posix';
import { RollupExecutorOptions } from '../../executors/rollup/schema';
import { RollupWithNxPluginOptions } from '../../plugins/with-nx/with-nx-options';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { assertSupportedRollupVersion } from '../../utils/versions';
import { rollupInitGenerator } from '../init/init';
import { RollupProjectSchema } from './schema';

let ts: typeof import('typescript');

export async function configurationGenerator(
  tree: Tree,
  options: RollupProjectSchema
) {
  assertSupportedRollupVersion(tree);

  const tasks: GeneratorCallback[] = [];
  const nxJson = readNxJson(tree);
  options.addPlugin = true;

  tasks.push(await rollupInitGenerator(tree, { ...options, skipFormat: true }));

  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(tree, options));
  }

  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  const outputConfig: OutputConfig | undefined = createRollupConfig(
    tree,
    options,
    isTsSolutionSetup
  );

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
    joinPathFragments(project.root, 'rollup.config.cjs'),
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
    assets: [{ input: '{projectRoot}', output: '.', glob:'*.md' }],`
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
        readTargetDefaultsForTarget(
          options.buildTarget,
          nxJson.targetDefaults,
          projectTarget.executor
        )
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
      developmentConditionName: getDefinedCustomConditionName(tree),
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

  const parsedTsConfig = readTsConfig(
    tsconfigPath,
    createTreeParseConfigHost(tree)
  );

  updateJson(tree, tsconfigPath, (json) => {
    if (parsedTsConfig.options.module === ts.ModuleKind.NodeNext) {
      json.compilerOptions ??= {};
      json.compilerOptions.module = 'esnext';
      json.compilerOptions.moduleResolution = 'bundler';
    }

    return json;
  });
}

export default configurationGenerator;
