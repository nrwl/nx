import {
  createNonNxProjectDirectory,
  readProjectConfig,
  runCommand,
  tmpProjPath,
  updateFile,
} from '@nrwl/e2e/utils';
import { Workspaces } from '@nrwl/tao/src/shared/workspace';

describe('add-nx-to-monorepo', () => {
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
    const output = runCommand('npx add-nx-to-monorepo');
    // Assert
    expect(output).toBeTruthy();
    expect(readWorkspaceConfig().projects['package-a']).toBeTruthy();
    expect(readWorkspaceConfig().projects['package-b']).toBeTruthy();
  });
});

const readWorkspaceConfig = () =>
  new Workspaces(tmpProjPath()).readWorkspaceConfiguration();
