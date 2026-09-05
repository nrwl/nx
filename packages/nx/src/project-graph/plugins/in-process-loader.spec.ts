import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('./resolve-plugin', () => ({ resolveNxPlugin: vi.fn() }));
vi.mock('../../plugins/js/utils/register', () => ({
  registerSourceGraphResolver: vi.fn(),
}));
vi.mock('./transpiler', () => ({
  registerPluginTSTranspiler: vi.fn(),
  pluginTranspilerIsRegistered: () => true,
}));
vi.mock('../../utils/handle-import', () => ({ handleImport: vi.fn() }));

import { loadNxPlugin } from './in-process-loader';
import { resolveNxPlugin } from './resolve-plugin';
import { registerSourceGraphResolver } from '../../plugins/js/utils/register';
import { handleImport } from '../../utils/handle-import';

const root = '/workspace';
const sourceEntry = '/workspace/packages/plugin/src/index.ts';
const packageNames = ['@proj/plugin', '@proj/utils'];

function resolved(isSourcePlugin: boolean) {
  return {
    pluginPath: isSourcePlugin
      ? sourceEntry
      : '/workspace/packages/plugin/dist/index.js',
    name: '@proj/plugin',
    shouldRegisterTSTranspiler: false,
    isSourcePlugin,
    workspacePackageNames: packageNames,
  };
}

describe('loadNxPlugin source graph lifecycle', () => {
  let calls: string[];
  let resolverCleanup: Mock;
  let loadResolvedNxPluginAsync: Mock;

  beforeEach(() => {
    calls = [];
    resolverCleanup = vi.fn();
    (registerSourceGraphResolver as Mock).mockReset().mockImplementation(() => {
      calls.push('register');
      return resolverCleanup;
    });
    loadResolvedNxPluginAsync = vi.fn(async () => {
      calls.push('load');
      return { name: '@proj/plugin' };
    });
    (handleImport as Mock)
      .mockReset()
      .mockResolvedValue({ loadResolvedNxPluginAsync });
    (resolveNxPlugin as Mock).mockReset();
  });

  it('registers the source graph before loading a source plugin and releases it through the returned cleanup', async () => {
    (resolveNxPlugin as Mock).mockResolvedValue(resolved(true));

    const [pluginPromise, cleanup] = loadNxPlugin('@proj/plugin', root);

    await expect(pluginPromise).resolves.toEqual({ name: '@proj/plugin' });
    expect(registerSourceGraphResolver).toHaveBeenCalledWith(
      sourceEntry,
      root,
      packageNames
    );
    expect(calls).toEqual(['register', 'load']);
    expect(resolverCleanup).not.toHaveBeenCalled();

    cleanup();
    expect(resolverCleanup).toHaveBeenCalledTimes(1);
  });

  it('releases the source graph when the load fails and leaves the returned cleanup inert', async () => {
    (resolveNxPlugin as Mock).mockResolvedValue(resolved(true));
    const loadError = new Error('load failed');
    loadResolvedNxPluginAsync.mockRejectedValue(loadError);

    const [pluginPromise, cleanup] = loadNxPlugin('@proj/plugin', root);

    await expect(pluginPromise).rejects.toBe(loadError);
    expect(resolverCleanup).toHaveBeenCalledTimes(1);

    cleanup();
    expect(resolverCleanup).toHaveBeenCalledTimes(1);
  });

  it('adds the built-entry hint when a built plugin cannot resolve a workspace package', async () => {
    (resolveNxPlugin as Mock).mockResolvedValue(resolved(false));
    const notFound = Object.assign(
      new Error("Cannot find module '@proj/utils/sub'"),
      { code: 'MODULE_NOT_FOUND' }
    );
    loadResolvedNxPluginAsync.mockRejectedValue(notFound);

    const [pluginPromise] = loadNxPlugin('@proj/plugin', root);

    const error: Error = await pluginPromise.then(
      () => {
        throw new Error('expected rejection');
      },
      (e) => e
    );
    expect(error.message).toMatch(/^Cannot find module '@proj\/utils\/sub'/);
    expect(error.message).toContain(
      '"@proj/utils/sub" was requested from "packages/plugin/dist/index.js"'
    );
    expect(error.cause).toBe(notFound);
    expect(registerSourceGraphResolver).not.toHaveBeenCalled();
  });

  it('does not register a source graph for a built plugin', async () => {
    (resolveNxPlugin as Mock).mockResolvedValue(resolved(false));

    const [pluginPromise, cleanup] = loadNxPlugin('@proj/plugin', root);

    await expect(pluginPromise).resolves.toEqual({ name: '@proj/plugin' });
    expect(registerSourceGraphResolver).not.toHaveBeenCalled();

    cleanup();
    expect(resolverCleanup).not.toHaveBeenCalled();
  });
});
