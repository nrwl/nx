import { type ExecutorContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { readFileSync } from 'fs';
import { join } from 'path';
import { type PackageJson } from 'nx/src/utils/package-json';
import pruneLockfileExecutor from './prune-lockfile';

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

jest.mock('nx/src/plugins/js/lock-file/lock-file', () => ({
  ...jest.requireActual('nx/src/plugins/js/lock-file/lock-file'),
  getLockFileName: jest.fn(() => 'package-lock.json'),
  createLockFile: jest.fn(() => '{}'),
}));
jest.mock('nx/src/plugins/js/utils/get-workspace-packages-from-graph', () => ({
  ...jest.requireActual(
    'nx/src/plugins/js/utils/get-workspace-packages-from-graph'
  ),
  getWorkspacePackagesFromGraph: jest.fn(() => new Map()),
}));

const PROJECT_ROOT = 'apps/app';

describe('pruneLockfileExecutor - allowScripts', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('prune-lockfile');
    mockWorkspaceRoot = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
    jest.clearAllMocks();
  });

  function setupWorkspace(
    rootPackageJson: PackageJson,
    projectPackageJson: PackageJson
  ) {
    tempFs.createFilesSync({
      'package.json': JSON.stringify(rootPackageJson),
      'package-lock.json': JSON.stringify({ name: 'root', lockfileVersion: 3 }),
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify(projectPackageJson),
    });
    tempFs.createDirSync('dist/app');
  }

  async function runExecutor() {
    return pruneLockfileExecutor(
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
          },
          dependencies: {},
          externalNodes: {},
        },
      } as unknown as ExecutorContext
    );
  }

  function readGeneratedPackageJson(): PackageJson {
    return JSON.parse(
      readFileSync(join(tempFs.tempDir, 'dist', 'app', 'package.json'), 'utf-8')
    );
  }

  it('copies the root allowScripts verbatim regardless of key shape', async () => {
    setupWorkspace(
      {
        name: 'root',
        version: '0.0.0',
        allowScripts: {
          'esbuild@0.19.0': true,
          sharp: true,
          'node-sass': false,
          '@scope/pkg@1.0.0': true,
          'org/repo#main': true,
          'git@github.com:org/repo.git': true,
          'file:../local-pkg': true,
          'https://example.com/a.tgz': true,
        },
      },
      { name: 'app', version: '0.0.1' }
    );

    await runExecutor();

    expect(readGeneratedPackageJson().allowScripts).toEqual({
      'esbuild@0.19.0': true,
      sharp: true,
      'node-sass': false,
      '@scope/pkg@1.0.0': true,
      'org/repo#main': true,
      'git@github.com:org/repo.git': true,
      'file:../local-pkg': true,
      'https://example.com/a.tgz': true,
    });
  });

  it('merges root and project allowScripts, with project winning on conflict', async () => {
    setupWorkspace(
      {
        name: 'root',
        version: '0.0.0',
        allowScripts: { sharp: true, esbuild: true },
      },
      { name: 'app', version: '0.0.1', allowScripts: { sharp: false } }
    );

    await runExecutor();

    expect(readGeneratedPackageJson().allowScripts).toEqual({
      sharp: false,
      esbuild: true,
    });
  });

  it('leaves the project allowScripts untouched when the root has none', async () => {
    setupWorkspace(
      { name: 'root', version: '0.0.0' },
      { name: 'app', version: '0.0.1', allowScripts: { foo: true } }
    );

    await runExecutor();

    expect(readGeneratedPackageJson().allowScripts).toEqual({ foo: true });
  });

  it('omits allowScripts when neither the root nor the project define it', async () => {
    setupWorkspace(
      { name: 'root', version: '0.0.0' },
      { name: 'app', version: '0.0.1' }
    );

    await runExecutor();

    expect(readGeneratedPackageJson().allowScripts).toBeUndefined();
  });
});
