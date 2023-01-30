import {
  cleanupProject,
  createNonNxProjectDirectory,
  getPackageManagerCommand,
  getPublishedVersion,
  getSelectedPackageManager,
  removeFile,
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

  it('should work in a monorepo', () => {
    createNonNxProjectDirectory('monorepo', true);
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

    const output = runCommand(
      `${pmc.runUninstalledPackage} nx@${getPublishedVersion()}  init -y`
    );
    expect(output).toContain('Enabled computation caching');

    expect(runCLI('run package:echo')).toContain('123');
    renameFile('nx.json', 'nx.json.old');

    expect(runCLI('run package:echo')).toContain('123');
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
      } nx@${getPublishedVersion()} init -y --cacheable=echo`
    );
    console.log(output);
    expect(output).toContain('Enabled computation caching');

    expect(runCLI('echo')).toContain('123');
    renameFile('nx.json', 'nx.json.old');

    expect(runCLI('echo')).toContain('123');
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
      } nx@${getPublishedVersion()} init -y --cacheable=compound`
    );

    const output = runCommand('npm run compound TEST');
    expect(output).toContain('HELLO\n');
    expect(output).toContain('COMPOUND TEST');
    expect(output).not.toContain('HELLO COMPOUND');
  });

  describe('encapsulated', () => {
    it('should support running targets in a encapsulated repo', () => {
      createNonNxProjectDirectory('encapsulated-repo', false);
      removeFile('package.json');
      updateFile(
        'projects/a/project.json',
        JSON.stringify({
          name: 'a',
          targets: {
            echo: {
              command: `echo 'Hello from A'`,
            },
          },
        })
      );
      const output = runCommand(
        `${pmc.runUninstalledPackage} nx@latest init --encapsulated`
      );
      expect(output).toContain('Setting Nx up in encapsulated mode');
      if (process.platform === 'win32') {
        expect(runCommand('./nx.bat echo a')).toContain('Hello from A');
      } else {
        expect(runCommand('./nx echo a')).toContain('Hello from A');
      }
    });
  });
});
