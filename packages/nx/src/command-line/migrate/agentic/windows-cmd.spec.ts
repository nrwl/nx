import {
  adaptSpawnForWindowsShim,
  caretEscape,
  neutralizePercent,
  quoteCmdArg,
} from './windows-cmd';

describe('quoteCmdArg', () => {
  it.each<[string, string]>([
    ['plain', '"plain"'],
    ['has space', '"has space"'],
    ['say "hi"', '"say \\"hi\\""'],
    ['back\\"slash', '"back\\\\\\"slash"'],
    ['trailing\\', '"trailing\\\\"'],
    ['', '""'],
  ])('quotes %j as %s', (input, expected) => {
    expect(quoteCmdArg(input)).toBe(expected);
  });
});

describe('caretEscape', () => {
  it('escapes cmd.exe metacharacters and leaves % alone', () => {
    expect(caretEscape('"a b(c)|d%e!"')).toBe('^"a^ b^(c^)^|d%e^!^"');
  });
});

describe('neutralizePercent', () => {
  it('turns each % into a zero-length substring expansion that leaves it literal', () => {
    expect(neutralizePercent('100%')).toBe('100%%cd:~,%');
  });

  it('keeps the comma it introduces uncareted after caretEscape', () => {
    expect(neutralizePercent(caretEscape(quoteCmdArg('50%,')))).toBe(
      '^"50%%cd:~,%^,^"'
    );
  });
});

describe('adaptSpawnForWindowsShim', () => {
  const originalPlatform = process.platform;
  const originalComspec = process.env.comspec;

  function setPlatform(value: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value,
    });
  }

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value: originalPlatform,
    });
    if (originalComspec === undefined) delete process.env.comspec;
    else process.env.comspec = originalComspec;
  });

  it('returns inputs untouched for non-shim binaries on Windows', () => {
    setPlatform('win32');
    const out = adaptSpawnForWindowsShim('C:\\bin\\claude.exe', ['a'], {});
    expect(out.binary).toBe('C:\\bin\\claude.exe');
    expect(out.args).toEqual(['a']);
    expect(out.options.windowsVerbatimArguments).toBeUndefined();
  });

  it.each([
    ['lowercase .cmd', 'C:\\Program Files\\agent\\bin\\claude.cmd'],
    ['.bat', 'C:\\tools\\agent.bat'],
    ['uppercase .CMD', 'C:\\bin\\AGENT.CMD'],
  ])(
    'wraps %s in cmd.exe /e:on /v:off /d /s /c with windowsVerbatimArguments',
    (_label, binary) => {
      setPlatform('win32');
      process.env.comspec = 'C:\\Windows\\System32\\cmd.exe';
      const out = adaptSpawnForWindowsShim(binary, ['--flag', 'value'], {
        stdio: 'inherit',
        windowsHide: true,
      });
      expect(out.binary).toBe('C:\\Windows\\System32\\cmd.exe');
      expect(out.args.slice(0, 5)).toEqual([
        '/e:on',
        '/v:off',
        '/d',
        '/s',
        '/c',
      ]);
      expect(out.args[5]).toMatch(/^".*"$/);
      expect(out.options.windowsVerbatimArguments).toBe(true);
      expect(out.options.stdio).toBe('inherit');
      expect(out.options.windowsHide).toBe(true);
    }
  );

  it('quotes args and caret-escapes cmd metacharacters (cross-spawn style)', () => {
    setPlatform('win32');
    const out = adaptSpawnForWindowsShim(
      'C:\\bin\\claude.cmd',
      ['arg with spaces', 'arg&with&amp', 'plain'],
      {}
    );
    // Args are quoted first, then caret-escaped, so the quotes get escaped
    // too; cmd strips the carets on its first parse, restoring the argument.
    const cmdLine = out.args[5];
    expect(cmdLine).toContain('^"arg^ with^ spaces^"');
    expect(cmdLine).toContain('^"arg^&with^&amp^"');
    expect(cmdLine).toContain('^"plain^"');
  });

  // A caret does not escape `%`; see `neutralizePercent`.
  it('neutralizes % so cmd.exe cannot expand an environment variable', () => {
    setPlatform('win32');
    const out = adaptSpawnForWindowsShim(
      'C:\\bin\\claude.cmd',
      ['%PATH% is 100% set'],
      {}
    );
    const cmdLine = out.args[5];
    expect(cmdLine).toContain('^"%%cd:~,%PATH%%cd:~,%^ is^ 100%%cd:~,%^ set^"');
    expect(cmdLine).not.toContain('^%');
    // The substring syntax only parses uncareted.
    expect(cmdLine).not.toContain('%cd:~^,%');
  });

  it('neutralizes % in the binary path too', () => {
    setPlatform('win32');
    const out = adaptSpawnForWindowsShim('C:\\100%\\claude.cmd', [], {});
    expect(out.args[5]).toContain('100%%cd:~,%');
  });

  // No escaping reproduces a line break through a `.cmd` shim.
  it.each([
    ['a newline', 'line1\nline2'],
    ['a carriage return', 'line1\rline2'],
  ])('refuses an argument containing %s', (_label, arg) => {
    setPlatform('win32');
    expect(() =>
      adaptSpawnForWindowsShim('C:\\bin\\claude.cmd', ['--flag', arg], {})
    ).toThrow('Cannot pass a multi-line argument');
  });

  it('refuses a binary path containing a line break', () => {
    setPlatform('win32');
    expect(() =>
      adaptSpawnForWindowsShim('C:\\bin\\cla\nude.cmd', [], {})
    ).toThrow('Cannot pass a multi-line argument');
  });

  it('passes multi-line arguments through untouched off the shim path', () => {
    setPlatform('win32');
    const out = adaptSpawnForWindowsShim(
      'C:\\bin\\claude.exe',
      ['line1\nline2'],
      {}
    );
    expect(out.args).toEqual(['line1\nline2']);
    expect(out.commandLineLength).toBeUndefined();
  });

  it('reports the command line length cmd.exe will receive', () => {
    setPlatform('win32');
    process.env.comspec = 'C:\\Windows\\System32\\cmd.exe';
    const out = adaptSpawnForWindowsShim('C:\\bin\\claude.cmd', ['a', 'b'], {});
    const expected =
      'C:\\Windows\\System32\\cmd.exe /e:on /v:off /d /s /c ' +
      '"^^^"C:\\bin\\claude.cmd^^^" ^"a^" ^"b^""';
    expect(out.commandLineLength).toBe(expected.length);
    expect([out.binary, ...out.args].join(' ')).toBe(expected);
  });

  it('falls back to "cmd.exe" when comspec is unset', () => {
    setPlatform('win32');
    delete process.env.comspec;
    const out = adaptSpawnForWindowsShim('C:\\x.cmd', [], {});
    expect(out.binary).toBe('cmd.exe');
  });
});
