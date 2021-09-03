import {
  addProjectConfiguration,
  convertNxGenerator,
  generateFiles,
  offsetFromRoot,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { jestProjectGenerator } from '@nrwl/jest';
import { join } from 'path';
import { workspaceLintPluginDir } from '../../utils/workspace-lint-rules';

export const WORKSPACE_RULES_PROJECT_NAME = 'eslint-rules';

const WORKSPACE_PLUGIN_DIR = 'tools/eslint-rules';

export async function lintWorkspaceRulesProjectGenerator(tree: Tree) {
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
  });

  /**
   * Ensure that when workspace rules are updated they cause all projects to be affected for now.
   * TODO: Explore writing a ProjectGraph plugin to make this more surgical.
   */
  const workspaceConfig = readWorkspaceConfiguration(tree);
  updateWorkspaceConfiguration(tree, {
    ...workspaceConfig,
    implicitDependencies: {
      ...workspaceConfig.implicitDependencies,
      [`${WORKSPACE_PLUGIN_DIR}/**/*`]: '*',
    },
  });

  // Add jest to the project and return installation task
  return await jestProjectGenerator(tree, {
    project: WORKSPACE_RULES_PROJECT_NAME,
    supportTsx: false,
    skipSerializers: true,
    setupFile: 'none',
    babelJest: false,
  });
}

export const lintWorkspaceRulesProjectSchematic = convertNxGenerator(
  lintWorkspaceRulesProjectGenerator
);
