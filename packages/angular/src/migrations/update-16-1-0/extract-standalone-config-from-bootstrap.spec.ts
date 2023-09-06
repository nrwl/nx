import {
  ProjectConfiguration,
  ProjectGraph,
  Tree,
  addProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import extractStandaloneConfig from './extract-standalone-config-from-bootstrap';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
}));

const TEST_MAIN_FILE = `import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import { appRoutes } from './app/app.routes';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(appRoutes, withEnabledBlockingInitialNavigation())],
}).catch((err) => console.error(err));`;

describe('extractStandaloneConfigFromBootstrap', () => {
  it('should extract the config correctly from a standard main.ts file', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProject(
      tree,
      'app1',
      {
        name: 'app1',
        root: 'apps/app1',
        sourceRoot: 'apps/app1/src',
        projectType: 'application',
        targets: {
          build: {
            options: { main: 'apps/app1/src/main.ts' },
          },
        },
      },
      ['npm:@angular/core']
    );

    tree.write('apps/app1/src/main.ts', TEST_MAIN_FILE);

    // ACT
    await extractStandaloneConfig(tree);

    // ASSERT
    expect(tree.read('apps/app1/src/main.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { appConfig } from './app/app.config';
      import { bootstrapApplication } from '@angular/platform-browser';

      import { AppComponent } from './app/app.component';

      bootstrapApplication(AppComponent, appConfig).catch((err) =>
        console.error(err)
      );
      "
    `);
    expect(tree.exists('apps/app1/src/app/app.config.ts')).toBeTruthy();
    expect(tree.read('apps/app1/src/app/app.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ApplicationConfig } from '@angular/core';
      import {
        provideRouter,
        withEnabledBlockingInitialNavigation,
      } from '@angular/router';
      import { appRoutes } from './app.routes';
      export const appConfig: ApplicationConfig = {
        providers: [provideRouter(appRoutes, withEnabledBlockingInitialNavigation())],
      };
      "
    `);
  });

  it('should extract the config correctly when the main.ts imports bootstrap from bootstrap.ts file', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProject(
      tree,
      'app1',
      {
        name: 'app1',
        root: 'apps/app1',
        sourceRoot: 'apps/app1/src',
        projectType: 'application',
        targets: {
          build: {
            options: { main: 'apps/app1/src/main.ts' },
          },
        },
      },
      ['npm:@angular/core']
    );

    tree.write('apps/app1/src/main.ts', `import('./bootstrap');`);
    tree.write('apps/app1/src/bootstrap.ts', TEST_MAIN_FILE);

    // ACT
    await extractStandaloneConfig(tree);

    // ASSERT
    expect(tree.read('apps/app1/src/main.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import('./bootstrap');
      "
    `);
    expect(tree.read('apps/app1/src/bootstrap.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { appConfig } from './app/app.config';
      import { bootstrapApplication } from '@angular/platform-browser';

      import { AppComponent } from './app/app.component';

      bootstrapApplication(AppComponent, appConfig).catch((err) =>
        console.error(err)
      );
      "
    `);
    expect(tree.exists('apps/app1/src/app/app.config.ts')).toBeTruthy();
    expect(tree.read('apps/app1/src/app/app.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ApplicationConfig } from '@angular/core';
      import {
        provideRouter,
        withEnabledBlockingInitialNavigation,
      } from '@angular/router';
      import { appRoutes } from './app.routes';
      export const appConfig: ApplicationConfig = {
        providers: [provideRouter(appRoutes, withEnabledBlockingInitialNavigation())],
      };
      "
    `);
  });

  it('should not throw with non-angular projects', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProject(
      tree,
      'app1',
      {
        name: 'app1',
        projectType: 'application',
        root: 'apps/app1',
        sourceRoot: 'apps/app1',
        targets: {
          build: {
            executor: '@nx-go/nx-go:build',
            options: { main: 'apps/app1' },
          },
        },
      },
      []
    );

    tree.write(
      'apps/app1/main.go',
      `package main

import "fmt"

func Hello(name string) string {
  result := "Hello " + name
  return result
}

func main() {
  fmt.Println(Hello("app1"))
}`
    );

    // ACT && ASSERT
    await expect(extractStandaloneConfig(tree)).resolves.not.toThrow();
  });
});

function addProject(
  tree: Tree,
  projectName: string,
  config: ProjectConfiguration,
  dependencies: string[]
): void {
  projectGraph = {
    dependencies: {
      [projectName]: dependencies.map((d) => ({
        source: projectName,
        target: d,
        type: 'static',
      })),
    },
    nodes: {
      [projectName]: { data: config, name: projectName, type: 'app' },
    },
  };
  addProjectConfiguration(tree, projectName, config);
}
