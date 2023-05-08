import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import extractStandaloneConfig from './extract-standalone-config-from-bootstrap';
import { addProjectConfiguration } from '@nx/devkit';

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
    addProjectConfiguration(tree, 'app1', {
      name: 'app1',
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        build: {
          options: {
            main: 'apps/app1/src/main.ts',
          },
        },
      },
    });

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
    addProjectConfiguration(tree, 'app1', {
      name: 'app1',
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        build: {
          options: {
            main: 'apps/app1/src/main.ts',
          },
        },
      },
    });

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
});
