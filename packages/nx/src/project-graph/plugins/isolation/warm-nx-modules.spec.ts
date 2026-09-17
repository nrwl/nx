import { mkdtempSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  nxModulesWarmedBeforeObserving,
  observePluginLoad,
} from './warm-nx-modules';

/** A module that reads one variable while it is being evaluated. */
function moduleReading(key: string): string {
  const file = join(mkdtempSync(join(tmpdir(), 'nx-warm-')), 'reader.cjs');
  writeFileSync(file, `process.env['${key}'];\nmodule.exports = {};\n`);
  return file;
}

describe('observePluginLoad', () => {
  it('resolves every module it warms', () => {
    // A rename would leave the warm silently doing nothing, and the only sign
    // would be records that stop surviving between two commands.
    const requireFrom = createRequire(join(__dirname, 'warm-nx-modules.ts'));

    expect(nxModulesWarmedBeforeObserving().length).toBeGreaterThan(0);
    for (const specifier of nxModulesWarmedBeforeObserving()) {
      expect(() => requireFrom.resolve(specifier)).not.toThrow();
    }
  });

  it('keeps what the warmed modules read out of the plugin’s reads', async () => {
    const warmed = moduleReading('NX_WARM_FIXTURE_A');

    const { envReads } = await observePluginLoad(async () => {
      require(warmed);
      return null;
    }, [warmed]);

    // Nx reads `NX_TUI`, `CI` and `NX_CLOUD_ACCESS_TOKEN` as it imports, and a
    // plugin importing `@nx/devkit` reaches all of it. Recording those as the
    // plugin's own is what made records miss on the next command.
    expect(envReads.keys).not.toContain('NX_WARM_FIXTURE_A');
  });

  it('still records what the plugin itself read', async () => {
    const unwarmed = moduleReading('NX_WARM_FIXTURE_B');

    const { envReads } = await observePluginLoad(async () => {
      require(unwarmed);
      return null;
    }, []);

    // The control for the test above. Warming has to narrow what is recorded,
    // not silence it.
    expect(envReads.keys).toContain('NX_WARM_FIXTURE_B');
  });
});
