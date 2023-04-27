import {
  cleanupProject,
  createNonNxProjectDirectory,
  getPackageManagerCommand,
  getPublishedVersion,
  getSelectedPackageManager,
  renameFile,
  runCLI,
  runCommand,
  updateFile,
} from '@nx/e2e/utils';

describe('nx init (NPM repo)', () => {
  const pmc = getPackageManagerCommand({
    packageManager: getSelectedPackageManager(),
  });

  it('should work in a regular npm repo', () => {
    createNonNxProjectDirectory('regular-repo', false);
    updateFile(
      'package.json',
      JSON.stringify({
        name: 'package',
        scripts: {
          echo: 'echo 123',
        },
      })
    );

    runCommand(pmc.install);

    const output = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --cacheable=echo --no-interactive`
    );
    console.log(output);
    expect(output).toContain('Enabled computation caching');

    expect(runCLI('echo')).toContain('123');
    renameFile('nx.json', 'nx.json.old');

    expect(runCLI('echo')).toContain('123');
    cleanupProject();
  });

  it('should support compound scripts', () => {
    createNonNxProjectDirectory('regular-repo', false);
    updateFile(
      'package.json',
      JSON.stringify({
        name: 'package',
        scripts: {
          compound: 'echo HELLO && echo COMPOUND',
        },
      })
    );

    runCommand(pmc.install);

    runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --cacheable=compound --no-interactive`
    );

    const output = runCommand('npm run compound TEST');
    expect(output).toContain('HELLO\n');
    expect(output).toContain('COMPOUND TEST');
    expect(output).not.toContain('HELLO COMPOUND');
    cleanupProject();
  });
});
