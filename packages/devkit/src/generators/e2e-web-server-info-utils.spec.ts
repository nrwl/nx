import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { type Tree, readNxJson, updateNxJson } from 'nx/src/devkit-exports';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { getE2EWebServerInfo } from './e2e-web-server-info-utils';

describe('getE2EWebServerInfo', () => {
  let tree: Tree;
  let tempFs: TempFs;
  beforeEach(() => {
    tempFs = new TempFs('e2e-webserver-info');
    tree = createTreeWithEmptyWorkspace();
    tree.root = tempFs.tempDir;

    tree.write(`app/vite.config.ts`, ``);
    tempFs.createFileSync(`app/vite.config.ts`, ``);
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
    const e2eWebServerInfo = await getE2EWebServerInfo(
      tree,
      'app',
      {
        plugin: '@nx/vite/plugin',
        configFilePath: 'app/vite.config.ts',
        serveTargetName: 'serveTargetName',
        serveStaticTargetName: 'previewTargetName',
      },
      {
        defaultServeTargetName: 'serve',
        defaultServeStaticTargetName: 'preview',
        defaultE2EWebServerAddress: 'http://localhost:4200',
        defaultE2ECiBaseUrl: 'http://localhost:4300',
        defaultE2EPort: 4200,
      },
      false
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4300",
        "e2eCiWebServerCommand": "npx nx run app:preview",
        "e2eDevServerTarget": "app:serve",
        "e2eWebServerAddress": "http://localhost:4200",
        "e2eWebServerCommand": "npx nx run app:serve",
      }
    `);
  });

  it('should use the default values of the plugin when the plugin is just a string', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = ['@nx/vite/plugin'];
    updateNxJson(tree, nxJson);

    // ACT
    const e2eWebServerInfo = await getE2EWebServerInfo(
      tree,
      'app',
      {
        plugin: '@nx/vite/plugin',
        configFilePath: 'app/vite.config.ts',
        serveTargetName: 'serveTargetName',
        serveStaticTargetName: 'previewTargetName',
      },
      {
        defaultServeTargetName: 'serve',
        defaultServeStaticTargetName: 'preview',
        defaultE2EWebServerAddress: 'http://localhost:4200',
        defaultE2ECiBaseUrl: 'http://localhost:4300',
        defaultE2EPort: 4200,
      },
      true
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4300",
        "e2eCiWebServerCommand": "npx nx run app:preview",
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
      plugin: '@nx/vite/plugin',
      options: {
        serveTargetName: 'vite:serve',
        previewTargetName: 'vite:preview',
      },
    });
    updateNxJson(tree, nxJson);

    // ACT
    const e2eWebServerInfo = await getE2EWebServerInfo(
      tree,
      'app',
      {
        plugin: '@nx/vite/plugin',
        configFilePath: 'app/vite.config.ts',
        serveTargetName: 'serveTargetName',
        serveStaticTargetName: 'previewTargetName',
      },
      {
        defaultServeTargetName: 'serve',
        defaultServeStaticTargetName: 'preview',
        defaultE2EWebServerAddress: 'http://localhost:4200',
        defaultE2ECiBaseUrl: 'http://localhost:4300',
        defaultE2EPort: 4200,
      },
      true
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4300",
        "e2eCiWebServerCommand": "npx nx run app:vite:preview",
        "e2eDevServerTarget": "app:vite:serve",
        "e2eWebServerAddress": "http://localhost:4200",
        "e2eWebServerCommand": "npx nx run app:vite:serve",
      }
    `);
  });

  it('should handle targetDefaults', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/vite/plugin',
      options: {
        serveTargetName: 'vite:serve',
        previewTargetName: 'vite:preview',
      },
    });
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['vite:serve'] = {
      options: {
        port: 4400,
      },
    };
    updateNxJson(tree, nxJson);

    // ACT
    const e2eWebServerInfo = await getE2EWebServerInfo(
      tree,
      'app',
      {
        plugin: '@nx/vite/plugin',
        configFilePath: 'app/vite.config.ts',
        serveTargetName: 'serveTargetName',
        serveStaticTargetName: 'previewTargetName',
      },
      {
        defaultServeTargetName: 'serve',
        defaultServeStaticTargetName: 'preview',
        defaultE2EWebServerAddress: 'http://localhost:4200',
        defaultE2ECiBaseUrl: 'http://localhost:4300',
        defaultE2EPort: 4200,
      },
      true
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4300",
        "e2eCiWebServerCommand": "npx nx run app:vite:preview",
        "e2eDevServerTarget": "app:vite:serve",
        "e2eWebServerAddress": "http://localhost:4400",
        "e2eWebServerCommand": "npx nx run app:vite:serve",
      }
    `);
  });

  it('should use the values of the correct registered plugin when there are includes or excludes defined', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/vite/plugin',
      options: {
        serveTargetName: 'vite:serve',
        previewTargetName: 'vite:preview',
      },
      include: ['libs/**'],
    });
    nxJson.plugins.push({
      plugin: '@nx/vite/plugin',
      options: {
        serveTargetName: 'vite-serve',
        previewTargetName: 'vite-preview',
      },
      include: ['app/**'],
    });
    updateNxJson(tree, nxJson);

    // ACT
    const e2eWebServerInfo = await getE2EWebServerInfo(
      tree,
      'app',
      {
        plugin: '@nx/vite/plugin',
        configFilePath: 'app/vite.config.ts',
        serveTargetName: 'serveTargetName',
        serveStaticTargetName: 'previewTargetName',
      },
      {
        defaultServeTargetName: 'serve',
        defaultServeStaticTargetName: 'preview',
        defaultE2EWebServerAddress: 'http://localhost:4200',
        defaultE2ECiBaseUrl: 'http://localhost:4300',
        defaultE2EPort: 4400,
      },
      true
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4300",
        "e2eCiWebServerCommand": "npx nx run app:vite-preview",
        "e2eDevServerTarget": "app:vite-serve",
        "e2eWebServerAddress": "http://localhost:4400",
        "e2eWebServerCommand": "npx nx run app:vite-serve",
      }
    `);
  });
});
