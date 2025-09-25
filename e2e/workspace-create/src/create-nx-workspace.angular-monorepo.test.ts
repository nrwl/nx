import { expectCodeIsFormatted, runCreateWorkspace, uniq } from '@nx/e2e-utils';

import {
  getCreateNxWorkspacePackageManager,
  registerCreateNxWorkspaceCleanup,
} from './create-nx-workspace.setup';

const packageManager = getCreateNxWorkspacePackageManager();

describe('create-nx-workspace angular monorepo', () => {
  registerCreateNxWorkspaceCleanup();

  it('should be able to create an angular workspace', () => {
    const wsName = uniq('angular');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'angular-monorepo',
      style: 'css',
      appName,
      packageManager,
      standaloneApi: false,
      routing: true,
      e2eTestRunner: 'none',
      bundler: 'webpack',
      ssr: false,
    });
    expectCodeIsFormatted();
  });

  it('should fail correctly when preset errors', () => {
    const wsName = uniq('angular-1-test');
    const appName = uniq('app');
    expect(() =>
      runCreateWorkspace(wsName, {
        preset: 'angular-monorepo',
        style: 'css',
        appName,
        packageManager,
        standaloneApi: false,
        routing: false,
        e2eTestRunner: 'none',
        bundler: 'webpack',
        ssr: false,
        prefix: '1-one',
      })
    ).toThrow();
  });
});

