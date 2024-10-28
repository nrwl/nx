import 'nx/src/internal-testing-utils/mock-project-graph';

jest.mock('../../utils/remix-config');
import * as remixConfigUtils from '../../utils/remix-config';

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from '../application/application.impl';
import routeGenerator from '../route/route.impl';
import metaGenerator from './meta.impl';

describe('meta', () => {
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

  it('should use v2 when specified', async () => {
    await metaGenerator(tree, {
      path: 'apps/demo/app/routes/example.tsx',
    });

    const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
    expect(content).toMatch(
      `import type { MetaFunction } from '@remix-run/node';`
    );

    expect(content).toMatch(`export const meta: MetaFunction`);
    expect(content).toMatch(`return [`);
  });

  it('--nameAndDirectoryFormat=as=provided', async () => {
    await metaGenerator(tree, {
      path: 'apps/demo/app/routes/example.tsx',
      nameAndDirectoryFormat: 'as-provided',
    });

    const content = tree.read('apps/demo/app/routes/example.tsx', 'utf-8');
    expect(content).toMatch(
      `import type { MetaFunction } from '@remix-run/node';`
    );

    expect(content).toMatch(`export const meta: MetaFunction`);
    expect(content).toMatch(`return [`);
  });
});
