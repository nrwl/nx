import {
  readJson,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { PackageJson } from 'nx/src/utils/package-json';
import { angularVersion, ngUniversalVersion } from '../../utils/versions';

import applicationGenerator from '../application/application';
import setupSsr from './setup-ssr';

describe('setupSSR', () => {
  it('should create the files correctly for ssr', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    await applicationGenerator(tree, {
      name: 'app1',
    });

    // ACT
    await setupSsr(tree, { project: 'app1' });

    // ASSERT
    expect(
      readProjectConfiguration(tree, 'app1').targets.server
    ).toMatchSnapshot();
    expect(tree.read('apps/app1/server.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('apps/app1/src/main.server.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "/***************************************************************************************************
       * Initialize the server environment - for example, adding DOM built-in types to the global scope.
       *
       * NOTE:
       * This import must come before any imports (direct or transitive) that rely on DOM built-ins being
       * available, such as \`@angular/elements\`.
       */
      import '@angular/platform-server/init';

      export { AppServerModule } from './app/app.server.module';
      export { renderModule } from '@angular/platform-server';"
    `);
    expect(tree.read('apps/app1/src/main.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

      import { AppModule } from './app/app.module';

      function bootstrap() {
        platformBrowserDynamic()
        .bootstrapModule(AppModule)
        .catch((err) => console.error(err));
      };


       if (document.readyState === 'complete') {
         bootstrap();
       } else {
         document.addEventListener('DOMContentLoaded', bootstrap);
       }"
    `);
    expect(tree.read('apps/app1/tsconfig.server.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "/* To learn more about this file see: https://angular.io/config/tsconfig. */
      {
        \\"extends\\": \\"./tsconfig.app.json\\",
        \\"compilerOptions\\": {
          \\"outDir\\": \\"../../out-tsc/server\\",
          \\"target\\": \\"es2019\\",
          \\"types\\": [
            \\"node\\"
          ]
        },
        \\"files\\": [
          \\"src/main.server.ts\\",
          \\"server.ts\\",
        ]
      }"
    `);
    expect(tree.read('apps/app1/src/app/app.server.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { ServerModule } from '@angular/platform-server';

      import { AppModule } from './app.module';
      import { AppComponent } from './app.component';

      @NgModule({
        imports: [
          AppModule,
          ServerModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppServerModule {}"
    `);
    expect(tree.read('apps/app1/src/app/app.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { BrowserModule } from '@angular/platform-browser';

      import { AppComponent } from './app.component';
      import { NxWelcomeComponent } from './nx-welcome.component';

      @NgModule({
        declarations: [
          AppComponent,
          NxWelcomeComponent
        ],
        imports: [
          BrowserModule.withServerTransition({ appId: 'serverApp' })
        ],
        providers: [],
        bootstrap: [AppComponent]
      })
      export class AppModule { }"
    `);
    const packageJson = readJson<PackageJson>(tree, 'package.json');
    const dependencies = {
      '@nguniversal/express-engine': ngUniversalVersion,
      '@angular/platform-server': angularVersion,
    };
    for (const [dep, version] of Object.entries(dependencies)) {
      expect(packageJson.dependencies[dep]).toEqual(version);
    }
    const devDeps = {
      '@nguniversal/builders': ngUniversalVersion,
    };
    for (const [dep, version] of Object.entries(devDeps)) {
      expect(packageJson.devDependencies[dep]).toEqual(version);
    }
  });

  it('should use fileReplacements if they already exist', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    await applicationGenerator(tree, {
      name: 'app1',
    });

    tree.write('apps/app1/src/environments/environment.ts', '');
    tree.write('apps/app1/src/environments/environment.prod.ts', '');
    const project = readProjectConfiguration(tree, 'app1');
    project.targets.build.configurations.production.fileReplacements = [
      {
        replace: 'apps/app1/src/environments/environment.ts',
        with: 'apps/app1/src/environments/environment.prod.ts',
      },
    ];
    updateProjectConfiguration(tree, 'app1', project);

    // ACT
    await setupSsr(tree, { project: 'app1' });

    // ASSERT
    expect(
      readProjectConfiguration(tree, 'app1').targets.server
    ).toMatchSnapshot();
  });
});
