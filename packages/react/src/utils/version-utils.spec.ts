import type { ProjectGraph, Tree } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  getInstalledReactVersion,
  getReactDependenciesVersionsToInstall,
} from './version-utils';
import {
  reactDomV18Version,
  reactDomVersion,
  reactIsV18Version,
  reactIsVersion,
  reactV18Version,
  reactVersion,
  typesReactDomV18Version,
  typesReactDomVersion,
  typesReactIsV18Version,
  typesReactIsVersion,
  typesReactV18Version,
  typesReactVersion,
} from './versions';

let projectGraph: ProjectGraph;

jest.mock('@nx/devkit', () => {
  const original = jest.requireActual('@nx/devkit');
  return {
    ...original,
    createProjectGraphAsync: jest
      .fn()
      .mockImplementation(() => Promise.resolve(projectGraph)),
  };
});

describe('getReactDependenciesVersionsToInstall', () => {
  beforeEach(() => {
    projectGraph = {
      dependencies: {},
      nodes: {},
      externalNodes: {},
    };
  });

  it('should return the correct versions of react and react-dom when react 18 is installed', async () => {
    // ARRANGE
    projectGraph.externalNodes['npm:react'] = {
      type: 'npm',
      name: 'npm:react',
      data: {
        version: '18.3.1',
        packageName: 'react',
        hash: 'sha512-4+0/v9+l9/3+3/2+2/1+1/0',
      },
    };

    // ACT
    const reactDependencies = await getReactDependenciesVersionsToInstall(
      createTreeWithEmptyWorkspace()
    );

    // ASSERT
    expect(reactDependencies).toEqual({
      react: reactV18Version,
      'react-dom': reactDomV18Version,
      'react-is': reactIsV18Version,
      '@types/react': typesReactV18Version,
      '@types/react-dom': typesReactDomV18Version,
      '@types/react-is': typesReactIsV18Version,
    });
  });

  it('should return the correct versions of react and react-dom when react 19 is installed', async () => {
    // ARRANGE
    projectGraph.externalNodes['npm:react'] = {
      type: 'npm',
      name: 'npm:react',
      data: {
        version: '19.0.0',
        packageName: 'react',
        hash: 'sha512-4+0/v9+l9/3+3/2+2/1+1/0',
      },
    };

    // ACT
    const reactDependencies = await getReactDependenciesVersionsToInstall(
      createTreeWithEmptyWorkspace()
    );

    // ASSERT
    expect(reactDependencies).toEqual({
      react: reactVersion,
      'react-dom': reactDomVersion,
      'react-is': reactIsVersion,
      '@types/react': typesReactVersion,
      '@types/react-dom': typesReactDomVersion,
      '@types/react-is': typesReactIsVersion,
    });
  });

  it('should return the correct versions of react and react-dom when react is not installed', async () => {
    // ARRANGE
    projectGraph.externalNodes['npm:react'] = undefined;

    // ACT
    const reactDependencies = await getReactDependenciesVersionsToInstall(
      createTreeWithEmptyWorkspace()
    );

    // ASSERT
    expect(reactDependencies).toEqual({
      react: reactVersion,
      'react-dom': reactDomVersion,
      'react-is': reactIsVersion,
      '@types/react': typesReactVersion,
      '@types/react-dom': typesReactDomVersion,
      '@types/react-is': typesReactIsVersion,
    });
  });
});

describe('getInstalledReactVersion', () => {
  let tempFs: TempFs;
  let tree: Tree;

  beforeEach(() => {
    tempFs = new TempFs('react-version-test');
    tree = createTreeWithEmptyWorkspace();
    tree.root = tempFs.tempDir;
    // force `detectPackageManager` to return `pnpm`
    tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');

    tree.write(
      'pnpm-workspace.yaml',
      `
packages:
  - packages/*

catalog:
  react: ^18.2.0
  lodash: ^4.17.0

catalogs:
  react17:
    react: ^17.0.2
`
    );
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it('should get installed React version from default catalog reference', () => {
    tree.write(
      'package.json',
      JSON.stringify({
        name: 'test',
        dependencies: {
          react: 'catalog:',
        },
      })
    );

    expect(getInstalledReactVersion(tree)).toBe('18.2.0');
  });

  it('should get installed React version from named catalog reference', () => {
    tree.write(
      'package.json',
      JSON.stringify({
        name: 'test',
        dependencies: {
          react: 'catalog:react17',
        },
      })
    );

    expect(getInstalledReactVersion(tree)).toBe('17.0.2');
  });

  it('should get installed React version from regular semver version', () => {
    tree.write(
      'package.json',
      JSON.stringify({
        name: 'test',
        dependencies: {
          react: '^18.2.0',
        },
      })
    );

    expect(getInstalledReactVersion(tree)).toBe('18.2.0');
  });
});
