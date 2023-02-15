import type { NxJsonConfiguration } from '@nrwl/devkit';
import {
  newEncapsulatedNxWorkspace,
  updateFile,
  updateJson,
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getPublishedVersion,
} from '@nrwl/e2e/utils';

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
    expect(runEncapsulatedNx('report')).toMatch(
      new RegExp(`nx.*:.*${getPublishedVersion()}`)
    );
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
