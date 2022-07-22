import {
  addProjectConfiguration,
  DependencyType,
  ProjectGraph,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateRouterInitialNavigation from './update-router-initial-navigation';

let projectGraph: ProjectGraph;
jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('update-router-initial-navigation migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should update "initialNavigation" to "enabledBlocking"', async () => {
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/router',
          },
        ],
      },
      nodes: {},
    };
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
    });
    tree.write(
      'apps/app1/src/app/app.module.ts',
      `import { NgModule } from '@angular/core';
      import { BrowserModule } from '@angular/platform-browser';
      import { AppComponent } from './app.component';
      import { NxWelcomeComponent } from './nx-welcome.component';
      import { RouterModule } from '@angular/router';

      @NgModule({
        declarations: [AppComponent, NxWelcomeComponent],
        imports: [
          BrowserModule,
          RouterModule.forRoot([], { relativeLinkResolution: 'legacy', initialNavigation: 'enabled' }),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}`
    );

    await updateRouterInitialNavigation(tree);

    expect(tree.read('apps/app1/src/app/app.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
            import { BrowserModule } from '@angular/platform-browser';
            import { AppComponent } from './app.component';
            import { NxWelcomeComponent } from './nx-welcome.component';
            import { RouterModule } from '@angular/router';

            @NgModule({
              declarations: [AppComponent, NxWelcomeComponent],
              imports: [
                BrowserModule,
                RouterModule.forRoot([], { relativeLinkResolution: 'legacy', initialNavigation: 'enabledBlocking' }),
              ],
              bootstrap: [AppComponent],
            })
            export class AppModule {}"
    `);
  });

  it('should do nothing when "initialNavigation" is not set to "enabled"', async () => {
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/router',
          },
        ],
      },
      nodes: {},
    };
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
    });
    const moduleContent = `import { NgModule } from '@angular/core';
    import { BrowserModule } from '@angular/platform-browser';
    import { AppComponent } from './app.component';
    import { NxWelcomeComponent } from './nx-welcome.component';
    import { RouterModule } from '@angular/router';

    @NgModule({
      declarations: [AppComponent, NxWelcomeComponent],
      imports: [
        BrowserModule,
        RouterModule.forRoot([], { relativeLinkResolution: 'legacy', initialNavigation: 'enabledNonBlocking' }),
      ],
      bootstrap: [AppComponent],
    })
    export class AppModule {}`;
    tree.write('apps/app1/src/app/app.module.ts', moduleContent);

    await updateRouterInitialNavigation(tree);

    expect(tree.read('apps/app1/src/app/app.module.ts', 'utf-8')).toBe(
      moduleContent
    );
  });

  it('should do nothing when "initialNavigation" is not set', async () => {
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/router',
          },
        ],
      },
      nodes: {},
    };
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
    });
    const moduleContent = `import { NgModule } from '@angular/core';
    import { BrowserModule } from '@angular/platform-browser';
    import { AppComponent } from './app.component';
    import { NxWelcomeComponent } from './nx-welcome.component';
    import { RouterModule } from '@angular/router';

    @NgModule({
      declarations: [AppComponent, NxWelcomeComponent],
      imports: [
        BrowserModule,
        RouterModule.forRoot([], { relativeLinkResolution: 'legacy' }),
      ],
      bootstrap: [AppComponent],
    })
    export class AppModule {}`;
    tree.write('apps/app1/src/app/app.module.ts', moduleContent);

    await updateRouterInitialNavigation(tree);

    expect(tree.read('apps/app1/src/app/app.module.ts', 'utf-8')).toBe(
      moduleContent
    );
  });

  it('should do nothing when not passing extra options to "RouterModule.forRoot" call', async () => {
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/router',
          },
        ],
      },
      nodes: {},
    };
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
    });
    const moduleContent = `import { NgModule } from '@angular/core';
    import { BrowserModule } from '@angular/platform-browser';
    import { AppComponent } from './app.component';
    import { NxWelcomeComponent } from './nx-welcome.component';
    import { RouterModule } from '@angular/router';

    @NgModule({
      declarations: [AppComponent, NxWelcomeComponent],
      imports: [BrowserModule, RouterModule.forRoot([])],
      bootstrap: [AppComponent],
    })
    export class AppModule {}`;
    tree.write('apps/app1/src/app/app.module.ts', moduleContent);

    await updateRouterInitialNavigation(tree);

    expect(tree.read('apps/app1/src/app/app.module.ts', 'utf-8')).toBe(
      moduleContent
    );
  });

  it('should no update "initialNavigation" when using a different module ".forRoot" call with similar API to "RouterModule.forRoot"', async () => {
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/router',
          },
        ],
      },
      nodes: {},
    };
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
    });
    const moduleContent = `import { NgModule } from '@angular/core';
    import { OtherModule } from '@foo/bar';
    import { FooComponent } from './foo.component';

    @NgModule({
      declarations: [AppComponent, NxWelcomeComponent],
      imports: [BrowserModule, OtherModule.forRoot([], { initialNavigation: 'enabled' })],
      bootstrap: [AppComponent],
    })
    export class FooModule {}`;
    tree.write('apps/app1/src/app/app.module.ts', moduleContent);

    await updateRouterInitialNavigation(tree);

    expect(tree.read('apps/app1/src/app/app.module.ts', 'utf-8')).toBe(
      moduleContent
    );
  });

  it('should do nothing when not using "@angular/router"', async () => {
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/common',
          },
        ],
      },
      nodes: {},
    };
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
    });
    const moduleContent = `import { NgModule } from '@angular/core';
    import { BrowserModule } from '@angular/platform-browser';
    import { AppComponent } from './app.component';
    import { NxWelcomeComponent } from './nx-welcome.component';

    @NgModule({
      declarations: [AppComponent, NxWelcomeComponent],
      imports: [BrowserModule],
      bootstrap: [AppComponent],
    })
    export class AppModule {}`;
    tree.write('apps/app1/src/app/app.module.ts', moduleContent);

    await updateRouterInitialNavigation(tree);

    expect(tree.read('apps/app1/src/app/app.module.ts', 'utf-8')).toBe(
      moduleContent
    );
  });

  it('should do nothing when using a "RouterModule.forChild" call', async () => {
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/router',
          },
        ],
      },
      nodes: {},
    };
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
    });
    const moduleContent = `import { NgModule } from '@angular/core';
    import { RouterModule } from '@angular/router';
    import { FooComponent } from './foo.component';

    @NgModule({
      declarations: [FooComponent],
      imports: [CommonModule, RouterModule.forChild([])],
      exports: [FooComponent],
    })
    export class FooModule {}`;
    tree.write('apps/app1/src/app/foo/foo.module.ts', moduleContent);

    await updateRouterInitialNavigation(tree);

    expect(tree.read('apps/app1/src/app/foo/foo.module.ts', 'utf-8')).toBe(
      moduleContent
    );
  });
});
