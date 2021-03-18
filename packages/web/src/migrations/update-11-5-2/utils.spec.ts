import { getProjects } from '@nrwl/devkit';
import { ProjectGraph } from '@nrwl/workspace';
import {
  DependencyType,
  reverse,
} from '@nrwl/workspace/src/core/project-graph';
import { hasDependentAppUsingWebBuild } from '@nrwl/web/src/migrations/update-11-5-2/utils';

describe('hasDependentAppUsingWebBuild', () => {
  const graph: ProjectGraph = reverse({
    nodes: {
      webapp: { name: 'webapp', data: { files: [] }, type: 'application' },
      nodeapp: { name: 'nodeapp', data: { files: [] }, type: 'application' },
      weblib1: { name: 'weblib1', data: { files: [] }, type: 'library' },
      weblib2: { name: 'weblib2', data: { files: [] }, type: 'library' },
      weblib3: { name: 'weblib3', data: { files: [] }, type: 'library' },
      stylelib: { name: 'stylelib', data: { files: [] }, type: 'library' },
      sharedlib: { name: 'sharedlib', data: { files: [] }, type: 'library' },
      nodelib: { name: 'nodelib', data: { files: [] }, type: 'library' },
    },
    dependencies: {
      webapp: [
        { source: 'webapp', target: 'weblib1', type: DependencyType.static },
        { source: 'webapp', target: 'sharedlib', type: DependencyType.static },
        {
          source: 'webapp',
          target: 'stylelib',
          type: DependencyType.implicit,
        },
      ],
      nodeapp: [
        { source: 'nodeapp', target: 'nodelib', type: DependencyType.static },
        { source: 'nodeapp', target: 'sharedlib', type: DependencyType.static },
      ],
      weblib1: [
        { source: 'weblib1', target: 'weblib2', type: DependencyType.static },
      ],
      weblib2: [
        { source: 'weblib2', target: 'weblib3', type: DependencyType.static },
      ],
    },
  });

  const projects: ReturnType<typeof getProjects> = new Map([
    [
      'webapp',
      {
        projectType: 'application',
        root: 'webapp',
        targets: {
          build: { executor: '@nrwl/web:build' },
        },
      },
    ],
    [
      'nodeapp',
      {
        projectType: 'application',
        root: 'nodeapp',
        targets: {
          build: { executor: '@nrwl/node:build' },
        },
      },
    ],
    [
      'weblib1',
      {
        projectType: 'library',
        root: 'weblib1',
        targets: {},
      },
    ],
    [
      'weblib2',
      {
        projectType: 'library',
        root: 'weblib2',
        targets: {},
      },
    ],
    [
      'weblib3',
      {
        projectType: 'library',
        root: 'weblib3',
        targets: {},
      },
    ],
    [
      'stylelib',
      {
        projectType: 'library',
        root: 'stylelib',
        targets: {},
      },
    ],
    [
      'nodelib',
      {
        projectType: 'library',
        root: 'nodelib',
        targets: {},
      },
    ],
    [
      'sharedlib',
      {
        projectType: 'library',
        root: 'sharedlib',
        targets: {},
      },
    ],
  ]);

  it('should return true if project is in the dependency chain of an app using `@nrwl/web:build`', () => {
    expect(
      hasDependentAppUsingWebBuild('weblib1', graph, projects)
    ).toBeTruthy();

    expect(
      hasDependentAppUsingWebBuild('weblib2', graph, projects)
    ).toBeTruthy();

    expect(
      hasDependentAppUsingWebBuild('weblib3', graph, projects)
    ).toBeTruthy();

    expect(
      hasDependentAppUsingWebBuild('sharedlib', graph, projects)
    ).toBeTruthy();
  });

  it('should return false if project an implicit dependency of an app using`@nrwl/web:build`', () => {
    expect(
      hasDependentAppUsingWebBuild('stylelib', graph, projects)
    ).toBeFalsy();
  });

  it('should return false if project is not used by an app using `@nrwl/web:build`', () => {
    expect(
      hasDependentAppUsingWebBuild('nodelib', graph, projects)
    ).toBeFalsy();
  });
});
