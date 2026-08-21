import { type ExecutorContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import copyWorkspaceModules from './copy-workspace-modules';

// The executor reads `workspaceRoot` from `@nx/devkit`, which is captured at
// module load and isn't updated by `TempFs.setWorkspaceRoot`. Point it at the
// per-test temp dir via a getter; everything else stays real.
let mockWorkspaceRoot = '';
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  get workspaceRoot() {
    return mockWorkspaceRoot;
  },
}));

const PROJECT_ROOT = 'apps/app';

describe('copyWorkspaceModules', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('copy-workspace-modules');
    mockWorkspaceRoot = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  async function runWithDependencies(dependencies: Record<string, string>) {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies,
      }),
      'libs/lib-a/package.json': JSON.stringify({
        name: '@myorg/lib-a',
        version: '1.0.0',
        dependencies: { 'custom-inner': 'workspace:@myorg/lib-b@*' },
      }),
      'libs/lib-b/package.json': JSON.stringify({
        name: '@myorg/lib-b',
        version: '1.0.0',
      }),
    });
    tempFs.createDirSync('dist/app');

    await copyWorkspaceModules(
      {
        buildTarget: 'app:build',
        outputPath: join(tempFs.tempDir, 'dist/app'),
      },
      {
        root: tempFs.tempDir,
        cwd: tempFs.tempDir,
        isVerbose: false,
        projectGraph: {
          nodes: {
            app: { name: 'app', type: 'app', data: { root: PROJECT_ROOT } },
            '@myorg/lib-a': {
              name: '@myorg/lib-a',
              type: 'lib',
              data: {
                root: 'libs/lib-a',
                metadata: {
                  js: { packageName: '@myorg/lib-a', packageVersion: '1.0.0' },
                },
              },
            },
            '@myorg/lib-b': {
              name: '@myorg/lib-b',
              type: 'lib',
              data: {
                root: 'libs/lib-b',
                metadata: {
                  js: { packageName: '@myorg/lib-b', packageVersion: '1.0.0' },
                },
              },
            },
          },
          dependencies: {},
          externalNodes: {},
        },
      } as unknown as ExecutorContext
    );
  }

  function modulePath(...segments: string[]) {
    return join(
      tempFs.tempDir,
      'dist',
      'app',
      'workspace_modules',
      ...segments
    );
  }

  it('copies a workspace dependency referenced through a workspace alias', async () => {
    await runWithDependencies({ 'custom-lib': 'workspace:@myorg/lib-a@*' });

    expect(existsSync(modulePath('@myorg/lib-a', 'package.json'))).toBe(true);
  });

  it('copies a workspace dependency referenced through an npm alias', async () => {
    await runWithDependencies({ 'custom-lib': 'npm:@myorg/lib-a@1.0.0' });

    expect(existsSync(modulePath('@myorg/lib-a', 'package.json'))).toBe(true);
  });

  it('rewrites aliased nested workspace dependencies to the target module dir and copies the target', async () => {
    await runWithDependencies({ '@myorg/lib-a': 'workspace:*' });

    expect(existsSync(modulePath('@myorg/lib-b', 'package.json'))).toBe(true);
    const copiedLibA = JSON.parse(
      readFileSync(modulePath('@myorg/lib-a', 'package.json'), 'utf-8')
    );
    // the alias key stays, the file: path points at the target's dir
    expect(copiedLibA.dependencies).toEqual({
      'custom-inner': 'file:../lib-b',
    });
  });

  it('does not copy anything for an npm alias to a registry package', async () => {
    await runWithDependencies({ 'custom-lib': 'npm:lodash@^4.17.21' });

    expect(existsSync(modulePath('@myorg'))).toBe(false);
  });
});
