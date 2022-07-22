import {
  createNonNxProjectDirectory,
  getPackageManagerCommand,
  getSelectedPackageManager,
  renameFile,
  runCLI,
  runCommand,
  updateFile,
} from '@nrwl/e2e/utils';

describe('nx init', () => {
  const packageManagerCommand = getPackageManagerCommand({
    packageManager: getSelectedPackageManager(),
  }).runUninstalledPackage;

  it('should work', () => {
    createNonNxProjectDirectory();
    updateFile(
      'packages/package/package.json',
      JSON.stringify({
        name: 'package',
        scripts: {
          echo: 'echo 123',
        },
      })
    );

    const output = runCommand(`${packageManagerCommand} nx init`);
    expect(output).toContain('Nx has been installed');
    expect(output).toContain('nx.json has been created');

    expect(runCLI('run package:echo')).toContain('123');
    renameFile('nx.json', 'nx.json.old');

    expect(runCLI('run package:echo')).toContain('123');
  });
});
