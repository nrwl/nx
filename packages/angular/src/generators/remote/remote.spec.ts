import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  getProjects,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { getRootTsConfigPathInTree } from '@nx/js';
import { E2eTestRunner } from '../../utils/test-runners';
import {
  generateTestHostApplication,
  generateTestRemoteApplication,
} from '../utils/testing';

describe('MF Remote App Generator', () => {
  it('should generate a remote mf app with no host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      port: 4201,
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('test/webpack.config.js', 'utf-8')).toMatchSnapshot();
    const tsconfigJson = readJson(tree, getRootTsConfigPathInTree(tree));
    expect(tsconfigJson.compilerOptions.paths['test/Module']).toEqual([
      'test/src/app/remote-entry/entry-module.ts',
    ]);
  });

  it('should generate the module file with the "typeSeparator" generator default', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.generators = {
      ...nxJson.generators,
      '@nx/angular:module': {
        typeSeparator: '.',
      },
    };
    updateNxJson(tree, nxJson);

    await generateTestRemoteApplication(tree, {
      directory: 'test',
      port: 4201,
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    expect(tree.read('test/module-federation.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "/**
      * Nx requires a default export of the config to allow correct resolution of the module federation graph.
      **/
      module.exports = {
        name: 'test',
        exposes: {
          './Module': 'test/src/app/remote-entry/entry.module.ts',
        },
      };
      "
    `);
    expect(tree.read(`test/src/app/app.module.ts`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { BrowserModule } from '@angular/platform-browser';
      import { RouterModule } from '@angular/router';
      import { App } from './app';

      @NgModule({
        declarations: [App],
        imports: [
          BrowserModule,
          RouterModule.forRoot([{
            path: '',
            loadChildren: () => import('./remote-entry/entry.module').then(m => m.RemoteEntryModule)
          }], { initialNavigation: 'enabledBlocking' }),
        ],
        providers: [],
        bootstrap: [App],
      })
      export class AppModule {}"
    `);
    const tsconfigJson = readJson(tree, getRootTsConfigPathInTree(tree));
    expect(tsconfigJson.compilerOptions.paths['test/Module']).toEqual([
      'test/src/app/remote-entry/entry.module.ts',
    ]);
  });

  it('should generate a remote mf app with no host when --typescriptConfiguration=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      port: 4201,
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('test/webpack.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a remote mf app with a host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    await generateTestHostApplication(tree, {
      directory: 'host',
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      host: 'host',
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('host/webpack.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a remote mf app with a host when --typescriptConfiguration=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    await generateTestHostApplication(tree, {
      directory: 'host',
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      host: 'host',
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('host/webpack.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/webpack.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should error when a remote app is attempted to be generated with an incorrect host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    try {
      await generateTestRemoteApplication(tree, {
        directory: 'test',
        host: 'host',
        standalone: false,
        skipFormat: true,
      });
    } catch (error) {
      // ASSERT
      expect(error.message).toEqual(
        'The name of the application to be used as the host app does not exist. (host)'
      );
    }
  });

  it('should generate a remote mf app and automatically find the next port available', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    await generateTestRemoteApplication(tree, {
      directory: 'existing',
      port: 4201,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    const project = readProjectConfiguration(tree, 'test');
    expect(project.targets.serve.options.port).toEqual(4202);
  });

  it('should generate a remote mf app and automatically find the next port available even when there are no other targets', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    const project = readProjectConfiguration(tree, 'test');
    expect(project.targets.serve.options.port).toEqual(4201);
  });

  it('should not set the remote as the default project', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      port: 4201,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    const { defaultProject } = readNxJson(tree);
    expect(defaultProject).toBeUndefined();
  });

  it('should generate the a remote setup for standalone components', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      typescriptConfiguration: false,
    });

    // ASSERT
    expect(tree.exists(`test/src/app/app-module.ts`)).toBeFalsy();
    expect(tree.exists(`test/src/app/app.ts`)).toBeFalsy();
    expect(
      tree.exists(`test/src/app/remote-entry/entry-module.ts`)
    ).toBeFalsy();
    expect(tree.read(`test/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
    expect(
      tree.read(`test/module-federation.config.js`, 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read(`test/src/app/remote-entry/entry.ts`, 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read(`test/src/app/app.routes.ts`, 'utf-8')).toMatchSnapshot();
    expect(
      tree.read(`test/src/app/remote-entry/entry.routes.ts`, 'utf-8')
    ).toMatchSnapshot();
    const tsconfigJson = readJson(tree, getRootTsConfigPathInTree(tree));
    expect(tsconfigJson.compilerOptions.paths['test/Routes']).toEqual([
      'test/src/app/remote-entry/entry.routes.ts',
    ]);
  });

  it('should generate the a remote setup for standalone components when --typescriptConfiguration=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      typescriptConfiguration: true,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists(`test/src/app/app-module.ts`)).toBeFalsy();
    expect(tree.exists(`test/src/app/app.ts`)).toBeFalsy();
    expect(
      tree.exists(`test/src/app/remote-entry/entry-module.ts`)
    ).toBeFalsy();
    expect(tree.read(`test/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
    expect(
      tree.read(`test/module-federation.config.ts`, 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read(`test/src/app/remote-entry/entry.ts`, 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read(`test/src/app/app.routes.ts`, 'utf-8')).toMatchSnapshot();
    expect(
      tree.read(`test/src/app/remote-entry/entry.routes.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  it('should not generate an e2e project when e2eTestRunner is none', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'remote1',
      e2eTestRunner: E2eTestRunner.None,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    const projects = getProjects(tree);
    expect(projects.has('remote1-e2e')).toBeFalsy();
  });

  it('should generate a correct app component when inline template is used', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      inlineTemplate: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('test/src/app/app.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { Component } from '@angular/core';

      @Component({
        selector: 'app-root',
        standalone: false,
        template: '<router-outlet></router-outlet>'

      })
      export class App {}"
    `);
  });

  it('should update the index.html to use the remote entry component selector for root when standalone', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestRemoteApplication(tree, {
      directory: 'test',
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('test/src/index.html', 'utf-8')).not.toContain('app-root');
    expect(tree.read('test/src/index.html', 'utf-8')).toContain(
      'app-test-entry'
    );
  });

  describe('--ssr', () => {
    it('should generate the correct files', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await generateTestRemoteApplication(tree, {
        directory: 'test',
        ssr: true,
        typescriptConfiguration: false,
        standalone: false,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
      expect(
        tree.exists(`test/src/app/remote-entry/entry-module.ts`)
      ).toBeTruthy();
      expect(
        tree.read(`test/src/app/app-module.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`test/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/src/bootstrap.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`test/src/main.server.ts`, 'utf-8')).toMatchSnapshot();
      expect(tree.read(`test/src/server.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/module-federation.config.js`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/webpack.server.config.js`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/remote-entry/entry.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/remote-entry/entry.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/remote-entry/entry.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets['static-server']).toMatchSnapshot();
    });

    it('should generate the correct files when --typescriptConfiguration=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await generateTestRemoteApplication(tree, {
        directory: 'test',
        ssr: true,
        typescriptConfiguration: true,
        standalone: false,
        skipFormat: true,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
      expect(
        tree.exists(`test/src/app/remote-entry/entry-module.ts`)
      ).toBeTruthy();
      expect(
        tree.read(`test/src/app/app-module.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`test/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/src/bootstrap.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`test/src/main.server.ts`, 'utf-8')).toMatchSnapshot();
      expect(tree.read(`test/src/server.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/module-federation.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/webpack.server.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/remote-entry/entry.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/remote-entry/entry.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/remote-entry/entry.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets['static-server']).toMatchSnapshot();
    });
  });

  it('should not touch the package.json when run with `--skipPackageJson`', async () => {
    const tree = createTreeWithEmptyWorkspace();
    let initialPackageJson;
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = {};
      json.devDependencies = {};
      initialPackageJson = json;

      return json;
    });

    await generateTestRemoteApplication(tree, {
      directory: 'test',
      port: 4201,
      ssr: true,
      skipFormat: true,
      skipPackageJson: true,
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual(initialPackageJson);
  });

  it('should error when an invalid remote name is passed to the remote generator', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await expect(
      generateTestRemoteApplication(tree, {
        directory: 'test/my-remote',
      })
    ).rejects.toMatchInlineSnapshot(`
      [Error: Invalid remote name: my-remote. Remote project names must:
      - Start with a letter, dollar sign ($) or underscore (_)
      - Followed by any valid character (letters, digits, underscores, or dollar signs)
      The regular expression used is ^[a-zA-Z_$][a-zA-Z_$0-9]*$.]
    `);
  });

  describe('compat', () => {
    it('should generate components with the "component" type for versions lower than v20', async () => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.dependencies = {
          ...json.dependencies,
          '@angular/core': '~19.2.0',
        };
        return json;
      });
      await generateTestHostApplication(tree, {
        directory: 'host',
        typescriptConfiguration: false,
        skipFormat: true,
      });

      await generateTestRemoteApplication(tree, {
        directory: 'test',
        host: 'host',
        typescriptConfiguration: false,
        skipFormat: true,
      });

      expect(tree.read('host/src/app/app.component.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { Component } from '@angular/core';
        import { RouterModule } from '@angular/router';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @Component({
          imports: [NxWelcomeComponent, RouterModule],
          selector: 'app-root',
          templateUrl: './app.component.html',
          styleUrl: './app.component.css',
        })
        export class AppComponent {
          title = 'host';
        }
        "
      `);
      expect(tree.read('test/src/app/remote-entry/entry.component.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { Component } from '@angular/core';
        import { CommonModule } from '@angular/common';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @Component({
          imports: [CommonModule, NxWelcomeComponent],
          selector: 'app-test-entry',
          template: \`<app-nx-welcome></app-nx-welcome>\`
        })
        export class RemoteEntryComponent {}
        "
      `);
      expect(tree.read('test/src/app/remote-entry/entry.routes.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { Route } from '@angular/router';
        import { RemoteEntryComponent } from './entry.component';

        export const remoteRoutes: Route[] = [{ path: '', component: RemoteEntryComponent }];"
      `);
    });

    it('should generate modules with the "." type separator for versions lower than v20', async () => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.dependencies = {
          ...json.dependencies,
          '@angular/core': '~19.2.0',
        };
        return json;
      });

      await generateTestRemoteApplication(tree, {
        directory: 'test',
        standalone: false,
        typescriptConfiguration: false,
        skipFormat: true,
      });

      expect(tree.read('test/src/app/app.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { AppComponent } from './app.component';

        @NgModule({
          declarations: [AppComponent],
          imports: [
            BrowserModule,
            RouterModule.forRoot([{
              path: '',
              loadChildren: () => import('./remote-entry/entry.module').then(m => m.RemoteEntryModule)
            }], { initialNavigation: 'enabledBlocking' }),
          ],
          providers: [],
          bootstrap: [AppComponent],
        })
        export class AppModule {}"
      `);
      expect(tree.read('test/src/app/remote-entry/entry.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';
        import { RouterModule } from '@angular/router';

        import { RemoteEntryComponent } from './entry.component';
        import { NxWelcomeComponent } from './nx-welcome.component';
        import { remoteRoutes } from './entry.routes';

        @NgModule({
          declarations: [RemoteEntryComponent, NxWelcomeComponent],
          imports: [
            CommonModule,
            RouterModule.forChild(remoteRoutes),
          ],
          providers: [],
        })
        export class RemoteEntryModule {}"
      `);
    });
  });
});
