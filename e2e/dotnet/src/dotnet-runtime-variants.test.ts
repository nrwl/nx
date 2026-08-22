import {
  cleanupProject,
  newProject,
  runCLI,
  updateJson,
} from '@nx/e2e-utils';

import {
  createDotNetProject,
  enableMultiTargeting,
  updateProjectFile,
} from './utils/create-dotnet-project';

/**
 * Exercises the opt-in per-runtime-identifier target variants for multi-targeted
 * executables that declare RIDs (https://github.com/nrwl/nx/discussions/36676,
 * https://github.com/nrwl/nx/issues/33474).
 *
 * Assertions go through the real plugin + MSBuild analyzer via `show project`,
 * so no RID runtime pack is required to validate the generated task graph.
 */
describe('.NET Plugin - Runtime (RID) Variants', () => {
  beforeAll(() => {
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);

    updateJson('nx.json', (nxJson) => {
      nxJson.plugins = (nxJson.plugins ?? []).map((p: unknown) =>
        p === '@nx/dotnet'
          ? { plugin: '@nx/dotnet', options: { runtimeVariants: true } }
          : p
      );
      return nxJson;
    });

    createDotNetProject({ name: 'RidApp', type: 'console' });
    enableMultiTargeting('RidApp', ['net9.0', 'net10.0']);
    updateProjectFile('RidApp', (content) =>
      content.replace(
        '</PropertyGroup>',
        `  <RuntimeIdentifiers>linux-x64;win-x64</RuntimeIdentifiers>\n</PropertyGroup>`
      )
    );

    createDotNetProject({ name: 'NoRidApp', type: 'console' });
    enableMultiTargeting('NoRidApp', ['net9.0', 'net10.0']);
  });

  afterAll(() => cleanupProject());

  it('should generate a RID-specific release build and publish per declared RID', () => {
    const details = JSON.parse(runCLI(`show project RidApp --json`));

    expect(details.targets['build-net10.0-win-x64-release']).toBeDefined();
    expect(details.targets['publish-net10.0-win-x64']).toBeDefined();
    expect(details.targets['build-net10.0-linux-x64-release']).toBeDefined();
    expect(details.targets['publish-net10.0-linux-x64']).toBeDefined();
  });

  it('should pass --runtime to the RID variant command', () => {
    const details = JSON.parse(runCLI(`show project RidApp --json`));

    expect(details.targets['publish-net10.0-win-x64'].options.args).toEqual(
      expect.arrayContaining(['--runtime', 'win-x64', '--framework', 'net10.0'])
    );
  });

  it('should make the RID publish depend on the RID-specific build', () => {
    const details = JSON.parse(runCLI(`show project RidApp --json`));

    expect(details.targets['publish-net10.0-win-x64'].dependsOn).toContain(
      'build-net10.0-win-x64-release'
    );
  });

  it('should keep the RID release build self-contained', () => {
    const details = JSON.parse(runCLI(`show project RidApp --json`));

    const build = details.targets['build-net10.0-win-x64-release'];
    expect(build.dependsOn ?? []).not.toContain('^build');
    expect(build.options.args).not.toContain('--no-dependencies');
  });

  it('should scope RID outputs to a runtime-specific folder', () => {
    const details = JSON.parse(runCLI(`show project RidApp --json`));

    expect(details.targets['build-net10.0-win-x64-release'].outputs).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/bin\/Release\/net10\.0\/win-x64/),
      ])
    );
  });

  it('should record framework and runtime in RID variant metadata', () => {
    const details = JSON.parse(runCLI(`show project RidApp --json`));

    const metadata = details.targets['publish-net10.0-win-x64'].metadata;
    expect(metadata.targetFramework).toBe('net10.0');
    expect(metadata.runtimeIdentifier).toBe('win-x64');
  });

  it('should still generate framework build variants (runtime implies framework)', () => {
    const details = JSON.parse(runCLI(`show project RidApp --json`));

    expect(details.targets['build-net10.0']).toBeDefined();
    expect(details.targets['build-net9.0']).toBeDefined();
  });

  it('should not generate RID variants when no RIDs are declared', () => {
    const details = JSON.parse(runCLI(`show project NoRidApp --json`));

    const ridTargets = Object.keys(details.targets).filter(
      (name) => name.includes('win-x64') || name.includes('linux-x64')
    );
    expect(ridTargets).toEqual([]);
  });
});
