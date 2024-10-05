import {
  NxJsonConfiguration,
  NxReleaseConfiguration,
  readNxJson,
} from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { createProjectFileMapUsingProjectGraph } from '../../project-graph/file-map-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { runCommandForTasks } from '../../tasks-runner/run-command';
import {
  createOverrides,
  readGraphFileFromGraphArg,
} from '../../utils/command-line-utils';
import { handleErrors } from '../../utils/handle-errors';
import { output } from '../../utils/output';
import { projectHasTarget } from '../../utils/project-graph-utils';
import { generateGraph } from '../graph/graph';
import { PublishOptions } from './command-object';
import {
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import { deepMergeJson } from './config/deep-merge-json';
import { filterReleaseGroups } from './config/filter-release-groups';
import { printConfigAndExit } from './utils/print-config';

export interface PublishProjectsResult {
  [projectName: string]: {
    code: number;
  };
}

export const releasePublishCLIHandler = (args: PublishOptions) =>
  handleErrors(args.verbose, async () => {
    const publishProjectsResult: PublishProjectsResult = await createAPI({})(
      args
    );
    // If all projects are published successfully, return 0, otherwise return 1
    return Object.values(publishProjectsResult).every(
      (result) => result.code === 0
    )
      ? 0
      : 1;
  });

export function createAPI(overrideReleaseConfig: NxReleaseConfiguration) {
  /**
   * NOTE: This function is also exported for programmatic usage and forms part of the public API
   * of Nx. We intentionally do not wrap the implementation with handleErrors because users need
   * to have control over their own error handling when using the API.
   */
  return async function releasePublish(
    args: PublishOptions
  ): Promise<PublishProjectsResult> {
    /**
     * When used via the CLI, the args object will contain a __overrides_unparsed__ property that is
     * important for invoking the relevant executor behind the scenes.
     *
     * We intentionally do not include that in the function signature, however, so as not to cause
     * confusing errors for programmatic consumers of this function.
     */
    const _args = args as PublishOptions & { __overrides_unparsed__: string[] };

    const projectGraph = await createProjectGraphAsync({ exitOnError: true });
    const nxJson = readNxJson();
    const userProvidedReleaseConfig = deepMergeJson(
      nxJson.release ?? {},
      overrideReleaseConfig ?? {}
    );

    // Apply default configuration to any optional user configuration
    const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
      projectGraph,
      await createProjectFileMapUsingProjectGraph(projectGraph),
      userProvidedReleaseConfig
    );
    if (configError) {
      return await handleNxReleaseConfigError(configError);
    }
    // --print-config exits directly as it is not designed to be combined with any other programmatic operations
    if (args.printConfig) {
      return printConfigAndExit({
        userProvidedReleaseConfig,
        nxReleaseConfig,
        isDebug: args.printConfig === 'debug',
      });
    }

    const {
      error: filterError,
      releaseGroups,
      releaseGroupToFilteredProjects,
    } = filterReleaseGroups(
      projectGraph,
      nxReleaseConfig,
      _args.projects,
      _args.groups
    );
    if (filterError) {
      output.error(filterError);
      process.exit(1);
    }

    /**
     * If the user is filtering to a subset of projects or groups, we should not run the publish task
     * for dependencies, because that could cause projects outset of the filtered set to be published.
     */
    const shouldExcludeTaskDependencies =
      _args.projects?.length > 0 ||
      _args.groups?.length > 0 ||
      args.excludeTaskDependencies;

    let overallPublishProjectsResult: PublishProjectsResult = {};

    if (args.projects?.length) {
      /**
       * Run publishing for all remaining release groups and filtered projects within them
       */
      for (const releaseGroup of releaseGroups) {
        const publishProjectsResult = await runPublishOnProjects(
          _args,
          projectGraph,
          nxJson,
          Array.from(releaseGroupToFilteredProjects.get(releaseGroup)),
          {
            excludeTaskDependencies: shouldExcludeTaskDependencies,
            loadDotEnvFiles: process.env.NX_LOAD_DOT_ENV_FILES !== 'false',
          }
        );
        overallPublishProjectsResult = {
          ...overallPublishProjectsResult,
          ...publishProjectsResult,
        };
      }

      return overallPublishProjectsResult;
    }

    /**
     * Run publishing for all remaining release groups
     */
    for (const releaseGroup of releaseGroups) {
      const publishProjectsResult = await runPublishOnProjects(
        _args,
        projectGraph,
        nxJson,
        releaseGroup.projects,
        {
          excludeTaskDependencies: shouldExcludeTaskDependencies,
          loadDotEnvFiles: process.env.NX_LOAD_DOT_ENV_FILES !== 'false',
        }
      );
      overallPublishProjectsResult = {
        ...overallPublishProjectsResult,
        ...publishProjectsResult,
      };
    }

    return overallPublishProjectsResult;
  };
}

