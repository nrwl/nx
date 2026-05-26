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

  // Round-trip guard: the system context is embedded as a JSON-stringified
  // value under OPENCODE_CONFIG_CONTENT. JSON handles quoting / newlines /
  // angle-brackets, so hostile workspace paths in the prompt must come back
  // out unchanged after a JSON.parse round-trip.
  it.each([
    ['embedded newlines', 'line1\nline2'],
    ['equals signs and braces', '{ key: "value" }'],
    ['double quotes', 'workspace at "/Users/me/work"'],
    ['angle brackets', 'before <script>after'],
    ['ampersands', 'a && b'],
    ['backticks and dollars', '`whoami` $HOME'],
    ['windows-style path', 'C:\\Users\\me\\My Documents\\ws'],
  ])(
    'round-trips hostile system context through OPENCODE_CONFIG_CONTENT (%s)',
    (_label, hostile) => {
      const spec = opencodeDefinition.buildInteractive({
        systemContext: hostile,
        userPrompt: 'user',
        workspaceRoot: '/ws',
      });
      const parsed = JSON.parse(spec.env!.OPENCODE_CONFIG_CONTENT as string);
      expect(parsed.agent['nx-migrate'].prompt).toBe(hostile);
    }
  );

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
