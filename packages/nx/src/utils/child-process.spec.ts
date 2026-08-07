jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawnSync: jest.fn(),
}));
jest.mock('../native', () => ({ ChildProcess: class {} }));
jest.mock('./package-manager', () => ({
  detectPackageManager: jest.fn(),
  getPackageManagerCommand: jest.fn(),
}));
jest.mock('./workspace-root', () => ({
  workspaceRoot: '/root',
  workspaceRootInner: jest.fn(() => '/root'),
}));

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { getRunNxBaseCommand, runNxArgvSync } from './child-process';
import type { PackageManagerCommands } from './package-manager';

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
    (existsSync as jest.Mock).mockReturnValue(true);
    expect(getRunNxBaseCommand(pmc, '/root')).toBe('npx nx');
  });

  it('should use the nx.bat wrapper on Windows when there is no package.json', () => {
    (existsSync as jest.Mock).mockReturnValue(false);
    withPlatform('win32', () => {
      expect(getRunNxBaseCommand(pmc, '/root')).toBe('.\\nx.bat');
    });
  });

  it('should use the ./nx wrapper on non-Windows platforms when there is no package.json', () => {
    (existsSync as jest.Mock).mockReturnValue(false);
    withPlatform('linux', () => {
      expect(getRunNxBaseCommand(pmc, '/root')).toBe('./nx');
    });
  });
});

describe('runNxArgvSync', () => {
  const spawnSyncMock = spawnSync as jest.Mock;

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
});
