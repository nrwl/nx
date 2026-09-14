import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { TempFs } from '../../internal-testing-utils/temp-fs';
import { getWorkspacePackagesMetadata } from '../../plugins/js/utils/packages';
import {
  clearProjectsWithoutPluginInferenceCache,
  retrieveProjectConfigurationsWithoutPluginInference,
} from '../../project-graph/utils/retrieve-workspace-files';
import { resetWorkspaceContext } from '../../utils/workspace-context';
import {
  resetWorkspacePackageNames,
  updateWorkspacePackageNames,
} from './workspace-package-names';

describe('updateWorkspacePackageNames', () => {
  let fs: TempFs;
  const manifest = (name: string) => JSON.stringify({ name });
  const sorted = (result: { names: string[] } | null) =>
    [...(result?.names ?? [])].sort();

  beforeEach(() => {
    fs = new TempFs('workspace-package-names');
    resetWorkspacePackageNames();
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      'packages/a/package.json': manifest('@proj/a'),
      'tools/t/package.json': manifest('@proj/t'),
    });
    resetWorkspaceContext(fs.tempDir);
  });

  afterEach(() => {
    fs.cleanup();
  });

  function update(updated: string[] = [], deleted: string[] = []) {
    return updateWorkspacePackageNames(
      fs.tempDir,
      updated,
      deleted,
      () => true
    );
  }

  // What the graph will hold once the package-json plugin has run.
  async function namesFromDiscovery(): Promise<string[]> {
    resetWorkspaceContext(fs.tempDir);
    clearProjectsWithoutPluginInferenceCache();
    return getWorkspacePackagesMetadata(
      await retrieveProjectConfigurationsWithoutPluginInference(fs.tempDir)
    ).packageManagerWorkspacePackageNames.sort();
  }

  it('follows manifest additions, renames and deletions ahead of the graph', async () => {
    const seeded = await update();
    expect(sorted(seeded)).toEqual(['@proj/a']);
    expect(seeded.version).toBe(1);

    fs.createFileSync('packages/b/package.json', manifest('@proj/b'));
    const added = await update(['packages/b/package.json']);
    expect(sorted(added)).toEqual(['@proj/a', '@proj/b']);
    expect(added.version).toBe(2);
    expect(sorted(added)).toEqual(await namesFromDiscovery());

    // A stale compute leaves its changes for the next one, which replays them.
    expect(await update(['packages/b/package.json'])).toBe(added);
    // An ordinary edit republishes nothing.
    expect(await update(['packages/a/index.js'])).toBe(added);

    fs.createFileSync('tools/u/package.json', manifest('@proj/u'));
    expect(sorted(await update(['tools/u/package.json']))).toEqual([
      '@proj/a',
      '@proj/b',
    ]);

    writeFileSync(
      join(fs.tempDir, 'packages/b/package.json'),
      manifest('@proj/b2')
    );
    const renamed = await update(['packages/b/package.json']);
    expect(sorted(renamed)).toEqual(['@proj/a', '@proj/b2']);
    expect(sorted(renamed)).toEqual(await namesFromDiscovery());

    rmSync(join(fs.tempDir, 'packages/b'), { recursive: true });
    const deleted = await update([], ['packages/b/package.json']);
    expect(sorted(deleted)).toEqual(['@proj/a']);
    expect(deleted.version).toBe(4);
    expect(sorted(deleted)).toEqual(await namesFromDiscovery());
  });

  it('keeps the set when a changed manifest cannot be read, then rescans', async () => {
    const seeded = await update();
    writeFileSync(join(fs.tempDir, 'packages/a/package.json'), '{');
    fs.createFileSync('packages/b/package.json', manifest('@proj/b'));
    resetWorkspaceContext(fs.tempDir);

    expect(
      await update(['packages/a/package.json', 'packages/b/package.json'])
    ).toBe(seeded);

    // The compute drained that batch; the repair alone must still surface b.
    writeFileSync(
      join(fs.tempDir, 'packages/a/package.json'),
      manifest('@proj/a')
    );
    expect(sorted(await update(['packages/a/package.json']))).toEqual([
      '@proj/a',
      '@proj/b',
    ]);
  });

  it('keeps the set when a rescan meets a manifest it cannot read', async () => {
    const seeded = await update();
    fs.createFileSync('packages/b/package.json', '{');
    writeFileSync(
      join(fs.tempDir, 'pnpm-workspace.yaml'),
      'packages:\n  - packages/*\n  - tools/*\n'
    );
    resetWorkspaceContext(fs.tempDir);

    expect(await update(['pnpm-workspace.yaml'])).toBe(seeded);

    // Repaired, the next compute picks the whole set up.
    writeFileSync(
      join(fs.tempDir, 'packages/b/package.json'),
      manifest('@proj/b')
    );
    expect(sorted(await update(['packages/b/package.json']))).toEqual([
      '@proj/a',
      '@proj/b',
      '@proj/t',
    ]);
  });

  it('keeps the set when a workspace glob source cannot be parsed', async () => {
    const seeded = await update();
    writeFileSync(join(fs.tempDir, 'package.json'), '{');

    expect(await update(['package.json'])).toBe(seeded);

    writeFileSync(
      join(fs.tempDir, 'package.json'),
      JSON.stringify({ name: 'root' })
    );
    expect(await update(['package.json'])).toBe(seeded);
  });

  it('does not republish a batch that leaves the set unchanged', async () => {
    fs.createFileSync('packages/b/package.json', manifest('@proj/b'));
    resetWorkspaceContext(fs.tempDir);
    const seeded = await update();
    expect(sorted(seeded)).toEqual(['@proj/a', '@proj/b']);

    writeFileSync(
      join(fs.tempDir, 'packages/a/package.json'),
      manifest('@proj/b')
    );
    writeFileSync(
      join(fs.tempDir, 'packages/b/package.json'),
      manifest('@proj/a')
    );

    expect(
      await update(['packages/a/package.json', 'packages/b/package.json'])
    ).toBe(seeded);
  });

  it('keeps versions monotonic across a reset', async () => {
    const seeded = await update();
    resetWorkspacePackageNames();
    fs.createFileSync('packages/b/package.json', manifest('@proj/b'));
    resetWorkspaceContext(fs.tempDir);

    const rescanned = await update(['packages/b/package.json']);

    expect(rescanned.version).toBe(seeded.version + 1);
  });

  it('rescans when a workspace glob source changes', async () => {
    await update();
    writeFileSync(
      join(fs.tempDir, 'pnpm-workspace.yaml'),
      'packages:\n  - packages/*\n  - tools/*\n'
    );
    resetWorkspaceContext(fs.tempDir);

    const result = await update(['pnpm-workspace.yaml']);

    expect(sorted(result)).toEqual(['@proj/a', '@proj/t']);
    expect(sorted(result)).toEqual(await namesFromDiscovery());
  });

  it('drops a rescan that lost to a newer recomputation', async () => {
    const seeded = await update();
    writeFileSync(
      join(fs.tempDir, 'pnpm-workspace.yaml'),
      'packages:\n  - packages/*\n  - tools/*\n'
    );
    resetWorkspaceContext(fs.tempDir);

    await expect(
      updateWorkspacePackageNames(
        fs.tempDir,
        ['pnpm-workspace.yaml'],
        [],
        () => false
      )
    ).resolves.toBeNull();

    expect(await update()).toBe(seeded);
  });
});
