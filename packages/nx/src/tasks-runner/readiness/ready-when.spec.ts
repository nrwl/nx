import { writeFileSync } from 'fs';
import { fileSync } from 'tmp';
import type { ProjectGraph } from '../../config/project-graph';
import type { Task } from '../../config/task-graph';
import { checkReadyWhen, getReadyWhen, normalizeReadyWhen } from './ready-when';

vi.mock('../utils', async () => ({
  ...(await vi.importActual('../utils')),
  getExecutorForTask: vi.fn(() => ({
    schema: {
      properties: {
        host: { type: 'string', default: 'localhost' },
        port: { type: 'number', default: 4200 },
        staticFilePath: { type: 'string' },
      },
    },
  })),
}));

const data = {
  workspaceRoot: '/workspace',
  projectRoot: 'apps/app',
  projectName: 'app',
  options: {
    port: 4200,
    host: 'dev.local',
    server: { port: 0 },
    hmrPort: 'auto',
  },
  env: () => ({}),
};

describe('normalizeReadyWhen', () => {
  it('keeps the knobs and fills in the default timeout', () => {
    expect(
      normalizeReadyWhen(
        { url: 'http://localhost:4200', timeout: 5, interval: 2 },
        'app:serve',
        data
      )
    ).toEqual({
      kind: 'url',
      url: 'http://localhost:4200',
      timeout: 5,
      interval: 2,
    });
    expect(normalizeReadyWhen({ port: 3000 }, 'app:serve', data)).toEqual({
      kind: 'port',
      port: 3000,
      timeout: 60_000,
    });
    expect(
      normalizeReadyWhen({ port: 3000, host: 'localhost' }, 'app:serve', data)
    ).toMatchObject({ kind: 'port', host: 'localhost' });
    expect(
      normalizeReadyWhen({ logMatches: 'a' }, 'app:serve', data)
    ).toMatchObject({
      kind: 'logMatches',
      logMatches: ['a'],
    });
  });

  it('resolves placeholders and leaves other braces alone', () => {
    const normalize = (readyWhen: any) =>
      normalizeReadyWhen(readyWhen, 'app:serve', data);
    expect(
      normalize({
        url: 'http://{options.host}:{options.port}/graphql?query={__typename}',
      })
    ).toMatchObject({
      url: 'http://dev.local:4200/graphql?query={__typename}',
    });
    expect(
      normalize({ port: '{options.port}', host: '{options.host}' })
    ).toMatchObject({ port: 4200, host: 'dev.local' });
    expect(
      normalize({
        command:
          "docker inspect --format='{{.State.Health.Status}}' {projectName}-db && test -f {workspaceRoot}/{projectRoot}/${MARKER:-ready}",
      })
    ).toMatchObject({
      command:
        "docker inspect --format='{{.State.Health.Status}}' app-db && test -f /workspace/apps/app/${MARKER:-ready}",
    });
    expect(
      normalize({
        logMatches: ['listening on {options.server.port}', '{ready}'],
      })
    ).toMatchObject({ logMatches: ['listening on 0', '{ready}'] });
    expect(
      normalize({ command: 'test "${options}" = ready || {projectName.x}' })
    ).toMatchObject({
      command: 'test "${options}" = ready || {projectName.x}',
    });
  });

  it.each([
    ['{options.port ?? env.READY_PORT ?? 3000}', 'http://h/4200'],
    ['{options.unset ?? env.READY_PORT ?? 3000}', 'http://h/5000'],
    ['{options.empty ?? env.READY_EMPTY ?? 3000}', 'http://h/3000'],
    ['{options.unset ?? env.APP.HTTP-PORT ?? 3000}', 'http://h/5001'],
    ['{options.unset ?? env.ProgramFiles(x86) ?? 3000}', 'http://h/5002'],
    ['{options.zero ?? 1}/{options.no ?? true}', 'http://h/0/false'],
    ['{options.constructor ?? 3000}', 'http://h/3000'],
    ['{options.unset ?? env.toString ?? 3000}', 'http://h/3000'],
    ['{options.unset ?? {projectName}/{options.port}}', 'http://h/app/4200'],
  ])('resolves the fallbacks in %s', (tokens, url) => {
    expect(
      normalizeReadyWhen({ url: `http://h/${tokens}` }, 'app:serve', {
        ...data,
        options: { ...data.options, empty: '', zero: 0, no: false },
        env: () => ({
          READY_PORT: '5000',
          READY_EMPTY: '',
          'APP.HTTP-PORT': '5001',
          'ProgramFiles(x86)': '5002',
        }),
      })
    ).toMatchObject({ url });
  });

  it.each([true, false])('treats %s as an unset host or port', (flag) => {
    const normalize = (readyWhen: any) =>
      normalizeReadyWhen(readyWhen, 'app:serve', {
        ...data,
        options: { ...data.options, host: flag, port: flag },
      });

    expect(
      normalize({
        port: '{options.port ?? 5173}',
        host: '{options.host ?? localhost}',
      })
    ).toMatchObject({ port: 5173, host: 'localhost' });
    expect(() => normalize({ port: 3000, host: '{options.host}' })).toThrow(
      'Task "app:serve" has an invalid "readyWhen": "{options.host}" has no value'
    );
  });

  it.each([
    [{ port: 0 }, {}],
    [{ port: 'auto' }, {}],
    [{ port: '{options.port ?? 4200}' }, { port: 0 }],
    [{ port: '{options.port ?? 4200}' }, { port: '0' }],
    [{ port: '{options.port ?? 4200}' }, { port: 'auto' }],
    [{ port: '{options.port ?? 4200}' }, { port: '' }],
  ])('skips the check of %j with the options %j', (readyWhen, options) => {
    expect(
      normalizeReadyWhen(readyWhen, 'app:serve', {
        ...data,
        options: { ...data.options, ...options },
      })
    ).toBeNull();
  });

  it('treats an empty env var as an unset port', () => {
    expect(
      normalizeReadyWhen({ port: '{env.PORT ?? 4200}' }, 'app:serve', {
        ...data,
        env: () => ({ PORT: '' }),
      })
    ).toMatchObject({ port: 4200 });
  });

  // A waiter in another process can't read PORT and checks the host, so the
  // producer's process must check it too
  it('checks the host when the server picks the port', () => {
    expect(() =>
      normalizeReadyWhen(
        { port: '{env.PORT}', host: '{options.host}' },
        'app:serve',
        { ...data, options: {}, env: () => ({ PORT: '0' }) }
      )
    ).toThrow(
      'Task "app:serve" has an invalid "readyWhen": "{options.host}" has no value.'
    );
  });

  it('reads env tokens case-insensitively on Windows', () => {
    const platform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    onTestFinished(() => {
      Object.defineProperty(process, 'platform', { value: platform });
    });
    const normalize = (readyWhen: any) =>
      normalizeReadyWhen(readyWhen, 'app:serve', {
        ...data,
        env: () => ({ Port: '5000' }),
      });

    expect(normalize({ port: '{env.PORT}' })).toMatchObject({ port: 5000 });
    expect(() => normalize({ port: '{env.READY_PORT}' })).toThrow(
      'Task "app:serve" has an invalid "readyWhen": "{env.READY_PORT}" has no value'
    );
  });

  it.each([
    ['ready on', 'expected an object'],
    [{}, 'expected exactly one of'],
    [{ url: 'http://x', port: 1 }, 'expected exactly one of'],
    [{ url: 'ftp://x' }, '"url" must be an http or https URL'],
    [{ url: 'not a url' }, '"url" must be an http or https URL'],
    [{ port: 70000 }, '"port" must be an integer from 0 to 65535, or "auto"'],
    [{ port: 80, host: '' }, '"host" must be a non-empty string'],
    [{ command: '' }, '"command" must be a non-empty string'],
    [{ logMatches: [] }, '"logMatches" must be a non-empty string'],
    [{ logMatches: ['a', ''] }, '"logMatches" must be a non-empty string'],
    [{ port: 80, timeout: 0 }, '"timeout" must be an integer from 1 to'],
    [{ port: 80, timeout: 2 ** 31 }, '"timeout" must be an integer from 1 to'],
    [{ port: 80, interval: 1.5 }, '"interval" must be an integer from 1 to'],
    [
      { url: 'http://localhost:{options.prot}' },
      '"{options.prot}" has no value',
    ],
    [
      { command: 'echo {options.server}' },
      '"{options.server}" is not a string or a number',
    ],
    [
      { url: 'http://localhost:{option.port}' },
      '"url" must be an http or https URL',
    ],
    [
      { url: 'http://localhost:{options.prot ?? env.NX_READY_WHEN_UNSET}' },
      '"{options.prot ?? env.NX_READY_WHEN_UNSET}" has no value',
    ],
    [
      { port: '{options.port ?? 4200 ?? env.PORT}' },
      '"{options.port ?? 4200 ?? env.PORT}" has a fallback after the literal "4200" that can never be used',
    ],
    [{ port: '{port}' }, '"port" contains an unknown placeholder'],
    [
      { port: '{options.host}' },
      '"port" must be an integer from 0 to 65535, or "auto"',
    ],
    // Only a port reads `auto` as a port the server picks
    [
      { url: 'http://localhost:{options.hmrPort}' },
      '"url" must be an http or https URL',
    ],
  ])('rejects %j', (readyWhen, reason) => {
    expect(() =>
      normalizeReadyWhen(readyWhen as any, 'app:serve', data)
    ).toThrow(`Task "app:serve" has an invalid "readyWhen": ${reason}`);
  });
});

