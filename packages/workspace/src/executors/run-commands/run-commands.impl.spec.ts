import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { relative } from 'path';
import { dirSync, fileSync } from 'tmp';
import runCommands, { LARGE_BUFFER } from './run-commands.impl';
import { env } from 'npm-run-path';
const {
  devDependencies: { '@nrwl/workspace': version },
} = require('package.json');

function normalize(p: string) {
  return p.startsWith('/private') ? p.substring(8) : p;
}
function readFile(f: string) {
  return readFileSync(f).toString().replace(/\s/g, '');
}

describe('Command Runner Builder', () => {
  const context = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should run one command', async () => {
    const f = fileSync().name;
    const result = await runCommands({ command: `echo 1 >> ${f}` }, context);
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('1');
  });

  it('should interpolate provided --args', async () => {
    const f = fileSync().name;
    const result = await runCommands(
      { command: `echo {args.key} >> ${f}`, args: '--key=123' },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('123');
  });

  it('should interpolate all unknown args as if they were --args', async () => {
    const f = fileSync().name;
    const result = await runCommands(
      {
        command: `echo {args.key} >> ${f}`,
        key: 123,
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('123');
  });

  it('should add all args to the command if no interpolation in the command', async () => {
    const exec = jest.spyOn(require('child_process'), 'execSync');

    await runCommands(
      {
        command: `echo`,
        a: 123,
        b: 456,
      },
      context
    );
    expect(exec).toHaveBeenCalledWith(`echo --a=123 --b=456`, {
      stdio: ['inherit', 'inherit', 'inherit'],
      cwd: undefined,
      env: {
        ...process.env,
        ...env(),
      },
      maxBuffer: LARGE_BUFFER,
    });
  });

  it('should forward args by default when using commands (plural)', async () => {
    const exec = jest.spyOn(require('child_process'), 'exec');

    await runCommands(
      {
        commands: [{ command: 'echo' }, { command: 'echo foo' }],
        parallel: true,
        a: 123,
        b: 456,
      },
      context
    );

    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec).toHaveBeenNthCalledWith(1, 'echo --a=123 --b=456', {
      maxBuffer: LARGE_BUFFER,
      env: {
        ...process.env,
        ...env(),
      },
    });
    expect(exec).toHaveBeenNthCalledWith(2, 'echo foo --a=123 --b=456', {
      maxBuffer: LARGE_BUFFER,
      env: {
        ...process.env,
        ...env(),
      },
    });
  });

  it('should forward args when forwardAllArgs is set to true', async () => {
    const exec = jest.spyOn(require('child_process'), 'exec');

    await runCommands(
      {
        commands: [
          { command: 'echo', forwardAllArgs: true },
          { command: 'echo foo', forwardAllArgs: true },
        ],
        parallel: true,
        a: 123,
        b: 456,
      },
      context
    );

    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec).toHaveBeenNthCalledWith(1, 'echo --a=123 --b=456', {
      maxBuffer: LARGE_BUFFER,
      env: {
        ...process.env,
        ...env(),
      },
    });
    expect(exec).toHaveBeenNthCalledWith(2, 'echo foo --a=123 --b=456', {
      maxBuffer: LARGE_BUFFER,
      env: {
        ...process.env,
        ...env(),
      },
    });
  });

  it('should not forward args when forwardAllArgs is set to false', async () => {
    const exec = jest.spyOn(require('child_process'), 'exec');

    await runCommands(
      {
        commands: [
          { command: 'echo', forwardAllArgs: false },
          { command: 'echo foo', forwardAllArgs: false },
        ],
        parallel: true,
        a: 123,
        b: 456,
      },
      context
    );

    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec).toHaveBeenNthCalledWith(1, 'echo', {
      maxBuffer: LARGE_BUFFER,
      env: {
        ...process.env,
        ...env(),
      },
    });
    expect(exec).toHaveBeenNthCalledWith(2, 'echo foo', {
      maxBuffer: LARGE_BUFFER,
      env: {
        ...process.env,
        ...env(),
      },
    });
  });

  it('should throw when invalid args', async () => {
    try {
      await runCommands(
        {
          command: `echo {args.key}`,
          args: 'key=value',
        },
        context
      );
    } catch (e) {
      expect(e.message).toEqual('Invalid args: key=value');
    }
  });

  it('should run commands serially', async () => {
    const f = fileSync().name;
    const result = await runCommands(
      {
        commands: [`sleep 0.2 && echo 1 >> ${f}`, `echo 2 >> ${f}`],
        parallel: false,
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('12');
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
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    const contents = readFile(f);
    expect(contents).toContain('1');
    expect(contents).toContain('2');
  });

  describe('readyWhen', () => {
    it('should error when parallel = false', async () => {
      try {
        await runCommands(
          {
            commands: [{ command: 'echo foo' }, { command: 'echo bar' }],
            parallel: false,
            readyWhen: 'READY',
          },
          context
        );
        fail('should throw');
      } catch (e) {
        expect(e.message).toEqual(
          `ERROR: Bad executor config for @nrwl/run-commands - "readyWhen" can only be used when "parallel=true".`
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

  it('should stop execution and fail when a command fails', async () => {
    const f = fileSync().name;

    try {
      await runCommands(
        {
          commands: [`echo 1 >> ${f} && exit 1`, `echo 2 >> ${f}`],
          parallel: false,
        },
        context
      );
      fail('should fail when a command fails');
    } catch (e) {}
    expect(readFile(f)).toEqual('1');
  });

  describe('--color', () => {
    it('should not set FORCE_COLOR=true', async () => {
      const exec = jest.spyOn(require('child_process'), 'exec');
      await runCommands(
        {
          commands: [`echo 'Hello World'`, `echo 'Hello Universe'`],
          parallel: true,
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
    it('should use local installed package when cwd is specified', async () => {
      const root = dirSync().name;
      const childFolder = dirSync({ dir: root }).name;
      const cwd = relative(root, childFolder);
      const f = fileSync().name;

      const result = await runCommands(
        {
          commands: [
            {
              command: `yarn init -y`,
            },
            {
              command: `yarn add nx@12.0.0 @nrwl/workspace@12.0.0 @nrwl/cli@12.0.0 --save --registry=https://registry.yarnpkg.com/`,
            },
            {
              command: `echo '{"name":"tmp","scripts":{"nx":"nx"}}' >> package.json`,
            },
            {
              command: `echo '{}' >> nx.json`,
            },
            {
              command: `echo '{}' >> workspace.json`,
            },
            {
              command: `nx --version >> ${f}`,
            },
          ],
          parallel: false,
          cwd,
        },
        { root } as any
      );
      expect(result).toEqual(expect.objectContaining({ success: true }));
      // expect(normalize(readFile(f))).toBe('12.0.0');
    });

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
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).toBe(childFolder);
    });

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
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).toBe(childFolder);
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
