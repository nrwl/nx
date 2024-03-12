import type { NxPluginV2 } from '../src/utils/nx-plugin';
import { workspaceRoot } from '../src/utils/workspace-root';
import { createNodeFromPackageJson } from '../src/plugins/package-json-workspaces';

const plugin: NxPluginV2 = {
  name: 'nx-all-package-jsons-plugin',
  createNodes: [
    '*/**/package.json',
    (f) => createNodeFromPackageJson(f, workspaceRoot),
  ],
};

module.exports = plugin;
