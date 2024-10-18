import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { addSwcRegisterDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import { join } from 'path';
import {
  eslint9__typescriptESLintVersion,
  nxVersion,
  typescriptESLintVersion,
} from '../../utils/versions';
import { workspaceLintPluginDir } from '../../utils/workspace-lint-rules';
import { useFlatConfig } from '../../utils/flat-config';

export const WORKSPACE_RULES_PROJECT_NAME = 'eslint-rules';

export const WORKSPACE_PLUGIN_DIR = 'tools/eslint-rules';

export interface LintWorkspaceRulesProjectGeneratorOptions {
  skipFormat?: boolean;
  addPlugin?: boolean;
}

export async function lintWorkspaceRulesProjectGenerator(
  tree: Tree,
  options: LintWorkspaceRulesProjectGeneratorOptions = {}
) {
  const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
    '@nx/jest',
    nxVersion
  );
  const tasks: GeneratorCallback[] = [];

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
  tasks.push(
    await configurationGenerator(tree, {
      ...options,
      project: WORKSPACE_RULES_PROJECT_NAME,
      supportTsx: false,
      skipSerializers: true,
      setupFile: 'none',
      compiler: 'tsc',
      skipFormat: true,
    })
  );

  updateJson(
    tree,
    join(workspaceLintPluginDir, 'tsconfig.spec.json'),
    (json) => {
      delete json.compilerOptions?.module;

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
  tasks.push(addSwcRegisterDependencies(tree));

  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@typescript-eslint/utils': useFlatConfig(tree)
          ? eslint9__typescriptESLintVersion
          : typescriptESLintVersion,
      }
    )
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}
