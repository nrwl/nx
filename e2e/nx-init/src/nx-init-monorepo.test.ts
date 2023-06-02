import {
  createNonNxProjectDirectory,
  getPackageManagerCommand,
  getPublishedVersion,
  getSelectedPackageManager,
  runCLI,
  runCommand,
  updateFile,
} from '@nx/e2e/utils';

describe('nx init (Monorepo)', () => {
  const pmc = getPackageManagerCommand({
    packageManager: getSelectedPackageManager(),
  });

  it('should convert to an Nx workspace', () => {
    createNonNxProjectDirectory();
    runCommand(pmc.install);
    updateFile(
      'packages/package-a/package.json',
      JSON.stringify({
        name: 'package-a',
        scripts: {
          serve: 'some serve',
          build: 'echo "build successful"',
          test: 'some test',
        },
      })
    );
    updateFile(
      'packages/package-b/package.json',
      JSON.stringify({
        name: 'package-b',
        scripts: {
          lint: 'some lint',
        },
      })
    );

    const output = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --cacheable=build --no-interactive`
    );

    expect(output).toContain('🎉 Done!');
    // check build
    const buildOutput = runCLI('build package-a');
    expect(buildOutput).toContain('build successful');
    // run build again for cache
    const cachedBuildOutput = runCLI('build package-a');
    expect(cachedBuildOutput).toContain('build successful');
    expect(cachedBuildOutput).toContain('Nx read the output from the cache');
  });
});