describe('normalizeReadyWhen signal', () => {
  const normalize = (readyWhen: any) =>
    normalizeReadyWhen(readyWhen, 'app:serve', data);

  it('takes an optional fallback check with the same timeout', () => {
    expect(normalize({ signal: true })).toEqual({
      kind: 'signal',
      timeout: 60_000,
    });
    expect(
      normalize({
        signal: true,
        timeout: 5000,
        fallback: { port: '{options.port}', interval: 20 },
      })
    ).toEqual({
      kind: 'signal',
      timeout: 5000,
      fallback: { kind: 'port', port: 4200, timeout: 5000, interval: 20 },
    });
  });

  it('treats an undefined fallback as absent, as a serialized config does', () => {
    expect(normalize({ port: 4200, fallback: undefined })).toMatchObject({
      kind: 'port',
      port: 4200,
    });
  });

  it('counts a fallback whose server picks the port as ready once started', () => {
    expect(
      normalize({ signal: true, fallback: { port: '{options.hmrPort}' } })
    ).toEqual({ kind: 'signal', timeout: 60_000, fallback: null });
  });

  it.each([
    [{ signal: false }, '"signal" must be true'],
    [{ signal: true, interval: 10 }, '"interval" is not used by "signal"'],
    [
      { port: 4200, fallback: { port: 1 } },
      '"fallback" is only allowed with "signal"',
    ],
    [
      { port: 4200, fallback: null },
      '"fallback" is only allowed with "signal"',
    ],
    [
      { signal: true, fallback: { port: 1, timeout: 5 } },
      '"fallback" must be a url, port, command or logMatches check without its own timeout',
    ],
    [
      { signal: true, fallback: { signal: true } },
      '"fallback" must be a url, port, command or logMatches check without its own timeout',
    ],
    [
      { signal: true, fallback: { port: 1, url: 'http://localhost' } },
      'expected exactly one of',
    ],
  ])('rejects %j', (readyWhen, reason) => {
    expect(() => normalize(readyWhen)).toThrow(reason);
  });
});

