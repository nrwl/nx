import { homedir } from 'os';
import { join } from 'path';
import { parse as parseToml } from 'smol-toml';
import {
  claudeCodeDefinition,
  claudeCodeHandoffAllowedTools,
  encodeTomlString,
  opencodeDefinition,
} from './definitions';

describe('claudeCodeDefinition', () => {
  const originalPlatform = process.platform;
  const originalUserProfile = process.env.USERPROFILE;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }
  });

  it('returns the POSIX well-known path on non-Windows platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    expect(claudeCodeDefinition.wellKnownPaths()).toEqual([
      join(homedir(), '.claude', 'local', 'claude'),
    ]);
  });

  it('returns the Windows well-known path when USERPROFILE is set', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.USERPROFILE = 'C:\\Users\\Tester';
    expect(claudeCodeDefinition.wellKnownPaths()).toEqual([
      join('C:\\Users\\Tester', '.local', 'bin', 'claude.exe'),
    ]);
  });

  it('returns no well-known paths on Windows when USERPROFILE is unset', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    delete process.env.USERPROFILE;
    expect(claudeCodeDefinition.wellKnownPaths()).toEqual([]);
  });

  it.each([
    ['a comma, which starts another rule', '23.0.0,Edit(.env)'],
    ['a space, which also starts another rule', '23.0.0 Edit(.env)'],
    ['a paren, which closes the rule early', '23.0.0)'],
    ['a gitignore wildcard', '23.*'],
    ['a parent-directory reference', '..'],
  ])(
    'hands over no rule at all when the run directory name carries %s',
    (_label, runDirName) => {
      expect(claudeCodeHandoffAllowedTools(runDirName)).toBeNull();
    }
  );
});

describe('encodeTomlString', () => {
  // codex parses `-c key=value` as TOML and, on a parse failure, falls back to
  // the raw text as a literal, so an encoding that does not survive a real TOML
  // parse would ship a mangled system context.
  it.each([
    ['control characters', 'line1\nline2\r\n\ntabbed\tvalue'],
    ['double quotes', 'workspace at "/Users/me/work"'],
    ['backslashes', 'C:\\Users\\me\\My Documents\\ws'],
    ['TOML punctuation', '{ key = "value" } at 100% of %PATH%'],
    ['unicode', 'ends with an em dash — and an ellipsis …'],
    // JSON leaves a DEL raw, and TOML rejects it.
    ['a DEL', 'before\x7fafter'],
  ])(
    'round-trips the system context through a TOML parse (%s)',
    (_label, systemContext) => {
      const encoded = encodeTomlString(systemContext);
      expect(encoded).not.toMatch(/[\r\n]/);
      expect((parseToml(`value = ${encoded}`) as { value: string }).value).toBe(
        systemContext
      );
    }
  );
});

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
});
