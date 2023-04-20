import * as chalk from 'chalk';
import { output } from '../output';
import type { CorePlugin, PluginCapabilities } from './models';

export function fetchCorePlugins(): CorePlugin[] {
  return [
    {
      name: '@nx/angular',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/cypress',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/detox',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/esbuild',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/expo',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/express',
      capabilities: 'generators',
    },
    {
      name: '@nx/jest',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/js',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/linter',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/nest',
      capabilities: 'generators',
    },
    {
      name: '@nx/next',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/node',
      capabilities: 'executors,generators',
    },
    {
      name: 'nx',
      capabilities: 'executors',
    },
    {
      name: '@nx/plugin',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/react',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/react-native',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/rollup',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/storybook',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/vite',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/web',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/webpack',
      capabilities: 'executors,generators',
    },
    {
      name: '@nx/workspace',
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
