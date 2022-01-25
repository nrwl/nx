// nx-ignore-next-line
import type { ProjectGraphDependency, ProjectGraphNode } from '@nrwl/devkit';
import { depGraphMachine } from './dep-graph.machine';
import { interpret } from 'xstate';

export const mockProjects: ProjectGraphNode[] = [
  {
    name: 'app1',
    type: 'app',
    data: {
      root: 'apps/app1',
    },
  },
  {
    name: 'app2',
    type: 'app',
    data: {
      root: 'apps/app2',
    },
  },
  {
    name: 'ui-lib',
    type: 'lib',
    data: {
      root: 'libs/ui-lib',
    },
  },
  {
    name: 'feature-lib1',
    type: 'lib',
    data: {
      root: 'libs/feature/lib1',
    },
  },
  {
    name: 'feature-lib2',
    type: 'lib',
    data: {
      root: 'libs/feature/lib2',
    },
  },
  {
    name: 'auth-lib',
    type: 'lib',
    data: {
      root: 'libs/auth-lib',
    },
  },
];

export const mockDependencies: Record<string, ProjectGraphDependency[]> = {
  app1: [
    {
      type: 'static',
      source: 'app1',
      target: 'auth-lib',
    },
    {
      type: 'static',
      source: 'app1',
      target: 'feature-lib1',
    },
  ],
  app2: [
    {
      type: 'static',
      source: 'app2',
      target: 'auth-lib',
    },
    {
      type: 'static',
      source: 'app2',
      target: 'feature-lib2',
    },
  ],
  'feature-lib1': [
    {
      type: 'static',
      source: 'feature-lib1',
      target: 'ui-lib',
    },
  ],
  'feature-lib2': [
    {
      type: 'static',
      source: 'feature-lib2',
      target: 'ui-lib',
    },
  ],
  'ui-lib': [],
  'auth-lib': [],
};

