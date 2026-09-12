import {
  cleanupProject,
  newProject,
  runCLI,
  tmpProjPath,
  updateJson,
  checkFilesMatchingPatternExist,
} from '@nx/e2e-utils';

import {
  createDotNetProject,
  enableMultiTargeting,
} from './utils/create-dotnet-project';

/**
 * Exercises the opt-in per-target-framework target variants for multi-targeted
 * projects (https://github.com/nrwl/nx/discussions/36676).
 *
 * The graph assertions go through the real plugin + MSBuild analyzer, so they
 * validate that a multi-targeted project produces correctly-named, correctly-wired
 * framework variants while leaving the unqualified targets in place. Frameworks
 * are chosen so evaluation does not require an extra workload.
 */
describe('.NET Plugin - Framework Variants', () => {
  beforeAll(() => {
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);

    // Opt in to framework variants by configuring the plugin.
    updateJson('nx.json', (nxJson) => {
      nxJson.plugins = (nxJson.plugins ?? []).map((p: unknown) =>
        p === '@nx/dotnet'
          ? { plugin: '@nx/dotnet', options: { frameworkVariants: true } }
          : p
      );
      return nxJson;
    });

    createDotNetProject({ name: 'MultiApp', type: 'console' });
    enableMultiTargeting('MultiApp', ['net9.0', 'net10.0']);

    createDotNetProject({ name: 'SingleApp', type: 'console' });

    runCLI('run-many -t restore');
  });

  afterAll(() => cleanupProject());

  it('should generate a build variant per target framework', () => {
    const details = JSON.parse(runCLI(`show project MultiApp --json`));

    expect(details.targets['build-net9.0']).toBeDefined();
    expect(details.targets['build-net10.0']).toBeDefined();

    // Unqualified targets are preserved.
    expect(details.targets.build).toBeDefined();
    expect(details.targets['build:release']).toBeDefined();
  });

  it('should pass --framework to the variant command', () => {
    const details = JSON.parse(runCLI(`show project MultiApp --json`));

    const args = details.targets['build-net10.0'].options.args;
    expect(args).toEqual(
      expect.arrayContaining(['--framework', 'net10.0'])
    );
  });

  it('should scope variant outputs to the framework', () => {
    const details = JSON.parse(runCLI(`show project MultiApp --json`));

    expect(details.targets['build-net10.0'].outputs).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/net10\.0/),
      ])
    );
    // A different framework's directory must not appear in this variant.
    for (const output of details.targets['build-net10.0'].outputs) {
      expect(output).not.toMatch(/net9\.0/);
    }
  });

  it('should generate a self-contained build variant (no aggregate build dependency)', () => {
    const details = JSON.parse(runCLI(`show project MultiApp --json`));

    const variant = details.targets['build-net10.0'];
    // Self-contained: no dependsOn on the aggregate build, and no --no-dependencies.
    expect(variant.dependsOn ?? []).not.toContain('^build');
    expect(variant.options.args).not.toContain('--no-dependencies');
  });

  it('should record the target framework in variant metadata', () => {
    const details = JSON.parse(runCLI(`show project MultiApp --json`));

    expect(details.targets['build-net10.0'].metadata.targetFramework).toBe(
      'net10.0'
    );
    expect(details.targets['build-net10.0'].metadata.frameworkVariantOf).toBe(
      'build'
    );
  });

  it('should never use a colon-ambiguous variant target name', () => {
    const details = JSON.parse(runCLI(`show project MultiApp --json`));

    const variantNames = Object.keys(details.targets).filter((name) =>
      name.includes('net10.0')
    );
    expect(variantNames.length).toBeGreaterThan(0);
    for (const name of variantNames) {
      expect(name).not.toContain(':');
    }
  });

  it('should not generate variants for single-targeted projects', () => {
    const details = JSON.parse(runCLI(`show project SingleApp --json`));

    const variantNames = Object.keys(details.targets).filter((name) =>
      /^build-net/.test(name)
    );
    expect(variantNames).toEqual([]);
  });

  it('should build a single framework variant in isolation', () => {
    const output = runCLI('build-net10.0 MultiApp', {
      verbose: true,
      env: { NX_DAEMON: 'false' },
    });
    expect(output).toContain('Build succeeded');

    checkFilesMatchingPatternExist(
      '.*/MultiApp.dll',
      tmpProjPath('MultiApp/bin/Debug/net10.0')
    );
  });
});
