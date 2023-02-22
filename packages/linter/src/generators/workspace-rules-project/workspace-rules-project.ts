import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  convertNxGenerator,
  ensurePackage,
  formatFiles,
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateNxJson,
} from '@nrwl/devkit';
import { getRelativePathToRootTsConfig } from '@nrwl/js';
import { join } from 'path';
import { workspaceLintPluginDir } from '../../utils/workspace-lint-rules';
import { swcCoreVersion, swcNodeVersion } from 'nx/src/utils/versions';
import { nxVersion } from '../../utils/versions';

export const WORKSPACE_RULES_PROJECT_NAME = 'eslint-rules';

export const WORKSPACE_PLUGIN_DIR = 'tools/eslint-rules';

export async function lintWorkspaceRulesProjectGenerator(tree: Tree) {
  const { addPropertyToJestConfig, jestProjectGenerator } = ensurePackage(
    '@nrwl/jest',
    nxVersion
  );

  // Noop if the workspace rules project already exists
  try {
    readProjectConfiguration(tree, WORKSPACE_RULES_PROJECT_NAME);
    return;
  } catch {}

  // Create the project, the test target is added below by the jest generator
  addProjectConfiguration(tree, WORKSPACE_RULES_PROJECT_NAME, {
    root: WORKSPACE_PLUGIN_DIR,
    sourceRoot: WORKSPACE_PLUGIN_DIR,
    targets: {},
  });

  // Generate the required files
  generateFiles(tree, join(__dirname, 'files'), workspaceLintPluginDir, {
    tmpl: '',
    offsetFromRoot: offsetFromRoot(WORKSPACE_PLUGIN_DIR),
    rootTsConfigPath: getRelativePathToRootTsConfig(tree, WORKSPACE_PLUGIN_DIR),
  });

  /**
   * Ensure that when workspace rules are updated they cause all projects to be affected for now.
   * TODO: Explore writing a ProjectGraph plugin to make this more surgical.
   */
  const nxJson = readNxJson(tree);

  if (nxJson.targetDefaults?.lint?.inputs) {
    nxJson.targetDefaults.lint.inputs.push(
      `{workspaceRoot}/${WORKSPACE_PLUGIN_DIR}/**/*`
    );

    updateNxJson(tree, nxJson);
  }

  // Add jest to the project and return installation task
  const installTask = await jestProjectGenerator(tree, {
    project: WORKSPACE_RULES_PROJECT_NAME,
    supportTsx: false,
    skipSerializers: true,
    setupFile: 'none',
    compiler: 'tsc',
    skipFormat: true,
  });

  updateJson(
    tree,
    join(workspaceLintPluginDir, 'tsconfig.spec.json'),
    (json) => {
      if (json.include) {
        json.include = json.include.map((v) => {
          if (v.startsWith('src/**')) {
            return v.replace('src/', '');
          }
          return v;
        });
      }
      if (json.exclude) {
        json.exclude = json.exclude.map((v) => {
          if (v.startsWith('src/**')) {
            return v.replace('src/', '');
          }
          return v;
        });
      }
      return json;
    }
  );

  // Add swc dependencies
  addDependenciesToPackageJson(
    tree,
    {},
    { '@swc-node/register': swcNodeVersion, '@swc/core': swcCoreVersion }
  );

  // Add extra config to the jest.config.ts file to allow ESLint 8 exports mapping to work with jest
  addPropertyToJestConfig(
    tree,
    joinPathFragments(WORKSPACE_PLUGIN_DIR, 'jest.config.ts'),
    'moduleNameMapper',
    {
      '@eslint/eslintrc': '@eslint/eslintrc/dist/eslintrc-universal.cjs',
    }
  );

  await formatFiles(tree);

  return installTask;
}

export const lintWorkspaceRulesProjectSchematic = convertNxGenerator(
  lintWorkspaceRulesProjectGenerator
);
