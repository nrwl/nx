import type { ProjectGraph } from '../../config/project-graph';
import type { Task } from '../../config/task-graph';
import { getReadyWhen, normalizeReadyWhen } from './ready-when';

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
  options: { port: 4200, host: 'dev.local', server: { port: 0 } },
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
  });

  it.each([
    ['ready on', 'expected an object'],
    [{}, 'expected exactly one of'],
    [{ url: 'http://x', port: 1 }, 'expected exactly one of'],
    [{ url: 'ftp://x' }, '"url" must be an http or https URL'],
    [{ url: 'not a url' }, '"url" must be an http or https URL'],
    [{ port: 0 }, '"port" must be an integer from 1 to 65535'],
    [{ port: 70000 }, '"port" must be an integer from 1 to 65535'],
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
    [{ port: '{port}' }, '"port" contains an unknown placeholder'],
    [{ port: '{options.host}' }, '"port" must be an integer from 1 to 65535'],
  ])('rejects %j', (readyWhen, reason) => {
    expect(() =>
      normalizeReadyWhen(readyWhen as any, 'app:serve', data)
    ).toThrow(`Task "app:serve" has an invalid "readyWhen": ${reason}`);
  });
});

describe('getReadyWhen', () => {
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
    const url = (t: Task) =>
      (getReadyWhen(t, projectGraph, projects, '/w') as { url: string }).url;

    // schema defaults fill host and port
    expect(url(task())).toBe('http://localhost:4200/dist/app');
    expect(url(task('ci'))).toBe('http://localhost:4300/dist/app');
    // a command-line override keeps its kebab-case spelling until the executor
    // options are combined
    expect(
      url(task('ci', { 'static-file-path': 'dist/new-app', port: 4400 }))
    ).toBe('http://localhost:4400/dist/new-app');
  });
});
