import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { getRspackE2EWebServerInfo } from './e2e-web-server-info-utils';
import { type Tree, readNxJson, updateNxJson } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';

describe('getRspackE2EWebServerInfo', () => {
  let tree: Tree;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('e2e-webserver-info');
    tree = createTreeWithEmptyWorkspace();
    tree.root = tempFs.tempDir;

    tree.write(`app/rspack.config.ts`, ``);
    tempFs.createFileSync(`app/rspack.config.ts`, ``);
    tempFs.createFileSync('package-lock.json', '{}');
  });

  afterEach(() => {
    tempFs.cleanup();
    jest.resetModules();
  });

  it('should use map-shaped targetDefaults when no plugin is registered and plugins are not being used', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.targetDefaults = {
      serve: {
        options: {
          port: 4400,
        },
      },
    };
    updateNxJson(tree, nxJson);

    // ACT
    const e2eWebServerInfo = await getRspackE2EWebServerInfo(
      tree,
      'app',
      'app/rspack.config.ts',
      false
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4400",
        "e2eCiWebServerCommand": "npx nx run app:preview",
        "e2eDevServerTarget": "app:serve",
        "e2eWebServerAddress": "http://localhost:4400",
        "e2eWebServerCommand": "npx nx run app:serve",
      }
    `);
  });

  it('should let an explicitly requested port win over targetDefaults', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.targetDefaults = { serve: { options: { port: 4300 } } };
    updateNxJson(tree, nxJson);

    // ACT — the generator wrote `port: 4321` onto the serve target, so e2e must
    // target 4321 too; targetDefaults is only a fallback for when nothing was asked.
    const e2eWebServerInfo = await getRspackE2EWebServerInfo(
      tree,
      'app',
      'app/rspack.config.ts',
      false,
      4321
    );

    // ASSERT
    expect(e2eWebServerInfo.e2eWebServerAddress).toBe('http://localhost:4321');
    expect(e2eWebServerInfo.e2eCiBaseUrl).toBe('http://localhost:4321');
  });
});
