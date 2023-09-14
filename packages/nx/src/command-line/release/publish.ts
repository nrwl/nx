import { readNxJson } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { NxJsonConfiguration, output } from '../../devkit-exports';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { runCommand } from '../../tasks-runner/run-command';
import { createOverrides } from '../../utils/command-line-utils';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { PublishOptions } from './command-object';
import { createNxReleaseConfig } from './config/config';
import {
  CATCH_ALL_RELEASE_GROUP,
  ReleaseGroup,
  createReleaseGroups,
  handleCreateReleaseGroupsError,
} from './config/create-release-groups';

export async function publishHandler(
  args: PublishOptions & { __unparsed_overrides__: string[] }
): Promise<void> {
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const nxJson = readNxJson();

  // Apply default configuration to any optional user configuration
  const nxReleaseConfig = createNxReleaseConfig(nxJson.release);
  const releaseGroupsData = await createReleaseGroups(
    projectGraph,
    nxReleaseConfig.groups
  );
  if (releaseGroupsData.error) {
    return await handleCreateReleaseGroupsError(releaseGroupsData.error);
  }

  let { releaseGroups } = releaseGroupsData;

  /**
   * User is filtering to a subset of projects. We need to make sure that what they have provided can be reconciled
   * against their configuration in terms of release groups and the ungroupedProjectsHandling option.
   */
  if (args.projects?.length) {
    const matchingProjectsForFilter = findMatchingProjects(
      args.projects,
      projectGraph.nodes
    );

    if (!matchingProjectsForFilter.length) {
      output.error({
        title: `Your --projects filter "${args.projects}" did not match any projects in the workspace`,
      });
      process.exit(1);
    }

    const filteredProjectToReleaseGroup = new Map<string, ReleaseGroup>();
    const releaseGroupToFilteredProjects = new Map<ReleaseGroup, Set<string>>();

    // Figure out which release groups, if any, that the filtered projects belong to so that we can resolve other config
    for (const releaseGroup of releaseGroups) {
      const matchingProjectsForReleaseGroup = findMatchingProjects(
        releaseGroup.projects,
        projectGraph.nodes
      );
      for (const matchingProject of matchingProjectsForFilter) {
        if (matchingProjectsForReleaseGroup.includes(matchingProject)) {
          filteredProjectToReleaseGroup.set(matchingProject, releaseGroup);
          if (!releaseGroupToFilteredProjects.has(releaseGroup)) {
            releaseGroupToFilteredProjects.set(releaseGroup, new Set());
          }
          releaseGroupToFilteredProjects.get(releaseGroup).add(matchingProject);
        }
      }
    }

    /**
     * If there are release groups specified, each filtered project must match at least one release
     * group, otherwise the command + config combination is invalid.
     */
    if (Object.keys(nxReleaseConfig.groups).length) {
      const unmatchedProjects = matchingProjectsForFilter.filter(
        (p) => !filteredProjectToReleaseGroup.has(p)
      );
      if (unmatchedProjects.length) {
        output.error({
          title: `The following projects which match your projects filter "${args.projects}" did not match any configured release groups:`,
          bodyLines: unmatchedProjects.map((p) => `- ${p}`),
        });
        process.exit(1);
      }
    }

    output.note({
      title: `Your filter "${args.projects}" matched the following projects:`,
      bodyLines: matchingProjectsForFilter.map((p) => {
        const releaseGroupForProject = filteredProjectToReleaseGroup.get(p);
        if (releaseGroupForProject.name === CATCH_ALL_RELEASE_GROUP) {
          return `- ${p}`;
        }
        return `- ${p} (release group "${releaseGroupForProject.name}")`;
      }),
    });

    // Filter the releaseGroups collection appropriately
    releaseGroups = releaseGroups.filter((rg) =>
      releaseGroupToFilteredProjects.has(rg)
    );

    /**
     * Run publishing for all remaining release groups and filtered projects within them
     */
    for (const releaseGroup of releaseGroups) {
      await runPublishOnProjects(
        args,
        projectGraph,
        nxJson,
        Array.from(releaseGroupToFilteredProjects.get(releaseGroup))
      );
    }

    return process.exit(0);
  }

  /**
   * The user is filtering by release group
   */
  if (args.groups?.length) {
    releaseGroups = releaseGroups.filter((g) => args.groups?.includes(g.name));
  }

  // Should be an impossible state, as we should have explicitly handled any errors/invalid config by now
  if (!releaseGroups.length) {
    output.error({
      title: `No projects could be matched for versioning, please report this case and include your nx.json config`,
    });
    process.exit(1);
  }

  /**
   * Run publishing for all remaining release groups
   */
  for (const releaseGroup of releaseGroups) {
    await runPublishOnProjects(
      args,
      projectGraph,
      nxJson,
      releaseGroup.projects
    );
  }

  process.exit(0);
}

async function runPublishOnProjects(
  args: PublishOptions & { __unparsed_overrides__: string[] },
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  projectNames: string[]
) {
  const projectsToRun: ProjectGraphProjectNode[] = projectNames.map(
    (projectName) => projectGraph.nodes[projectName]
  );

  const overrides = createOverrides(args.__unparsed_overrides__);

  if (args.registry) {
    overrides.registry = args.registry;
  }
  if (args.tag) {
    overrides.registry = args.registry;
  }

  if (args.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  /**
   * Run the relevant release-publish executor on each of the selected projects.
   */
  const status = await runCommand(
    projectsToRun,
    projectGraph,
    { nxJson },
    {
      targets: ['release-publish'],
      parallel: 1,
      outputStyle: 'stream',
    },
    overrides,
    null,
    {},
    { excludeTaskDependencies: false, loadDotEnvFiles: true }
  );

  if (status !== 0) {
    // fix for https://github.com/nrwl/nx/issues/1666
    if (process.stdin['unref']) (process.stdin as any).unref();
    process.exit(status);
  }
}
