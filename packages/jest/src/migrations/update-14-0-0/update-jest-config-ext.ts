import {
  formatFiles,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  stripIndents,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { extname } from 'path';
import { JestExecutorOptions } from '../../executors/jest/schema';

const allowedExt = ['.ts', '.js'];

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

function addEsLintIgnoreComments(tree: Tree, filePath: string) {
  if (tree.exists(filePath)) {
    const contents = tree.read(filePath, 'utf-8');
    tree.write(
      filePath,
      `/* eslint-disable */
${contents}`
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
  path,
  options: { isNextWithProjectParse: boolean; tsConfigPath: string } = {
    isNextWithProjectParse: false,
    tsConfigPath: '',
  }
) {
  updateJson(tree, joinPathFragments(projectConfig.root, path), (json) => {
    json.include = Array.from(
      new Set([...(json.include || []), 'jest.config.ts'])
    );
    if (options.isNextWithProjectParse) {
      const tsConfig = readJson(tree, options.tsConfigPath);
      const tsConfigExclude = (tsConfig.exclude || []).filter(
        (e) => e !== 'jest.config.ts'
      );
      json.exclude = Array.from(
        new Set([...(json.exclude || []), ...tsConfigExclude])
      );
    }
    return json;
  });
}

function isNextWithProjectLint(
  projectConfig: ProjectConfiguration,
  esLintJson: any
) {
  const esLintOverrides = esLintJson?.overrides?.find((o) =>
    ['*.ts', '*.tsx', '*.js', '*.jsx'].every((ext) => o.files.includes(ext))
  );

  // check if it's a next app and has a parserOptions.project set in the eslint overrides
  return !!(
    projectConfig?.targets?.['build']?.executor === '@nrwl/next:build' &&
    esLintOverrides?.parserOptions?.project
  );
}

export async function updateJestConfigExt(tree: Tree) {
  if (tree.exists('jest.config.js')) {
    tree.rename('jest.config.js', 'jest.config.ts');
  }

  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options, projectName, target, configuration) => {
      const projectConfig = readProjectConfiguration(tree, projectName);

      if (!options.jestConfig || !isJestConfigValid(tree, options)) {
        return;
      }

      addEsLintIgnoreComments(tree, options.jestConfig);

      const newJestConfigPath = options.jestConfig.replace('.js', '.ts');
      tree.rename(options.jestConfig, newJestConfigPath);

      const rootFiles = tree.children(projectConfig.root);
      for (const fileName of rootFiles) {
        if (fileName === 'tsconfig.json') {
          const filePath = joinPathFragments(projectConfig.root, fileName);
          const tsConfig = readJson(tree, filePath);

          if (tsConfig.references) {
            for (const { path } of tsConfig.references) {
              if (path.endsWith('tsconfig.spec.json')) {
                const eslintPath = joinPathFragments(
                  projectConfig.root,
                  '.eslintrc.json'
                );
                updateTsconfigSpec(tree, projectConfig, path, {
                  isNextWithProjectParse: tree.exists(eslintPath)
                    ? isNextWithProjectLint(
                        projectConfig,
                        readJson(tree, eslintPath)
                      )
                    : false,
                  tsConfigPath: filePath,
                });
                continue;
              }

              updateTsConfig(tree, joinPathFragments(projectConfig.root, path));
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
