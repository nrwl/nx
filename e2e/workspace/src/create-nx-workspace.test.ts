import { runCreateWorkspace, uniq } from '@nrwl/e2e/utils';
import { existsSync, mkdirSync } from 'fs-extra';
import { execSync } from 'child_process';

describe('create-nx-workspace', () => {
  it('should be able to create an empty workspace', () => {
    const wsName = uniq('empty');
    runCreateWorkspace(wsName, {
      preset: 'empty',
    });
  });

  it('should be able to create an oss workspace', () => {
    const wsName = uniq('oss');
    runCreateWorkspace(wsName, {
      preset: 'oss',
    });
  });

  it('should be able to create an angular workspace', () => {
    const wsName = uniq('angular');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'angular',
      style: 'css',
      appName,
    });
  });

  it('should be able to create an react workspace', () => {
    const wsName = uniq('react');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'react',
      style: 'css',
      appName,
    });
  });

  it('should be able to create an next workspace', () => {
    const wsName = uniq('next');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'next',
      style: 'css',
      appName,
    });
  });

  it('should be able to create an web-components workspace', () => {
    const wsName = uniq('web-components');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'web-components',
      style: 'css',
      appName,
    });
  });

  it('should be able to create an angular + nest workspace', () => {
    const wsName = uniq('angular-nest');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'angular-nest',
      style: 'css',
      appName,
    });
  });

  it('should be able to create an react + express workspace', () => {
    const wsName = uniq('react-express');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'react-express',
      style: 'css',
      appName,
    });
  });

  it('should be able to create a workspace with a custom base branch and HEAD', () => {
    const wsName = uniq('branch');
    runCreateWorkspace(wsName, {
      preset: 'empty',
      base: 'main',
    });
  });

  it('should be able to create a nest workspace', () => {
    const wsName = uniq('nest');
    const appName = uniq('app');
    runCreateWorkspace(wsName, {
      preset: 'nest',
      appName,
    });
  });

  it('should handle spaces in workspace path', () => {
    const wsName = uniq('empty');

    const tmpDir = `./tmp/nx/with space`;

    mkdirSync(tmpDir);

    const command = `npx create-nx-workspace@${process.env.PUBLISHED_VERSION} ${wsName} --cli=nx --preset=empty --no-nxCloud --no-interactive`;
    execSync(command, {
      cwd: tmpDir,
      stdio: [0, 1, 2],
      env: process.env,
    });

    expect(existsSync(`${tmpDir}/${wsName}/package.json`)).toBeTruthy();
  });
});
