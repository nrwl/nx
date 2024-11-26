import 'nx/src/internal-testing-utils/mock-project-graph';

jest.mock('../../utils/remix-config');
import * as remixConfigUtils from '../../utils/remix-config';

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from '../application/application.impl';
import routeGenerator from '../route/route.impl';
import loaderGenerator from './loader.impl';

describe('loader', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write('.gitignore', `/node_modules/dist`);

    (remixConfigUtils.getRemixConfigValues as jest.Mock) = jest.fn(() =>
      Promise.resolve({
        ignoredRouteFiles: ['**/.*'],
      })
    );

    await applicationGenerator(tree, { name: 'demo', directory: 'apps/demo' });
    await routeGenerator(tree, {
      path: 'apps/demo/app/routes/example.tsx',
      style: 'none',
      loader: false,
      action: false,
      meta: false,
      skipChecks: false,
    });
  });

  [
    {
      path: 'apps/demo/app/routes/example.tsx',
    },
  ].forEach((config) => {
    describe(`add loader using route path "${config.path}"`, () => {
      beforeEach(async () => {
        await loaderGenerator(tree, {
          path: config.path,
        });
      });

      it('should add imports', async () => {
        const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
        expect(content).toMatch(`import { json } from '@remix-run/node';`);
        expect(content).toMatch(
          `import type { LoaderFunctionArgs } from '@remix-run/node';`
        );
        expect(content).toMatch(
          `import { useLoaderData } from '@remix-run/react';`
        );
      });

      it('should add loader function', () => {
        const loaderFunction = `export const loader = async`;
        const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
        expect(content).toMatch(loaderFunction);
      });

      it('should add useLoaderData to component', () => {
        const useLoaderData = `const data = useLoaderData<typeof loader>();`;

        const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
        expect(content).toMatch(useLoaderData);
      });
    });
  });

  describe('--nameAndDirectoryFormat=as-provided', () => {
    it('should add imports', async () => {
      // ACT
      await loaderGenerator(tree, {
        path: 'apps/demo/app/routes/example.tsx',
        nameAndDirectoryFormat: 'as-provided',
      });

      // ASSERT
      const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
      expect(content).toMatch(`import { json } from '@remix-run/node';`);
      expect(content).toMatch(
        `import type { LoaderFunctionArgs } from '@remix-run/node';`
      );
      expect(content).toMatch(
        `import { useLoaderData } from '@remix-run/react';`
      );
    });
  });
});
