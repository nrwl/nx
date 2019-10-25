/**
 * This file is used by `nx list --recommended` to list the recommended schematic collections (plugins)
 */

export enum Collection {
  Angular = '@nrwl/angular',
  Cypress = '@nrwl/cypress',
  Express = '@nrwl/express',
  Jest = '@nrwl/jest',
  Nest = '@nrwl/nest',
  Next = '@nrwl/next',
  Node = '@nrwl/node',
  React = '@nrwl/react',
  Storybook = '@nrwl/storybook',
  Web = '@nrwl/web'
}

export interface CollectionInfo {
  description: string;
  for?: string[];
  dependencies?: Collection[];
}

export type CollectionMap = {
  [collection in Collection]: CollectionInfo;
};

export const recommendedCollectionMap: CollectionMap = {
  [Collection.Angular]: {
    description:
      'Provides code generation for Angular, NgRx and DataPersistence',
    for: ['@angular/core'],
    dependencies: [Collection.Cypress, Collection.Jest]
  },
  [Collection.Cypress]: {
    description: 'Provides tools to run Cypress tests',
    for: ['@angular/core', 'react', '@nrwl/web', 'webpack']
  },
  [Collection.Express]: {
    description: 'Provides code generation and tools for Express',
    for: ['express'],
    dependencies: [Collection.Node, Collection.Jest]
  },
  [Collection.Jest]: {
    description: 'Provides tools to run Jest tests'
  },
  [Collection.Nest]: {
    description: 'Provides code generation and tools for NestJS',
    for: ['@nestjs/core'],
    dependencies: [Collection.Node, Collection.Jest]
  },
  [Collection.Next]: {
    description: 'Provides code generation and tools for Next.js',
    for: ['next'],
    dependencies: [Collection.React]
  },
  [Collection.Node]: {
    description: 'Provides code generation and tools for Node'
  },
  [Collection.React]: {
    description: 'Provides code generation and tools for React',
    for: ['react'],
    dependencies: [Collection.Cypress, Collection.Jest, Collection.Web]
  },

  [Collection.Storybook]: {
    description: 'Provides tools to run Storybook tests',
    for: ['@storybook/core'],
    dependencies: [Collection.Cypress]
  },
  [Collection.Web]: {
    description:
      'Provides code generation and tools for standard Web applications'
  }
};
