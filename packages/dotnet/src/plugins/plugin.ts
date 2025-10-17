import { createNodesV2, type DotNetPluginOptions } from './create-nodes';
import { createDependencies } from './create-dependencies';
import { NxPlugin } from '@nx/devkit';

const plugin: NxPlugin<DotNetPluginOptions> = {
  name: '@nx/dotnet',
  createNodes: createNodesV2,
  createNodesV2,
  createDependencies,
};

export = plugin;
