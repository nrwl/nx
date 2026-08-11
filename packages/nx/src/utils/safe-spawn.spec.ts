import { execFileSync, spawn } from 'child_process';
import { safeExecFileSync, safeSpawn } from './safe-spawn';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execFileSync: jest.fn(),
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
    (spawn as jest.Mock).mockReset();
    (execFileSync as jest.Mock).mockReset();
  });

  afterEach(() => setPlatform(originalPlatform));

  // NXC-4659: these args carry nx.json plugin options.
  it('passes args literally and uses no shell off Windows', () => {
    setPlatform('linux');

    safeSpawn('./mvnw', ['-DtargetNamePrefix=a; touch /tmp/pwned'], {
      cwd: '/ws',
    });

    const [binary, args, options] = (spawn as jest.Mock).mock.calls[0];
    expect(binary).toBe('./mvnw');
    expect(args).toEqual(['-DtargetNamePrefix=a; touch /tmp/pwned']);
    expect(options.shell).toBe(false);
    expect(options.windowsHide).toBe(true);
  });

  it('uses a shell on Windows, where .cmd wrappers need one', () => {
    setPlatform('win32');

    safeSpawn('mvnw.cmd', ['-DtargetNamePrefix=api'], { cwd: 'C:\\ws' });

    expect((spawn as jest.Mock).mock.calls[0][2].shell).toBe(true);
  });

  // quoteShellArg keeps & literal through cmd's parse and the .cmd shim's
  // re-parse of %*, so this is quoted rather than refused.
  it('quotes cmd.exe syntax in an argument on Windows', () => {
    setPlatform('win32');

    safeSpawn('mvnw.cmd', ['-DtargetNamePrefix=a&calc'], {});

    expect((spawn as jest.Mock).mock.calls[0][1]).toEqual([
      '"-DtargetNamePrefix=a&calc"',
    ]);
  });

  // quoteShellArg lets `%` and line breaks through by design, which is fine for
  // argv the user typed; these come from nx.json in a cloned repo.
  it.each([
    ['a percent sign', '-DtargetNamePrefix=%PATH%'],
    ['a line break', '-DtargetNamePrefix=a\nwhoami'],
  ])('refuses %s on Windows', (_label, arg) => {
    setPlatform('win32');

    expect(() => safeSpawn('mvnw.cmd', [arg], {})).toThrow(
      'Cannot safely pass'
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it('allows a percent sign off Windows, where nothing expands it', () => {
    setPlatform('linux');

    safeSpawn('./mvnw', ['-DtargetNamePrefix=%PATH%'], {});

    expect((spawn as jest.Mock).mock.calls[0][1]).toEqual([
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

    expect((spawn as jest.Mock).mock.calls[0][1]).toEqual([
      '"-DworkspaceRoot=C:\\Users\\me\\my ws"',
    ]);
  });

  it('does not quote or refuse off Windows, where no shell runs', () => {
    setPlatform('linux');

    safeSpawn('./mvnw', ['-DtargetNamePrefix=a&calc'], {});

    expect((spawn as jest.Mock).mock.calls[0][1]).toEqual([
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
    (execFileSync as jest.Mock).mockReturnValue('Apache Maven 3.9.9\n');

    expect(safeExecFileSync('mvn', ['--version'])).toBe('Apache Maven 3.9.9\n');
    expect((execFileSync as jest.Mock).mock.calls[0][2]).toMatchObject({
      encoding: 'utf-8',
      windowsHide: true,
      shell: false,
    });
  });
});
