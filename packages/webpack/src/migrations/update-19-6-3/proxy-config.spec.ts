import { readJson, writeJson, addProjectConfiguration, Tree } from '@nx/devkit';
import update from './proxy-config';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

describe('Migration: update proxy config format', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should convert an object to an array', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        serve: {
          executor: '@nx/webpack:dev-server',
          options: {
            proxyConfig: 'apps/app1/proxy.conf.json',
          },
          configurations: {
            production: {
              proxyConfig: 'apps/app1/proxy.conf.prod.json',
            },
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/proxy.conf.json', {
      '/api': {
        target: 'http://localhost:3000',
      },
    });
    writeJson(tree, 'apps/app1/proxy.conf.prod.json', {
      '/api': {
        target: 'https://example.com',
      },
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'apps/app2',
      targets: {
        serve: {
          executor: '@nx/react:module-federation-dev-server',
          options: {
            proxyConfig: 'apps/app2/proxy.conf.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app2/proxy.conf.json', {
      '/api': {
        target: 'http://localhost:3000',
      },
    });

    await update(tree);

    expect(readJson(tree, 'apps/app1/proxy.conf.json')).toEqual([
      { context: ['/api'], target: 'http://localhost:3000' },
    ]);
    expect(readJson(tree, 'apps/app1/proxy.conf.prod.json')).toEqual([
      { context: ['/api'], target: 'https://example.com' },
    ]);
    expect(readJson(tree, 'apps/app2/proxy.conf.json')).toEqual([
      { context: ['/api'], target: 'http://localhost:3000' },
    ]);
  });
});
