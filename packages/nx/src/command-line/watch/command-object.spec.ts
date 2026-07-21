import yargs = require('yargs');
import { yargsWatchCommand } from './command-object';

describe('watch command setup', () => {
  it('should parse --includeDependencies and its aliases', () => {
    for (const flag of [
      '--includeDependencies',
      '--include-dependencies',
      '-d',
    ]) {
      const { error, parsedArgs } = parse([
        'watch',
        '-p',
        'app',
        flag,
        '--',
        'x',
      ]);
      expect(error).toBeUndefined();
      expect(parsedArgs.includeDependencies).toBe(true);
    }
  });

  it('should pass flags after -- through as the command', () => {
    const { error, parsedArgs } = parse([
      'watch',
      '--all',
      '--',
      'echo',
      '--unknown-flag',
    ]);
    expect(error).toBeUndefined();
    expect(parsedArgs.command).toBe('echo --unknown-flag');
  });

  it.each(['--includeDependentProjects', '--include-dependent-projects'])(
    'should reject the removed %s flag',
    (flag) => {
      const { error, parsedArgs } = parse([
        'watch',
        '-p',
        'app',
        flag,
        '--',
        'x',
      ]);
      expect(error?.message).toContain('Unknown argument');
      expect(parsedArgs).toBeUndefined();
    }
  );
});

describe('watch command-object argument parsing', () => {
  // Run the real command builder (parserConfiguration, checks, and the
  // `--`->command middleware) but capture the parsed argv instead of importing
  // and running watch.js, so we exercise the actual parse pipeline.
  function parseArgv(args: string[]): Record<string, any> {
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
    const parsed = parseArgv([
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
    const parsed = parseArgv([
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
    const parsed = parseArgv([
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
    const parsed = parseArgv([
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
    const parsed = parseArgv([
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

function parse(args: string[]) {
  let parsedArgs: any;
  let error: Error | undefined;
  yargs(args)
    .command({
      ...yargsWatchCommand,
      handler: (args) => {
        parsedArgs = args;
      },
    })
    .parse(args, {}, (err) => {
      error = err ?? undefined;
    });
  return { error, parsedArgs };
}
