import {
  addProjectConfiguration,
  readJson,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migrate-provide-server-rendering-import';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
}));

describe('migrate-provide-server-rendering-import migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
    projectGraph = {
      dependencies: {
        app1: [
          {
            source: 'app1',
            target: 'npm:@angular/platform-server',
            type: 'static',
          },
        ],
      },
      nodes: {
        app1: {
          data: { root: 'apps/app1' },
          name: 'app1',
          type: 'app',
        },
      },
    };
  });

  it('should replace provideServerRouting with provideServerRendering', async () => {
    tree.write(
      'apps/app1/src/app/app.config.server.ts',
      `import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideServerRouting } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRouting(serverRoutes)
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/app/app.config.server.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
      import { provideServerRouting, provideServerRendering } from '@angular/ssr';
      import { appConfig } from './app.config';
      import { serverRoutes } from './app.routes.server';

      const serverConfig: ApplicationConfig = {
        providers: [provideServerRendering(), provideServerRouting(serverRoutes)],
      };

      export const config = mergeApplicationConfig(appConfig, serverConfig);
      "
    `);
  });

  it('should add "@angular/ssr" when the import is changed', async () => {
    tree.write(
      'apps/app1/src/app/app.config.server.ts',
      `import { provideServerRendering } from '@angular/platform-server';`
    );

    await migration(tree);

    const { dependencies } = readJson(tree, 'package.json');
    expect(dependencies['@angular/ssr']).toBeDefined();
  });

  it('should not add "@angular/ssr" dependency when no imports have been updated', async () => {
    tree.write(
      'apps/app1/src/app/app.config.server.ts',
      `import { provideClientHydration } from '@angular/platform-browser';`
    );

    await migration(tree);

    const { dependencies } = readJson(tree, 'package.json');
    expect(dependencies['@angular/ssr']).toBeUndefined();
  });
});
