import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { RemoteCacheV2, type RemoteCache } from './default-tasks-runner';

const { root } = vi.hoisted(() => {
  const { mkdtempSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  return { root: mkdtempSync(join(tmpdir(), 'nx-remote-cache-v1-')) };
});

vi.mock('../utils/cache-directory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/cache-directory')>()),
  cacheDir: require('path').join(root, 'local-cache'),
}));

describe('RemoteCacheV2.fromCacheV1', () => {
  const cacheDirectory = join(root, 'remote');
  const hash = 'abc123';
  const entry = join(cacheDirectory, hash);
  const secret = join(root, 'secret');

  function v1Cache(unpack: () => void): RemoteCache {
    return {
      retrieve: async () => {
        unpack();
        return true;
      },
      store: async () => true,
    };
  }

  beforeEach(() => {
    rmSync(cacheDirectory, { recursive: true, force: true });
    mkdirSync(join(entry, 'outputs'), { recursive: true });
    writeFileSync(secret, 'SECRET=1');
    mkdirSync(join(secret + '-dir', 'dist'), { recursive: true });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reads code and terminal output from regular files', async () => {
    const cache = await RemoteCacheV2.fromCacheV1(
      v1Cache(() => {
        writeFileSync(join(entry, 'code'), '0');
        writeFileSync(join(entry, 'terminalOutputs'), 'built');
      })
    );

    expect(await cache.retrieve(hash, cacheDirectory)).toEqual({
      outputsPath: join(entry, 'outputs'),
      terminalOutput: 'built',
      code: 0,
    });
  });

  it('treats a symlinked terminal output as a miss', async () => {
    const cache = await RemoteCacheV2.fromCacheV1(
      v1Cache(() => {
        writeFileSync(join(entry, 'code'), '0');
        symlinkSync(secret, join(entry, 'terminalOutputs'));
      })
    );

    expect(await cache.retrieve(hash, cacheDirectory)).toBeNull();
  });

  it('ignores a symlinked terminal output in the local cache directory', async () => {
    const localTerminalOutput = join(
      root,
      'local-cache',
      'terminalOutputs',
      hash
    );
    const cache = await RemoteCacheV2.fromCacheV1(
      v1Cache(() => {
        writeFileSync(join(entry, 'code'), '0');
        rmSync(localTerminalOutput, { force: true });
        symlinkSync(secret, localTerminalOutput);
      })
    );

    expect(await cache.retrieve(hash, cacheDirectory)).toEqual({
      outputsPath: join(entry, 'outputs'),
      terminalOutput: null,
      code: 0,
    });
  });

  it('treats a symlinked code file as a miss', async () => {
    const cache = await RemoteCacheV2.fromCacheV1(
      v1Cache(() => {
        symlinkSync(secret, join(entry, 'code'));
        writeFileSync(join(entry, 'terminalOutputs'), 'built');
      })
    );

    expect(await cache.retrieve(hash, cacheDirectory)).toBeNull();
  });

  it('treats a symlinked outputs directory as a miss', async () => {
    const cache = await RemoteCacheV2.fromCacheV1(
      v1Cache(() => {
        writeFileSync(join(entry, 'code'), '0');
        writeFileSync(join(entry, 'terminalOutputs'), 'built');
        rmSync(join(entry, 'outputs'), { recursive: true });
        symlinkSync(secret + '-dir', join(entry, 'outputs'), 'dir');
      })
    );

    expect(await cache.retrieve(hash, cacheDirectory)).toBeNull();
  });
});
