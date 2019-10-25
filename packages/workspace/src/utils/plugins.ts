/**
 * This file is used by `nx list` to display approved plugins
 */

export interface Plugin {
  name: string;
  capabilities: 'builders' | 'schematics' | 'builders,schematics';
  link?: string;
}

export const approvedPlugins: Plugin[] = [
  {
    name: '@nrwl/angular',
    capabilities: 'schematics'
  },
  {
    name: '@nrwl/cypress',
    capabilities: 'builders,schematics'
  },
  {
    name: '@nrwl/express',
    capabilities: 'builders,schematics'
  },
  {
    name: '@nrwl/jest',
    capabilities: 'builders,schematics'
  },
  {
    name: '@nrwl/nest',
    capabilities: 'builders,schematics'
  },
  {
    name: '@nrwl/next',
    capabilities: 'builders,schematics'
  },
  {
    name: '@nrwl/node',
    capabilities: 'builders,schematics'
  },
  {
    name: '@nrwl/react',
    capabilities: 'builders,schematics'
  },
  {
    name: '@nrwl/storybook',
    capabilities: 'builders,schematics'
  },
  {
    name: '@nrwl/web',
    capabilities: 'builders,schematics'
  }
];
