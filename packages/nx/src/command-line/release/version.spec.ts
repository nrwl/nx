import type { ProjectGraph } from '../../config/project-graph';
import type { NxReleaseConfig } from './config/config';
import { ReleaseGraph } from './utils/release-graph';
import { hasDockerReleaseConfiguration } from './version';

describe('hasDockerReleaseConfiguration', () => {
  it('should be false when a project has a docker target but no docker release configuration', () => {
    const releaseGraph = createReleaseGraph(['app']);
    const projectGraph = createProjectGraph({
      app: {
        targets: {
          'docker:build': {
            metadata: {
              technologies: ['docker'],
            },
          },
        },
      },
    });

    expect(
      hasDockerReleaseConfiguration(
        {} as NxReleaseConfig,
        releaseGraph,
        projectGraph
      )
    ).toBe(false);
  });

  it('should be true when docker is configured at the root release level', () => {
    const releaseGraph = createReleaseGraph(['app']);
    const projectGraph = createProjectGraph({
      app: {},
    });

    expect(
      hasDockerReleaseConfiguration(
        { docker: {} } as NxReleaseConfig,
        releaseGraph,
        projectGraph
      )
    ).toBe(true);
  });

  it('should be true when docker is configured at the release group level', () => {
    const releaseGraph = createReleaseGraph(['app'], { docker: {} });
    const projectGraph = createProjectGraph({
      app: {},
    });

    expect(
      hasDockerReleaseConfiguration(
        {} as NxReleaseConfig,
        releaseGraph,
        projectGraph
      )
    ).toBe(true);
  });

  it('should be true when docker is configured at the project level', () => {
    const releaseGraph = createReleaseGraph(['app']);
    const projectGraph = createProjectGraph({
      app: {
        release: {
          docker: {
            repositoryName: 'acme/app',
          },
        },
      },
    });

    expect(
      hasDockerReleaseConfiguration(
        {} as NxReleaseConfig,
        releaseGraph,
        projectGraph
      )
    ).toBe(true);
  });

  it('should ignore project level docker configuration for projects that are not being processed', () => {
    const releaseGraph = createReleaseGraph(['app']);
    const projectGraph = createProjectGraph({
      app: {},
      skipped: {
        release: {
          docker: {
            repositoryName: 'acme/skipped',
          },
        },
      },
    });

    expect(
      hasDockerReleaseConfiguration(
        {} as NxReleaseConfig,
        releaseGraph,
        projectGraph
      )
    ).toBe(false);
  });
});

function createReleaseGraph(
  projects: string[],
  releaseGroupOverrides: Record<string, unknown> = {}
): ReleaseGraph {
  const releaseGroup = {
    name: 'default',
    projects,
    projectsRelationship: 'independent',
    ...releaseGroupOverrides,
  } as any;
  const releaseGraph = new ReleaseGraph([releaseGroup], {});
  releaseGraph.allProjectsToProcess = new Set(projects);
  releaseGraph.releaseGroupToFilteredProjects.set(
    releaseGroup,
    new Set(projects)
  );
  return releaseGraph;
}

function createProjectGraph(
  projects: Record<string, Record<string, unknown>>
): ProjectGraph {
  return {
    nodes: Object.fromEntries(
      Object.entries(projects).map(([name, data]) => [
        name,
        {
          name,
          type: 'app',
          data: {
            root: name,
            ...data,
          },
        },
      ])
    ),
    dependencies: {},
  };
}
