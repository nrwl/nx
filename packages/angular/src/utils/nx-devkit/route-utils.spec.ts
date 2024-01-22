import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProviderToRoute, addRoute } from './route-utils';

describe.each([
  ['Route[]', 'Route'],
  ['Routes', 'Routes'],
])('standalone component utils - %s', (routes, routeType) => {
  it('should add a static route to the routes file', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      'routes-file.ts',
      `import { ${routeType} } from '@angular/router';
      export const ROUTES: ${routes} = [];`
    );

    // ACT
    addRoute(
      tree,
      'routes-file.ts',
      "{path: 'test', children: ROUTES }",
      false,
      'ROUTES',
      '@proj/lib'
    );

    // ASSERT
    expect(tree.read('routes-file.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { ${routeType} } from '@angular/router';
      import { ROUTES } from '@proj/lib';
            export const ROUTES: ${routes} = [
          {path: 'test', children: ROUTES },];"
    `);
  });

  it('should add a lazy route to the routes file', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      'routes-file.ts',
      `import { ${routeType} } from '@angular/router';
      export const ROUTES: ${routes} = [];`
    );

    // ACT
    addRoute(
      tree,
      'routes-file.ts',
      "{path: 'test', loadChildren: () => import('@proj/lib').then(m => m.ROUTES) }"
    );

    // ASSERT
    expect(tree.read('routes-file.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { ${routeType} } from '@angular/router';
            export const ROUTES: ${routes} = [
          {path: 'test', loadChildren: () => import('@proj/lib').then(m => m.ROUTES) },];"
    `);
  });

  it('should add a lazy route to a routes file when there is a static route', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      'routes-file.ts',
      `import { NxWelcomeComponent } from './nx-welcome.component';
    import { ${routeType} } from '@angular/router';

    export const appRoutes: ${routes} = [
      {
        path: '',
        component: NxWelcomeComponent
      },];`
    );

    // ACT
    addRoute(
      tree,
      'routes-file.ts',
      `{
    path: 'mfe-kitchen',
    loadChildren: () => import('mfe-kitchen/Module').then(m => m.RemoteEntryModule)
    }`
    );

    // ASSERT
    expect(tree.read('routes-file.ts', 'utf-8'))
      .toEqual(`import { NxWelcomeComponent } from './nx-welcome.component';
    import { ${routeType} } from '@angular/router';

    export const appRoutes: ${routes} = [
    {
    path: 'mfe-kitchen',
    loadChildren: () => import('mfe-kitchen/Module').then(m => m.RemoteEntryModule)
    },
      {
        path: '',
        component: NxWelcomeComponent
      },];`);
  });

  it('should add provider along with providers array to the route when providers do not exist', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      'routes-file.ts',
      `import { ${routeType} } from '@angular/router';
      export const ROUTES: ${routes} = [{path: 'test', loadChildren: () => import('@proj/lib').then(m => m.ROUTES) }];`
    );

    // ACT
    addProviderToRoute(tree, 'routes-file.ts', 'test', 'provideStore()');

    // ASSERT
    expect(tree.read('routes-file.ts', 'utf-8'))
      .toEqual(`import { ${routeType} } from '@angular/router';
      export const ROUTES: ${routes} = [{path: 'test', loadChildren: () => import('@proj/lib').then(m => m.ROUTES) , providers: [provideStore()]}];`);
  });

  it('should add provider to the providers array to the route', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      'routes-file.ts',
      `import { ${routeType} } from '@angular/router';
      export const ROUTES: ${routes} = [{path: 'test', providers: [provideState()], loadChildren: () => import('@proj/lib').then(m => m.ROUTES) }];`
    );

    // ACT
    addProviderToRoute(tree, 'routes-file.ts', 'test', 'provideStore()');

    // ASSERT
    expect(tree.read('routes-file.ts', 'utf-8'))
      .toEqual(`import { ${routeType} } from '@angular/router';
      export const ROUTES: ${routes} = [{path: 'test', providers: [provideState(), provideStore()], loadChildren: () => import('@proj/lib').then(m => m.ROUTES) }];`);
  });

  it('should add provider to the providers array of a nested route', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      'routes-file.ts',
      `import { ${routeType} } from '@angular/router';
      export const ROUTES: ${routes} = [{path: '', providers: [provideState()], children: [{ path: 'test' }]}];`
    );

    // ACT
    addProviderToRoute(tree, 'routes-file.ts', 'test', 'provideStore()');

    // ASSERT
    expect(tree.read('routes-file.ts', 'utf-8'))
      .toEqual(`import { ${routeType} } from '@angular/router';
      export const ROUTES: ${routes} = [{path: '', providers: [provideState()], children: [{ path: 'test' , providers: [provideStore()]}]}];`);
  });
});
