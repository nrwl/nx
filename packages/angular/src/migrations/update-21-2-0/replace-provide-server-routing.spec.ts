import {
  addProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './replace-provide-server-routing';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
}));

describe('replace-provide-server-routing migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
    projectGraph = {
      dependencies: {
        app1: [
          {
            source: 'app1',
            target: 'npm:@angular/ssr',
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

  it('should remove "provideServerRouting", add an import for "withRoutes" and update "provideServerRendering" to use "withRoutes"', async () => {
    tree.write(
      'apps/app1/src/app/app.config.server.ts',
      `import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, provideServerRouting } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(), provideServerRouting(serverRoutes)],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/app/app.config.server.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
      import { provideServerRendering, withRoutes } from '@angular/ssr';
      import { appConfig } from './app.config';
      import { serverRoutes } from './app.routes.server';

      const serverConfig: ApplicationConfig = {
        providers: [provideServerRendering(withRoutes(serverRoutes))],
      };

      export const config = mergeApplicationConfig(appConfig, serverConfig);
      "
    `);
  });

  it('should include extra arguments provided to "provideServerRouting"', async () => {
    tree.write(
      'apps/app1/src/app/app.config.server.ts',
      `import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, provideServerRouting, withAppShell } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRouting(serverRoutes, withAppShell(AppShellComponent)),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/app/app.config.server.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
      import { provideServerRendering, withAppShell, withRoutes } from '@angular/ssr';
      import { appConfig } from './app.config';
      import { serverRoutes } from './app.routes.server';
      
      const serverConfig: ApplicationConfig = {
        providers: [
          provideServerRendering(
            withRoutes(serverRoutes),
            withAppShell(AppShellComponent)
          ),
        ],
      };

      export const config = mergeApplicationConfig(appConfig, serverConfig);
      "
    `);
  });
});
