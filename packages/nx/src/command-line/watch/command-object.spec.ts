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
