import {
  cleanupProject,
  e2eCwd,
  getPnpmVersion,
  getSelectedPackageManager,
  readFile,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

describe('create-nx-workspace --preset=<third-party package>', () => {
  // pnpm 11 is the first version that fails installs on unreviewed build
  // scripts; older versions warn and skip, so there is nothing to record.
  const pnpmMajor = +(getPnpmVersion()?.split('.')[0] ?? 0);
  const itOnPnpm11 =
    getSelectedPackageManager() === 'pnpm' && pnpmMajor >= 11 ? it : it.skip;

  afterEach(() => cleanupProject());

  itOnPnpm11(
    'should record the build-script decisions the preset declares before the first install',
    () => {
      const preset = publishPreset({
        dependencies: { esbuild: '0.25.0' },
        pnpm: { allowBuilds: { esbuild: false } },
      });

      runCreateWorkspace(uniq('ws'), {
        preset: `${preset.name}@${preset.version}`,
        packageManager: 'pnpm',
      });

      expect(readFile('pnpm-workspace.yaml')).toContain('esbuild: false');
      expect(
        JSON.parse(readFile('node_modules/esbuild/package.json')).version
      ).toBe('0.25.0');
    }
  );
});

/**
 * Publishes a minimal preset package to the e2e registry: a `preset`
 * generator that changes nothing, plus whatever package.json fields the
 * test needs.
 */
function publishPreset(packageJson: Record<string, unknown>): {
  name: string;
  version: string;
} {
  const name = uniq('preset');
  const version = '1.0.0';
  const dir = join(e2eCwd, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      { name, version, generators: './generators.json', ...packageJson },
      null,
      2
    )
  );
  writeFileSync(
    join(dir, 'generators.json'),
    JSON.stringify({
      generators: {
        preset: { factory: './preset', schema: './schema.json' },
      },
    })
  );
  writeFileSync(
    join(dir, 'schema.json'),
    JSON.stringify({
      $schema: 'https://json-schema.org/schema',
      type: 'object',
      properties: {},
    })
  );
  writeFileSync(
    join(dir, 'preset.js'),
    'module.exports = async function preset() {};\nmodule.exports.default = module.exports;\n'
  );
  execSync('npm publish', { cwd: dir, stdio: 'pipe', env: process.env });
  return { name, version };
}
