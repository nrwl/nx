import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serializeResult } from '../socket-utils';
import { handleProcessInBackground } from './handle-process-in-background';

describe('handleProcessInBackground', () => {
  const nativeJsLoader = require.extensions['.js'];
  let fixturesDir: string;
  let hookedFiles: string[];
  let hookedJsLoader: typeof nativeJsLoader;

  beforeEach(() => {
    fixturesDir = realpathSync(
      mkdtempSync(join(tmpdir(), 'nx-process-in-background-'))
    );
    hookedFiles = [];
    hookedJsLoader = (module, filename) => {
      hookedFiles.push(filename);
      return nativeJsLoader(module, filename);
    };
    require.extensions['.js'] = hookedJsLoader;
  });

  afterEach(() => {
    require.extensions['.js'] = nativeJsLoader;
    rmSync(fixturesDir, { recursive: true, force: true });
  });

  it('requires the module with the .js loader captured before user code hooked it', async () => {
    const requirePath = join(fixturesDir, 'process.js');
    writeFileSync(
      requirePath,
      'exports.default = async (data) => ({ received: data });'
    );

    const result = await handleProcessInBackground({
      type: 'test',
      requirePath,
      data: { a: 1 },
    });

    expect(result.error).toBeUndefined();
    expect(result.response).toEqual({ received: { a: 1 } });
    expect(hookedFiles).toEqual([]);
    expect(require.extensions['.js']).toBe(hookedJsLoader);
  });

  it.each([
    ['an Error', `throw new Error('fixture failed to load');`],
    [
      'an Error with a BigInt property',
      `throw Object.assign(new Error('fixture failed to load'), { size: 1n });`,
    ],
  ])(
    'responds with the original message and stack when loading throws %s',
    async (_, source) => {
      const requirePath = join(fixturesDir, 'throws.js');
      writeFileSync(requirePath, source);

      const result = await handleProcessInBackground({
        type: 'test',
        requirePath,
        data: {},
      });

      const error = sentToClient(result.error);
      expect(result.description).toBe(`Unable to require ${requirePath}`);
      expect(error.message).toBe('fixture failed to load');
      expect(error.stack).toContain(requirePath);
      expect(require.extensions['.js']).toBe(hookedJsLoader);
    }
  );

  it.each(['null', `'boom'`, '1n'])(
    'responds with an Error when loading throws %s',
    async (value) => {
      const requirePath = join(fixturesDir, 'throws.js');
      writeFileSync(requirePath, `throw ${value};`);

      const result = await handleProcessInBackground({
        type: 'test',
        requirePath,
        data: {},
      });

      expect(result.error).toBeInstanceOf(Error);
      const error = sentToClient(result.error);
      expect(result.description).toBe(`Unable to require ${requirePath}`);
      expect(error.message).toBe(`Unable to require ${requirePath}`);
      expect(error.stack).toContain(`Unable to require ${requirePath}`);
      expect(require.extensions['.js']).toBe(hookedJsLoader);
    }
  );

  it('responds with an Error when processing throws a non-Error', async () => {
    const requirePath = join(fixturesDir, 'process.js');
    writeFileSync(requirePath, 'exports.default = () => { throw null; };');

    const result = await handleProcessInBackground({
      type: 'test',
      requirePath,
      data: {},
    });

    expect(result.error).toBeInstanceOf(Error);
    const error = sentToClient(result.error);
    expect(result.description).toBe('Error when processing test.');
    expect(error.message).toBe('Error when processing test.');
  });
});

function sentToClient(error: Error) {
  return JSON.parse(serializeResult(error, null, null)).error;
}
