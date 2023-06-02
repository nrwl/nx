import { ProcessedPackageMetadata } from '@nx/nx-dev/models-package';

export const pkg: ProcessedPackageMetadata = {
  description: '',
  documents: {
    '/packages/rspack/documents/overview': {
      id: 'overview',
      name: 'Overview of the Nx Rspack plugin',
      description:
        'The Nx Plugin for Rspack contains executors and generators that support building applications using Rspack.',
      file: '',
      itemList: [],
      isExternal: false,
      path: '/packages/rspack/documents/overview',
      tags: [],
    },
    '/packages/rspack/documents/rspack-plugins': {
      id: 'rspack-plugins',
      name: 'Rspack plugins',
      description: 'Rspack plugins',
      file: '',
      itemList: [],
      isExternal: false,
      path: '/packages/rspack/documents/rspack-plugins',
      tags: [],
    },
    '/packages/rspack/documents/rspack-config-setup': {
      id: 'rspack-config-setup',
      name: ' How to configure Rspack on your Nx workspace',
      description:
        'A guide on how to configure rspack on your Nx workspace, and instructions on how to customize your rspack configuration.',
      file: '',
      itemList: [],
      isExternal: false,
      path: '/packages/rspack/documents/rspack-config-setup',
      tags: [],
    },
  },
  executors: {
    '/packages/rspack/executors/rspack': {
      description: 'Run rspack build.',
      file: 'generated/packages/rspack/executors/rspack.json',
      hidden: false,
      name: 'rspack',
      originalFilePath: '/packages/rspack/src/executors/rspack/schema.json',
      path: '/packages/rspack/executors/rspack',
      type: 'executor',
    },
    '/packages/rspack/executors/dev-server': {
      description: 'Serve a web application.',
      file: 'generated/packages/rspack/executors/dev-server.json',
      hidden: false,
      name: 'dev-server',
      originalFilePath: '/packages/rspack/src/executors/dev-server/schema.json',
      path: '/packages/rspack/executors/dev-server',
      type: 'executor',
    },
  },
  generators: {
    '/packages/rspack/generators/init': {
      description: 'Initialize the `@nx/rspack` plugin.',
      file: 'generated/packages/rspack/generators/init.json',
      hidden: false,
      name: 'init',
      originalFilePath: '/packages/rspack/src/generators/init/schema.json',
      path: '/packages/rspack/generators/init',
      type: 'generator',
    },
    '/packages/rspack/generators/configuration': {
      description: 'Add Rspack configuration to a project.',
      file: 'generated/packages/rspack/generators/configuration.json',
      hidden: false,
      name: 'configuration',
      originalFilePath:
        '/packages/rspack/src/generators/configuration/schema.json',
      path: '/packages/rspack/generators/configuration',
      type: 'generator',
    },
    '/packages/rspack/generators/application': {
      description: 'Add Rspack application to a project.',
      file: 'generated/packages/rspack/generators/application.json',
      hidden: false,
      name: 'application',
      originalFilePath:
        '/packages/rspack/src/generators/application/schema.json',
      path: '/packages/rspack/generators/application',
      type: 'generator',
    },
  },
  githubRoot: 'https://github.com/nrwl/nx-labs/tree/main/packages/rspack',
  name: 'Rspack',
  packageName: '@nx/rspack',
  path: '',
  root: '',
  source: '',
};
