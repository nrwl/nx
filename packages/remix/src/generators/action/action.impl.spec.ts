jest.mock('../../utils/remix-config');
import * as remixConfigUtils from '../../utils/remix-config';

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from '../application/application.impl';
import routeGenerator from '../route/route.impl';
import actionGenerator from './action.impl';

describe('action', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write('.gitignore', `/node_modules/dist`);

    (remixConfigUtils.getRemixConfigValues as jest.Mock) = jest.fn(() =>
      Promise.resolve({
        ignoredRouteFiles: ['**/.*'],
      })
    );

    await applicationGenerator(tree, { name: 'demo' });
    await routeGenerator(tree, {
      path: 'example',
      project: 'demo',
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
    {
      path: 'example',
    },
    {
      path: 'example.tsx',
    },
  ].forEach((config) => {
    describe(`Generating action using path ${config.path}`, () => {
      beforeEach(async () => {
        await actionGenerator(tree, {
          path: config.path,
          // path: 'apps/demo/app/routes/example.tsx',
          project: 'demo',
        });
      });
      it('should add imports', async () => {
        const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
        expect(content).toMatch(`import { json } from '@remix-run/node';`);
        expect(content).toMatch(
          `import type { ActionFunctionArgs } from '@remix-run/node';`
        );
        expect(content).toMatch(
          `import { useActionData } from '@remix-run/react';`
        );
      });

      it('should add action function', () => {
        const actionFunction = `export const action = async ({ request }: ActionFunctionArgs)`;
        const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
        expect(content).toMatch(actionFunction);
      });

      it('should add useActionData to component', () => {
        const useActionData = `const actionMessage = useActionData<typeof action>();`;

        const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
        expect(content).toMatch(useActionData);
      });
    });
  });

  it('--nameAndDirectoryFormat=as-provided', async () => {
    // ACT
    await actionGenerator(tree, {
      path: 'apps/demo/app/routes/example.tsx',
    });
    // ASSERT
    const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
    const useActionData = `const actionMessage = useActionData<typeof action>();`;
    const actionFunction = `export const action = async ({ request }: ActionFunctionArgs)`;
    expect(content).toMatch(`import { json } from '@remix-run/node';`);
    expect(content).toMatch(
      `import type { ActionFunctionArgs } from '@remix-run/node';`
    );
    expect(content).toMatch(
      `import { useActionData } from '@remix-run/react';`
    );
    expect(content).toMatch(useActionData);
    expect(content).toMatch(actionFunction);
  });
});
