import { homedir } from 'os';
import { join } from 'path';
import { parse as parseToml } from 'smol-toml';
import {
  claudeCodeDefinition,
  codexDefinition,
  opencodeDefinition,
} from './definitions';
import { InvocationContext } from './types';

function makeContext(
  overrides: Partial<InvocationContext> = {}
): InvocationContext {
  return {
    systemPrompt: 'system text',
    systemPromptFilePath:
      '/workspace/.nx/migrate-runs/23.0.0/handoffs/pkg/m.system.md',
    instructionsPointer:
      'read .nx/migrate-runs/23.0.0/handoffs/pkg/m.instructions.md',
    inlineSystemContext: 'inline system text',
    inlineSystemContextFallback: 'short system text',
    workspaceRoot: '/workspace',
    runDirName: '23.0.0',
    ...overrides,
  };
}

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

  it('builds the interactive spec with pre-authorized handoff writes, --system-prompt-file, and the instructions pointer', () => {
    const spec = claudeCodeDefinition.buildInteractive(makeContext());
    expect(spec).toEqual({
      args: [
        '--allowedTools',
        'Edit(.nx/migrate-runs/23.0.0/handoffs/**)',
        '--system-prompt-file',
        '/workspace/.nx/migrate-runs/23.0.0/handoffs/pkg/m.system.md',
        'read .nx/migrate-runs/23.0.0/handoffs/pkg/m.instructions.md',
      ],
      cwd: '/workspace',
    });
  });

  // A run directory holds the state Nx wrote and reads back beside the
  // handoffs, and a sibling directory is another run's, whose handoffs decide
  // how its steps settle. Both are reachable from the session cwd, so only the
  // rule keeps this invocation out of them.
  it('names one run directory rather than a pattern spanning several', () => {
    const [, rule] = claudeCodeDefinition.buildInteractive(makeContext()).args;

    expect(rule).toBe('Edit(.nx/migrate-runs/23.0.0/handoffs/**)');
    expect(rule).not.toContain('*/handoffs');
    expect(rule).not.toContain('Write(');
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
      const spec = claudeCodeDefinition.buildInteractive(
        makeContext({ runDirName })
      );

      expect(spec.args).toEqual([
        '--system-prompt-file',
        '/workspace/.nx/migrate-runs/23.0.0/handoffs/pkg/m.system.md',
        'read .nx/migrate-runs/23.0.0/handoffs/pkg/m.instructions.md',
      ]);
    }
  );
});

describe('codexDefinition', () => {
  it('injects the inline system context via developer_instructions and appends the instructions pointer', () => {
    const spec = codexDefinition.buildInteractive(makeContext());
    expect(spec).toEqual({
      args: [
        '-c',
        'developer_instructions="inline system text"',
        'read .nx/migrate-runs/23.0.0/handoffs/pkg/m.instructions.md',
      ],
      cwd: '/workspace',
    });
  });

  // codex parses `-c key=value` as TOML and, on a parse failure, silently
  // falls back to the raw text with quotes trimmed, so an encoding that does
  // not survive a real TOML parse would ship a mangled system context.
  it.each([
    ['embedded newlines', 'line1\nline2\n\nline4'],
    ['carriage returns', 'line1\r\nline2'],
    ['double quotes', 'workspace at "/Users/me/work"'],
    ['backslashes', 'C:\\Users\\me\\My Documents\\ws'],
    ['tabs', 'a\tb'],
    ['equals signs and braces', '{ key = "value" }'],
    ['percent signs', '100% of %PATH%'],
    ['unicode', 'ends with an em dash — and an ellipsis …'],
  ])(
    'round-trips the inline system context through a TOML parse (%s)',
    (_label, inlineSystemContext) => {
      const spec = codexDefinition.buildInteractive(
        makeContext({ inlineSystemContext })
      );
      const encoded = spec.args[1].replace('developer_instructions=', '');
      expect(encoded).not.toMatch(/[\r\n]/);
      expect((parseToml(`value = ${encoded}`) as { value: string }).value).toBe(
        inlineSystemContext
      );
    }
  );

  it('refuses a system context that cannot be encoded as TOML', () => {
    expect(() =>
      // A raw DEL is legal in a JSON string but not in a TOML basic string.
      codexDefinition.buildInteractive(
        makeContext({ inlineSystemContext: 'before\x7fafter' })
      )
    ).toThrow('Could not encode the agent');
  });
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

  // Round-trip guard: the system prompt reference is embedded as a
  // JSON-stringified value under OPENCODE_CONFIG_CONTENT. JSON handles quoting
  // / newlines / angle-brackets, so a hostile workspace path must come back out
  // of a JSON.parse round-trip as the reference opencode will resolve. That is
  // the path with separators rewritten to `/`, or the inlined prompt when the
  // path carries a `}` (see below).
  it.each([
    ['equals signs and braces', '/ws/{ key: "value" }/m.system.md'],
    ['double quotes', '/ws/"quoted"/m.system.md'],
    ['angle brackets', '/ws/<script>/m.system.md'],
    ['ampersands', '/ws/a && b/m.system.md'],
    ['backticks and dollars', '/ws/`whoami` $HOME/m.system.md'],
    ['windows-style path', 'C:\\Users\\me\\My Documents\\ws\\m.system.md'],
  ])(
    'round-trips a hostile system prompt path through OPENCODE_CONFIG_CONTENT (%s)',
    (_label, systemPromptFilePath) => {
      const spec = opencodeDefinition.buildInteractive(
        makeContext({ systemPromptFilePath })
      );
      const parsed = JSON.parse(spec.env!.OPENCODE_CONFIG_CONTENT as string);
      const prompt = parsed.agent['nx-migrate'].prompt;
      // A `}` in the path would end opencode's `{file:...}` substitution early,
      // so those paths inline the prompt instead of referencing it.
      expect(prompt).toBe(
        systemPromptFilePath.includes('}')
          ? 'system text'
          : `{file:${systemPromptFilePath.replace(/\\/g, '/')}}`
      );
    }
  );

  it('references the system prompt file via OPENCODE_CONFIG_CONTENT under the transient agent name', () => {
    const spec = opencodeDefinition.buildInteractive(makeContext());
    expect(spec.args).toEqual([
      '--agent',
      'nx-migrate',
      '--prompt',
      'read .nx/migrate-runs/23.0.0/handoffs/pkg/m.instructions.md',
    ]);
    expect(spec.cwd).toBe('/workspace');
    const parsed = JSON.parse(spec.env!.OPENCODE_CONFIG_CONTENT as string);
    expect(parsed).toEqual({
      agent: {
        'nx-migrate': {
          prompt:
            '{file:/workspace/.nx/migrate-runs/23.0.0/handoffs/pkg/m.system.md}',
        },
      },
    });
  });

  // cmd.exe drops any inherited environment variable over 8191 characters, so
  // the reference has to stay short even when the prompt behind it does not.
  it('keeps the environment value small regardless of system prompt size', () => {
    const spec = opencodeDefinition.buildInteractive(
      makeContext({ systemPrompt: 'x'.repeat(20_000) })
    );
    expect(
      `OPENCODE_CONFIG_CONTENT=${spec.env!.OPENCODE_CONFIG_CONTENT}`.length
    ).toBeLessThan(500);
  });
});
