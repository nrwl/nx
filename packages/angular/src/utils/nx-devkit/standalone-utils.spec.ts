import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { addStandaloneRoute } from './standalone-utils';

describe('standalone component utils', () => {
  it('should add a lazy route correctly to parent with router module', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'parent-file.ts',
      `import { RouterModule } from '@angular/router';
      import { AppComponent } from './app/app.component';
      
    bootstrapApplication(AppComponent, {
      providers: [
        importProvidersFrom(
          RouterModule.forRoot([], { initialNavigation: 'enabledBlocking' }),
          SomeOtherModule
        ),
      ],
    })`
    );

    // ACT
    addStandaloneRoute(
      tree,
      'parent-file.ts',
      "{path: 'test', loadChildren: () => import('@proj/lib').then(m => m.ROUTES) }"
    );

    // ASSERT
    expect(tree.read('parent-file.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { RouterModule } from '@angular/router';
            import { AppComponent } from './app/app.component';
            
          bootstrapApplication(AppComponent, {
            providers: [
              importProvidersFrom(
                RouterModule.forRoot([
          {path: 'test', loadChildren: () => import('@proj/lib').then(m => m.ROUTES) },], { initialNavigation: 'enabledBlocking' }),
                SomeOtherModule
              ),
            ],
          }"
    `);
  });

  it('should add a route correctly to parent with router module', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'parent-file.ts',
      `import { RouterModule } from '@angular/router';
      import { AppComponent } from './app/app.component';
      
    bootstrapApplication(AppComponent, {
      providers: [
        importProvidersFrom(
          RouterModule.forRoot([], { initialNavigation: 'enabledBlocking' }),
          SomeOtherModule
        ),
      ],
    })`
    );

    // ACT
    addStandaloneRoute(
      tree,
      'parent-file.ts',
      "{path: 'test', children: ROUTES }",
      false,
      'ROUTES',
      '@proj/lib'
    );

    // ASSERT
    expect(tree.read('parent-file.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { RouterModule } from '@angular/router';
            import { AppComponent } from './app/app.component';
      import { ROUTES } from '@proj/lib';
            
          bootstrapApplication(AppComponent, {
            providers: [
              importProvidersFrom(
                RouterModule.forRoot([
          {path: 'test', children: ROUTES },], { initialNavigation: 'enabledBlocking' }),
                SomeOtherModule
              ),
            ],
          }"
    `);
  });

  it('should add a lazy route correctly to parent with route config', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'parent-file.ts',
      `import { Route } from '@angular/router';
      export const ROUTES: Route[] = [];`
    );

    // ACT
    addStandaloneRoute(
      tree,
      'parent-file.ts',
      "{path: 'test', loadChildren: () => import('@proj/lib').then(m => m.ROUTES) }"
    );

    // ASSERT
    expect(tree.read('parent-file.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { Route } from '@angular/router';
            export const ROUTES: Route[] = [
          {path: 'test', loadChildren: () => import('@proj/lib').then(m => m.ROUTES) },]"
    `);
  });

  it('should add a route correctly to parent with router module', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'parent-file.ts',
      `import { Route } from '@angular/router';
      export const ROUTES: Route[] = [];`
    );

    // ACT
    addStandaloneRoute(
      tree,
      'parent-file.ts',
      "{path: 'test', children: ROUTES }",
      false,
      'ROUTES',
      '@proj/lib'
    );

    // ASSERT
    expect(tree.read('parent-file.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { Route } from '@angular/router';
      import { ROUTES } from '@proj/lib';
            export const ROUTES: Route[] = [
          {path: 'test', children: ROUTES },]"
    `);
  });
});
