/**
 * @vitest-environment jsdom
 */

// nx-ignore-next-line
import type {
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from '@nrwl/devkit';
import { interpret } from 'xstate';
import { projectGraphMachine } from './project-graph.machine';
import { it, describe, expect } from 'vitest';

window.environment = 'release';
window.appConfig = {
  showDebugger: true,
  defaultWorkspaceId: 'local',
  workspaces: [],
  showExperimentalFeatures: true,
};

export const mockProjects: ProjectGraphProjectNode[] = [
  {
    name: 'app1',
    type: 'app',
    data: {
      root: 'apps/app1',
      files: [],
    },
  },
  {
    name: 'app2',
    type: 'app',
    data: {
      root: 'apps/app2',
      files: [],
    },
  },
  {
    name: 'ui-lib',
    type: 'lib',
    data: {
      root: 'libs/ui-lib',
      files: [],
    },
  },
  {
    name: 'feature-lib1',
    type: 'lib',
    data: {
      root: 'libs/feature/lib1',
      files: [],
    },
  },
  {
    name: 'feature-lib2',
    type: 'lib',
    data: {
      root: 'libs/feature/lib2',
      files: [],
    },
  },
  {
    name: 'auth-lib',
    type: 'lib',
    data: {
      root: 'libs/auth-lib',
      files: [],
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
      const result = projectGraphMachine.transition(
        projectGraphMachine.initialState,
        {
          type: 'setProjects',
          projects: mockProjects,
          dependencies: mockDependencies,
          affectedProjects: [],
          workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
        }
      );
      expect(result.context.projects).toEqual(mockProjects);
      expect(result.context.dependencies).toEqual(mockDependencies);
      expect(result.context.workspaceLayout).toEqual({
        appsDir: 'apps',
        libsDir: 'libs',
      });
    });

    it('should start with no projects selected', () => {
      const result = projectGraphMachine.transition(
        projectGraphMachine.initialState,
        {
          type: 'setProjects',
          projects: mockProjects,
          dependencies: mockDependencies,
          affectedProjects: [],
          workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
        }
      );

      expect(result.value).toEqual('unselected');
      expect(result.context.selectedProjects).toEqual([]);
    });
  });

  describe('selecting projects', () => {
    it('should select projects', () =>
      new Promise<void>((done) => {
        let service = interpret(projectGraphMachine).onTransition((state) => {
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
          type: 'setProjects',
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
      }));
  });

  describe('deselecting projects', () => {
    it('should deselect projects', () =>
      new Promise<void>((done) => {
        let service = interpret(projectGraphMachine).onTransition((state) => {
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
          type: 'setProjects',
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
      }));

    it('should go to unselected when last project is deselected', () => {
      let result = projectGraphMachine.transition(
        projectGraphMachine.initialState,
        {
          type: 'setProjects',
          projects: mockProjects,
          dependencies: mockDependencies,
          affectedProjects: [],
          workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
        }
      );

      result = projectGraphMachine.transition(result, {
        type: 'selectProject',
        projectName: 'app1',
      });

      result = projectGraphMachine.transition(result, {
        type: 'selectProject',
        projectName: 'app2',
      });

      result = projectGraphMachine.transition(result, {
        type: 'deselectProject',
        projectName: 'app1',
      });

      result = projectGraphMachine.transition(result, {
        type: 'deselectProject',
        projectName: 'app2',
      });

      expect(result.value).toEqual('unselected');
      expect(result.context.selectedProjects).toEqual([]);
    });
  });

  describe('focusing projects', () => {
    it('should set the focused project', () => {
      let result = projectGraphMachine.transition(
        projectGraphMachine.initialState,
        {
          type: 'setProjects',
          projects: mockProjects,
          dependencies: mockDependencies,
          affectedProjects: [],
          workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
        }
      );

      result = projectGraphMachine.transition(result, {
        type: 'focusProject',
        projectName: 'app1',
      });

      expect(result.value).toEqual('focused');
      expect(result.context.focusedProject).toEqual('app1');
    });

    it('should select the projects by the focused project', () =>
      new Promise<void>((done) => {
        let service = interpret(projectGraphMachine).onTransition((state) => {
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
          type: 'setProjects',
          projects: mockProjects,
          dependencies: mockDependencies,
          affectedProjects: [],
          workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
        });
        service.send({
          type: 'setSearchDepthEnabled',
          searchDepthEnabled: false,
        });
        service.send({ type: 'focusProject', projectName: 'app1' });
      }));

    it('should select no projects on unfocus', () => {
      let result = projectGraphMachine.transition(
        projectGraphMachine.initialState,
        {
          type: 'setProjects',
          projects: mockProjects,
          dependencies: mockDependencies,
          affectedProjects: [],
          workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
        }
      );

      result = projectGraphMachine.transition(result, {
        type: 'focusProject',
        projectName: 'app1',
      });

      result = projectGraphMachine.transition(result, {
        type: 'unfocusProject',
      });

      expect(result.value).toEqual('unselected');
      expect(result.context.selectedProjects).toEqual([]);
    });
  });

  describe('search depth', () => {
    it('should not decrement search depth below 1', () => {
      let result = projectGraphMachine.transition(
        projectGraphMachine.initialState,
        {
          type: 'setProjects',
          projects: mockProjects,
          dependencies: mockDependencies,
          affectedProjects: [],
          workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
        }
      );

      result = projectGraphMachine.transition(result, {
        type: 'filterByText',
        search: 'app1',
      });

      expect(result.context.searchDepth).toEqual(1);

      result = projectGraphMachine.transition(result, {
        type: 'incrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(2);

      result = projectGraphMachine.transition(result, {
        type: 'incrementSearchDepth',
      });

      result = projectGraphMachine.transition(result, {
        type: 'incrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(4);

      result = projectGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      result = projectGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(2);

      result = projectGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(1);

      result = projectGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(1);

      result = projectGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      expect(result.context.searchDepth).toEqual(1);
    });

    it('should activate search depth if incremented or decremented', () => {
      let result = projectGraphMachine.transition(
        projectGraphMachine.initialState,
        {
          type: 'setProjects',
          projects: mockProjects,
          dependencies: mockDependencies,
          affectedProjects: [],
          workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
        }
      );

      result = projectGraphMachine.transition(result, {
        type: 'setSearchDepthEnabled',
        searchDepthEnabled: false,
      });

      expect(result.context.searchDepthEnabled).toBe(false);

      result = projectGraphMachine.transition(result, {
        type: 'incrementSearchDepth',
      });

      expect(result.context.searchDepthEnabled).toBe(true);

      result = projectGraphMachine.transition(result, {
        type: 'setSearchDepthEnabled',
        searchDepthEnabled: false,
      });

      expect(result.context.searchDepthEnabled).toBe(false);

      result = projectGraphMachine.transition(result, {
        type: 'decrementSearchDepth',
      });

      expect(result.context.searchDepthEnabled).toBe(true);
    });
  });
});
