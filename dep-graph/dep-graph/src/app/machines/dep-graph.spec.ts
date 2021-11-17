import { ProjectGraphDependency, ProjectGraphNode } from '@nrwl/devkit';
import { depGraphMachine } from './dep-graph.machine';

export const mockProjects: ProjectGraphNode[] = [
  {
    name: 'app1',
    type: 'app',
    data: {},
  },
  {
    name: 'app2',
    type: 'app',
    data: {},
  },
  {
    name: 'ui-lib',
    type: 'lib',
    data: {},
  },
  {
    name: 'feature-lib1',
    type: 'lib',
    data: {},
  },
  {
    name: 'feature-lib2',
    type: 'lib',
    data: {},
  },
  {
    name: 'auth-lib',
    type: 'lib',
    data: {},
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
    it('should select projects', () => {
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

      expect(result.value).toEqual('customSelected');
      expect(result.context.selectedProjects).toEqual(['app1']);

      result = depGraphMachine.transition(result, {
        type: 'selectProject',
        projectName: 'app2',
      });

      expect(result.context.selectedProjects).toEqual(['app1', 'app2']);
    });
  });

  describe('deselecting projects', () => {
    it('should deselect projects', () => {
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

      expect(result.value).toEqual('customSelected');
      expect(result.context.selectedProjects).toEqual(['app2']);
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

    it('should select the projects by the focused project', () => {
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

      expect(result.context.selectedProjects).toEqual([
        'app1',
        'ui-lib',
        'feature-lib1',
        'auth-lib',
      ]);
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

    it('should not decrement search depth below 1', () => {
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
  });

  describe('filtering projects by text', () => {
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
  });
});
