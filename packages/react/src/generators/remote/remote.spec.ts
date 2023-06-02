import { readJson, readNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import remote from './remote';

describe('remote generator', () => {
  it('should install @nx/web for the file-server executor', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: false,
      style: 'css',
      unitTestRunner: 'jest',
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nx/web']).toBeDefined();
  });

  it('should not set the remote as the default project', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: false,
      style: 'css',
      unitTestRunner: 'jest',
    });

    const { defaultProject } = readNxJson(tree);
    expect(defaultProject).toBeUndefined();
  });

  it('should generate a remote-specific server.ts file for --ssr', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: false,
      style: 'css',
      unitTestRunner: 'jest',
      ssr: true,
    });

    const mainFile = tree.read('apps/test/server.ts', 'utf-8');
    expect(mainFile).toContain(`join(process.cwd(), 'dist/apps/test/browser')`);
    expect(mainFile).toContain('nx.server.ready');
  });
});
