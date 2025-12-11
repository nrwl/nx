import { createNodesV2, type DotNetPluginOptions } from './create-nodes';
import { createDependencies } from './create-dependencies';
import { NxPlugin } from '@nx/devkit';

const regularPlugin: NxPlugin<DotNetPluginOptions> = {
  name: '@nx/dotnet',
  createNodes: createNodesV2,
  createNodesV2,
  createDependencies,
};

const noopPlugin: NxPlugin = {
  name: '@nx/dotnet [disabled]',
};

const plugin: NxPlugin<DotNetPluginOptions> =
  process.env.NX_DOTNET_DISABLE === 'true' ? noopPlugin : regularPlugin;

export = plugin;
