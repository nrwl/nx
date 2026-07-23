import yargs = require('yargs');
import { yargsWatchCommand } from './command-object';

describe('watch command-object argument parsing', () => {
  // Run the real command builder (parserConfiguration, checks, and the
  // `--`->command middleware) but capture the parsed argv instead of importing
  // and running watch.js, so we exercise the actual parse pipeline.
  function parse(args: string[]): Record<string, any> {
    let parsed: any;
    yargs(args)
      .command({
        ...yargsWatchCommand,
        handler: (a) => {
          parsed = a;
        },
      })
      .parse();
    return parsed;
  }

  it('collects space-delimited --include values into an array', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--include',
      'a',
      'b',
      '--',
      'echo',
      'hi',
    ]);
    expect(parsed.include).toEqual(['a', 'b']);
  });

  it('collects repeated --include flags into an array', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--include',
      'a',
      '--include',
      'b',
      '--',
      'echo',
      'hi',
    ]);
    expect(parsed.include).toEqual(['a', 'b']);
  });

  it('collects space-delimited --exclude values into an array', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--exclude',
      'a',
      'b',
      '--',
      'echo',
      'hi',
    ]);
    expect(parsed.exclude).toEqual(['a', 'b']);
  });

  it('keeps a brace glob intact without splitting on the comma', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--include',
      '**/*.{ts,tsx}',
      '--',
      'echo',
      'hi',
    ]);
    expect(parsed.include).toEqual(['**/*.{ts,tsx}']);
  });

  it('does not swallow the trailing -- command into the include array', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--include',
      '**/*.ts',
      '--',
      'nx',
      'build',
    ]);
    // The trailing command lands in `command` (via the `--` middleware), not in
    // the include array — proving the array flag stops at `--`.
    expect(parsed.include).toEqual(['**/*.ts']);
    expect(parsed.command).toBe('nx build');
  });
});
