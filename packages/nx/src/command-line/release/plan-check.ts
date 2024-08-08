import { NxReleaseConfiguration, readNxJson } from '../../config/nx-json';
import { getTouchedProjects } from '../../project-graph/affected/locators/workspace-projects';
import { createProjectFileMapUsingProjectGraph } from '../../project-graph/file-map-utils';
import {
  calculateFileChanges,
  defaultReadFileAtRevision,
} from '../../project-graph/file-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { allFileData } from '../../utils/all-file-data';
import {
  applyNxBaseAndHead,
  NxArgs,
  parseFiles,
} from '../../utils/command-line-utils';
import { getIgnoreObject } from '../../utils/ignore';
import { output } from '../../utils/output';
import { handleErrors } from '../../utils/params';
import { PlanCheckOptions, PlanOptions } from './command-object';
import {
  createNxReleaseConfig,
  handleNxReleaseConfigError,
  IMPLICIT_DEFAULT_RELEASE_GROUP,
} from './config/config';
import { deepMergeJson } from './config/deep-merge-json';
import { filterReleaseGroups } from './config/filter-release-groups';
import {
  ProjectsVersionPlan,
  readRawVersionPlans,
  setResolvedVersionPlansOnGroups,
} from './config/version-plans';
import { printConfigAndExit } from './utils/print-config';

export const releasePlanCheckCLIHandler = (args: PlanCheckOptions) =>
  handleErrors(args.verbose, () => createAPI({})(args));