describe('dep-graph machine', () => {
  describe('initGraph', () => {
    it('should set projects, dependencies, and workspaceLayout', () => {
      const result = depGraphMachine.transition(depGraphMachine.initialState, {
        type: 'initGraph',
        projects: mockProjects,
        dependencies: mockDependencies,
        affectedProjects: [],
        workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
      });
      expect(result.context.projects).toEqual(mockProjects);
      expect(result.context.dependencies).toEqual(mockDependencies);
      expect(result.context.workspaceLayout).toEqual({
        appsDir: 'apps',
        libsDir: 'libs',
      });
    });

    it('should start with no projects selected', () => {
      const result = depGraphMachine.transition(depGraphMachine.initialState, {
        type: 'initGraph',
        projects: mockProjects,
        dependencies: mockDependencies,
        affectedProjects: [],
        workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
      });

      expect(result.value).toEqual('unselected');
      expect(result.context.selectedProjects).toEqual([]);
    });
  });

  describe('selecting projects', () => {
    it('should select projects', (done) => {
      let service = interpret(depGraphMachine).onTransition((state) => {
        if (
          state.matches('customSelected') &&
          state.context.selectedProjects.includes('app1') &&
          state.context.selectedProjects.includes('app2')
        ) {
          done();
        }
      });

      service.start();

      service.send({
        type: 'initGraph',
        projects: mockProjects,
        dependencies: mockDependencies,
        affectedProjects: [],
        workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
      });

      service.send({
        type: 'selectProject',
        projectName: 'app1',
      });

      service.send({
        type: 'selectProject',
        projectName: 'app2',
      });
    });
  });

  describe('deselecting projects', () => {
    it('should deselect projects', (done) => {
      let service = interpret(depGraphMachine).onTransition((state) => {
        if (
          state.matches('customSelected') &&
          !state.context.selectedProjects.includes('app1') &&
          state.context.selectedProjects.includes('app2')
        ) {
          done();
        }
      });

      service.start();

      service.send({
        type: 'initGraph',
        projects: mockProjects,
        dependencies: mockDependencies,
        affectedProjects: [],
        workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
      });

      service.send({
        type: 'selectProject',
        projectName: 'app1',
      });

      service.send({
        type: 'selectProject',
        projectName: 'app2',
      });

      service.send({
        type: 'deselectProject',
        projectName: 'app1',
      });
    });

    it('should go to unselected when last project is deselected', () => {
      let result = depGraphMachine.transition(depGraphMachine.initialState, {
        type: 'initGraph',
        projects: mockProjects,
        dependencies: mockDependencies,
        affectedProjects: [],
        workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
      });

      result = depGraphMachine.transition(result, {
        type: 'selectProject',
        projectName: 'app1',
      });

      result = depGraphMachine.transition(result, {
        type: 'selectProject',
        projectName: 'app2',
      });

      result = depGraphMachine.transition(result, {
        type: 'deselectProject',
        projectName: 'app1',
      });

      result = depGraphMachine.transition(result, {
        type: 'deselectProject',
        projectName: 'app2',
      });

      expect(result.value).toEqual('unselected');
      expect(result.context.selectedProjects).toEqual([]);
    });
  });

  describe('focusing projects', () => {
    it('should set the focused project', () => {
      let result = depGraphMachine.transition(depGraphMachine.initialState, {
        type: 'initGraph',
        projects: mockProjects,
        dependencies: mockDependencies,
        affectedProjects: [],
        workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
      });

      result = depGraphMachine.transition(result, {
        type: 'focusProject',
        projectName: 'app1',
      });

      expect(result.value).toEqual('focused');
      expect(result.context.focusedProject).toEqual('app1');
    });

    it('should select the projects by the focused project', (done) => {
      let service = interpret(depGraphMachine).onTransition((state) => {
        if (
          state.matches('focused') &&
          state.context.selectedProjects.includes('app1') &&
          state.context.selectedProjects.includes('ui-lib') &&
          state.context.selectedProjects.includes('feature-lib1') &&
          state.context.selectedProjects.includes('auth-lib')
        ) {
          done();
        }
      });

      service.start();

      service.send({
        type: 'initGraph',
        projects: mockProjects,
        dependencies: mockDependencies,
        affectedProjects: [],
        workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
      });

      service.send({ type: 'focusProject', projectName: 'app1' });
    });

    it('should select no projects on unfocus', () => {
      let result = depGraphMachine.transition(depGraphMachine.initialState, {
        type: 'initGraph',
        projects: mockProjects,
        dependencies: mockDependencies,
        affectedProjects: [],
        workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
      });

      result = depGraphMachine.transition(result, {
        type: 'focusProject',
        projectName: 'app1',
      });

      result = depGraphMachine.transition(result, {
        type: 'unfocusProject',
      });

      expect(result.value).toEqual('unselected');
      expect(result.context.selectedProjects).toEqual([]);
    });
  });

  describe('search depth', () => {
    it('should not decrement search depth below 1', () => {
      let result = depGraphMachine.transition(depGraphMachine.initialState, {
        type: 'initGraph',
        projects: mockProjects,
        dependencies: mockDependencies,
        affectedProjects: [],
        workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
      });

      result = depGraphMachine.transition(result, {
        type: 'filterByText',
        search: 'app1',
      });

      expect(result.context.searchDepth).toEqual(1);

      result = depGraphMachine.transition(result, {
        type: 'incrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(2);

      result = depGraphMachine.transition(result, {
        type: 'incrementSearchDepth',
      });

      result = depGraphMachine.transition(result, {
        type: 'incrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(4);

      result = depGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      result = depGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(2);

      result = depGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(1);

      result = depGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(1);

      result = depGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(1);
    });

    it('should activate search depth if incremented or decremented', () => {
      let result = depGraphMachine.transition(depGraphMachine.initialState, {
        type: 'initGraph',
        projects: mockProjects,
        dependencies: mockDependencies,
        affectedProjects: [],
        workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
      });

      result = depGraphMachine.transition(result, {
        type: 'setSearchDepthEnabled',
        searchDepthEnabled: false,
      });

      expect(result.context.searchDepthEnabled).toBe(false);

      result = depGraphMachine.transition(result, {
        type: 'incrementSearchDepth',
      });

      expect(result.context.searchDepthEnabled).toBe(true);

      result = depGraphMachine.transition(result, {
        type: 'setSearchDepthEnabled',
        searchDepthEnabled: false,
      });

      expect(result.context.searchDepthEnabled).toBe(false);

      result = depGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      expect(result.context.searchDepthEnabled).toBe(true);
    });
  });
});