describe('getReadyWhen', () => {
  it('gives a command check the env and options the producer runs with', () => {
    const serve = {
      executor: 'nx:run-commands',
      continuous: true,
      readyWhen: { signal: true, fallback: { command: 'check-ready' } },
      options: { command: 'serve', env: { NX_READY_WHEN_PORT: '5001' } },
    };
    const projectGraph = {
      nodes: {
        app: {
          name: 'app',
          type: 'app',
          data: { root: 'apps/app', targets: { serve } },
        },
      },
    } as unknown as ProjectGraph;
    const projects = { app: { root: 'apps/app', targets: { serve } } };
    const task = {
      id: 'app:serve',
      target: { project: 'app', target: 'serve' },
      overrides: { port: 4400 },
      continuous: true,
    } as Task;

    const readyWhen = getReadyWhen(task, projectGraph, projects, '/w', {
      NX_TASK_ENV: 'yes',
    });

    expect(readyWhen).toMatchObject({
      kind: 'signal',
      fallback: { kind: 'command', command: 'check-ready' },
    });
    const { env } = (readyWhen as any).fallback;
    expect(env).toMatchObject({
      NX_TASK_ENV: 'yes',
      NX_READY_WHEN_PORT: '5001',
    });
    expect(JSON.parse(env.NX_TASK_OPTIONS)).toMatchObject({
      command: 'serve',
      port: 4400,
    });
  });

  it('resolves against the options the executor receives', () => {
    const serve = {
      executor: '@nx/web:file-server',
      continuous: true,
      readyWhen: {
        url: 'http://{options.host}:{options.port}/{options.staticFilePath}',
      },
      options: { staticFilePath: 'dist/app' },
      configurations: { ci: { port: 4300 } },
    };
    const projectGraph = {
      nodes: {
        app: {
          name: 'app',
          type: 'app',
          data: { root: 'apps/app', targets: { serve } },
        },
      },
    } as unknown as ProjectGraph;
    const projects = { app: { root: 'apps/app', targets: { serve } } };
    const task = (configuration?: string, overrides = {}) =>
      ({
        id: 'app:serve',
        target: { project: 'app', target: 'serve', configuration },
        overrides,
        continuous: true,
      }) as Task;
    const taskEnv = { NX_READY_WHEN_PORT: '5000' };
    const url = (t: Task) =>
      (
        getReadyWhen(t, projectGraph, projects, '/w', taskEnv) as {
          url: string;
        }
      ).url;

    // schema defaults fill host and port
    expect(url(task())).toBe('http://localhost:4200/dist/app');
    expect(url(task('ci'))).toBe('http://localhost:4300/dist/app');
    // a command-line override keeps its kebab-case spelling until the executor
    // options are combined
    expect(
      url(task('ci', { 'static-file-path': 'dist/new-app', port: 4400 }))
    ).toBe('http://localhost:4400/dist/new-app');

    // env tokens read the env the producer is started with
    serve.readyWhen.url = 'http://localhost:{env.NX_READY_WHEN_PORT}';
    expect(url(task())).toBe('http://localhost:5000');

    // run-commands runs its command with its `env` option applied on top
    Object.assign(serve, {
      executor: 'nx:run-commands',
      options: { command: 'serve' },
    });
    expect(url(task())).toBe('http://localhost:5000');
    serve.options['env'] = { NX_READY_WHEN_PORT: '5001' };
    expect(url(task())).toBe('http://localhost:5001');
    // and with the values from its `envFile`
    const envFile = fileSync().name;
    writeFileSync(envFile, 'NX_READY_WHEN_FILE_PORT=5002');
    serve.options['envFile'] = envFile;
    serve.readyWhen.url = 'http://localhost:{env.NX_READY_WHEN_FILE_PORT}';
    expect(url(task())).toBe('http://localhost:5002');
  });
});

