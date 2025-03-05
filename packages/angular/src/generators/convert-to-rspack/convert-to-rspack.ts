import {
  type Tree,
  readProjectConfiguration,
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  runTasksInSerial,
  ensurePackage,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { ConvertToRspackSchema } from './schema';
import { ngRspackVersion, nxVersion } from '../../utils/versions';
import { createConfig, CreateConfigOptions } from './lib/create-config';
import { getCustomWebpackConfig } from './lib/get-custom-webpack-config';
import { updateTsconfig } from './lib/update-tsconfig';
import { validateSupportedBuildExecutor } from './lib/validate-supported-executor';

const SUPPORTED_EXECUTORS = [
  '@angular-devkit/build-angular:browser',
  '@angular-devkit/build-angular:dev-server',
  '@nx/angular:webpack-browser',
  '@nx/angular:dev-server',
  '@nx/angular:module-federation-dev-server',
];

export async function convertToRspack(
  tree: Tree,
  schema: ConvertToRspackSchema
) {
  const { project: projectName } = schema;
  const project = readProjectConfiguration(tree, projectName);
  const tasks: GeneratorCallback[] = [];

  const createConfigOptions: Partial<CreateConfigOptions> = {
    root: project.root,
  };
  const buildTargetNames: string[] = [];
  let customWebpackConfigPath: string | undefined;

  validateSupportedBuildExecutor(Object.values(project.targets));

  for (const [targetName, target] of Object.entries(project.targets)) {
    if (
      target.executor === '@angular-devkit/build-angular:browser' ||
      target.executor === '@nx/angular:webpack-browser'
    ) {
      createConfigOptions.browser = target.options.main;
      createConfigOptions.index = target.options.index;
      createConfigOptions.assets = target.options.assets.map(
        (asset: string | { input: string; glob: string; output: string }) => {
          if (typeof asset === 'string') {
            return asset;
          }
          return asset.input;
        }
      );
      createConfigOptions.styles = target.options.styles;
      createConfigOptions.scripts = target.options.scripts;
      createConfigOptions.polyfills = target.options.polyfills;
      createConfigOptions.tsconfigPath = target.options.tsConfig;
      createConfigOptions.jit =
        target.options.aot === undefined ? false : !target.options.aot;
      createConfigOptions.inlineStylesExtension =
        target.options.inlineStyleLanguage === undefined
          ? 'css'
          : target.options.inlineStyleLanguage;
      createConfigOptions.fileReplacements = target.options.fileReplacements;
      createConfigOptions.stylePreprocessorOptions =
        target.options.stylePreprocessorOptions;
      if (target.options.customWebpackConfig) {
        customWebpackConfigPath = target.options.customWebpackConfig.path;
      }
      // TODO: Add more options that can be correctly mapped
      buildTargetNames.push(targetName);
    } else if (
      target.executor === '@angular-devkit/build-angular:dev-server' ||
      target.executor === '@nx/angular:dev-server' ||
      target.executor === '@nx/angular:module-federation-dev-server'
    ) {
      const port = target.options?.port ?? 4200;
      project[targetName] = {
        options: {
          port,
        },
      };
    }
  }

  const customWebpackConfigInfo = customWebpackConfigPath
    ? await getCustomWebpackConfig(tree, project.root, customWebpackConfigPath)
    : undefined;

  createConfig(
    tree,
    createConfigOptions,
    customWebpackConfigInfo?.normalizedPathToCustomWebpackConfig,
    customWebpackConfigInfo?.isWebpackConfigFunction
  );
  updateTsconfig(tree, project.root);

  for (const targetName of buildTargetNames) {
    delete project.targets[targetName];
  }

  updateProjectConfiguration(tree, projectName, project);

  const { rspackInitGenerator } = ensurePackage<typeof import('@nx/rspack')>(
    '@nx/rspack',
    nxVersion
  );

  await rspackInitGenerator(tree, {
    addPlugin: true,
  });

  if (!schema.skipInstall) {
    const installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@ng-rspack/build': ngRspackVersion,
      }
    );
    tasks.push(installTask);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default convertToRspack;
