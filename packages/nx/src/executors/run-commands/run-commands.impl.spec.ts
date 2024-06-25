import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { relative } from 'path';
import { dirSync, fileSync } from 'tmp';
import runCommands, {
  interpolateArgsIntoCommand,
  LARGE_BUFFER,
} from './run-commands.impl';
import { env } from 'npm-run-path';

function normalize(p: string) {
  return p.startsWith('/private') ? p.substring(8) : p;
}

function readFile(f: string) {
  return readFileSync(f).toString().replace(/\s/g, '');
}

describe('Run Commands', () => {
  const context = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should interpolate provided --args', async () => {
    const f = fileSync().name;
    const result = await runCommands(
      {
        command: `echo {args.key} >> ${f}`,
        args: '--key=123',
        __unparsed__: [],
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('123');
  });

  it.each([
    {
      unparsed: ['test1', '--args=--key=123', '--test2=1', '--test2=2'],
      expected: 'test1 --test2=1 --test2=2',
    },
    {
      unparsed: ['test', '--args=--key=123', '--test.a=1', '--test.b=2'],
      expected: 'test --test.a=1 --test.b=2',
    },
    { unparsed: ['one', '-a=b', `--args=--key=123`], expected: 'one -a=b' },
  ])(
    'should pass command line args $unparsed to the command and ignore --args',
    async ({ unparsed: unparsedOptions, expected }) => {
      let result = (
        await runCommands(
          {
            command: `echo`,
            __unparsed__: unparsedOptions,
            args: '--key=123',
          },
          context
        )
      ).terminalOutput.trim();
      expect(result).not.toContain('--args=--key=123');
      expect(result).toContain(`echo --key=123 ${expected}`);
    }
  );

  it('should overwrite matching options with args', async () => {
    let result = (
      await runCommands(
        {
          command: `echo`,
          __unparsed__: [],
          key: 789,
        },
        context
      )
    ).terminalOutput.trim();
    expect(result).toContain('echo --key=789'); // unknown options

    result = (
      await runCommands(
        {
          command: `echo`,
          __unparsed__: ['--a.b=234'],
          a: { b: 123 },
        },
        context
      )
    ).terminalOutput.trim();
    expect(result).toContain('echo --a.b=234');

    result = (
      await runCommands(
        {
          command: `echo`,
          __unparsed__: ['--key=456'],
          key: 123,
        },
        context
      )
    ).terminalOutput.trim();
    expect(result).not.toContain('--key=123');
    expect(result).toContain('echo --key=456'); // should take unparsed over unknown options

    result = (
      await runCommands(
        {
          command: `echo`,
          __unparsed__: ['--key=456'],
          key: 123,
          args: '--key=789',
        },
        context
      )
    ).terminalOutput.trim();
    expect(result).not.toContain('--key=123');
    expect(result).toContain('--key=789'); // should take args over unknown options

    result = (
      await runCommands(
        {
          command: 'echo',
          __unparsed__: [],
          key1: 'from options',
          key2: 'from options',
          args: '--key1="from args"',
        },
        context
      )
    ).terminalOutput.trim();
    expect(result).not.toContain('--key1="from options"');
    expect(result).toContain('echo --key2="from options" --key1="from args"'); // take args over options with the same name while keeping the rest
  });

  it('should not foward any args to underlying command if forwardAllArgs is false', async () => {
    let result = await runCommands(
      {
        command: `echo`,
        key: 123,
        __unparsed__: [],
        forwardAllArgs: false,
      },
      context
    );
    expect(result.terminalOutput.trim()).not.toContain('--key=123');

    result = await runCommands(
      {
        command: `echo`,
        key: 123,
        __unparsed__: [],
        forwardAllArgs: true,
      },
      context
    );
    expect(result.terminalOutput.trim()).toContain('--key=123');

    result = await runCommands(
      {
        commands: [
          {
            command: `echo 1`,
            forwardAllArgs: true,
          },
          {
            command: `echo 2`,
          },
        ],
        __unparsed__: ['--args=--key=123'],
        args: '--key=123',
        forwardAllArgs: false,
      },
      context
    );
    expect(result.terminalOutput).toContain('1 --key=123');
    expect(result.terminalOutput).not.toContain('2 --key=123');
  });

  it('should interpolate all unknown args as if they were --args', async () => {
    const f = fileSync().name;
    const result = await runCommands(
      {
        command: `echo {args.key} >> ${f}`,
        key: 123,
        __unparsed__: [],
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('123');
  });

  it.each([
    [`--key=123`, `args.key`, `123`],
    [`--key="123.10"`, `args.key`, `123.10`],
    [`--nested.key="123.10"`, `args.nested.key`, `123.10`],
  ])(
    'should interpolate %s into %s as %s',
    async (cmdLineArg, argKey, expected) => {
      const f = fileSync().name;
      const result = await runCommands(
        {
          command: `echo {${argKey}} >> ${f}`,
          __unparsed__: [cmdLineArg],
        },
        context
      );
      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(readFile(f)).toEqual(expected);
    }
  );

  it('should run commands serially', async () => {
    const f = fileSync().name;
    let result = await runCommands(
      {
        commands: [`sleep 0.2 && echo 1 >> ${f}`, `echo 2 >> ${f}`],
        parallel: false,
        __unparsed__: [],
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('12');

    result = await runCommands(
      {
        commands: [`sleep 0.2 && echo 1 >> ${f}`, `echo 2 >> ${f}`],
        __unparsed__: ['--no-parallel'],
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('1212');
  });

  it('should run commands in parallel', async () => {
    const f = fileSync().name;
    const result = await runCommands(
      {
        commands: [
          {
            command: `echo 1 >> ${f}`,
          },
          {
            command: `echo 2 >> ${f}`,
          },
        ],
        parallel: true,
        __unparsed__: [],
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    const contents = readFile(f);
    expect(contents).toContain('1');
    expect(contents).toContain('2');
  });

  describe('readyWhen', () => {
    describe('single string', () => {
      it('should error when parallel = false', async () => {
        try {
          await runCommands(
            {
              commands: [{ command: 'echo foo' }, { command: 'echo bar' }],
              parallel: false,
              readyWhen: 'READY',
              __unparsed__: [],
            },
            context
          );
          fail('should throw');
        } catch (e) {
          expect(e.message).toEqual(
            `ERROR: Bad executor config for run-commands - "readyWhen" can only be used when "parallel=true".`
          );
        }
      });

      it('should return success true when the string specified as ready condition is found', async () => {
        const f = fileSync().name;
        const result = await runCommands(
          {
            commands: [`echo READY && sleep 0.1 && echo 1 >> ${f}`, `echo foo`],
            parallel: true,
            readyWhen: 'READY',
            __unparsed__: [],
          },

          context
        );
        expect(result).toEqual(expect.objectContaining({ success: true }));
        expect(readFile(f)).toEqual('');

        setTimeout(() => {
          expect(readFile(f)).toEqual('1');
        }, 150);
      });
    });

    describe('array of strings', () => {
      it('should return success true when all strings specified as ready condition were found', async () => {
        const f = fileSync().name;
        const result = await runCommands(
          {
            commands: [`echo READY && sleep 0.1 && echo 1 >> ${f}`, `echo foo`],
            parallel: true,
            readyWhen: ['READY', 'foo'],
            __unparsed__: [],
          },

          context
        );
        expect(result).toEqual(expect.objectContaining({ success: true }));
        expect(readFile(f)).toEqual('');

        setTimeout(() => {
          expect(readFile(f)).toEqual('1');
        }, 150);
      });

      it('should keep waiting when not all strings specified as ready condition were found', (done) => {
        const f = fileSync().name;
        let result: { success: boolean } | null = null;

        runCommands(
          {
            commands: [`echo 1 >> ${f} && echo READY`, `echo foo`],
            parallel: true,
            readyWhen: ['READY', 'bar'],
            __unparsed__: [],
          },

          context
        ).then((res) => {
          result = res;
        });

        expect(readFile(f)).toEqual('');

        setTimeout(() => {
          expect(readFile(f)).toEqual('1');
          expect(result).toBeNull();
          done();
        }, 150);
      });
    });
  });

  it('should stop execution and fail when a command fails', async () => {
    const f = fileSync().name;

    try {
      await runCommands(
        {
          commands: [`echo 1 >> ${f} && exit 1`, `echo 2 >> ${f}`],
          parallel: false,
          __unparsed__: [],
        },
        context
      );
      fail('should fail when a command fails');
    } catch (e) {}
    expect(readFile(f)).toEqual('1');
  });

  describe('interpolateArgsIntoCommand', () => {
    it('should add all unparsed args when forwardAllArgs is true', () => {
      expect(
        interpolateArgsIntoCommand(
          'echo',
          { __unparsed__: ['one', '-a=b'] } as any,
          true
        )
      ).toEqual('echo one -a=b');
    });

    it('should not forward all unparsed args when the options is a prop to run command', () => {
      expect(
        interpolateArgsIntoCommand(
          'echo',
          {
            __unparsed__: ['--args', 'test', 'hello'],
            parsedArgs: { args: 'test' },
          } as any,
          true
        )
      ).toEqual('echo hello'); // should not pass --args test to underlying command

      expect(
        interpolateArgsIntoCommand(
          'echo',
          {
            __unparsed__: ['--args=test', 'hello'],
          } as any,
          true
        )
      ).toEqual('echo hello');

      expect(
        interpolateArgsIntoCommand(
          'echo',
          { __unparsed__: ['--parallel=true', 'hello'] } as any,
          true
        )
      ).toEqual('echo hello');
    });

    it('should add all args when forwardAllArgs is true', () => {
      expect(
        interpolateArgsIntoCommand(
          'echo',
          { args: '--additional-arg', __unparsed__: [] } as any,
          true
        )
      ).toEqual('echo --additional-arg');
    });

    it('should add forward unknown options when forwardAllArgs is true', () => {
      expect(
        interpolateArgsIntoCommand(
          'echo',
          { unknownOptions: { hello: 123 }, parsedArgs: { hello: 123 } } as any,
          true
        )
      ).toEqual('echo --hello=123');
    });

    it('should add all args and unparsed args when forwardAllArgs is true', () => {
      expect(
        interpolateArgsIntoCommand(
          'echo',
          {
            args: '--additional-arg',
            __unparsed__: ['--additional-unparsed-arg'],
          } as any,
          true
        )
      ).toEqual('echo --additional-arg --additional-unparsed-arg');
    });

    it("shouldn't add literal `undefined` if arg is not provided", () => {
      expect(
        interpolateArgsIntoCommand(
          'echo {args.someValue}',
          {
            parsedArgs: {},
            __unparsed__: [],
          },
          false
        )
      ).not.toContain('undefined');
    });

    it('should interpolate provided values', () => {
      expect(
        interpolateArgsIntoCommand(
          'echo {args.someValue}',
          {
            parsedArgs: {
              someValue: '"hello world"',
            },
            __unparsed__: [],
          },
          false
        )
      ).toEqual('echo "hello world"');
    });

    it('should interpolate provided values with spaces', () => {
      expect(
        interpolateArgsIntoCommand(
          'echo',
          {
            unknownOptions: { hello: 'test 123' },
            parsedArgs: { hello: 'test 123' },
          } as any,
          true
        )
      ).toEqual('echo --hello="test 123"'); // should wrap in quotes

      expect(
        interpolateArgsIntoCommand(
          'echo',
          {
            unknownOptions: { hello: '"test 123"' },
            parsedArgs: { hello: '"test 123"' },
          } as any,
          true
        )
      ).toEqual('echo --hello="test 123"'); // should leave double quotes

      expect(
        interpolateArgsIntoCommand(
          'echo',
          {
            unknownOptions: { hello: "'test 123'" },
            parsedArgs: { hello: "'test 123'" },
          } as any,
          true
        )
      ).toEqual("echo --hello='test 123'"); // should leave single quote

      expect(
        interpolateArgsIntoCommand(
          'echo',
          {
            __unparsed__: [
              '--hello=test 123',
              'hello world',
              '"random config"',
              '456',
            ],
          } as any,
          true
        )
      ).toEqual(`echo --hello="test 123" "hello world" "random config" 456`); // should wrap aroound __unparsed__ args with key value
    });
  });

  describe('--color', () => {
    it('should not set FORCE_COLOR=true', async () => {
      const exec = jest.spyOn(require('child_process'), 'exec');
      await runCommands(
        {
          commands: [`echo 'Hello World'`, `echo 'Hello Universe'`],
          parallel: true,
          __unparsed__: [],
        },
        context
      );

      expect(exec).toHaveBeenCalledTimes(2);
      expect(exec).toHaveBeenNthCalledWith(1, `echo 'Hello World'`, {
        maxBuffer: LARGE_BUFFER,
        env: {
          ...process.env,
          ...env(),
        },
      });
      expect(exec).toHaveBeenNthCalledWith(2, `echo 'Hello Universe'`, {
        maxBuffer: LARGE_BUFFER,
        env: {
          ...process.env,
          ...env(),
        },
      });
    });

    it('should not set FORCE_COLOR=true when --no-color is passed', async () => {
      const exec = jest.spyOn(require('child_process'), 'exec');
      await runCommands(
        {
          commands: [`echo 'Hello World'`, `echo 'Hello Universe'`],
          parallel: true,
          __unparsed__: [],
          color: false,
        },
        context
      );

      expect(exec).toHaveBeenCalledTimes(2);
      expect(exec).toHaveBeenNthCalledWith(1, `echo 'Hello World'`, {
        maxBuffer: LARGE_BUFFER,
        env: {
          ...process.env,
          ...env(),
        },
      });
      expect(exec).toHaveBeenNthCalledWith(2, `echo 'Hello Universe'`, {
        maxBuffer: LARGE_BUFFER,
        env: {
          ...process.env,
          ...env(),
        },
      });
    });

    it('should set FORCE_COLOR=true when running with --color', async () => {
      const exec = jest.spyOn(require('child_process'), 'exec');
      await runCommands(
        {
          commands: [`echo 'Hello World'`, `echo 'Hello Universe'`],
          parallel: true,
          color: true,
          __unparsed__: [],
        },
        context
      );

      expect(exec).toHaveBeenCalledTimes(2);
      expect(exec).toHaveBeenNthCalledWith(1, `echo 'Hello World'`, {
        maxBuffer: LARGE_BUFFER,
        env: { ...process.env, FORCE_COLOR: `true`, ...env() },
      });
      expect(exec).toHaveBeenNthCalledWith(2, `echo 'Hello Universe'`, {
        maxBuffer: LARGE_BUFFER,
        env: { ...process.env, FORCE_COLOR: `true`, ...env() },
      });
    });
  });

  describe('cwd', () => {
    it('should use workspace root package when cwd is not specified', async () => {
      const root = dirSync().name;
      const f = fileSync().name;

      const result = await runCommands(
        {
          commands: [
            {
              command: `nx --version >> ${f}`,
            },
          ],
          parallel: true,
          cwd: process.cwd(),
          __unparsed__: [],
        },
        { root } as any
      );
      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).not.toBe('12.0.0');
    });

    it('should run the task in the workspace root when no cwd is specified', async () => {
      const root = dirSync().name;
      const f = fileSync().name;

      const result = await runCommands(
        {
          commands: [
            {
              command: `pwd >> ${f}`,
            },
          ],
          parallel: true,
          __unparsed__: [],
        },

        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).toBe(root);
    });

    it('should run the task in the specified cwd relative to the workspace root when cwd is not an absolute path', async () => {
      const root = dirSync().name;
      const childFolder = dirSync({ dir: root }).name;
      const cwd = relative(root, childFolder);
      const f = fileSync().name;

      const result = await runCommands(
        {
          commands: [
            {
              command: `pwd >> ${f}`,
            },
          ],
          cwd,
          parallel: true,
          __unparsed__: [],
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).toBe(childFolder);
    });

    it('should terminate properly with an error if the cwd is not valid', async () => {
      const root = dirSync().name;
      const cwd = 'bla';

      const result = await runCommands(
        {
          commands: [
            {
              command: `echo "command does not run"`,
            },
          ],
          cwd,
          parallel: true,
          __unparsed__: [],
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: false }));
    }, 1000);

    it('should run the task in the specified absolute cwd', async () => {
      const root = dirSync().name;
      const childFolder = dirSync({ dir: root }).name;
      const f = fileSync().name;

      const result = await runCommands(
        {
          commands: [
            {
              command: `pwd >> ${f}`,
            },
          ],
          cwd: childFolder,
          parallel: true,
          __unparsed__: [],
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).toBe(childFolder);
    });

    it('should add node_modules/.bins to the env for the cwd', async () => {
      const root = dirSync().name;
      const childFolder = dirSync({ dir: root }).name;
      const f = fileSync().name;

      const result = await runCommands(
        {
          commands: [
            {
              command: `echo $PATH >> ${f}`,
            },
          ],
          cwd: childFolder,
          parallel: true,
          __unparsed__: [],
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).toContain(
        `${childFolder}/node_modules/.bin`
      );
      expect(normalize(readFile(f))).toContain(`${root}/node_modules/.bin`);
    });
  });

  describe('env', () => {
    afterAll(() => {
      delete process.env.MY_ENV_VAR;
      unlinkSync('.env');
    });

    it('should add the env to the command', async () => {
      const root = dirSync().name;
      const f = fileSync().name;
      const result = await runCommands(
        {
          commands: [
            {
              command: `echo "$MY_ENV_VAR" >> ${f}`,
            },
          ],
          env: {
            MY_ENV_VAR: 'my-value',
          },
          parallel: true,
          __unparsed__: [],
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('my-value');
    });
    it('should prioritize env setting over local dotenv files', async () => {
      writeFileSync('.env', 'MY_ENV_VAR=from-dotenv');
      const root = dirSync().name;
      const f = fileSync().name;
      const result = await runCommands(
        {
          commands: [
            {
              command: `echo "$MY_ENV_VAR" >> ${f}`,
            },
          ],
          env: {
            MY_ENV_VAR: 'from-options',
          },
          parallel: true,
          __unparsed__: [],
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('from-options');
    });
  });

  describe('dotenv', () => {
    beforeAll(() => {
      writeFileSync('.env', 'NRWL_SITE=https://nrwl.io/');
    });

    beforeEach(() => {
      delete process.env.NRWL_SITE;
      delete process.env.NX_SITE;
    });

    afterAll(() => {
      unlinkSync('.env');
    });

    it('should load the root .env file by default if there is one', async () => {
      let f = fileSync().name;
      const result = await runCommands(
        {
          commands: [
            {
              command: `echo $NRWL_SITE >> ${f}`,
            },
          ],
          __unparsed__: [],
        },
        context
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('https://nrwl.io/');
    });

    it('should load the specified .env file instead of the root one', async () => {
      const devEnv = fileSync().name;
      writeFileSync(devEnv, 'NX_SITE=https://nx.dev/');
      let f = fileSync().name;
      const result = await runCommands(
        {
          commands: [
            {
              command: `echo $NX_SITE >> ${f} && echo $NRWL_SITE >> ${f}`,
            },
          ],
          envFile: devEnv,
          __unparsed__: [],
        },
        context
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('https://nx.dev/');
    });

    it('should error if the specified .env file does not exist', async () => {
      let f = fileSync().name;
      try {
        await runCommands(
          {
            commands: [
              {
                command: `echo $NX_SITE >> ${f} && echo $NRWL_SITE >> ${f}`,
              },
            ],
            envFile: '/somePath/.fakeEnv',
            __unparsed__: [],
          },

          context
        );
        fail('should not reach');
      } catch (e) {
        expect(e.message).toContain(
          `no such file or directory, open '/somePath/.fakeEnv'`
        );
      }
    });
  });
});
