import { execSync } from 'node:child_process';
import { quoteForShell } from './prettier';

// `writeWithPrettier` / `checkWithPrettier` interpolate patterns into a command
// string that a shell parses, so anything the shell treats specially inside
// double quotes has to survive as a literal path. `printf %s` is used as the
// probe deliberately: it echoes its argument and can execute nothing, so a
// failure here shows up as a wrong string rather than as a side effect.
const posixOnly = process.platform === 'win32' ? describe.skip : describe;

posixOnly('quoteForShell', () => {
  it.each([
    ['an ordinary path', 'libs/my-lib/src/index.ts'],
    ['a dollar sign', 'apps/$(id)'],
    ['a bare variable', 'apps/$HOME'],
    ['a backtick', 'apps/`id`'],
    ['a double quote', 'apps/a"b'],
    ['a backslash', 'apps/a\\b'],
    ['a single quote', "apps/it's"],
    ['a space', 'apps/my app'],
    ['several at once', 'apps/`id`$(id)"\\'],
  ])('passes %s through the shell unchanged', (_name, pattern) => {
    const roundTripped = execSync(`printf %s ${quoteForShell(pattern)}`, {
      encoding: 'utf-8',
    });

    expect(roundTripped).toEqual(pattern);
  });

  it('does not let a backtick reach the shell as command substitution', () => {
    // The pre-hardening version escaped only `$`, so a backtick in a path -
    // legal on POSIX, and reachable through an `angular.json` project root -
    // executed. `id` is inert, but proves the substitution happened.
    const quoted = quoteForShell('apps/`id`');

    expect(quoted).toContain('\\`');
    expect(execSync(`printf %s ${quoted}`, { encoding: 'utf-8' })).toEqual(
      'apps/`id`'
    );
  });
});
