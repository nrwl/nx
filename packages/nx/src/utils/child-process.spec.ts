import type { Mock } from 'vitest';
vi.mock('fs', async () => ({
  ...require('fs'),
  existsSync: vi.fn(),
}));
vi.mock('child_process', async () => ({
  ...require('child_process'),
  spawnSync: vi.fn(),
  execSync: vi.fn(),
}));
vi.mock('../native', () => ({ ChildProcess: class {} }));
vi.mock('./package-manager', () => ({
  detectPackageManager: vi.fn(),
  getPackageManagerCommand: vi.fn(),
}));
vi.mock('./workspace-root', () => ({
  workspaceRoot: '/root',
  workspaceRootInner: vi.fn(() => '/root'),
}));

import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getNxBin,
  getRunNxBaseCommand,
  readInstalledNxBin,
  runNxArgvSync,
} from './child-process';
import {
  getPackageManagerCommand,
  type PackageManagerCommands,
} from './package-manager';

const realFs = require('fs') as typeof import('fs');

describe('getRunNxBaseCommand', () => {
  const pmc = { exec: 'npx' } as PackageManagerCommands;

  function withPlatform(platform: NodeJS.Platform, fn: () => void) {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: platform });
    try {
      fn();
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  }

  it('should run nx through the package manager when the workspace has a package.json', () => {
    (existsSync as Mock).mockReturnValue(true);
    expect(getRunNxBaseCommand(pmc, '/root')).toBe('npx nx');
  });

  it('should use the nx.bat wrapper on Windows when there is no package.json', () => {
    (existsSync as Mock).mockReturnValue(false);
    withPlatform('win32', () => {
      expect(getRunNxBaseCommand(pmc, '/root')).toBe('.\\nx.bat');
    });
  });

  it('should use the ./nx wrapper on non-Windows platforms when there is no package.json', () => {
    (existsSync as Mock).mockReturnValue(false);
    withPlatform('linux', () => {
      expect(getRunNxBaseCommand(pmc, '/root')).toBe('./nx');
    });
  });
});

describe('getNxBin', () => {
  let fixture: string;

  // Shaped like the published package, whose `bin` points into `dist`, so the
  // tests would notice the lookup falling back to a guessed path.
  function writeNxInstall(
    dir: string,
    bin: unknown = { nx: './dist/bin/nx.js' }
  ) {
    const nxDir = join(dir, 'node_modules', 'nx');
    realFs.mkdirSync(join(nxDir, 'dist', 'bin'), { recursive: true });
    realFs.writeFileSync(
      join(nxDir, 'package.json'),
      JSON.stringify({ name: 'nx', version: '1.0.0', bin })
    );
    realFs.writeFileSync(join(nxDir, 'dist', 'bin', 'nx.js'), '');
    return join(nxDir, 'dist', 'bin', 'nx.js');
  }

  function workspace(name: string): string {
    const root = join(fixture, name);
    realFs.mkdirSync(root, { recursive: true });
    realFs.writeFileSync(join(root, 'package.json'), '{}');
    return root;
  }

  beforeEach(() => {
    (existsSync as Mock).mockImplementation(realFs.existsSync);
    fixture = realFs.realpathSync(
      realFs.mkdtempSync(join(tmpdir(), 'nx-get-nx-bin-'))
    );
  });

  afterEach(() => {
    realFs.rmSync(fixture, { recursive: true, force: true });
  });

  it('takes the entry point the workspace nx names in its bin field', () => {
    const root = workspace('ws');
    const nxBin = writeNxInstall(root);

    expect(getNxBin(root)).toBe(nxBin);
  });

  it('accepts the single-entry bin form', () => {
    const root = workspace('ws');
    const nxBin = writeNxInstall(root, './dist/bin/nx.js');

    expect(getNxBin(root)).toBe(nxBin);
  });

  it('finds nx hoisted into an ancestor node_modules', () => {
    const nxBin = writeNxInstall(fixture);
    const root = workspace('ws');

    expect(getNxBin(root)).toBe(nxBin);
  });

  it('prefers the nearest install over a hoisted one', () => {
    writeNxInstall(fixture);
    const root = workspace('ws');
    const nxBin = writeNxInstall(root);

    expect(getNxBin(root)).toBe(nxBin);
  });

  it('returns null when the workspace holds no nx of its own', () => {
    // A resolver would still answer here, from NODE_PATH or from the running
    // package. `nx migrate` puts its temp installation on NODE_PATH before
    // handing off, and handing off to that would re-enter the same hand-off.
    expect(getNxBin(workspace('ws'))).toBeNull();
  });

  it('returns null when the installed nx names no nx bin', () => {
    const root = workspace('ws');
    writeNxInstall(root, { 'nx-cloud': './dist/bin/nx-cloud.js' });

    expect(getNxBin(root)).toBeNull();
  });

  it('returns null when the installed nx has an unreadable manifest', () => {
    const root = workspace('ws');
    writeNxInstall(root);
    realFs.writeFileSync(
      join(root, 'node_modules', 'nx', 'package.json'),
      '{ not json'
    );

    expect(getNxBin(root)).toBeNull();
  });

  it('returns null when the workspace has no root package.json', () => {
    // A `.nx/installation` workspace: the `./nx` wrapper has to run so it can
    // re-sync the installation, so nothing may be spawned directly, not even
    // the hoisted nx the ascent would otherwise hand back.
    const root = join(fixture, 'ws');
    writeNxInstall(fixture);
    writeNxInstall(join(root, '.nx', 'installation'));

    expect(getNxBin(root)).toBeNull();
  });

  it('finds nx linked into the workspace node_modules from outside it', () => {
    // `npm link nx` and a `file:` dependency both land here. The package
    // manager runs this nx, so it is the workspace's nx however far outside
    // the link target sits.
    const outside = join(fixture, 'outside');
    realFs.mkdirSync(outside, { recursive: true });
    writeNxInstall(outside);

    const root = workspace('ws');
    realFs.mkdirSync(join(root, 'node_modules'), { recursive: true });
    realFs.symlinkSync(
      join(outside, 'node_modules', 'nx'),
      join(root, 'node_modules', 'nx'),
      'dir'
    );

    expect(getNxBin(root)).toBe(
      join(root, 'node_modules', 'nx', 'dist', 'bin', 'nx.js')
    );
  });

  describe('readInstalledNxBin', () => {
    it('takes the entry point the nx installed in that directory names', () => {
      const root = workspace('ws');
      const nxBin = writeNxInstall(root);

      expect(readInstalledNxBin(root)).toBe(nxBin);
    });

    it('returns null rather than reaching for an ancestor nx', () => {
      // The caller installed nx itself, so an ancestor's is one nobody asked
      // for. `nx migrate` reads its temp installation through here, and that
      // temp dir sits directly under the shared system temp directory.
      writeNxInstall(fixture);
      const root = join(fixture, 'installation');
      realFs.mkdirSync(root, { recursive: true });

      expect(readInstalledNxBin(root)).toBeNull();
      expect(readInstalledNxBin(fixture)).not.toBeNull();
    });
  });
});

