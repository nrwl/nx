import { terminal } from '@angular-devkit/core';
import { output } from '../output';
import { CorePlugin, PluginCapabilities } from './models';

export function fetchCorePlugins() {
  const corePlugins: CorePlugin[] = [
    {
      name: '@nrwl/angular',
      capabilities: 'schematics',
    },
    {
      name: '@nrwl/bazel',
      capabilities: 'schematics',
    },
    {
      name: '@nrwl/cypress',
      capabilities: 'builders,schematics',
    },
    {
      name: '@nrwl/express',
      capabilities: 'builders,schematics',
    },
    {
      name: '@nrwl/jest',
      capabilities: 'builders,schematics',
    },
    {
      name: '@nrwl/linter',
      capabilities: 'builders',
    },
    {
      name: '@nrwl/nest',
      capabilities: 'builders,schematics',
    },
    {
      name: '@nrwl/next',
      capabilities: 'builders,schematics',
    },
    {
      name: '@nrwl/node',
      capabilities: 'builders,schematics',
    },
    {
      name: '@nrwl/nx-plugin',
      capabilities: 'builders,schematics',
    },
    {
      name: '@nrwl/react',
      capabilities: 'builders,schematics',
    },
    {
      name: '@nrwl/storybook',
      capabilities: 'builders,schematics',
    },
    {
      name: '@nrwl/web',
      capabilities: 'builders,schematics',
    },
    {
      name: '@nrwl/workspace',
      capabilities: 'builders,schematics',
    },
  ];
  return corePlugins;
}

export function listCorePlugins(
  installedPlugins: PluginCapabilities[],
  corePlugins: CorePlugin[]
) {
  const installedPluginsMap: Set<string> = new Set<string>(
    installedPlugins.map((p) => p.name)
  );

  const alsoAvailable = corePlugins.filter(
    (p) => !installedPluginsMap.has(p.name)
  );

  if (alsoAvailable.length) {
    output.log({
      title: `Also available:`,
      bodyLines: alsoAvailable.map((p) => {
        return `${terminal.bold(p.name)} (${p.capabilities})`;
      }),
    });
  }
}