async function runPublishOnProjects(
  args: PublishOptions & { __overrides_unparsed__: string[] },
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  projectNames: string[],
  extraOptions: {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
  }
): Promise<PublishProjectsResult> {
  const projectsToRun: ProjectGraphProjectNode[] = projectNames.map(
    (projectName) => projectGraph.nodes[projectName]
  );

  const overrides = createOverrides(args.__overrides_unparsed__);

  if (args.registry) {
    overrides.registry = args.registry;
  }
  if (args.tag) {
    overrides.tag = args.tag;
  }
  if (args.otp) {
    overrides.otp = args.otp;
  }
  if (args.access) {
    overrides.access = args.access;
  }
  if (args.dryRun) {
    overrides.dryRun = args.dryRun;
    /**
     * Ensure the env var is set too, so that any and all publish executors triggered
     * indirectly via dependsOn can also pick up on the fact that this is a dry run.
     */
    process.env.NX_DRY_RUN = 'true';
  }

  if (args.firstRelease) {
    overrides.firstRelease = args.firstRelease;
  }

  const requiredTargetName = 'nx-release-publish';

  if (args.graph) {
    const file = readGraphFileFromGraphArg(args);
    const projectNamesWithTarget = projectsToRun
      .map((t) => t.name)
      .filter((projectName) =>
        projectHasTarget(projectGraph.nodes[projectName], requiredTargetName)
      );

    await generateGraph(
      {
        watch: true,
        all: false,
        open: true,
        view: 'tasks',
        targets: [requiredTargetName],
        projects: projectNamesWithTarget,
        file,
      },
      projectNamesWithTarget
    );
    return {};
  }

  const projectsWithTarget = projectsToRun.filter((project) =>
    projectHasTarget(project, requiredTargetName)
  );

  if (projectsWithTarget.length === 0) {
    throw new Error(
      `Based on your config, the following projects were matched for publishing but do not have the "${requiredTargetName}" target specified:\n${[
        ...projectsToRun.map((p) => `- ${p.name}`),
        '',
        `This is usually caused by not having an appropriate plugin, such as "@nx/js" installed, which will add the appropriate "${requiredTargetName}" target for you automatically.`,
      ].join('\n')}\n`
    );
  }

  /**
   * Run the relevant nx-release-publish executor on each of the selected projects.
   */
  const commandResults = await runCommandForTasks(
    projectsWithTarget,
    projectGraph,
    { nxJson },
    {
      targets: [requiredTargetName],
      outputStyle: 'static',
      ...(args as any),
      // It is possible for workspaces to have circular dependencies between packages and still release them to a registry
      nxIgnoreCycles: true,
    },
    overrides,
    null,
    {},
    extraOptions
  );

  const publishProjectsResult: PublishProjectsResult = {};
  for (const taskData of Object.values(commandResults)) {
    publishProjectsResult[taskData.task.target.project] = {
      code: taskData.code,
    };
  }

  return publishProjectsResult;
}