export function createAPI(overrideReleaseConfig: NxReleaseConfiguration) {
  return async function releasePlanCheck(args: PlanOptions): Promise<number> {
    const projectGraph = await createProjectGraphAsync({ exitOnError: true });
    const nxJson = readNxJson();
    const userProvidedReleaseConfig = deepMergeJson(
      nxJson.release ?? {},
      overrideReleaseConfig ?? {}
    );

    if (args.verbose) {
      process.env.NX_VERBOSE_LOGGING = 'true';
    }

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
      args.projects,
      args.groups
    );
    if (filterError) {
      output.error(filterError);
      process.exit(1);
    }

    // If no release groups have version plans enabled, provide an explicit error
    if (!releaseGroups.some((group) => group.versionPlans)) {
      output.error({
        title: 'Version plans are not enabled',
        bodyLines: [
          'Please ensure at least one release group has version plans enabled in your Nx release configuration if you want to use this command.',
          // TODO: Add docs link here once it is available
        ],
      });
      return 1;
    }

    const rawVersionPlans = await readRawVersionPlans();
    setResolvedVersionPlansOnGroups(
      rawVersionPlans,
      releaseGroups,
      Object.keys(projectGraph.nodes)
    );

    // Resolve the final values for base and head to use when resolving the changes to consider
    applyNxBaseAndHead(args, nxJson, args.verbose);

    const changedFiles = parseFiles(args).files;
    if (args.verbose) {
      if (changedFiles.length) {
        output.log({
          title: `Changed files based on resolved "base" (${
            (args as NxArgs).base
          }) and "head" (${(args as NxArgs).head ?? 'HEAD'})`,
          bodyLines: changedFiles.map((file) => `  - ${file}`),
        });
      } else {
        output.warn({
          title: 'No changed files found based on resolved "base" and "head"',
        });
      }
    }
    const resolvedAllFileData = await allFileData();

    /**
     * Create a minimal subset of touched projects based on the configured ignore patterns, we only need
     * to recompute when the ignorePatternsForPlanCheck differs between release groups.
     */
    const serializedIgnorePatternsToTouchedProjects = new Map<
      string,
      Record<string, true> // project names -> true for O(N) lookup later
    >();

    const NOTE_ABOUT_VERBOSE_LOGGING =
      'Run with --verbose to see the full list of changed files used for the touched projects logic.';

    let hasErrors = false;

    for (const releaseGroup of releaseGroups) {
      // The current release group doesn't leverage version plans
      if (!releaseGroup.versionPlans) {
        continue;
      }

      const resolvedVersionPlans = releaseGroup.resolvedVersionPlans || [];

      // Check upfront if the release group as a whole is featured in any version plan files
      const matchingVersionPlanFiles = resolvedVersionPlans.filter(
        (plan) => 'groupVersionBump' in plan
      );
      if (matchingVersionPlanFiles.length) {
        output.log({
          title: `${
            releaseGroup.name === IMPLICIT_DEFAULT_RELEASE_GROUP
              ? `There are`
              : `Release group "${releaseGroup.name}" has`
          } pending bumps in version plan(s)`,
          bodyLines: [
            ...matchingVersionPlanFiles.map(
              (plan) => `  - "${plan.groupVersionBump}" in ${plan.fileName}`
            ),
          ],
        });
        continue;
      }

      // Exclude patterns from .nxignore, .gitignore and explicit version plan config
      let serializedIgnorePatterns = '[]';
      const ignore = getIgnoreObject();

      if (
        typeof releaseGroup.versionPlans !== 'boolean' &&
        Array.isArray(releaseGroup.versionPlans.ignorePatternsForPlanCheck) &&
        releaseGroup.versionPlans.ignorePatternsForPlanCheck.length
      ) {
        output.note({
          title: `Applying configured ignore patterns to changed files${
            releaseGroup.name !== IMPLICIT_DEFAULT_RELEASE_GROUP
              ? ` for release group "${releaseGroup.name}"`
              : ''
          }`,
          bodyLines: [
            ...releaseGroup.versionPlans.ignorePatternsForPlanCheck.map(
              (pattern) => `  - ${pattern}`
            ),
          ],
        });
        ignore.add(releaseGroup.versionPlans.ignorePatternsForPlanCheck);
        serializedIgnorePatterns = JSON.stringify(
          releaseGroup.versionPlans.ignorePatternsForPlanCheck
        );
      }

      let touchedProjects = {};
      if (
        serializedIgnorePatternsToTouchedProjects.has(serializedIgnorePatterns)
      ) {
        touchedProjects = serializedIgnorePatternsToTouchedProjects.get(
          serializedIgnorePatterns
        );
      } else {
        // We only care about directly touched projects, not implicitly affected ones etc
        const touchedProjectsArr = await getTouchedProjects(
          calculateFileChanges(
            changedFiles,
            resolvedAllFileData,
            args,
            defaultReadFileAtRevision,
            ignore
          ),
          projectGraph.nodes
        );
        touchedProjects = touchedProjectsArr.reduce(
          (acc, project) => ({ ...acc, [project]: true }),
          {}
        );
        serializedIgnorePatternsToTouchedProjects.set(
          serializedIgnorePatterns,
          touchedProjects
        );
      }

      const touchedProjectsUnderReleaseGroup = releaseGroup.projects.filter(
        (project) => touchedProjects[project]
      );
      if (touchedProjectsUnderReleaseGroup.length) {
        output.log({
          title: `Touched projects based on changed files${
            releaseGroup.name !== IMPLICIT_DEFAULT_RELEASE_GROUP
              ? ` under release group "${releaseGroup.name}"`
              : ''
          }`,
          bodyLines: [
            ...touchedProjectsUnderReleaseGroup.map(
              (project) => `  - ${project}`
            ),
            '',
            'NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.',
          ],
        });
      } else {
        output.log({
          title: `No touched projects found based on changed files${
            typeof releaseGroup.versionPlans !== 'boolean' &&
            Array.isArray(
              releaseGroup.versionPlans.ignorePatternsForPlanCheck
            ) &&
            releaseGroup.versionPlans.ignorePatternsForPlanCheck.length
              ? ' combined with configured ignore patterns'
              : ''
          }${
            releaseGroup.name !== IMPLICIT_DEFAULT_RELEASE_GROUP
              ? ` under release group "${releaseGroup.name}"`
              : ''
          }`,
        });
      }

      const projectsInResolvedVersionPlans: Record<
        string,
        { bump: string; fileName: string }[]
      > = resolvedVersionPlans.reduce((acc, plan) => {
        if ('projectVersionBumps' in plan) {
          for (const project in plan.projectVersionBumps) {
            acc[project] = acc[project] || [];
            acc[project].push({
              bump: plan.projectVersionBumps[project],
              fileName: plan.fileName,
            });
          }
        }
        return acc;
      }, {});

      // Ensure each touched project under this release group features in at least one version plan file
      let touchedProjectsNotFoundInVersionPlans = [];
      for (const touchedProject of touchedProjectsUnderReleaseGroup) {
        if (!resolvedVersionPlans.length) {
          touchedProjectsNotFoundInVersionPlans.push(touchedProject);
          continue;
        }
        const matchingVersionPlanFileEntries =
          projectsInResolvedVersionPlans[touchedProject];
        if (!matchingVersionPlanFileEntries?.length) {
          touchedProjectsNotFoundInVersionPlans.push(touchedProject);
          continue;
        }
      }

      // Log any resolved pending bumps, regardless of whether the projects were directly touched or not
      for (const [projectName, entries] of Object.entries(
        projectsInResolvedVersionPlans
      )) {
        output.log({
          title: `Project "${projectName}" has pending bumps in version plan(s)`,
          bodyLines: [
            ...entries.map(
              ({ bump, fileName }) => `  - "${bump}" in ${fileName}`
            ),
          ],
        });
      }

      if (touchedProjectsNotFoundInVersionPlans.length) {
        const bodyLines = [
          `The following touched projects${
            releaseGroup.name !== IMPLICIT_DEFAULT_RELEASE_GROUP
              ? ` under release group "${releaseGroup.name}"`
              : ''
          } do not feature in any version plan files:`,
          ...touchedProjectsNotFoundInVersionPlans.map(
            (project) => `  - ${project}`
          ),
          '',
          'Please use `nx release plan` to generate missing version plans, or adjust your "versionPlans.ignorePatternsForPlanCheck" config stop certain files from affecting the projects for the purposes of this command.',
        ];
        if (!args.verbose) {
          bodyLines.push('', NOTE_ABOUT_VERBOSE_LOGGING);
        }
        output.error({
          title: 'Touched projects missing version plans',
          bodyLines,
        });
        // At least one project in one release group has an issue
        hasErrors = true;
      }
    }

    // Do not print success message if any projects are missing version plans
    if (hasErrors) {
      return 1;
    }

    const bodyLines = [];
    if (!args.verbose) {
      bodyLines.push(NOTE_ABOUT_VERBOSE_LOGGING);
    }
    output.success({
      title: 'All touched projects have, or do not require, version plans.',
      bodyLines,
    });

    return 0;
  };
}