describe('runNxArgvSync', () => {
  const spawnSyncMock = spawnSync as Mock;

  beforeEach(() => {
    spawnSyncMock.mockReset();
    spawnSyncMock.mockReturnValue({ status: 0 });
  });

  it('passes every argument through verbatim with no shell involved', () => {
    const argv = [
      '_migrate',
      '--commit-prefix=chore(repo): [nx migration] ',
      '--data=%FOO% and ^caret and $HOME',
      '',
    ];

    runNxArgvSync(argv, { nxBin: '/tmp/nx/bin/nx.js' });

    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnSyncMock.mock.calls[0];
    expect(command).toBe(process.execPath);
    expect(args).toEqual(['/tmp/nx/bin/nx.js', ...argv]);
    expect(options.shell).toBeUndefined();
  });

  it('throws an error carrying the exit status when the command fails', () => {
    spawnSyncMock.mockReturnValue({ status: 7 });

    let caught: any;
    try {
      runNxArgvSync(['_migrate'], { nxBin: '/tmp/nx/bin/nx.js' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.status).toBe(7);
  });

  it('throws the spawn error when the process could not start', () => {
    spawnSyncMock.mockReturnValue({ error: new Error('ENOENT'), status: null });

    expect(() =>
      runNxArgvSync(['_migrate'], { nxBin: '/tmp/nx/bin/nx.js' })
    ).toThrow('ENOENT');
  });

  it('hands quoted arguments to the package manager when no nx can be resolved', () => {
    const execSyncMock = execSync as Mock;
    execSyncMock.mockReset();
    // A root package.json with no readable nx beside it: the shape of the
    // workspaces `getNxBin` declines, so the shell fallback runs.
    (existsSync as Mock).mockReturnValue(true);
    (getPackageManagerCommand as Mock).mockReturnValue({ exec: 'npx' });
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    try {
      runNxArgvSync(['_migrate', '--commit-prefix=chore(repo): x']);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }

    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(execSyncMock.mock.calls[0][0]).toBe(
      `npx nx _migrate '--commit-prefix=chore(repo): x'`
    );
  });
});
