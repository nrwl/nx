import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addHydration } from './add-hydration';

describe('add-hydration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', {
      root: 'app1',
      sourceRoot: 'app1/src',
      projectType: 'application',
      targets: {},
    });
  });

  it('should add "provideClientHydration" for standalone config', () => {
    tree.write(
      'app1/src/app/app.config.ts',
      `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(appRoutes)],
};
`
    );

    addHydration(tree, { project: 'app1', standalone: true });

    expect(tree.read('app1/src/app/app.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ApplicationConfig } from '@angular/core';
      import { provideRouter } from '@angular/router';
      import { appRoutes } from './app.routes';
      import { provideClientHydration } from '@angular/platform-browser';

      export const appConfig: ApplicationConfig = {
        providers: [provideClientHydration(),provideRouter(appRoutes)],
      };
      "
    `);
  });

  it('should not duplicate "provideClientHydration" for standalone config', () => {
    tree.write(
      'app1/src/app/app.config.ts',
      `import { ApplicationConfig } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideClientHydration(), provideRouter(appRoutes)],
};
`
    );

    addHydration(tree, { project: 'app1', standalone: true });

    expect(tree.read('app1/src/app/app.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ApplicationConfig } from '@angular/core';
      import { provideClientHydration } from '@angular/platform-browser';
      import { provideRouter } from '@angular/router';
      import { appRoutes } from './app.routes';

      export const appConfig: ApplicationConfig = {
        providers: [provideClientHydration(), provideRouter(appRoutes)],
      };
      "
    `);
  });

  it('should add "provideClientHydration" for non-standalone config', () => {
    tree.write(
      'app1/src/app/app.module.ts',
      `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { appRoutes } from './app.routes';
import { NxWelcomeComponent } from './nx-welcome.component';

@NgModule({
  declarations: [AppComponent, NxWelcomeComponent],
  imports: [BrowserModule, RouterModule.forRoot(appRoutes)],
  bootstrap: [AppComponent],
})
export class AppModule {}
`
    );

    addHydration(tree, { project: 'app1', standalone: false });

    expect(tree.read('app1/src/app/app.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
      import { RouterModule } from '@angular/router';
      import { AppComponent } from './app.component';
      import { appRoutes } from './app.routes';
      import { NxWelcomeComponent } from './nx-welcome.component';

      @NgModule({
        declarations: [AppComponent, NxWelcomeComponent],
        imports: [BrowserModule, RouterModule.forRoot(appRoutes)],
        bootstrap: [AppComponent],
        providers: [provideClientHydration()],
      })
      export class AppModule {}
      "
    `);
  });

  it('should not duplicate "provideClientHydration" for non-standalone config', () => {
    tree.write(
      'app1/src/app/app.module.ts',
      `import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { appRoutes } from './app.routes';
import { NxWelcomeComponent } from './nx-welcome.component';

@NgModule({
  declarations: [AppComponent, NxWelcomeComponent],
  imports: [BrowserModule, RouterModule.forRoot(appRoutes)],
  bootstrap: [AppComponent],
  providers: [provideClientHydration()],
})
export class AppModule {}
`
    );

    addHydration(tree, { project: 'app1', standalone: false });

    expect(tree.read('app1/src/app/app.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
      import { RouterModule } from '@angular/router';
      import { AppComponent } from './app.component';
      import { appRoutes } from './app.routes';
      import { NxWelcomeComponent } from './nx-welcome.component';

      @NgModule({
        declarations: [AppComponent, NxWelcomeComponent],
        imports: [BrowserModule, RouterModule.forRoot(appRoutes)],
        bootstrap: [AppComponent],
        providers: [provideClientHydration()],
      })
      export class AppModule {}
      "
    `);
  });
});
