import { join } from 'path';
import { NxJsonConfiguration } from './../config/nx-json';
import { cacheDirectory } from './cache-directory';

describe.only('cache-directory', () => {
  const emptyNxJSon = () =>
    ({
      tasksRunnerOptions: {
        default: {
          options: {},
        },
      },
    } as unknown as NxJsonConfiguration);
  const emptyEnv = () => ({});
  const root = () => '/Users/BlaBla/repos/some-repo';

  const cacheDirSpec = () => ({
    envName: 'NX_CACHE_DIRECTORY',
    propertyName: 'cacheDirectory',
    defaultDirectory: join('node_modules', '.cache', 'nx'),
  });

  const projectGraphCacheDirSpec = (cacheDir: string) => ({
    envName: 'NX_PROJECT_GRAPH_CACHE_DIRECTORY',
    defaultDirectory: join('node_modules', '.cache', 'nx'),
  });

  it('cacheDir should default to node_modules/.cache/nx', () => {
    const spec = cacheDirSpec();
    const dir = cacheDirectory(root(), emptyEnv(), emptyNxJSon(), spec);
    expect(dir).toBe(join(root(), spec.defaultDirectory));
  });

  it('cacheDirectory in nx.json should work with relative path', () => {
    const spec = cacheDirSpec();
    const nxJson = emptyNxJSon();
    nxJson.tasksRunnerOptions.default.options['cacheDirectory'] = '.nxcache';

    const dir = cacheDirectory(root(), emptyEnv(), nxJson, spec);
    expect(dir).toBe(join(root(), '.nxcache'));
  });

  it('cacheDirectory in nx.json should work with absolute path', () => {
    const spec = cacheDirSpec();
    const nxJson = emptyNxJSon();
    nxJson.tasksRunnerOptions.default.options['cacheDirectory'] =
      '/tmp/.nxcache';

    const dir = cacheDirectory(root(), emptyEnv(), nxJson, spec);
    expect(dir).toBe('/tmp/.nxcache');
  });

  it('env NX_CACHE_DIRECTORY should work with relative path', () => {
    const spec = cacheDirSpec();
    const env = { NX_CACHE_DIRECTORY: 'local-cache' };
    const dir = cacheDirectory(root(), env, emptyNxJSon(), spec);
    expect(dir).toBe(join(root(), 'local-cache'));
  });

  it('env NX_CACHE_DIRECTORY should work with aboslute path', () => {
    const spec = cacheDirSpec();
    const env = { NX_CACHE_DIRECTORY: '/Users/BlaBla/.cache' };
    const dir = cacheDirectory(root(), env, emptyNxJSon(), spec);
    expect(dir).toBe('/Users/BlaBla/.cache');
  });

  it('env NX_CACHE_DIRECTORY should have priority over nx.json', () => {
    const spec = cacheDirSpec();
    const env = { NX_CACHE_DIRECTORY: 'local-cache' };
    const nxJson = emptyNxJSon();
    nxJson.tasksRunnerOptions.default.options['cacheDirectory'] = '.nxcache';
    const dir = cacheDirectory(root(), env, nxJson, spec);
    expect(dir).toBe(join(root(), 'local-cache'));
  });

  it('projectGraphCacheDirectory should default to node_modules/.cache/nx', () => {
    const cacheDir = cacheDirectory(
      root(),
      emptyEnv(),
      emptyNxJSon(),
      cacheDirSpec()
    );
    const spec = projectGraphCacheDirSpec(cacheDir);
    const dir = cacheDirectory(root(), emptyEnv(), emptyNxJSon(), spec);
    expect(dir).toBe(join(root(), spec.defaultDirectory));
  });

  it('env NX_PROJECT_GRAPH_CACHE_DIRECTORY should work with relative path', () => {
    const spec = projectGraphCacheDirSpec('not/a/directory/we/should/see');
    const env = { NX_PROJECT_GRAPH_CACHE_DIRECTORY: 'nx-project-graph' };
    const dir = cacheDirectory(root(), env, emptyNxJSon(), spec);
    expect(dir).toBe(join(root(), 'nx-project-graph'));
  });

  it('env NX_PROJECT_GRAPH_CACHE_DIRECTORY should work with absolute path', () => {
    const spec = projectGraphCacheDirSpec('not/a/directory/we/should/see');
    const env = {
      NX_PROJECT_GRAPH_CACHE_DIRECTORY: '/usr/home/bla/nx-project-graph',
    };
    const dir = cacheDirectory(root(), env, emptyNxJSon(), spec);
    expect(dir).toBe('/usr/home/bla/nx-project-graph');
  });
});
