import {
  formatFiles,
  logger,
  offsetFromRoot,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  stripIndents,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { jestConfigObject } from '../../utils/config/functions';
import { dirname, extname, join } from 'path';
import {
  removePropertyFromJestConfig,
  addPropertyToJestConfig,
} from '../../utils/config/update-config';
import { JestExecutorOptions } from '../../executors/jest/schema';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

const allowedExt = ['.ts', '.js'];
let isRootPresetUpdated = false;

function updateJestPreset(
  tree: Tree,
  options: JestExecutorOptions,
  projectName: string
) {
  const oldConfig = jestConfigObject(tree, options.jestConfig);
  if (!oldConfig) {
    return;
  }
  // if using the root preset and the root preset was updated to ts file.
  // then update the jest config
  if (isRootPresetUpdated && oldConfig?.preset?.endsWith('jest.preset.js')) {
    removePropertyFromJestConfig(tree, options.jestConfig, 'preset');
    addPropertyToJestConfig(
      tree,
      options.jestConfig,
      'preset',
      join(offsetFromRoot(dirname(options.jestConfig)), 'jest.preset.ts'),
      { valueAsString: false }
    );
  }
}

function updateTsConfig(tree: Tree, tsConfigPath: string) {
  try {
    updateJson(tree, tsConfigPath, (json) => {
      json.exclude = Array.from(
        new Set([...(json.exclude || []), 'jest.config.ts'])
      );
      return json;
    });
  } catch (e) {
    logger.warn(
      stripIndents`Nx Unable to update ${tsConfigPath}. Please manually ignore the jest.config.ts file.`
    );
  }
}

function isJestConfigValid(tree: Tree, options: JestExecutorOptions) {
  const configExt = extname(options.jestConfig);

  if (!tree.exists(options.jestConfig) || !allowedExt.includes(configExt)) {
    logger.debug(
      `unable to update file because it doesn't exist or is not a js or ts file. Config: ${
        options.jestConfig
      }. Exists?: ${tree.exists(options.jestConfig)}`
    );
    return false;
  }
  return true;
}

function updateTsconfigSpec(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  path
) {
  updateJson(tree, join(projectConfig.root, path), (json) => {
    json.include = Array.from(
      new Set([...(json.include || []), 'jest.config.ts'])
    );
    return json;
  });
}

export async function updateJestConfigExt(tree: Tree) {
  if (tree.exists('jest.config.js')) {
    tree.rename('jest.config.js', 'jest.config.ts');
  }

  if (tree.exists('jest.preset.js')) {
    isRootPresetUpdated = true;
    tree.rename('jest.preset.js', 'jest.preset.ts');
  }

  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options, projectName, target, configuration) => {
      const projectConfig = readProjectConfiguration(tree, projectName);

      if (!isJestConfigValid(tree, options)) {
        return;
      }

      updateJestPreset(tree, options, projectName);

      const newJestConfigPath = options.jestConfig.replace('.js', '.ts');
      tree.rename(options.jestConfig, newJestConfigPath);

      const rootFiles = tree.children(projectConfig.root);
      for (const fileName of rootFiles) {
        if (fileName === 'tsconfig.json') {
          const filePath = join(projectConfig.root, fileName);
          const tsConfig = readJson(tree, filePath);

          if (tsConfig.references) {
            for (const { path } of tsConfig.references) {
              if (path.endsWith('tsconfig.spec.json')) {
                updateTsconfigSpec(tree, projectConfig, path);
                continue;
              }

              updateTsConfig(tree, join(projectConfig.root, path));
            }
          } else {
            updateTsConfig(tree, filePath);
          }
        }
      }

      projectConfig.targets[target].options.jestConfig = newJestConfigPath;
      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  );
  await formatFiles(tree);
}

export default updateJestConfigExt;
