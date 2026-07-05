import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TempFs } from '../../internal-testing-utils/temp-fs';

// Regression tests for intermittent "Source project does not exist: npm:<pkg>"
// graph failures caused by stale/corrupted lockfile caches in
// .nx/workspace-data (see #27213, #30416). The plugin must never fail graph
// construction because of bad cache state - it reprocesses or degrades
// gracefully instead.

const LOCKFILE = JSON.stringify({
  name: 'repro',
  version: '1.0.0',
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': {
      name: 'repro',
      version: '1.0.0',
      dependencies: { autoprefixer: '^10.0.0' },
    },
    'node_modules/autoprefixer': {
      version: '10.4.0',
      resolved:
        'https://registry.npmjs.org/autoprefixer/-/autoprefixer-10.4.0.tgz',
      integrity: 'sha512-autoprefixer',
      dependencies: { picocolors: '^1.0.0' },
    },
    'node_modules/picocolors': {
      version: '1.0.0',
      resolved: 'https://registry.npmjs.org/picocolors/-/picocolors-1.0.0.tgz',
      integrity: 'sha512-picocolors',
    },
  },
});

const LOCKFILE_WITHOUT_AUTOPREFIXER = JSON.stringify({
  name: 'repro',
  version: '1.0.0',
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': { name: 'repro', version: '1.0.0' },
  },
});

describe('js plugin lockfile cache resilience', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('js-lockfile-cache');
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'repro', version: '1.0.0' }),
      'package-lock.json': LOCKFILE,
    });
  });

  afterEach(() => {
    fs.cleanup();
  });

  async function runPlugin(fn: (harness: any) => Promise<void>) {
    await jest.isolateModulesAsync(async () => {
      const { setWorkspaceRoot } = require('../../utils/workspace-root');
      setWorkspaceRoot(fs.tempDir);
      const plugin = require('./index');
      const { hashArray } = require('../../hasher/file-hasher');
      const { nxVersion } = require('../../utils/versions');
      const { workspaceDataDirectory } = require('../../utils/cache-directory');

      const createNodesContext = {
        workspaceRoot: fs.tempDir,
        nxJsonConfiguration: {},
        configFiles: [],
      };

      const runCreateNodes = async () => {
        const results = await plugin.createNodes[1](
          ['package-lock.json'],
          undefined,
          createNodesContext
        );
        return results[0][1].externalNodes;
      };

      const runCreateDependencies = async (externalNodes: any) =>
        plugin.createDependencies(undefined, {
          externalNodes,
          projects: {},
          nxJsonConfiguration: {},
          workspaceRoot: fs.tempDir,
          fileMap: { projectFileMap: {}, nonProjectFiles: [] },
          filesToProcess: { projectFileMap: {}, nonProjectFiles: [] },
        });

      const lockFileHash = (contents: string) =>
        hashArray([nxVersion, contents]);

      await fn({
        runCreateNodes,
        runCreateDependencies,
        lockFileHash,
        nodesCachePath: join(
          workspaceDataDirectory,
          'parsed-lock-file.nodes.json'
        ),
        depsCachePath: join(
          workspaceDataDirectory,
          'parsed-lock-file.dependencies.json'
        ),
      });
    });
  }

  it('computes dependencies and reuses caches on a second run', async () => {
    await runPlugin(async (h) => {
      const externalNodes = await h.runCreateNodes();
      expect(externalNodes['npm:autoprefixer']).toBeDefined();
      const deps = await h.runCreateDependencies(externalNodes);
      expect(deps).toContainEqual(
        expect.objectContaining({
          source: 'npm:autoprefixer',
          target: 'npm:picocolors',
        })
      );
    });
    // Second run in a fresh module registry - both phases served from cache
    await runPlugin(async (h) => {
      const externalNodes = await h.runCreateNodes();
      expect(externalNodes['npm:autoprefixer']).toBeDefined();
      const deps = await h.runCreateDependencies(externalNodes);
      expect(deps).toContainEqual(
        expect.objectContaining({
          source: 'npm:autoprefixer',
          target: 'npm:picocolors',
        })
      );
    });
  });

  it('self-heals when the cached dependencies reference nodes that do not exist', async () => {
    await runPlugin(async (h) => {
      const externalNodes = await h.runCreateNodes();
      // Poison the deps cache: valid shape, hash claiming the current
      // lockfile, but edges referencing a package that is not in the graph.
      // This is the persistent on-disk state left behind by interrupted or
      // racing processes before caches became atomic and self-describing.
      writeFileSync(
        h.depsCachePath,
        JSON.stringify({
          lockFileHash: h.lockFileHash(
            readFileSync(join(fs.tempDir, 'package-lock.json'), 'utf-8')
          ),
          dependencies: [
            { source: 'npm:ghost', target: 'npm:picocolors', type: 'static' },
          ],
        })
      );

      const deps = await h.runCreateDependencies(externalNodes);
      expect(deps).not.toContainEqual(
        expect.objectContaining({ source: 'npm:ghost' })
      );
      expect(deps).toContainEqual(
        expect.objectContaining({
          source: 'npm:autoprefixer',
          target: 'npm:picocolors',
        })
      );
      // Cache was rewritten with the reparsed result
      const rewritten = JSON.parse(readFileSync(h.depsCachePath, 'utf-8'));
      expect(rewritten.dependencies).not.toContainEqual(
        expect.objectContaining({ source: 'npm:ghost' })
      );
    });
  });

  it('reprocesses when cache files are truncated or corrupted', async () => {
    await runPlugin(async (h) => {
      const externalNodes = await h.runCreateNodes();
      await h.runCreateDependencies(externalNodes);
      // Simulate torn writes from a killed process
      writeFileSync(h.nodesCachePath, '{"lockFileHash":"abc","nod');
      writeFileSync(h.depsCachePath, '');
    });
    await runPlugin(async (h) => {
      const externalNodes = await h.runCreateNodes();
      expect(externalNodes['npm:autoprefixer']).toBeDefined();
      const deps = await h.runCreateDependencies(externalNodes);
      expect(deps).toContainEqual(
        expect.objectContaining({
          source: 'npm:autoprefixer',
          target: 'npm:picocolors',
        })
      );
    });
  });

  it('does not fail the graph when the lockfile changes between createNodes and createDependencies', async () => {
    await runPlugin(async (h) => {
      fs.createFileSync('package-lock.json', LOCKFILE_WITHOUT_AUTOPREFIXER);
      const externalNodes = await h.runCreateNodes();
      expect(externalNodes['npm:autoprefixer']).toBeUndefined();

      // Lockfile rewritten mid-flight (e.g. npm install still running)
      fs.createFileSync('package-lock.json', LOCKFILE);

      const deps = await h.runCreateDependencies(externalNodes);
      // Must not throw, and must not emit edges referencing nodes the
      // graph does not have
      for (const dep of deps) {
        expect(externalNodes[dep.source] ?? dep.source).toBeTruthy();
        expect(
          externalNodes[dep.source] !== undefined ||
            !dep.source.startsWith('npm:')
        ).toBe(true);
      }
    });
  });
});
