import type { Task } from '../config/task-graph';
import { output } from '../utils/output';
import { DbCache } from './cache';

const nativeCache = vi.hoisted(() => ({
  cacheDirectory: '/cache',
  get: vi.fn(),
  getBatch: vi.fn(),
  applyRemoteCacheResults: vi.fn(),
  put: vi.fn(),
}));

vi.mock('../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../native')>()),
  NxCache: class {
    constructor() {
      return nativeCache;
    }
  },
}));
vi.mock('../utils/db-connection', () => ({ getDbConnection: () => ({}) }));
vi.mock('../config/nx-json', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config/nx-json')>()),
  readNxJson: () => ({}),
}));

function task(id: string): Task {
  return { id, hash: `hash-${id}`, outputs: ['dist/app'] } as Task;
}

function remoteResult(hash: string) {
  return { code: 0, terminalOutput: 'log', outputsPath: `/cache/${hash}` };
}

function cacheWithRemote() {
  const cache = new DbCache({ nxCloudRemoteCache: null });
  (cache as any).remoteCache = {
    retrieve: vi.fn(async (hash: string) => remoteResult(hash)),
  };
  return cache;
}

describe('DbCache remote results', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    nativeCache.get.mockReturnValue(null);
    nativeCache.getBatch.mockImplementation((hashes: string[]) =>
      hashes.map(() => null)
    );
    warn = vi.spyOn(output, 'warn').mockImplementation(() => {});
  });

  it('returns a remote hit once its outputs are applied', async () => {
    nativeCache.applyRemoteCacheResults.mockReturnValue(true);

    const res = await cacheWithRemote().get(task('a'));

    expect(res).toMatchObject({ remote: true, code: 0 });
    expect(nativeCache.applyRemoteCacheResults).toHaveBeenCalledWith(
      'hash-a',
      remoteResult('hash-a'),
      ['dist/app']
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('treats a discarded remote result as a miss', async () => {
    nativeCache.applyRemoteCacheResults.mockReturnValue(false);

    expect(await cacheWithRemote().get(task('a'))).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('a') })
    );
  });

  it('leaves discarded remote results out of a batch', async () => {
    nativeCache.applyRemoteCacheResults.mockImplementation(
      (hash: string) => hash !== 'hash-b'
    );

    const results = await cacheWithRemote().getBatch([task('a'), task('b')]);

    expect([...results.keys()]).toEqual(['hash-a']);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('DbCache put', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warn = vi.spyOn(output, 'warn').mockImplementation(() => {});
  });

  function cacheWithRemoteStore() {
    const cache = new DbCache({ nxCloudRemoteCache: null });
    const store = vi.fn(async () => true);
    (cache as any).remoteCache = { store };
    return { cache, store };
  }

  it('stores a cached result remotely', async () => {
    nativeCache.put.mockReturnValue({
      expandedOutputs: ['dist/app'],
      files: [],
      outputsBelowALink: [],
    });
    const { cache, store } = cacheWithRemoteStore();

    await cache.put(task('a'), 'log', ['dist/app'], 0);

    expect(store).toHaveBeenCalledWith('hash-a', '/cache', 'log', 0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns and stores nothing remotely when outputs are below a link', async () => {
    nativeCache.put.mockReturnValue({
      expandedOutputs: [],
      files: [],
      outputsBelowALink: ['dist/packages/api'],
    });
    const { cache, store } = cacheWithRemoteStore();

    await cache.put(task('a'), 'log', ['dist/packages/api'], 0);

    expect(store).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Not caching a',
        bodyLines: expect.arrayContaining(['- dist/packages/api']),
      })
    );
  });
});
