import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { output } from '@nx/devkit';
import { callUpgrade } from './calling-storybook-cli';

let workspace: string;

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  execSync: vi.fn(),
}));

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  detectPackageManager: vi.fn(() => 'npm'),
  get workspaceRoot() {
    return workspace;
  },
}));

describe('callUpgrade', () => {
  function writePackageJson(json: Record<string, any>) {
    writeFileSync(join(workspace, 'package.json'), JSON.stringify(json));
  }

  function readPackageJson() {
    return JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf-8'));
  }

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'calling-storybook-cli-'));
    vi.mocked(execSync).mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(workspace, { recursive: true, force: true });
  });

  it('keeps @nx packages on their existing versions and reinstalls them when the storybook CLI bumps them', () => {
    writePackageJson({
      devDependencies: {
        nx: '22.7.12',
        '@nx/js': '22.7.12',
        '@nx/storybook': '22.7.12',
        storybook: '^9.0.0',
      },
    });
    vi.mocked(execSync).mockImplementationOnce(() => {
      writePackageJson({
        devDependencies: {
          nx: '22.7.12',
          '@nx/js': '22.7.12',
          '@nx/storybook': '^23.2.1',
          storybook: '^10.0.0',
        },
      });
      return Buffer.from('');
    });

    const result = callUpgrade({ autoAcceptAllPrompts: true });

    expect(result).toEqual({ success: true });
    expect(readPackageJson().devDependencies).toEqual({
      nx: '22.7.12',
      '@nx/js': '22.7.12',
      '@nx/storybook': '22.7.12',
      storybook: '^10.0.0',
    });
    expect(execSync).toHaveBeenCalledTimes(2);
    expect(execSync).toHaveBeenLastCalledWith(
      'npm install',
      expect.objectContaining({ cwd: workspace })
    );
  });

  it('restores and reinstalls @nx versions even when the storybook CLI fails', () => {
    writePackageJson({ devDependencies: { '@nx/storybook': '22.7.12' } });
    vi.mocked(execSync).mockImplementationOnce(() => {
      writePackageJson({ devDependencies: { '@nx/storybook': '^23.2.1' } });
      throw new Error('upgrade failed');
    });

    expect(callUpgrade({ autoAcceptAllPrompts: true })).toEqual({
      success: false,
    });
    expect(readPackageJson().devDependencies['@nx/storybook']).toBe('22.7.12');
    expect(execSync).toHaveBeenCalledTimes(2);
    expect(execSync).toHaveBeenLastCalledWith(
      'npm install',
      expect.objectContaining({ cwd: workspace })
    );
  });

  it('does not touch package.json or reinstall when the storybook CLI leaves @nx versions unchanged', () => {
    const original = JSON.stringify({
      devDependencies: { '@nx/storybook': '22.7.12', storybook: '^9.0.0' },
    });
    writeFileSync(join(workspace, 'package.json'), original);
    vi.mocked(execSync).mockImplementation(() => Buffer.from(''));

    const result = callUpgrade({ autoAcceptAllPrompts: true });

    expect(result).toEqual({ success: true });
    expect(readFileSync(join(workspace, 'package.json'), 'utf-8')).toBe(
      original
    );
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it('tells the user to install when reinstalling the restored @nx versions fails', () => {
    const warnSpy = vi.spyOn(output, 'warn').mockImplementation(() => {});
    writePackageJson({ devDependencies: { '@nx/storybook': '22.7.12' } });
    vi.mocked(execSync)
      .mockImplementationOnce(() => {
        writePackageJson({ devDependencies: { '@nx/storybook': '^23.2.1' } });
        return Buffer.from('');
      })
      .mockImplementationOnce(() => {
        throw new Error('install failed');
      });

    expect(callUpgrade({ autoAcceptAllPrompts: true })).toEqual({
      success: true,
    });
    expect(readPackageJson().devDependencies['@nx/storybook']).toBe('22.7.12');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyLines: [expect.stringContaining('"npm install"')],
      })
    );
  });
});
