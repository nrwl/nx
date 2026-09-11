import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { withModuleClosure } from './module-closure';

// A path under a fake workspace, spelled the way this platform spells it, and
// the URL a loader would report it as. `resolve` supplies the drive letter
// Windows needs, which `fileURLToPath` rejects a URL without.
const wsFile = (path: string) => resolve('/ws', path);
const loadedAs = (path: string) => pathToFileURL(path).href;

describe('withModuleClosure', () => {
  function registrarFor(urls: string[]) {
    return (hooks: {
      load(url: string, context: unknown, next: Function): unknown;
    }) => {
      for (const url of urls) {
        hooks.load(url, {}, () => undefined);
      }
      return { deregister: () => {} };
    };
  }

  it('reports the files the load read', async () => {
    const entry = wsFile('libs/p/index.js');
    const shared = wsFile('libs/shared/hooks.js');

    const { result, sourceFiles } = await withModuleClosure(
      async () => 'loaded',
      registrarFor([loadedAs(entry), loadedAs(shared)])
    );

    expect(result).toBe('loaded');
    expect(sourceFiles).toEqual([entry, shared]);
  });

  it.each([
    ['a builtin under its new spelling', 'node:fs'],
    ['a builtin under its old spelling', 'fs'],
    ['a vendored file', loadedAs(wsFile('node_modules/dep/i.js'))],
    ['a non-file scheme', 'data:text/javascript,export%20default%201'],
  ])('leaves out %s', async (_what, specifier) => {
    const entry = wsFile('libs/p/index.js');

    const { sourceFiles } = await withModuleClosure(
      async () => null,
      registrarFor([loadedAs(entry), specifier])
    );

    expect(sourceFiles).toEqual([entry]);
  });

  it('deregisters the hook even when the load throws', async () => {
    let registered = true;
    const registrar = () => ({
      deregister: () => {
        registered = false;
      },
    });

    await expect(
      withModuleClosure(async () => {
        throw new Error('plugin blew up');
      }, registrar as any)
    ).rejects.toThrow('plugin blew up');
    // Left registered it would bill every later hook call to this load.
    expect(registered).toBe(false);
  });

  it('reports nothing observable where the runtime cannot be asked', async () => {
    const { result, sourceFiles } = await withModuleClosure(
      async () => 'loaded',
      null
    );

    // Null rather than an empty list, and rather than a require-cache answer
    // that would miss an ESM edge reached from inside a CJS graph. A caller
    // cannot validate what it could not see, so it must not record it.
    expect(result).toBe('loaded');
    expect(sourceFiles).toBeNull();
  });
});
