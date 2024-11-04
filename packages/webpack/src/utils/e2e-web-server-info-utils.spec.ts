import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { type Tree, readNxJson, updateNxJson } from 'nx/src/devkit-exports';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { getWebpackE2EWebServerInfo } from './e2e-web-server-info-utils';

describe('getWebpackE2EWebServerInfo', () => {
  let tree: Tree;
  let tempFs: TempFs;
  beforeEach(() => {
    tempFs = new TempFs('e2e-webserver-info');
    tree = createTreeWithEmptyWorkspace();
    tree.root = tempFs.tempDir;

    tree.write(`app/webpack.config.ts`, ``);
    tempFs.createFileSync(`app/webpack.config.ts`, ``);
  });

  afterEach(() => {
    tempFs.cleanup();
    jest.resetModules();
  });

  it('should use the default values when no plugin is registered and plugins are not being used', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    updateNxJson(tree, nxJson);

    // ACT
    const e2eWebServerInfo = await getWebpackE2EWebServerInfo(
      tree,
      'app',
      'app/webpack.config.ts',
      false
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4200",
        "e2eCiWebServerCommand": "npx nx run app:serve-static",
        "e2eDevServerTarget": "app:serve",
        "e2eWebServerAddress": "http://localhost:4200",
        "e2eWebServerCommand": "npx nx run app:serve",
      }
    `);
  });

  it('should use the default values of the plugin when the plugin is just a string', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = ['@nx/webpack/plugin'];
    updateNxJson(tree, nxJson);

    // ACT
    const e2eWebServerInfo = await getWebpackE2EWebServerInfo(
      tree,
      'app',
      'app/webpack.config.ts',
      true
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4200",
        "e2eCiWebServerCommand": "npx nx run app:serve-static",
        "e2eDevServerTarget": "app:serve",
        "e2eWebServerAddress": "http://localhost:4200",
        "e2eWebServerCommand": "npx nx run app:serve",
      }
    `);
  });

  it('should use the values of the registered plugin when there is no includes or excludes defined', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/webpack/plugin',
      options: {
        serveTargetName: 'webpack:serve',
        serveStaticTargetName: 'webpack:preview',
      },
    });
    updateNxJson(tree, nxJson);

    // ACT
    const e2eWebServerInfo = await getWebpackE2EWebServerInfo(
      tree,
      'app',
      'app/webpack.config.ts',
      true
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4200",
        "e2eCiWebServerCommand": "npx nx run app:webpack:preview",
        "e2eDevServerTarget": "app:webpack:serve",
        "e2eWebServerAddress": "http://localhost:4200",
        "e2eWebServerCommand": "npx nx run app:webpack:serve",
      }
    `);
  });

  it('should use the values of the correct registered plugin when there are includes or excludes defined', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/webpack/plugin',
      options: {
        serveTargetName: 'webpack:serve',
        serveStaticTargetName: 'webpack:preview',
      },
      include: ['libs/**'],
    });
    nxJson.plugins.push({
      plugin: '@nx/webpack/plugin',
      options: {
        serveTargetName: 'webpack-serve',
        serveStaticTargetName: 'webpack-preview',
      },
      include: ['app/**'],
    });
    updateNxJson(tree, nxJson);

    // ACT
    const e2eWebServerInfo = await getWebpackE2EWebServerInfo(
      tree,
      'app',
      'app/webpack.config.ts',
      true
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4200",
        "e2eCiWebServerCommand": "npx nx run app:webpack-preview",
        "e2eDevServerTarget": "app:webpack-serve",
        "e2eWebServerAddress": "http://localhost:4200",
        "e2eWebServerCommand": "npx nx run app:webpack-serve",
      }
    `);
  });
});
