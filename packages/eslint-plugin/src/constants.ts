import { workspaceRoot } from '@nx/devkit';
import { join } from 'path';

export const WORKSPACE_RULES_PATH = 'tools/eslint-rules';

export const WORKSPACE_PLUGIN_DIR = join(workspaceRoot, WORKSPACE_RULES_PATH);

/**
 * We add a namespace so that we mitigate the risk of rule name collisions as much as
 * possible between what users might create in their workspaces and what we might want
 * to offer directly in @nx/eslint-plugin in the future.
 *
 * E.g. if a user writes a rule called "foo", then they will include it in their ESLint
 * config files as:
 *
 * "@nx/workspace-foo": "error"
 */
export const WORKSPACE_RULE_PREFIX = 'workspace';
