import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { type Tree, readNxJson, updateNxJson } from 'nx/src/devkit-exports';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { getRspackE2EWebServerInfo } from './e2e-web-server-info-utils';

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

  it('should use array-shaped targetDefaults when no plugin is registered and plugins are not being used', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.targetDefaults = [
      {
        target: 'serve',
        options: {
          port: 4400,
        },
      },
    ];
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
});
