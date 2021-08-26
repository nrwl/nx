import {
  convertNxGenerator,
  generateFiles,
  joinPathFragments,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { join } from 'path';
import { workspaceLintPluginDir } from '../../utils/workspace-lint-rules';

export async function lintInitWorkspaceRulesGenerator(tree: Tree) {
  // Generate the required files if they don't exist yet
  if (!tree.exists(joinPathFragments(workspaceLintPluginDir, 'index.ts'))) {
    generateFiles(tree, join(__dirname, 'files'), workspaceLintPluginDir, {
      tmpl: '',
    });
  }

  // Ensure that when workspace rules are updated they cause all projects to be affected
  const workspaceConfig = readWorkspaceConfiguration(tree);
  updateWorkspaceConfiguration(tree, {
    ...workspaceConfig,
    implicitDependencies: {
      ...workspaceConfig.implicitDependencies,
      'tools/eslint-rules/**/*': '*',
    },
  });
}

export const lintInitWorkspaceRulesSchematic = convertNxGenerator(
  lintInitWorkspaceRulesGenerator
);
