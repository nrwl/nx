import { projectsToRun } from './run-many';
import { performance } from 'perf_hooks';
import { ProjectGraph } from '../../config/project-graph';

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
              tags: ['api', 'theme1'],
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
              tags: ['ui', 'theme2'],
              targets: {
                test: {},
              },
            },
          },
        } as any,
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

    it('should filter projects by tag', () => {
      const projects = projectsToRun(
        {
          targets: ['test'],
          projects: ['tag:api'],
        },
        projectGraph
      ).map(({ name }) => name);
      expect(projects).toContain('proj1');
      expect(projects).not.toContain('proj2');
    });

    it('should filter projects by tag pattern', () => {
      const projects = projectsToRun(
        {
          targets: ['test'],
          projects: ['tag:theme*'],
        },
        projectGraph
      ).map(({ name }) => name);
      expect(projects).toContain('proj1');
      expect(projects).toContain('proj2');
    });

    it('should filter projects by name and tag', () => {
      let projects = projectsToRun(
        {
          targets: ['test'],
          projects: ['proj1', 'tag:ui'],
        },
        projectGraph
      ).map(({ name }) => name);
      expect(projects).toContain('proj1');
      expect(projects).toContain('proj2');
      projects = projectsToRun(
        {
          targets: ['test'],
          projects: ['proj1', 'tag:a*'],
        },
        projectGraph
      ).map(({ name }) => name);
      expect(projects).toContain('proj1');
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

    it('should exclude projects by tag', () => {
      const projects = projectsToRun(
        {
          all: true,
          targets: ['test'],
          projects: [],
          exclude: ['tag:ui'],
        },
        projectGraph
      ).map(({ name }) => name);
      expect(projects).toContain('proj1');
      expect(projects).not.toContain('proj2');
    });

    it('should exclude projects with a tag pattern', () => {
      const projects = projectsToRun(
        {
          all: true,
          targets: ['test'],
          projects: [],
          exclude: ['tag:theme*'],
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
            } as any,
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
