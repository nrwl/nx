import { terminal } from '@angular-devkit/core';
import { output } from '../output';
import { CorePlugin, PluginCapabilities } from './models';

export function fetchCorePlugins() {
  const corePlugins: CorePlugin[] = [
    {
      name: '@nrwl/angular',
      capabilities: 'generators',
    },
    {
      name: '@nrwl/cypress',
      capabilities: 'builders,generators',
    },
    {
      name: '@nrwl/express',
      capabilities: 'builders,generators',
    },
    {
      name: '@nrwl/jest',
      capabilities: 'builders,generators',
    },
    {
      name: '@nrwl/linter',
      capabilities: 'builders',
    },
    {
      name: '@nrwl/nest',
      capabilities: 'builders,generators',
    },
    {
      name: '@nrwl/next',
      capabilities: 'builders,generators',
    },
    {
      name: '@nrwl/node',
      capabilities: 'builders,generators',
    },
    {
      name: '@nrwl/nx-plugin',
      capabilities: 'builders,generators',
    },
    {
      name: '@nrwl/react',
      capabilities: 'builders,generators',
    },
    {
      name: '@nrwl/storybook',
      capabilities: 'builders,generators',
    },
    {
      name: '@nrwl/web',
      capabilities: 'builders,generators',
    },
    {
      name: '@nrwl/workspace',
      capabilities: 'builders,generators',
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
