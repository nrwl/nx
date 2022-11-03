import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { addRoute } from './route-utils';

describe.each([
  ['Route[]', 'Route'],
  ['Routes', 'Routes'],
])('standalone component utils - %s', (routes, routeType) => {
  it('should add a static route to the routes file', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
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
          {path: 'test', children: ROUTES },]"
    `);
  });

  it('should add a lazy route to the routes file', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'routes-file.ts',
      `import { ${routeType} } from '@angular/router';
      export const ROUTES: ${routes} = [];`
    );

    // ACT
    addRoute(
      tree,
      'routes-file.ts',
      "{path: 'test', , loadChildren: () => import('@proj/lib').then(m => m.ROUTES) }"
    );

    // ASSERT
    expect(tree.read('routes-file.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { ${routeType} } from '@angular/router';
            export const ROUTES: ${routes} = [
          {path: 'test', , loadChildren: () => import('@proj/lib').then(m => m.ROUTES) },]"
    `);
  });
});
