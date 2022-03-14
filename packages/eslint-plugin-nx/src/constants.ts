import { appRootPath } from 'nx/src/utils/app-root';
import { join } from 'path';

export const WORKSPACE_PLUGIN_DIR = join(appRootPath, 'tools/eslint-rules');

/**
 * We add a namespace so that we mitigate the risk of rule name collisions as much as
 * possible between what users might create in their workspaces and what we might want
 * to offer directly in eslint-plugin-nx in the future.
 *
 * E.g. if a user writes a rule called "foo", then they will include it in their ESLint
 * config files as:
 *
 * "@nrwl/nx/workspace/foo": "error"
 */
export const WORKSPACE_RULE_NAMESPACE = 'workspace';
