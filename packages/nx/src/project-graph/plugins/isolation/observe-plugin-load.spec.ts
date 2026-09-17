import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  nxModulesWarmedBeforeObserving,
  observePluginLoad,
} from './observe-plugin-load';

/** A module that reads one variable while it is being evaluated. */
function moduleReading(key: string): string {
  // Resolved, because the loader reports the real path and on macOS `tmpdir()`
  // is a symlink into `/private`.
  const file = join(
    realpathSync(mkdtempSync(join(tmpdir(), 'nx-warm-'))),
    'reader.cjs'
  );
  writeFileSync(file, `process.env['${key}'];\nmodule.exports = {};\n`);
  return file;
}

describe('observePluginLoad', () => {
  it('resolves every module it warms', () => {
    // A rename would leave the warm silently doing nothing, and the only sign
    // would be records that stop surviving between two commands.
    //
    // The `@nx/devkit` entries are resolved in a real Node process rather than
    // here, because this repository's test resolver answers for the
    // `@nx/nx-source` condition and points them at TypeScript entries that only
    // exist in the source tree, which is not the lookup a plugin worker
    // performs. The `nx/*` entries are the other way round; see below.
    const specifiers = nxModulesWarmedBeforeObserving();
    expect(specifiers.length).toBeGreaterThan(0);

    // Split by who can answer for them. A child process resolving `nx/src/*`
    // from inside `packages/nx` answers through this package's own `exports`,
    // which point at `dist` and so demand a build this spec has no reason to
    // need; in here the test resolver answers for the source tree. The
    // `@nx/devkit` entries are the other way round, which is what the child is
    // for.
    const [inThisProcess, inAChildProcess] = specifiers.reduce(
      ([ours, theirs], specifier) =>
        specifier.startsWith('nx/')
          ? [[...ours, specifier], theirs]
          : [ours, [...theirs, specifier]],
      [[], []] as [string[], string[]]
    );
    expect(inThisProcess.length).toBeGreaterThan(0);
    expect(inAChildProcess.length).toBeGreaterThan(0);

    for (const specifier of inThisProcess) {
      expect(() => require.resolve(specifier)).not.toThrow();
    }

    const script = `
      const { createRequire } = require('module');
      const from = createRequire(${JSON.stringify(__filename)});
      for (const s of ${JSON.stringify(inAChildProcess)}) from.resolve(s);
    `;
    expect(() =>
      execFileSync(process.execPath, ['-e', script], { stdio: 'pipe' })
    ).not.toThrow();
  });

  it('keeps what the warmed modules read out of the plugin’s reads', async () => {
    const warmed = moduleReading('NX_WARM_FIXTURE_A');

    const { envReads } = await observePluginLoad(
      async () => {
        require(warmed);
        return null;
      },
      __filename,
      [warmed]
    );

    // Nx reads `NX_TUI`, `CI` and `NX_CLOUD_ACCESS_TOKEN` as it imports, and a
    // plugin importing `@nx/devkit` reaches all of it. Recording those as the
    // plugin's own is what made records miss on the next command.
    expect(envReads.keys).not.toContain('NX_WARM_FIXTURE_A');
  });

  it('reports the files the load read alongside the environment', async () => {
    const read = moduleReading('NX_WARM_FIXTURE_C');

    const { result, sourceFiles, envReads } = await observePluginLoad(
      async () => {
        require(read);
        return 'loaded';
      },
      __filename,
      []
    );

    // One call answers with everything a record is checked against, so the
    // worker cannot watch a load with one observer and not the other.
    expect(result).toBe('loaded');
    expect(sourceFiles).toContain(read);
    expect(envReads.keys).toContain('NX_WARM_FIXTURE_C');
  });

  it('settles the copy the plugin resolves, not one beside Nx', async () => {
    // A bare specifier, so where it resolves from decides whether it resolves
    // at all. An absolute path would warm from anywhere and prove nothing.
    const pkgRoot = realpathSync(mkdtempSync(join(tmpdir(), 'nx-warm-pkg-')));
    const dep = join(pkgRoot, 'node_modules', 'warm-fixture');
    mkdirSync(dep, { recursive: true });
    writeFileSync(join(dep, 'package.json'), '{"name":"warm-fixture"}');
    writeFileSync(
      join(dep, 'index.js'),
      "process.env['NX_WARM_FIXTURE_D'];\nmodule.exports = {};\n"
    );
    const pluginFile = join(pkgRoot, 'plugin.js');
    writeFileSync(pluginFile, 'module.exports = {};\n');

    const reads = async (from: string) =>
      (
        await observePluginLoad(
          async () => {
            require(join(dep, 'index.js'));
            return null;
          },
          from,
          ['warm-fixture']
        )
      ).envReads.keys;

    // Resolved from the plugin, the dependency is reachable and settles.
    expect(await reads(pluginFile)).not.toContain('NX_WARM_FIXTURE_D');

    // Resolved from anywhere else it is not, which is the case a plugin with
    // its own `node_modules` would hit if the warm resolved against Nx.
    delete require.cache[join(dep, 'index.js')];
    expect(await reads(join(tmpdir(), 'elsewhere.js'))).toContain(
      'NX_WARM_FIXTURE_D'
    );
  });

  it('still records what the plugin itself read', async () => {
    const unwarmed = moduleReading('NX_WARM_FIXTURE_B');

    const { envReads } = await observePluginLoad(
      async () => {
        require(unwarmed);
        return null;
      },
      __filename,
      []
    );

    // The control for the test above. Warming has to narrow what is recorded,
    // not silence it.
    expect(envReads.keys).toContain('NX_WARM_FIXTURE_B');
  });
});
