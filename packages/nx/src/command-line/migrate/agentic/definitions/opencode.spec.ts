import { homedir } from 'os';
import { join } from 'path';
import { opencodeDefinition } from './opencode';

describe('opencodeDefinition', () => {
  const originalPlatform = process.platform;
  const originalInstallDir = process.env.OPENCODE_INSTALL_DIR;
  const originalXdgBinDir = process.env.XDG_BIN_DIR;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    if (originalInstallDir === undefined) {
      delete process.env.OPENCODE_INSTALL_DIR;
    } else {
      process.env.OPENCODE_INSTALL_DIR = originalInstallDir;
    }
    if (originalXdgBinDir === undefined) {
      delete process.env.XDG_BIN_DIR;
    } else {
      process.env.XDG_BIN_DIR = originalXdgBinDir;
    }
  });

  it('uses the expected id, display name, and binary name', () => {
    expect(opencodeDefinition.id).toBe('opencode');
    expect(opencodeDefinition.displayName).toBe('OpenCode');
    expect(opencodeDefinition.binaryNames).toEqual(['opencode']);
  });

  it('returns POSIX well-known paths derived from environment and home', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env.OPENCODE_INSTALL_DIR = '/opt/opencode';
    process.env.XDG_BIN_DIR = '/home/me/.local/bin';
    const paths = opencodeDefinition.wellKnownPaths();
    const home = homedir();
    expect(paths).toEqual([
      join('/opt/opencode', 'opencode'),
      join('/home/me/.local/bin', 'opencode'),
      join(home, 'bin', 'opencode'),
      join(home, '.opencode', 'bin', 'opencode'),
    ]);
  });

  it('omits env-derived paths when their variables are unset', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    delete process.env.OPENCODE_INSTALL_DIR;
    delete process.env.XDG_BIN_DIR;
    const paths = opencodeDefinition.wellKnownPaths();
    const home = homedir();
    expect(paths).toEqual([
      join(home, 'bin', 'opencode'),
      join(home, '.opencode', 'bin', 'opencode'),
    ]);
  });

  it('returns no well-known paths on Windows (deferred)', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    expect(opencodeDefinition.wellKnownPaths()).toEqual([]);
  });

  it('injects the system context via OPENCODE_CONFIG_CONTENT under the transient agent name', () => {
    const spec = opencodeDefinition.buildInteractive({
      systemContext: 'system text',
      userPrompt: 'user text',
      workspaceRoot: '/workspace',
    });
    expect(spec.args).toEqual([
      '--agent',
      'nx-migrate',
      '--prompt',
      'user text',
    ]);
    expect(spec.cwd).toBe('/workspace');
    expect(spec.env?.OPENCODE_CONFIG_CONTENT).toBeDefined();
    const parsed = JSON.parse(spec.env!.OPENCODE_CONFIG_CONTENT as string);
    expect(parsed).toEqual({
      agent: { 'nx-migrate': { prompt: 'system text' } },
    });
  });
});
