import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { type Tree, readNxJson, updateNxJson } from 'nx/src/devkit-exports';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { getRsbuildE2EWebServerInfo } from './e2e-web-server-info-utils';

describe('getRsbuildE2EWebServerInfo', () => {
  let tree: Tree;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('e2e-webserver-info');
    tree = createTreeWithEmptyWorkspace();
    tree.root = tempFs.tempDir;

    tree.write(`app/rsbuild.config.ts`, ``);
    tempFs.createFileSync(`app/rsbuild.config.ts`, ``);
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
        target: 'dev',
        options: {
          port: 4400,
        },
      },
    ];
    updateNxJson(tree, nxJson);

    // ACT
    const e2eWebServerInfo = await getRsbuildE2EWebServerInfo(
      tree,
      'app',
      'app/rsbuild.config.ts',
      false
    );

    // ASSERT
    expect(e2eWebServerInfo).toMatchInlineSnapshot(`
      {
        "e2eCiBaseUrl": "http://localhost:4400",
        "e2eCiWebServerCommand": "npx nx run app:preview",
        "e2eDevServerTarget": "app:dev",
        "e2eWebServerAddress": "http://localhost:4400",
        "e2eWebServerCommand": "npx nx run app:dev",
      }
    `);
  });
});
