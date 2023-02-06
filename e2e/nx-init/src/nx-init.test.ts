import { NxJsonConfiguration } from '@nrwl/devkit';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createNonNxProjectDirectory,
  getPackageManagerCommand,
  getPublishedVersion,
  getSelectedPackageManager,
  newEncapsulatedNxWorkspace,
  removeFile,
  renameFile,
  runCLI,
  runCommand,
  updateFile,
  updateJson,
} from '@nrwl/e2e/utils';

describe('nx init', () => {
  const pmc = getPackageManagerCommand({
    packageManager: getSelectedPackageManager(),
  });

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
    cleanupProject();
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
      } nx@${getPublishedVersion()} init -y --cacheable=compound`
    );

    const output = runCommand('npm run compound TEST');
    expect(output).toContain('HELLO\n');
    expect(output).toContain('COMPOUND TEST');
    expect(output).not.toContain('HELLO COMPOUND');
    cleanupProject();
  });

  describe('encapsulated', () => {
    it('should support running targets in a encapsulated repo', () => {
      const runEncapsulatedNx = newEncapsulatedNxWorkspace();
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

      updateJson<NxJsonConfiguration>('nx.json', (json) => ({
        ...json,
        tasksRunnerOptions: {
          default: {
            ...json.tasksRunnerOptions['default'],
            options: {
              ...json.tasksRunnerOptions['default'].options,
              cacheableOperations: ['echo'],
            },
          },
        },
      }));

      expect(runEncapsulatedNx('echo a')).toContain('Hello from A');

      expect(runEncapsulatedNx('echo a')).toContain(
        'Nx read the output from the cache instead of running the command for 1 out of 1 tasks'
      );

      expect(() =>
        checkFilesDoNotExist(
          'node_modules',
          'package.json',
          'package-lock.json',
          'yarn-lock.json',
          'pnpm-lock.yaml'
        )
      ).not.toThrow();
      expect(() =>
        checkFilesExist(
          '.nx/installation/package.json',
          '.nx/installation/package-lock.json',
          '.nx/cache/terminalOutputs'
        )
      ).not.toThrow();
    });
    cleanupProject({
      skipReset: true,
    });
  });
});
