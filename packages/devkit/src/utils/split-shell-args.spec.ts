import { splitShellArgs } from './split-shell-args';

describe('splitShellArgs', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');

  beforeEach(() => {
    vi.stubEnv('PORT', '4300');
    vi.stubEnv('ARGS', ' --port  4301 ');
    vi.stubEnv('EMPTY', '');
    vi.stubEnv('QUOTED', '"a b"');
    delete process.env.MISSING;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', platform);
    vi.unstubAllEnvs();
  });

  describe('on POSIX', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
    });

    it.each([
      ['--port 4200 --host=localhost', ['--port', '4200', '--host=localhost']],
      ['  --a   --b  ', ['--a', '--b']],
      ["--config 'my config.mjs'", ['--config', 'my config.mjs']],
      ['\'a\\b $HOME "x"\'', ['a\\b $HOME "x"']],
      ['--config "vite.config.mjs"', ['--config', 'vite.config.mjs']],
      ['"a \\" \\\\ \\$ \\` \\n"', ['a " \\ $ ` \\n']],
      ['a\\ b \\"c', ['a b', '"c']],
      ['--config="a b.mjs"', ['--config=a b.mjs']],
      ['x"y"\'z\'', ['xyz']],
      ['"" \'\'', ['', '']],
      ['a\\\nb "c\\\nd"', ['ab', 'cd']],
      ['a\u00a0b', ['a\u00a0b']],
      ['', []],
      ['   ', []],
      ['--port $PORT', ['--port', '4300']],
      ['--port=${PORT}', ['--port=4300']],
      ['"$PORT" \'$PORT\'', ['4300', '$PORT']],
      ['--a $MISSING --b "$MISSING"', ['--a', '--b', '']],
      [
        '${MISSING:-4200} ${EMPTY:-1} ${EMPTY-2} ${MISSING-${PORT}}',
        ['4200', '1', '4300'],
      ],
      ['x$ARGS', ['x', '--port', '4301']],
      ['${MISSING:-"my config.mjs"}', ['my config.mjs']],
      ["${MISSING:-'my config.mjs'}", ['my config.mjs']],
      ['"${MISSING:-"my config.mjs"}"', ['my config.mjs']],
      ['${MISSING:-my\\ config.mjs}', ['my config.mjs']],
      ['${MISSING:-${MISSING:-"my config.mjs"}}', ['my config.mjs']],
      ['a${MISSING:-""}b', ['ab']],
      ['${MISSING:-""}', ['']],
      ['${MISSING:-"$PORT"}', ['4300']],
      ['${MISSING:-$QUOTED}', ['"a', 'b"']],
      ['${MISSING:-"$QUOTED"}', ['"a b"']],

      ['$(echo 1) $1 ${a b}', ['$(echo', '1)', '$1', '${a', 'b}']],
    ])('splits %j', (input, expected) => {
      expect(splitShellArgs(input)).toEqual(expected);
    });
  });

  describe('on Windows', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
    });

    it.each([
      ['--port 4200 --host=localhost', ['--port', '4200', '--host=localhost']],
      [
        '--config C:\\apps\\web\\rspack.config.js',
        ['--config', 'C:\\apps\\web\\rspack.config.js'],
      ],
      ['--config "C:\\my apps\\a.js"', ['--config', 'C:\\my apps\\a.js']],
      ["--config 'a.js'", ['--config', "'a.js'"]],
      ['--config="a b.mjs"', ['--config=a b.mjs']],
      ['a\\"b "c\\\\" d', ['a"b', 'c\\', 'd']],
      ['"a ""b"" c"', ['a "b" c']],
      ['"" x', ['', 'x']],
      ['a\u00a0b', ['a\u00a0b']],
      ['', []],
      ['--port %PORT% %MISSING%', ['--port', '4300', '%MISSING%']],
      ['a^&b "c^d"', ['a&b', 'c^d']],
    ])('splits %j', (input, expected) => {
      expect(splitShellArgs(input)).toEqual(expected);
    });
  });
});
