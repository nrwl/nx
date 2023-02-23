import type { NxJsonConfiguration } from '@nrwl/devkit';
import {
  newEncapsulatedNxWorkspace,
  updateFile,
  updateJson,
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getPublishedVersion,
  uniq,
} from '@nrwl/e2e/utils';
import { bold } from 'chalk';

describe('encapsulated nx', () => {
  let runEncapsulatedNx: ReturnType<typeof newEncapsulatedNxWorkspace>;

  beforeAll(() => {
    runEncapsulatedNx = newEncapsulatedNxWorkspace();
  });

  afterAll(() => {
    cleanupProject({
      skipReset: true,
    });
  });

  it('should support running targets in a encapsulated repo', () => {
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

    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.tasksRunnerOptions.default.options.cacheableOperations = ['echo'];
      json.installation.plugins = {
        '@nrwl/nest': getPublishedVersion(),
      };
      return json;
    });

    expect(runEncapsulatedNx('echo a')).toContain('Hello from A');

    expect(runEncapsulatedNx('echo a')).toContain(
      'Nx read the output from the cache instead of running the command for 1 out of 1 tasks'
    );

    assertNoRootPackages();
    expect(() =>
      checkFilesExist(
        '.nx/installation/package.json',
        '.nx/installation/package-lock.json',
        '.nx/cache/terminalOutputs'
      )
    ).not.toThrow();
  });

  it('should work with nx report', () => {
    const output = runEncapsulatedNx('report');
    expect(output).toMatch(new RegExp(`nx.*:.*${getPublishedVersion()}`));
    expect(output).toMatch(
      new RegExp(`@nrwl/nest.*:.*${getPublishedVersion()}`)
    );
    expect(output).not.toContain('@nrwl/express');
  });

  it('should work with nx list', () => {
    let output = runEncapsulatedNx('list');
    const lines = output.split('\n');
    const installedPluginStart = lines.findIndex((l) =>
      l.includes('Installed plugins')
    );
    const installedPluginEnd = lines.findIndex((l) =>
      l.includes('Also available')
    );
    const installedPluginLines = lines.slice(
      installedPluginStart + 1,
      installedPluginEnd
    );

    expect(installedPluginLines.some((x) => x.includes(`${bold('nx')}`)));
    expect(
      installedPluginLines.some((x) => x.includes(`${bold('@nrwl/nest')}`))
    );

    output = runEncapsulatedNx('list @nrwl/nest');
    expect(output).toContain('Capabilities in @nrwl/nest');
  });

  it('should work with basic generators', () => {
    updateJson<NxJsonConfiguration>('nx.json', (j) => {
      j.installation.plugins ??= {};
      j.installation.plugins['@nrwl/workspace'] = getPublishedVersion();
      return j;
    });
    expect(() =>
      runEncapsulatedNx(`g npm-package ${uniq('pkg')}`)
    ).not.toThrow();
    expect(() => checkFilesExist());
  });
});

function assertNoRootPackages() {
  expect(() =>
    checkFilesDoNotExist(
      'node_modules',
      'package.json',
      'package-lock.json',
      'yarn-lock.json',
      'pnpm-lock.yaml'
    )
  ).not.toThrow();
}
