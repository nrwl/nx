import {
  createNonNxProjectDirectory,
  runCLI,
  runCommand,
  tmpProjPath,
  updateFile,
} from '@nrwl/e2e/utils';
import { Workspaces } from 'nx/src/shared/workspace';

describe.each(['npx', 'pnpx --yes'])('%s add-nx-to-monorepo', (command) => {
  it('should not throw', () => {
    // Arrange
    createNonNxProjectDirectory();
    updateFile(
      'packages/package-a/package.json',
      JSON.stringify({
        name: 'package-a',
      })
    );
    updateFile(
      'packages/package-b/package.json',
      JSON.stringify({
        name: 'package-b',
      })
    );

    // Act
    const output = runCommand(`${command} add-nx-to-monorepo --nx-cloud false`);
    // Assert
    expect(output).toContain('🎉 Done!');
    expect(readWorkspaceConfig().projects['package-a']).toBeTruthy();
    expect(readWorkspaceConfig().projects['package-b']).toBeTruthy();
  });

  it('should build', () => {
    // Arrange
    createNonNxProjectDirectory();
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
    runCommand(`${command} add-nx-to-monorepo --nx-cloud false`);
    const output = runCLI('build package-a');
    // Assert
    expect(output).toContain('build successful');
  });
});

const readWorkspaceConfig = () =>
  new Workspaces(tmpProjPath()).readWorkspaceConfiguration();
