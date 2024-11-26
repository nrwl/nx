import type { NxPluginV2 } from '../src/project-graph/plugins';
import { workspaceRoot } from '../src/utils/workspace-root';
import { createNodeFromPackageJson } from '../src/plugins/package-json';

const plugin: NxPluginV2 = {
  name: 'nx-all-package-jsons-plugin',
  createNodes: [
    '*/**/package.json',
    (f) => createNodeFromPackageJson(f, workspaceRoot),
  ],
};

module.exports = plugin;
