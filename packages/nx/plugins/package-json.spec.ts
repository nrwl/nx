import '../src/internal-testing-utils/mock-fs';

import { join } from 'node:path';
import { vol } from 'memfs';
import type { ProjectConfiguration } from '../src/config/workspace-json-project-json';
import { createNodes as createDefaultNodes } from '../src/plugins/package-json';
import { workspaceDataDirectory } from '../src/utils/cache-directory';
import { hasNxJsPlugin } from '../src/utils/has-nx-js-plugin';
import { PluginCache } from '../src/utils/plugin-cache-utils';
import { getFileHashesInContext } from '../src/utils/workspace-context';
import * as fileUtils from '../src/utils/fileutils';
import { createNodes, readPackageJsonConfigurationCache } from './package-json';

vi.mock('../src/utils/workspace-context', () => ({
  getFileHashesInContext: vi.fn().mockResolvedValue([]),
}));
vi.mock('../src/utils/has-nx-js-plugin', () => ({
  hasNxJsPlugin: vi.fn().mockReturnValue(true),
}));

describe('all-package-jsons plugin cache API', () => {
  const context = { workspaceRoot: '/root', nxJsonConfiguration: {} };
  const configFiles = ['packages/a/package.json', 'packages/b/package.json'];
  const defaultCachePath = join(workspaceDataDirectory, 'package-json.hash');
  const allCachePath = join(workspaceDataDirectory, 'all-package-jsons.hash');

  beforeEach(() => {
    vol.fromJSON(
      {
        'package-lock.json': '{}',
        'package.json': JSON.stringify({ workspaces: ['packages/a'] }),
        'packages/a/package.json': JSON.stringify({ name: 'a' }),
        'packages/b/package.json': JSON.stringify({ name: 'b' }),
      },
      '/root'
    );
    vi.mocked(getFileHashesInContext).mockReset().mockResolvedValue([]);
    vi.mocked(hasNxJsPlugin).mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vol.reset();
  });

  it('reads the all-package-jsons cache and preserves the exported PluginCache API', async () => {
    await createDefaultNodes[1](configFiles, undefined, context);
    const defaultCache = vol.readFileSync(defaultCachePath, 'utf8');
    await createNodes[1](configFiles, undefined, context);

    const cache: PluginCache<ProjectConfiguration> =
      readPackageJsonConfigurationCache();
    expect(cache).toBeInstanceOf(PluginCache);
    expect(
      Object.values(cache.toSerializable().entries)
        .map((project) => project.root)
        .sort()
    ).toEqual(['packages/a', 'packages/b']);

    const key = Object.entries(cache.toSerializable().entries).find(
      ([, project]) => project.root === 'packages/a'
    )[0];
    expect(cache.has(key)).toBe(true);
    expect(cache.get(key)).toEqual(
      expect.objectContaining({ root: 'packages/a' })
    );
    const project = { root: 'packages/extra', name: 'extra' };
    cache.set('extra', project);
    expect(cache.get('extra')).toEqual(project);
    cache.writeToDisk();

    expect(readPackageJsonConfigurationCache().get('extra')).toEqual(project);
    expect(
      JSON.parse(vol.readFileSync(allCachePath, 'utf8').toString()).entries
        .extra
    ).toEqual(project);
    expect(vol.readFileSync(defaultCachePath, 'utf8')).toEqual(defaultCache);
  });

  it('rebuilds plain entries written through the public API before reusing inference', async () => {
    const first = await createNodes[1](configFiles, undefined, context);
    expect(
      first[0][1].projects['packages/a'].targets['nx-release-publish']
    ).toBeDefined();
    readPackageJsonConfigurationCache().writeToDisk();
    vi.mocked(hasNxJsPlugin).mockReturnValue(false);

    const updated = await createNodes[1](configFiles, undefined, context);
    expect(
      updated[0][1].projects['packages/a'].targets['nx-release-publish']
    ).toBeUndefined();
    const entries = JSON.parse(
      vol.readFileSync(allCachePath, 'utf8').toString()
    ).entries;
    expect(
      Object.values(entries).map((entry: any) => entry.hasNxJsPlugin)
    ).toEqual([false, false]);
  });

  it('skips an unchanged warm write and persists an invalidating change', async () => {
    const writeCache = vi.spyOn(PluginCache.prototype, 'writeToDisk');
    const readJson = vi.spyOn(fileUtils, 'readJsonFile');
    vi.mocked(getFileHashesInContext).mockResolvedValue([
      'package-a-v1',
      'project-a',
      'package-b',
      'project-b',
    ]);
    await createNodes[1](configFiles, undefined, context);
    expect(writeCache).toHaveBeenCalledOnce();
    writeCache.mockClear();
    readJson.mockClear();

    await createNodes[1](configFiles, undefined, context);
    expect(writeCache).not.toHaveBeenCalled();
    for (const file of configFiles) {
      expect(readJson).not.toHaveBeenCalledWith(join('/root', file));
    }

    vol.writeFileSync(
      '/root/packages/a/package.json',
      JSON.stringify({ name: 'a', nx: { tags: ['changed'] } })
    );
    vi.mocked(getFileHashesInContext).mockResolvedValue([
      'package-a-v2',
      'project-a',
      'package-b',
      'project-b',
    ]);
    const updated = await createNodes[1](configFiles, undefined, context);
    expect(updated[0][1].projects['packages/a'].tags).toContain('changed');
    expect(writeCache).toHaveBeenCalledOnce();
  });
});
