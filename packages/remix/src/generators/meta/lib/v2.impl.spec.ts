import 'nx/src/internal-testing-utils/mock-project-graph';

jest.mock('../../../utils/remix-config');
import * as remixConfigUtils from '../../../utils/remix-config';

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from '../../application/application.impl';
import routeGenerator from '../../route/route.impl';
import { v2MetaGenerator } from './v2.impl';

describe('meta v2', () => {
  let tree: Tree;

  test.each([['apps/demo/app/routes/example.tsx']])(
    'add meta using route path "%s"',
    async (path) => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      tree.write('.gitignore', `/node_modules/dist`);

      (remixConfigUtils.getRemixConfigValues as jest.Mock) = jest.fn(() =>
        Promise.resolve({
          ignoredRouteFiles: ['**/.*'],
        })
      );

      await applicationGenerator(tree, {
        name: 'demo',
        directory: 'apps/demo',
      });
      await routeGenerator(tree, {
        path: 'apps/demo/app/routes/example.tsx',
        style: 'none',
        loader: false,
        action: false,
        meta: false,
        skipChecks: false,
      });

      await v2MetaGenerator(tree, {
        path,
      });

      const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
      expect(content).toMatch(
        `import type { MetaFunction } from '@remix-run/node';`
      );

      expect(content).toMatch(`export const meta: MetaFunction`);
      expect(content).toMatch(`return [`);
    }
  );
});
