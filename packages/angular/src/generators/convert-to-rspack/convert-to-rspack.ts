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
  const buildAndServeTargetNames: string[] = [];
  let customWebpackConfigPath: string | undefined;

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
      if (target.options.customWebpackConfig) {
        customWebpackConfigPath = target.options.customWebpackConfig.path;
      }
      // TODO: Add more options that can be correctly mapped
      buildAndServeTargetNames.push(targetName);
    } else if (
      target.executor === '@angular-devkit/build-angular:dev-server' ||
      target.executor === '@nx/angular:dev-server'
    ) {
      buildAndServeTargetNames.push(targetName);
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

  for (const targetName of buildAndServeTargetNames) {
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
