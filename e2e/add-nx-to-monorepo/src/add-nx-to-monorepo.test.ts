import {
  createNonNxProjectDirectory,
  runCLI,
  runCommand,
  updateFile,
  getPackageManagerCommand,
  getSelectedPackageManager,
  getPublishedVersion,
} from '@nrwl/e2e/utils';

describe('add-nx-to-monorepo', () => {
  const pmc = getPackageManagerCommand({
    packageManager: getSelectedPackageManager(),
  });

  it('should not throw', () => {
    if (pmc.runUninstalledPackage) {
      // Arrange
      createNonNxProjectDirectory();
      runCommand(pmc.install);
      updateFile(
        'packages/package-a/package.json',
        JSON.stringify({
          name: 'package-a',
          scripts: {
            serve: 'some serve',
            build: 'some build',
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

      // Act
      const output = runCommand(
        `${
          pmc.runUninstalledPackage
        } add-nx-to-monorepo@${getPublishedVersion()} -y`
      );
      // Assert
      expect(output).toContain('🎉 Done!');
    }
  });

  it('should build', () => {
    if (pmc.runUninstalledPackage) {
      // Arrange
      createNonNxProjectDirectory();
      runCommand(pmc.runUninstalledPackage);
      updateFile(
        'packages/package-a/package.json',
        JSON.stringify({
          name: 'package-a',
          scripts: {
            build: 'echo "build successful"',
          },
        })
      );

      // Act
      runCommand(
        `${
          pmc.runUninstalledPackage
        } add-nx-to-monorepo@${getPublishedVersion()} -y`
      );
      const output = runCLI('build package-a');
      // Assert
      expect(output).toContain('build successful');
    }
  });
});
