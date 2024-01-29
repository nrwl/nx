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
  });
});
