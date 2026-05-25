import yargs = require('yargs');
import { withOverrides } from '../yargs-utils/shared-options';
import { yargsNxInfixCommand, yargsRunCommand } from './command-object';

describe('run-one command setup', () => {
  it('should parse simple infix and `run` notation equivalently', () => {
    const infixOptions = getParsedInfixArgs(['serve', 'myapp']);
    const runOptions = getParsedRunArgs(['run', 'myapp:serve']);

    compareArgs(infixOptions, runOptions);
  });

  describe('flag-based invocation', () => {
    it.each([
      ['short form: -p / -t', ['run', '-p', 'myapp', '-t', 'test:unit']],
      [
        'long form: --project / --target',
        ['run', '--project', 'myapp', '--target', 'test:unit'],
      ],
      [
        'equals form: --project= / --target=',
        ['run', '--project=myapp', '--target=test:unit'],
      ],
    ])('parses %s when target contains a colon', (_label, argv) => {
      const parsed = getParsedRunArgs(argv);
      expect(parsed.project).toEqual('myapp');
      expect(parsed.target).toEqual('test:unit');
    });
  });

  it.each(['--array=1,2,3', '--array=1 2 3', '--array=1 --array=2 --array=3'])(
    'should read arrays (%s)',
    (args) => {
      const infixArgs = getParsedInfixArgs([
        'serve',
        'myapp',
        ...args.split(' '),
      ]);
      const runArgs = getParsedRunArgs([
        'run',
        'myapp:serve',
        ...args.split(' '),
      ]);

      compareArgs(infixArgs, runArgs);
    }
  );

  describe('infix notation', () => {
    it('should handle flags passed after project', () => {
      const parsed = getParsedInfixArgs([
        'serve',
        'myapp',
        '--prod',
        '--configuration=production',
      ]);

      expect(parsed.target).toEqual('serve');
      expect(parsed.project).toEqual('myapp');
      expect(parsed.configuration).toEqual('production');
      expect(parsed.prod).toEqual(true);
    });

    it('should handle flags passed before project', () => {
      const parsed = getParsedInfixArgs([
        'serve',
        '--prod',
        '--configuration=production',
        'myapp',
      ]);

      expect(parsed.target).toEqual('serve');
      expect(parsed.project).toEqual('myapp');
      expect(parsed.configuration).toEqual('production');
      expect(parsed.prod).toEqual(true);
    });

    it('should parse with missing project', () => {
      const parsed = getParsedArgs(['serve', '--prod'], yargsNxInfixCommand);

      expect(parsed.target).toEqual('serve');
      expect(parsed.project).toEqual(undefined);
      expect(parsed.configuration).toEqual(undefined);
      expect(parsed.prod).toEqual(true);
    });
  });
});

function compareArgs(a: any, b: any) {
  delete a['_'];
  delete b['_'];
  // `project`/`target` have `p`/`t` yargs aliases; strip the alias keys
  // before comparing so the two invocation forms match structurally.
  delete a['p'];
  delete b['p'];
  delete a['t'];
  delete b['t'];
  if (a['target'] && a['project']) {
    a['project:target:configuration'] = `${a['project']}:${a['target']}`;
    delete a['project'];
    delete a['target'];
  }
  if (b['target'] && b['project']) {
    b['project:target:configuration'] = `${b['project']}:${b['target']}`;
    delete b['project'];
    delete b['target'];
  }
  expect(a).toEqual(b);
}

function getParsedInfixArgs(args: string[]) {
  return getParsedArgs(args, yargsNxInfixCommand, 0);
}

function getParsedRunArgs(args: string[]) {
  return getParsedArgs(args, yargsRunCommand);
}

function getParsedArgs(
  args: string[],
  command: yargs.CommandModule,
  withOverridesLevel = 1
) {
  let parsedArgs: any;
  yargs(args)
    .command({
      ...command,
      handler: (args) => {
        parsedArgs = withOverrides({ ...args }, withOverridesLevel);
      },
    })
    .parse();
  return parsedArgs;
}
