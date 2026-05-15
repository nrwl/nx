import { homedir } from 'os';
import { join } from 'path';
import { claudeCodeDefinition } from './claude-code';

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

  it('uses the expected id, display name, and binary name', () => {
    expect(claudeCodeDefinition.id).toBe('claude-code');
    expect(claudeCodeDefinition.displayName).toBe('Claude Code');
    expect(claudeCodeDefinition.binaryNames).toEqual(['claude']);
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

  it('builds the interactive spec with --system-prompt and the user prompt', () => {
    const spec = claudeCodeDefinition.buildInteractive({
      systemContext: 'system text',
      userPrompt: 'user text',
      workspaceRoot: '/workspace',
    });
    expect(spec).toEqual({
      args: ['--system-prompt', 'system text', 'user text'],
      cwd: '/workspace',
    });
  });
});
