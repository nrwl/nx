import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { getReactDependenciesVersionsToInstall } from './version-utils';
import { type ProjectGraph } from '@nx/devkit';
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
