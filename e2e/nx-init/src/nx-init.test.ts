import {
  cleanupProject,
  createNonNxProjectDirectory,
  getPackageManagerCommand,
  getSelectedPackageManager,
  renameFile,
  runCLI,
  runCommand,
  updateFile,
} from '@nrwl/e2e/utils';

describe('nx init', () => {
  const pmc = getPackageManagerCommand({
    packageManager: getSelectedPackageManager(),
  });

  afterEach(() => cleanupProject());

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

    runCommand(pmc.install);

    const output = runCommand(`${pmc.runUninstalledPackage} nx init -y`);
    expect(output).toContain('Enabled computation caching');

    expect(runCLI('run package:echo')).toContain('123');
    renameFile('nx.json', 'nx.json.old');

    expect(runCLI('run package:echo')).toContain('123');
  });
});
