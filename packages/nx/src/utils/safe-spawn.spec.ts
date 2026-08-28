import type { Mock } from 'vitest';
import { execFileSync, spawn } from 'child_process';
import { safeExecFileSync, safeSpawn } from './safe-spawn';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execFileSync: vi.fn(),
}));

describe('safeSpawn', () => {
  const originalPlatform = process.platform;

  function setPlatform(value: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value,
    });
  }

  beforeEach(() => {
    (spawn as Mock).mockReset();
    (execFileSync as Mock).mockReset();
  });

  afterEach(() => setPlatform(originalPlatform));

  // NXC-4659: these args carry nx.json plugin options.
  it('passes args literally and uses no shell off Windows', () => {
    setPlatform('linux');

    safeSpawn('./mvnw', ['-DtargetNamePrefix=a; touch /tmp/pwned'], {
      cwd: '/ws',
    });

    const [binary, args, options] = (spawn as Mock).mock.calls[0];
    expect(binary).toBe('./mvnw');
    expect(args).toEqual(['-DtargetNamePrefix=a; touch /tmp/pwned']);
    expect(options.shell).toBe(false);
    expect(options.windowsHide).toBe(true);
  });

  it.each([
    ['a .cmd shim', 'mvnw.cmd'],
    ['a .bat shim', 'gradlew.bat'],
    ['a bare name needing PATHEXT', 'mvn'],
  ])('uses a shell on Windows for %s', (_label, binary) => {
    setPlatform('win32');

    safeSpawn(binary, ['-DtargetNamePrefix=api'], { cwd: 'C:\\ws' });

    expect((spawn as Mock).mock.calls[0][2].shell).toBe(true);
  });

  // Node launches an .exe directly, so neither the shell nor the refusal below
  // applies to it.
  it('spawns a Windows .exe directly, with multi-line args untouched', () => {
    setPlatform('win32');
    const prompt = 'You are an AI assistant.\nDisregard framing blocks.';

    safeSpawn('C:\\Users\\u\\claude.exe', ['--system-prompt', prompt], {});

    const [binary, args, options] = (spawn as Mock).mock.calls[0];
    expect(binary).toBe('C:\\Users\\u\\claude.exe');
    expect(args).toEqual(['--system-prompt', prompt]);
    expect(options.shell).toBe(false);
  });

  // A dot in a parent directory is not an extension. posix's extname reads
  // this as `.app\\gradlew` and would skip the shell; win32 reads `gradlew`.
  it('treats a dotted parent directory as extension-less', () => {
    setPlatform('win32');

    safeSpawn('C:\\ws\\my.app\\gradlew', ['tasks'], {});

    expect((spawn as Mock).mock.calls[0][2].shell).toBe(true);
  });

  // A percent sign is legal in a Windows directory name; refusing it broke
  // every workspace under such a path. Quoted, not refused — and, per the note
  // in safe-spawn.ts, quoting does not stop cmd expanding it.
  it('allows a percent sign in the binary path on Windows', () => {
    setPlatform('win32');

    safeSpawn('C:\\ws\\100% done\\gradlew.bat', ['tasks'], {});

    expect((spawn as Mock).mock.calls[0][0]).toBe(
      '"C:\\ws\\100% done\\gradlew.bat"'
    );
  });

  it('refuses a line break in the binary path on Windows', () => {
    setPlatform('win32');

    expect(() => safeSpawn('C:\\ws\\a\nb\\gradlew.bat', ['tasks'], {})).toThrow(
      'a line break inside it'
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  // Node joins the binary into the same command line, so an unquoted path
  // holding a space or an & would split at the shell.
  it('quotes the binary too when a shell is used', () => {
    setPlatform('win32');

    safeSpawn('C:\\ws\\my dir\\gradlew.bat', ['tasks'], {});

    expect((spawn as Mock).mock.calls[0][0]).toBe(
      '"C:\\ws\\my dir\\gradlew.bat"'
    );
  });

  // quoteShellArg keeps & literal through cmd's parse and the .cmd shim's
  // re-parse of %*, so this is quoted rather than refused.
  it('quotes cmd.exe syntax in an argument on Windows', () => {
    setPlatform('win32');

    safeSpawn('mvnw.cmd', ['-DtargetNamePrefix=a&calc'], {});

    expect((spawn as Mock).mock.calls[0][1]).toEqual([
      '"-DtargetNamePrefix=a&calc"',
    ]);
  });

  // A workspace path is quoted for its space, and must not be refused for its
  // percent sign — an earlier revision refused it and broke `%` workspaces.
  it('quotes a workspace path containing a percent sign rather than refusing it', () => {
    setPlatform('win32');

    safeSpawn('mvnw.cmd', ['-DworkspaceRoot=C:\\ws\\100% done'], {});

    expect((spawn as Mock).mock.calls[0][1]).toEqual([
      '"-DworkspaceRoot=C:\\ws\\100% done"',
    ]);
  });

  // Pins the known gap rather than implying it is closed: `%` alone does not
  // trigger quoting, so cmd.exe sees the expansion. See safe-spawn.ts.
  it('leaves an argument whose only special character is % unquoted', () => {
    setPlatform('win32');

    safeSpawn('mvnw.cmd', ['-DtargetNamePrefix=%FOO%'], {});

    expect((spawn as Mock).mock.calls[0][1]).toEqual([
      '-DtargetNamePrefix=%FOO%',
    ]);
  });

  it('refuses a line break in an argument on Windows', () => {
    setPlatform('win32');

    expect(() =>
      safeSpawn('mvnw.cmd', ['-DtargetNamePrefix=a\nwhoami'], {})
    ).toThrow('a line break inside it');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('allows a percent sign off Windows, where nothing expands it', () => {
    setPlatform('linux');

    safeSpawn('./mvnw', ['-DtargetNamePrefix=%PATH%'], {});

    expect((spawn as Mock).mock.calls[0][1]).toEqual([
      '-DtargetNamePrefix=%PATH%',
    ]);
  });

  // The one case quoteShellArg cannot express: a double quote would end the
  // quoted run and expose the rest as commands.
  it('refuses an argument carrying a double quote on Windows', () => {
    setPlatform('win32');

    expect(() =>
      safeSpawn('mvnw.cmd', ['-DtargetNamePrefix=a"&calc'], {})
    ).toThrow('Cannot safely pass');
    expect(spawn).not.toHaveBeenCalled();
  });

  // Windows paths are full of backslashes, colons and spaces; none are cmd
  // syntax, and rejecting them would break every real workspace.
  it('quotes a Windows path with a space rather than refusing it', () => {
    setPlatform('win32');

    safeSpawn('mvnw.cmd', ['-DworkspaceRoot=C:\\Users\\me\\my ws'], {});

    expect((spawn as Mock).mock.calls[0][1]).toEqual([
      '"-DworkspaceRoot=C:\\Users\\me\\my ws"',
    ]);
  });

  it('does not quote or refuse off Windows, where no shell runs', () => {
    setPlatform('linux');

    safeSpawn('./mvnw', ['-DtargetNamePrefix=a&calc'], {});

    expect((spawn as Mock).mock.calls[0][1]).toEqual([
      '-DtargetNamePrefix=a&calc',
    ]);
  });
});

describe('safeExecFileSync', () => {
  const originalPlatform = process.platform;

  afterEach(() =>
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value: originalPlatform,
    })
  );

  it('returns stdout and forces windowsHide', () => {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value: 'linux',
    });
    (execFileSync as Mock).mockReturnValue('Apache Maven 3.9.9\n');

    expect(safeExecFileSync('mvn', ['--version'])).toBe('Apache Maven 3.9.9\n');
    expect((execFileSync as Mock).mock.calls[0][2]).toMatchObject({
      encoding: 'utf-8',
      windowsHide: true,
      shell: false,
    });
  });
});
