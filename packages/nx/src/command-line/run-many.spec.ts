import { ProjectGraph } from '@nrwl/nx-cloud/lib/core/models/run-context.model';
import { projectsToRun } from './run-many';
import { performance } from 'perf_hooks';

describe('run-many', () => {
  describe('projectsToRun', () => {
    let projectGraph: ProjectGraph;
    beforeEach(() => {
      projectGraph = {
        nodes: {
          proj1: {
            name: 'proj1',
            type: 'lib',
            data: {
              root: 'proj1',
              targets: {
                build: {},
                test: {},
              },
            },
          },
          proj2: {
            name: 'proj2',
            type: 'lib',
            data: {
              root: 'proj2',
              targets: {
                test: {},
              },
            },
          },
        },
        dependencies: {},
      };
    });

    it('should select all projects with a target', () => {
      const projects = projectsToRun(
        {
          all: true,
          targets: ['test'],
          projects: [],
        },
        projectGraph
      ).map(({ name }) => name);
      expect(projects).toContain('proj1');
      expect(projects).toContain('proj2');
    });

    it('should select a project with a target', () => {
      const projects = projectsToRun(
        {
          targets: ['test'],
          projects: ['proj1'],
        },
        projectGraph
      ).map(({ name }) => name);
      expect(projects).toContain('proj1');
      expect(projects).not.toContain('proj2');
    });

    it('should filter projects with a pattern', () => {
      const projects = projectsToRun(
        {
          targets: ['test'],
          projects: ['proj*'],
        },
        projectGraph
      ).map(({ name }) => name);
      expect(projects).toContain('proj1');
      expect(projects).toContain('proj2');
    });

    it('should exclude projects', () => {
      const projects = projectsToRun(
        {
          all: true,
          targets: ['test'],
          projects: [],
          exclude: ['proj1'],
        },
        projectGraph
      ).map(({ name }) => name);
      expect(projects).not.toContain('proj1');
      expect(projects).toContain('proj2');
    });

    it('should exclude projects with a pattern', () => {
      const projects = projectsToRun(
        {
          all: true,
          targets: ['test'],
          projects: [],
          exclude: ['proj*'],
        },
        projectGraph
      ).map(({ name }) => name);
      expect(projects).not.toContain('proj1');
      expect(projects).not.toContain('proj2');
    });

    describe('perf testing', () => {
      beforeEach(() => {
        for (let i = 0; i < 1000000; i++) {
          projectGraph.nodes['proj' + i] = {
            name: 'proj' + i,
            type: 'lib',
            data: {
              root: 'proj' + i,
              targets: {
                test: {},
              },
            },
          };
        }
      });

      it('should be able to select and exclude via patterns', async () => {
        performance.mark('start');
        projectsToRun(
          {
            targets: ['test'],
            projects: ['proj1*'],
            exclude: ['proj12*'],
          },
          projectGraph
        );
        performance.mark('end');
        const measure = performance.measure('projects', 'start', 'end');
        expect(measure.duration).toBeLessThan(4000);
      });
    });
  });
});
