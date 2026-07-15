import { ExecutorContext } from '@nx/devkit';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getProjectRoot,
  normalizeOptions,
  parseDotEnvFile,
} from './normalize-options';

function fakeContext(root: string, projectRoot = 'apps/app'): ExecutorContext {
  return {
    root,
    cwd: root,
    isVerbose: false,
    projectName: 'app',
    projectGraph: {
      nodes: {
        app: { name: 'app', type: 'app', data: { root: projectRoot } },
      },
      dependencies: {},
    },
  } as unknown as ExecutorContext;
}

describe('getProjectRoot', () => {
  it('reads the project root from the project graph', () => {
    expect(getProjectRoot(fakeContext('/workspace'))).toEqual('apps/app');
  });
});

describe('parseDotEnvFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-docker-envfile-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty object when the file does not exist', () => {
    expect(parseDotEnvFile(join(dir, 'missing.env'))).toEqual({});
  });

  it('parses KEY=value lines, skipping comments and blanks', () => {
    const file = join(dir, '.env');
    writeFileSync(file, '# comment\n\nFOO=bar\nBAZ="quoted value"\n');
    expect(parseDotEnvFile(file)).toEqual({ FOO: 'bar', BAZ: 'quoted value' });
  });
});

describe('normalizeOptions', () => {
  it('defaults the Dockerfile path to <projectRoot>/Dockerfile', () => {
    const result = normalizeOptions({}, fakeContext('/workspace', 'apps/app'));
    expect(result.inputs.file).toEqual('/workspace/apps/app/Dockerfile');
  });

  it('respects an explicit file path', () => {
    const result = normalizeOptions(
      { file: '{workspaceRoot}/nest.Dockerfile' },
      fakeContext('/workspace')
    );
    expect(result.inputs.file).toEqual('{workspaceRoot}/nest.Dockerfile');
  });

  it('normalizes cache-from/cache-to from a single string into an array', () => {
    const result = normalizeOptions(
      { 'cache-from': 'type=registry,ref=app:cache' },
      fakeContext('/workspace')
    );
    expect(result.inputs.cacheFrom).toEqual(['type=registry,ref=app:cache']);
  });

  it('defaults engine to docker', () => {
    expect(normalizeOptions({}, fakeContext('/workspace')).engine).toEqual(
      'docker'
    );
  });

  it('produces no metadata options when metadata.images is not set', () => {
    expect(
      normalizeOptions({}, fakeContext('/workspace')).metadata
    ).toBeUndefined();
  });

  it('produces metadata options when metadata.images is set', () => {
    const result = normalizeOptions(
      { metadata: { images: ['app'], tags: ['latest'] } },
      fakeContext('/workspace')
    );
    expect(result.metadata).toEqual({
      images: ['app'],
      tags: ['latest'],
      flavor: [],
      labels: [],
      annotations: [],
    });
  });

  it('merges options.env on top of process.env', () => {
    const result = normalizeOptions(
      { env: { CMD_COMMAND: 'node main.js' } },
      fakeContext('/workspace')
    );
    expect(result.env.CMD_COMMAND).toEqual('node main.js');
  });

  it('merges envFile before options.env, letting options.env win on conflicts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nx-docker-envfile-precedence-'));
    writeFileSync(join(dir, '.env'), 'CMD_COMMAND=from-file\nOTHER=kept\n');
    const result = normalizeOptions(
      { envFile: '.env', env: { CMD_COMMAND: 'from-options' } },
      fakeContext(dir)
    );
    expect(result.env.CMD_COMMAND).toEqual('from-options');
    expect(result.env.OTHER).toEqual('kept');
    rmSync(dir, { recursive: true, force: true });
  });
});
