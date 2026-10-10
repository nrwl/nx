import {
  detectPackageManager,
  getPackageManagerVersion,
  readJson,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import hostGenerator from './host/host';
import remoteGenerator from './remote/remote';

vi.mock('@nx/devkit', async () => {
  const original = await vi.importActual<any>('@nx/devkit');
  return {
    ...original,
    detectPackageManager: vi.fn(),
    getPackageManagerVersion: vi.fn(),
    createProjectGraphAsync: vi.fn().mockResolvedValue({
      dependencies: {},
      nodes: {},
    }),
    readCachedProjectGraph: vi.fn().mockReturnValue({
      dependencies: {},
      nodes: {},
    }),
  };
});

describe('Module Federation workspace dependencies', () => {
  it.each([
    ['npm', '11.0.0', '*'],
    ['yarn', '1.22.22', '*'],
    ['yarn', '4.0.2', 'workspace:*'],
    ['pnpm', '10.0.0', 'workspace:*'],
    ['bun', '1.3.0', 'workspace:*'],
  ] as const)(
    'links remotes with %s %s',
    async (packageManager, version, expectedSpecifier) => {
      vi.mocked(detectPackageManager).mockReturnValue(packageManager);
      vi.mocked(getPackageManagerVersion).mockReturnValue(version);
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        workspaces: ['*'],
      }));
      if (packageManager === 'pnpm') {
        tree.write('pnpm-workspace.yaml', 'packages:\n  - "*"\n');
      }
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: { composite: true, declaration: true },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });

      await hostGenerator(tree, {
        directory: 'shell',
        remotes: ['remote1'],
        bundler: 'rspack',
        e2eTestRunner: 'none',
        unitTestRunner: 'none',
        linter: 'none',
        style: 'css',
        skipFormat: true,
      });
      await remoteGenerator(tree, {
        directory: 'remote2',
        host: 'shell',
        bundler: 'rspack',
        e2eTestRunner: 'none',
        unitTestRunner: 'none',
        linter: 'none',
        style: 'css',
        skipFormat: true,
      });
      expect(
        readJson(tree, 'shell/package.json').devDependencies
      ).toMatchObject({
        remote1: expectedSpecifier,
        remote2: expectedSpecifier,
      });
    }
  );
});
