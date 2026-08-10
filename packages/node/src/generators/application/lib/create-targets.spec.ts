import { getPruneTargets } from './create-targets';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(),
}));

// Pruning reads the lockfile of the workspace nx itself runs in, which is not
// the temp fixture below; stub that read and the pruning step so the fixture's
// own lockfile content drives the artifacts. Only that one path is stubbed,
// since the fixture's own reads are what the assertions observe.
// Not a jest.fn: `resetAllMocks` below would strip the passthrough and every
// read would return undefined.
jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    readFileSync: (path, ...args) =>
      path === mockRootLockfile
        ? 'ROOT_LOCKFILE'
        : actual.readFileSync(path, ...args),
  };
});
jest.mock('nx/src/plugins/js/lock-file/project-graph-pruning', () => ({
  ...jest.requireActual('nx/src/plugins/js/lock-file/project-graph-pruning'),
  pruneProjectGraph: jest.fn((graph) => graph),
}));
jest.mock('nx/src/plugins/js/lock-file/pnpm-parser', () => ({
  ...jest.requireActual('nx/src/plugins/js/lock-file/pnpm-parser'),
  stringifyPnpmLockfile: jest.fn(),
}));

import {
  detectPackageManager,
  workspaceRoot as nxWorkspaceRoot,
} from '@nx/devkit';
import { generatePrunedDeployOutput } from '@nx/devkit/internal';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, relative, sep } from 'path';

const mockRootLockfile = join(nxWorkspaceRoot, 'pnpm-lock.yaml');

// True when `writtenFile` (workspace-root-relative, forward-slashed) sits at or
// under one of the `{workspaceRoot}/...` output globs the prune targets declare.
function coveredByDeclaredOutput(
  writtenFile: string,
  declaredOutputs: string[]
): boolean {
  return declaredOutputs.some((output) => {
    const declared = output.replace('{workspaceRoot}/', '');
    return writtenFile === declared || writtenFile.startsWith(`${declared}/`);
  });
}

describe('getPruneTargets', () => {
  afterEach(() => jest.resetAllMocks());

  it('declares the pnpm-workspace.yaml, patches, and local_path_modules outputs on pnpm', () => {
    // The prune-lockfile executor emits pnpm-workspace.yaml (pnpm 11+ settings),
    // any `pnpm patch` files under patches/, and non-workspace local-path deps
    // under local_path_modules/; all must be declared outputs or a cache replay
    // drops them.
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');

    const targets = getPruneTargets('build', 'dist/my-app');

    expect(targets['prune-lockfile'].outputs).toEqual([
      '{workspaceRoot}/dist/my-app/package.json',
      '{workspaceRoot}/dist/my-app/pnpm-lock.yaml',
      '{workspaceRoot}/dist/my-app/pnpm-workspace.yaml',
      '{workspaceRoot}/dist/my-app/patches',
      '{workspaceRoot}/dist/my-app/local_path_modules',
    ]);
  });

  it('declares only package.json and the lockfile on npm', () => {
    (detectPackageManager as jest.Mock).mockReturnValue('npm');

    const targets = getPruneTargets('build', 'dist/my-app');

    expect(targets['prune-lockfile'].outputs).toEqual([
      '{workspaceRoot}/dist/my-app/package.json',
      '{workspaceRoot}/dist/my-app/package-lock.json',
    ]);
  });

  // The prune-lockfile executor ships non-workspace local-path deps (a file:
  // tarball/directory or a link: target) into the output under
  // local_path_modules/. Those destinations must be covered by a declared
  // prune-lockfile output, or a cache replay on a fresh machine restores only
  // the declared files and the pruned deploy loses the vendored dependency.
  it('declares outputs covering the local-path artifacts the prune-lockfile executor writes', () => {
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');

    const workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-prune-outputs-'));
    try {
      const outputPath = 'dist/my-app';
      const outputDir = join(workspaceRoot, outputPath);
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(
        join(workspaceRoot, 'package.json'),
        JSON.stringify({ name: 'root', packageManager: 'pnpm@11.2.2' })
      );

      // A vendored file: directory dependency outside the pnpm workspace glob.
      // Its source lives at its original workspace path; the pruned lockfile
      // records it relocated under local_path_modules/ (as prune-lockfile emits).
      mkdirSync(join(workspaceRoot, 'vendor/dir'), { recursive: true });
      writeFileSync(
        join(workspaceRoot, 'vendor/dir/package.json'),
        JSON.stringify({ name: 'dir-dep', version: '1.0.0', main: 'index.js' })
      );
      writeFileSync(
        join(workspaceRoot, 'vendor/dir/index.js'),
        'module.exports = {};'
      );
      const { stringifyPnpmLockfile } = jest.requireMock(
        'nx/src/plugins/js/lock-file/pnpm-parser'
      );
      stringifyPnpmLockfile.mockReturnValue(
        [
          "lockfileVersion: '9.0'",
          '',
          'packages:',
          '',
          '  dir-dep@file:local_path_modules/vendor/dir:',
          '    resolution: {directory: local_path_modules/vendor/dir, type: directory}',
          '',
        ].join('\n')
      );

      generatePrunedDeployOutput(
        { name: 'my-app', version: '1.0.0' },
        { nodes: {}, dependencies: {}, externalNodes: {} },
        'apps/my-app',
        { outputDirectory: outputDir, packageManager: 'pnpm', workspaceRoot }
      );

      const declaredOutputs = getPruneTargets('build', outputPath)[
        'prune-lockfile'
      ].outputs;

      const writtenFiles: string[] = [];
      const collect = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          const absolute = join(dir, entry);
          if (statSync(absolute).isDirectory()) {
            collect(absolute);
          } else {
            writtenFiles.push(
              relative(workspaceRoot, absolute).split(sep).join('/')
            );
          }
        }
      };
      collect(outputDir);

      // The vendored tree is what the declared outputs have to cover, so the
      // check is only meaningful once it has actually shipped.
      expect(writtenFiles).toContain(
        `${outputPath}/local_path_modules/vendor/dir/index.js`
      );
      const uncovered = writtenFiles.filter(
        (file) => !coveredByDeclaredOutput(file, declaredOutputs)
      );
      expect(uncovered).toEqual([]);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
