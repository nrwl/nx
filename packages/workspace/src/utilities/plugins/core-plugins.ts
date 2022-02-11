import * as chalk from 'chalk';
import { output } from '../output';
import type { CorePlugin, PluginCapabilities } from './models';

export function fetchCorePlugins() {
  const corePlugins: CorePlugin[] = [
    {
      name: '@nrwl/angular',
      capabilities: 'generators',
    },
    {
      name: '@nrwl/cypress',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/express',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/jest',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/linter',
      capabilities: 'executors',
    },
    {
      name: '@nrwl/nest',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/next',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/node',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/nx-plugin',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/react',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/js',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/storybook',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/web',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/workspace',
      capabilities: 'executors,generators',
    },
  ];
  return corePlugins;
}

export function listCorePlugins(
  installedPlugins: Map<string, PluginCapabilities>,
  corePlugins: CorePlugin[]
): void {
  const alsoAvailable = corePlugins.filter(
    (p) => !installedPlugins.has(p.name)
  );

  if (alsoAvailable.length) {
    output.log({
      title: `Also available:`,
      bodyLines: alsoAvailable.map((p) => {
        return `${chalk.bold(p.name)} (${p.capabilities})`;
      }),
    });
  }
}
