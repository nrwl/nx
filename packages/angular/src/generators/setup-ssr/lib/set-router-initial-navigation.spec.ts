import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { setRouterInitialNavigation } from './set-router-initial-navigation';

describe('setRouterInitialNavigation', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
  });

  describe('standalone', () => {
    it('should import and set "withEnabledBlockingInitialNavigation"', () => {
      tree.write(
        'apps/app1/src/app.config.ts',
        `import { ApplicationConfig } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(appRoutes)],
};
`
      );

      setRouterInitialNavigation(tree, {
        project: 'app1',
        standalone: true,
        isUsingApplicationBuilder: true,
        buildTargetTsConfigPath: 'apps/app1/tsconfig.app.json',
      });

      expect(tree.read('apps/app1/src/app.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { ApplicationConfig } from '@angular/platform-browser';
        import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
        import { appRoutes } from './app.routes';

        export const appConfig: ApplicationConfig = {
          providers: [provideRouter(appRoutes, withEnabledBlockingInitialNavigation())],
        };
        "
      `);
    });

    it('should remove "withDisabledInitialNavigation"', () => {
      tree.write(
        'apps/app1/src/app.config.ts',
        `import { ApplicationConfig } from '@angular/platform-browser';
import {
  provideRouter,
  withDisabledInitialNavigation,
} from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(
    appRoutes,
    withDisabledInitialNavigation(),
  )],
};
`
      );

      setRouterInitialNavigation(tree, {
        project: 'app1',
        standalone: true,
        isUsingApplicationBuilder: true,
        buildTargetTsConfigPath: 'apps/app1/tsconfig.app.json',
      });

      expect(tree.read('apps/app1/src/app.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { ApplicationConfig } from '@angular/platform-browser';
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

    it('should update a file that starts with a comment', () => {
      tree.write(
        'apps/app1/src/app.config.ts',
        `// Copyright header

import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(appRoutes)],
};
`
      );

      setRouterInitialNavigation(tree, {
        project: 'app1',
        standalone: true,
        isUsingApplicationBuilder: true,
        buildTargetTsConfigPath: 'apps/app1/tsconfig.app.json',
      });

      expect(tree.read('apps/app1/src/app.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "// Copyright header

        import { ApplicationConfig } from '@angular/core';
        import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
        import { appRoutes } from './app.routes';

        export const appConfig: ApplicationConfig = {
          providers: [provideRouter(appRoutes, withEnabledBlockingInitialNavigation())],
        };
        "
      `);
    });
  });

  describe('NgModule', () => {
    it(`should set "initialNavigation: 'enabledBlocking'"`, () => {
      tree.write(
        'apps/app1/src/app.module.ts',
        `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { appRoutes } from './app.routes';
import { NxWelcomeComponent } from './nx-welcome.component';

@NgModule({
  declarations: [AppComponent, NxWelcomeComponent],
  imports: [
    BrowserModule.withServerTransition({ appId: 'serverApp' }),
    RouterModule.forRoot(appRoutes),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
`
      );

      setRouterInitialNavigation(tree, {
        project: 'app1',
        standalone: false,
        isUsingApplicationBuilder: true,
        buildTargetTsConfigPath: 'apps/app1/tsconfig.app.json',
      });

      expect(tree.read('apps/app1/src/app.module.ts', 'utf-8'))
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
            BrowserModule.withServerTransition({ appId: 'serverApp' }),
            RouterModule.forRoot(appRoutes, { initialNavigation: 'enabledBlocking' }),
          ],
          providers: [],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
        "
      `);
    });

    it('should update a file that starts with a comment', () => {
      tree.write(
        'apps/app1/src/app.module.ts',
        `// Copyright header

import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { appRoutes } from './app.routes';

@NgModule({
  imports: [RouterModule.forRoot(appRoutes)],
})
export class AppModule {}
`
      );

      setRouterInitialNavigation(tree, {
        project: 'app1',
        standalone: false,
        isUsingApplicationBuilder: true,
        buildTargetTsConfigPath: 'apps/app1/tsconfig.app.json',
      });

      expect(tree.read('apps/app1/src/app.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "// Copyright header

        import { NgModule } from '@angular/core';
        import { RouterModule } from '@angular/router';
        import { appRoutes } from './app.routes';

        @NgModule({
          imports: [RouterModule.forRoot(appRoutes, { initialNavigation: 'enabledBlocking' })],
        })
        export class AppModule {}
        "
      `);
    });

    it.each([
      ['routerOptions', '...(routerOptions ?? {}), '],
      ['config.routerOptions', '...(config.routerOptions ?? {}), '],
      ["config['routerOptions']", "...(config['routerOptions'] ?? {}), "],
      ['getRouterOptions()', '...(getRouterOptions() ?? {}), '],
      [
        'routerOptions as ExtraOptions',
        '...((routerOptions as ExtraOptions) ?? {}), ',
      ],
      ['undefined', ''],
    ])('should handle router options passed as %s', (options, spread) => {
      tree.write(
        'apps/app1/src/app.module.ts',
        `import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule } from '@angular/router';
import { appRoutes, config, getRouterOptions, routerOptions } from './app.routes';

@NgModule({
  imports: [RouterModule.forRoot(appRoutes, ${options})],
})
export class AppModule {}
`
      );

      setRouterInitialNavigation(tree, {
        project: 'app1',
        standalone: false,
        isUsingApplicationBuilder: true,
        buildTargetTsConfigPath: 'apps/app1/tsconfig.app.json',
      });

      expect(tree.read('apps/app1/src/app.module.ts', 'utf-8')).toContain(
        `RouterModule.forRoot(appRoutes, { ${spread}initialNavigation: 'enabledBlocking' })`
      );
    });
  });
});