describe('checkReadyWhen', () => {
  const check = (readyWhen: any) =>
    checkReadyWhen(readyWhen, 'app:serve', {
      workspaceRoot: '/workspace',
      projectRoot: 'apps/app',
      projectName: 'app',
      options: { port: 4200 },
    });

  it('leaves only the values that read the env to the producer process', () => {
    expect(check({ url: 'http://localhost:{options.port}' })).toEqual({
      timeout: 60_000,
      description: 'url http://localhost:4200',
    });
    // options.port has a value, so the env is never read
    expect(check({ port: '{options.port ?? env.PORT}' })).toEqual({
      timeout: 60_000,
      description: 'port 4200',
    });
    expect(
      check({ port: '{options.unset ?? env.PORT}', host: 'h', timeout: 5 })
    ).toEqual({
      timeout: 5,
      description: 'port h:{options.unset ?? env.PORT}',
    });
    expect(check({ logMatches: ['on {env.PORT}', 'ready'] })).toEqual({
      timeout: 60_000,
      description: 'logMatches "on {env.PORT}", "ready"',
    });
  });

  it('waits for the producer to start when the server picks the port', () => {
    expect(check({ port: 'auto', host: 'h' })).toEqual({
      timeout: 60_000,
      description: 'port h:auto',
    });
  });

  it.each([
    [{ port: '{options.prot}' }, '"{options.prot}" has no value'],
    [{ port: '{env.PORT}', host: '' }, '"host" must be a non-empty string'],
    [
      { logMatches: ['', '{env.READY_TEXT}'] },
      '"logMatches" must be a non-empty string or an array of them',
    ],
    [
      { url: 'http://localhost:{env.PORT}', timeout: 0 },
      '"timeout" must be an integer from 1 to',
    ],
  ])('rejects %j', (readyWhen, reason) => {
    expect(() => check(readyWhen)).toThrow(
      `Task "app:serve" has an invalid "readyWhen": ${reason}`
    );
  });
});
