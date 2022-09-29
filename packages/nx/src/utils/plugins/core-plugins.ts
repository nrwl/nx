import * as chalk from 'chalk';
import { output } from '../output';
import type { CorePlugin, PluginCapabilities } from './models';

export function fetchCorePlugins(): CorePlugin[] {
  return [
    {
      name: '@nrwl/angular',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/cypress',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/detox',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/esbuild',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/expo',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/express',
      capabilities: 'generators',
    },
    {
      name: '@nrwl/jest',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/js',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/linter',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/nest',
      capabilities: 'generators',
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
      name: 'nx',
      capabilities: 'executors',
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
      name: '@nrwl/react-native',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/rollup',
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
      name: '@nrwl/webpack',
      capabilities: 'executors,generators',
    },
    {
      name: '@nrwl/workspace',
      capabilities: 'executors,generators',
    },
  ];
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
