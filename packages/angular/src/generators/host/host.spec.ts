import 'nx/src/internal-testing-utils/mock-project-graph';

import { readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  getProjects,
  readProjectConfiguration,
} from 'nx/src/generators/utils/project-configuration';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import {
  generateTestHostApplication,
  generateTestRemoteApplication,
} from '../utils/testing';

describe('Host App Generator', () => {
  it('should generate a host app with no remotes', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'test',
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });
  it('should generate a host app with no remotes when --typescript=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'test',
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('test/webpack.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a host app with a remote', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    await generateTestRemoteApplication(tree, {
      directory: 'remote',
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'test',
      remotes: ['remote'],
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('remote/webpack.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });
  it('should generate a host app with a remote when --typesscript=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    await generateTestRemoteApplication(tree, {
      directory: 'remote',
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'test',
      remotes: ['remote'],
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('remote/webpack.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/webpack.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a host and any remotes that dont exist with correct routing setup', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT

    await generateTestHostApplication(tree, {
      directory: 'host-app',
      remotes: ['remote1', 'remote2'],
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('remote2/project.json')).toBeTruthy();
    expect(
      tree.read('host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1','remote2'`);
    expect(tree.read('host-app/src/app/app.html', 'utf-8'))
      .toMatchInlineSnapshot(`
      "<ul class="remote-menu">
      <li><a routerLink="/">Home</a></li>
      <li><a routerLink="remote1">Remote1</a></li>
      <li><a routerLink="remote2">Remote2</a></li>
      </ul>
      <router-outlet></router-outlet>
      "
    `);
  });

  it('should generate a host and any remotes that dont exist with correct routing setup when --typescript=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT

    await generateTestHostApplication(tree, {
      directory: 'host-app',
      remotes: ['remote1', 'remote2'],
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('remote2/project.json')).toBeTruthy();
    expect(
      tree.read('host-app/module-federation.config.ts', 'utf-8')
    ).toContain(`'remote1','remote2'`);
    expect(tree.read('host-app/src/app/app.html', 'utf-8'))
      .toMatchInlineSnapshot(`
      "<ul class="remote-menu">
      <li><a routerLink="/">Home</a></li>
      <li><a routerLink="remote1">Remote1</a></li>
      <li><a routerLink="remote2">Remote2</a></li>
      </ul>
      <router-outlet></router-outlet>
      "
    `);
  });

  it('should generate a host, integrate existing remotes and generate any remotes that dont exist', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    await generateTestRemoteApplication(tree, {
      directory: 'remote1',
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'host-app',
      remotes: ['remote1', 'remote2', 'remote3'],
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('remote2/project.json')).toBeTruthy();
    expect(tree.exists('remote3/project.json')).toBeTruthy();
    expect(
      tree.read('host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1','remote2','remote3'`);
  });

  it('should generate a host, integrate existing remotes and generate any remotes that dont exist when --typescript=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    await generateTestRemoteApplication(tree, {
      directory: 'remote1',
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'host-app',
      remotes: ['remote1', 'remote2', 'remote3'],
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('remote2/project.json')).toBeTruthy();
    expect(tree.exists('remote3/project.json')).toBeTruthy();
    expect(
      tree.read('host-app/module-federation.config.ts', 'utf-8')
    ).toContain(`'remote1','remote2','remote3'`);
  });

  it('should generate a host, integrate existing remotes and generate any remotes that dont exist, in a directory', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    await generateTestRemoteApplication(tree, {
      directory: 'remote1',
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'foo/host-app',
      remotes: ['remote1', 'remote2', 'remote3'],
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote2/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote3/project.json')).toBeTruthy();
    expect(
      tree.read('foo/host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1','remote2','remote3'`);
  });

  it('should generate a host, integrate existing remotes and generate any remotes that dont exist, in a directory when --typescript=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    await generateTestRemoteApplication(tree, {
      directory: 'remote1',
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'foo/host-app',
      remotes: ['remote1', 'remote2', 'remote3'],
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote2/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote3/project.json')).toBeTruthy();
    expect(
      tree.read('foo/host-app/module-federation.config.ts', 'utf-8')
    ).toContain(`'remote1','remote2','remote3'`);
  });

  it('should generate a host with remotes using standalone components', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'host',
      remotes: ['remote1'],
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists(`host/src/app/app-module.ts`)).toBeFalsy();
    expect(tree.read(`host/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
    expect(tree.read(`host/src/app/app.ts`, 'utf-8')).toMatchSnapshot();
  });

  it('should generate the correct app component spec file', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'host',
      remotes: ['remote1'],
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read(`host/src/app/app.spec.ts`, 'utf-8')).toMatchSnapshot();
  });

  it('should generate the correct app component spec file with a directory', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestHostApplication(tree, {
      remotes: ['remote1'],
      directory: 'test/dashboard',
      skipFormat: true,
    });

    // ASSERT
    expect(
      tree.read(`test/dashboard/src/app/app.spec.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  it('should not generate an e2e project when e2eTestRunner is none', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await generateTestHostApplication(tree, {
      directory: 'dashboard',
      remotes: ['remote1'],
      e2eTestRunner: E2eTestRunner.None,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    const projects = getProjects(tree);
    expect(projects.has('dashboard-e2e')).toBeFalsy();
    expect(projects.has('remote1-e2e')).toBeFalsy();
  });

  describe('--ssr', () => {
    it('should generate the correct files', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await generateTestHostApplication(tree, {
        directory: 'test',
        ssr: true,
        typescriptConfiguration: false,
        standalone: false,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
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
        tree.read(`test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(project.targets['serve-ssr']).toMatchSnapshot();
    });

    it('should generate the correct files when --typescript=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await generateTestHostApplication(tree, {
        directory: 'test',
        ssr: true,
        typescriptConfiguration: true,
        standalone: false,
        skipFormat: true,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
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
        tree.read(`test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(project.targets['serve-ssr']).toMatchSnapshot();
    });

    it('should generate the correct files for standalone', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await generateTestHostApplication(tree, {
        directory: 'test',
        ssr: true,
        typescriptConfiguration: false,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
      expect(tree.exists(`test/src/app/app-module.ts`)).toBeFalsy();
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
        tree.read(`test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.config.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(project.targets['serve-ssr']).toMatchSnapshot();
    });

    it('should generate the correct files for standalone when --typescript=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await generateTestHostApplication(tree, {
        directory: 'test',
        ssr: true,
        typescriptConfiguration: true,
        skipFormat: true,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
      expect(tree.exists(`test/src/app/app-module.ts`)).toBeFalsy();
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
        tree.read(`test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.config.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(project.targets['serve-ssr']).toMatchSnapshot();
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

    await generateTestHostApplication(tree, {
      directory: 'test',
      ssr: true,
      skipFormat: true,
      skipPackageJson: true,
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual(initialPackageJson);
  });

  it('should throw an error if invalid remotes names are provided and --dynamic is set to true', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const remote = 'invalid-remote-name';

    await expect(
      generateTestHostApplication(tree, {
        directory: 'myhostapp',
        remotes: [remote],
        dynamic: true,
        e2eTestRunner: E2eTestRunner.None,
        linter: 'none',
        style: 'css',
        unitTestRunner: UnitTestRunner.None,
        typescriptConfiguration: false,
      })
    ).rejects.toThrow(`Invalid remote name provided: ${remote}.`);
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
        remotes: ['remote1'],
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
      expect(tree.read('host/src/app/app.routes.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NxWelcomeComponent } from './nx-welcome.component';
        import { Route } from '@angular/router';

        export const appRoutes: Route[] = [
            {
            path: 'remote1',
            loadChildren: () => import('remote1/Routes').then(m => m!.remoteRoutes)
            },
            {
              path: '',
              component: NxWelcomeComponent
            },];
        "
      `);
      expect(
        tree.read('remote1/src/app/remote-entry/entry.component.ts', 'utf-8')
      ).toMatchInlineSnapshot(`
        "import { Component } from '@angular/core';
        import { CommonModule } from '@angular/common';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @Component({
          imports: [CommonModule, NxWelcomeComponent],
          selector: 'app-remote1-entry',
          template: \`<app-nx-welcome></app-nx-welcome>\`
        })
        export class RemoteEntryComponent {}
        "
      `);
      expect(tree.read('remote1/src/app/remote-entry/entry.routes.ts', 'utf-8'))
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

      await generateTestHostApplication(tree, {
        directory: 'host',
        remotes: ['remote1'],
        standalone: false,
        skipFormat: true,
      });

      expect(tree.read('host/src/app/app.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { AppComponent } from './app.component';
        import { appRoutes } from './app.routes';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @NgModule({
          declarations: [AppComponent, NxWelcomeComponent],
          imports: [
            BrowserModule,
            RouterModule.forRoot(appRoutes),
          ],
          providers: [],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
        "
      `);
      expect(tree.read('remote1/src/app/remote-entry/entry.module.ts', 'utf-8'))
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
