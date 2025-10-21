import {
  cleanupProject,
  readJson,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';
import { setupRunTests } from './run-setup';

describe('Nx Running Tests - forwarding params', () => {
  let proj: string;
  beforeAll(() => (proj = setupRunTests()));
  afterAll(() => cleanupProject());

  // Ensures that nx.json is restored to its original state after each test
  let existingNxJson;
  beforeEach(() => {
    existingNxJson = readJson('nx.json');
  });
  afterEach(() => {
    updateJson('nx.json', () => existingNxJson);
  });

  describe('(forwarding params)', () => {
    let proj = uniq('proj');
    beforeAll(() => {
      runCLI(`generate @nx/js:lib libs/${proj}`);
      updateJson(`libs/${proj}/project.json`, (c) => {
        c.targets['echo'] = {
          command: 'echo ECHO:',
        };
        return c;
      });
    });

    it('should support running with simple names (i.e. matching on full segments)', () => {
      const foo = uniq('foo');
      const bar = uniq('bar');
      const nested = uniq('nested');
      runCLI(`generate @nx/js:lib libs/${foo}`);
      runCLI(`generate @nx/js:lib libs/${bar}`);
      runCLI(`generate @nx/js:lib libs/nested/${nested}`);
      updateJson(`libs/${foo}/project.json`, (c) => {
        c.name = `@acme/${foo}`;
        c.targets['echo'] = { command: 'echo TEST' };
        return c;
      });
      updateJson(`libs/${bar}/project.json`, (c) => {
        c.name = `@acme/${bar}`;
        c.targets['echo'] = { command: 'echo TEST' };
        return c;
      });
      updateJson(`libs/nested/${nested}/project.json`, (c) => {
        c.name = `@acme/nested/${bar}`; // The last segment is a duplicate
        c.targets['echo'] = { command: 'echo TEST' };
        return c;
      });

      // Full segments should match
      expect(() => runCLI(`echo ${foo}`)).not.toThrow();

      // Multiple matches should fail
      expect(() => runCLI(`echo ${bar}`)).toThrow();

      // Partial segments should not match (Note: project foo has numbers in the end that aren't matched fully)
      expect(() => runCLI(`echo foo`)).toThrow();
    });

    it.each([
      '--watch false',
      '--watch=false',
      '--arr=a,b,c',
      '--arr=a --arr=b --arr=c',
      'a',
      '--a.b=1',
      '--a.b 1',
      '-- a b c --a --a.b=1',
      '--ignored -- a b c --a --a.b=1',
    ])('should forward %s properly', (args) => {
      const output = runCLI(`echo ${proj} ${args}`);
      expect(output).toContain(`ECHO: ${args.replace(/^.*-- /, '')}`);
    });

    it.each([
      {
        args: '--test="hello world" "abc def"',
        result: '--test="hello world" "abc def"',
      },
      {
        args: `--test="hello world" 'abc def'`,
        result: '--test="hello world" "abc def"',
      },
      {
        args: `--test="hello world" 'abcdef'`,
        result: '--test="hello world" abcdef',
      },
      {
        args: `--test='hello world' 'abcdef'`,
        result: '--test="hello world" abcdef',
      },
      {
        args: `"--test='hello world' 'abcdef'"`,
        result: `--test='hello world' 'abcdef'`,
      },
    ])('should forward %args properly with quotes', ({ args, result }) => {
      const output = runCLI(`echo ${proj} ${args}`);
      expect(output).toContain(`ECHO: ${result}`);
    });

    it.each([
      {
        args: '-- a b c --a --a.b=1 --no-color --no-parallel',
        result: 'ECHO: a b c --a --a.b=1',
      },
      {
        args: '-- a b c --a --a.b=1 --color --parallel',
        result: 'ECHO: a b c --a --a.b=1',
      },
    ])(
      'should not forward --color --parallel for $args',
      ({ args, result }) => {
        const output = runCLI(`echo ${proj} ${args}`);
        expect(output).toContain(result);
      }
    );
  });
});
