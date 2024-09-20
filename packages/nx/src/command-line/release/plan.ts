import { prompt } from 'enquirer';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RELEASE_TYPES } from 'semver';
import { dirSync } from 'tmp';
import { NxReleaseConfiguration, readNxJson } from '../../config/nx-json';
import { createProjectFileMapUsingProjectGraph } from '../../project-graph/file-map-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { allFileData } from '../../utils/all-file-data';
import {
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { output } from '../../utils/output';
import { handleErrors } from '../../utils/handle-errors';
import { PlanOptions } from './command-object';
import {
  createNxReleaseConfig,
  handleNxReleaseConfigError,
  IMPLICIT_DEFAULT_RELEASE_GROUP,
} from './config/config';
import { deepMergeJson } from './config/deep-merge-json';
import { filterReleaseGroups } from './config/filter-release-groups';
import { getVersionPlansAbsolutePath } from './config/version-plans';
import { generateVersionPlanContent } from './utils/generate-version-plan-content';
import { createGetTouchedProjectsForGroup } from './utils/get-touched-projects-for-group';
import { launchEditor } from './utils/launch-editor';
import { printDiff } from './utils/print-changes';
import { printConfigAndExit } from './utils/print-config';

export const releasePlanCLIHandler = (args: PlanOptions) =>
  handleErrors(args.verbose, () => createAPI({})(args));

export function createAPI(overrideReleaseConfig: NxReleaseConfiguration) {
  return async function releasePlan(
    args: PlanOptions
  ): Promise<string | number> {
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
      args.projects,
      args.groups
    );
    if (filterError) {
      output.error(filterError);
      process.exit(1);
    }

    // If no release groups have version plans enabled, it doesn't make sense to use the plan command only to set yourself up for an error at release time
    if (!releaseGroups.some((group) => group.versionPlans === true)) {
      if (releaseGroups.length === 1) {
        output.warn({
          title: `Version plans are not enabled in your release configuration`,
          bodyLines: [
            'To enable version plans, set `"versionPlans": true` at the top level of your `"release"` configuration',
          ],
        });
        return 0;
      }
      output.warn({
        title: 'No release groups have version plans enabled',
        bodyLines: [
          'To enable version plans, set `"versionPlans": true` at the top level of your `"release"` configuration to apply it to all groups, otherwise set it at the release group level',
        ],
      });
      return 0;
    }

    // Resolve the final values for base, head etc to use when resolving the changes to consider
    const { nxArgs } = splitArgsIntoNxArgsAndOverrides(
      args,
      'affected',
      {
        printWarnings: args.verbose,
      },
      nxJson
    );

    const versionPlanBumps: Record<string, string> = {};
    const setBumpIfNotNone = (projectOrGroup: string, version: string) => {
      if (version !== 'none') {
        versionPlanBumps[projectOrGroup] = version;
      }
    };

    // Changed files are only relevant if considering touched projects
    let changedFiles: string[] = [];
    let getProjectsToVersionForGroup:
      | ReturnType<typeof createGetTouchedProjectsForGroup>
      | undefined;
    if (args.onlyTouched) {
      changedFiles = parseFiles(nxArgs).files;
      if (nxArgs.verbose) {
        if (changedFiles.length) {
          output.log({
            title: `Changed files based on resolved "base" (${
              nxArgs.base
            }) and "head" (${nxArgs.head ?? 'HEAD'})`,
            bodyLines: changedFiles.map((file) => `  - ${file}`),
          });
        } else {
          output.warn({
            title: 'No changed files found based on resolved "base" and "head"',
          });
        }
      }
      const resolvedAllFileData = await allFileData();
      getProjectsToVersionForGroup = createGetTouchedProjectsForGroup(
        nxArgs,
        projectGraph,
        changedFiles,
        resolvedAllFileData
      );
    }

    if (args.projects?.length) {
      /**
       * Run plan for all remaining release groups and filtered projects within them
       */
      for (const releaseGroup of releaseGroups) {
        const releaseGroupName = releaseGroup.name;
        const releaseGroupProjectNames = Array.from(
          releaseGroupToFilteredProjects.get(releaseGroup)
        );
        let applicableProjects = releaseGroupProjectNames;

        if (
          args.onlyTouched &&
          typeof getProjectsToVersionForGroup === 'function'
        ) {
          applicableProjects = await getProjectsToVersionForGroup(
            releaseGroup,
            releaseGroupProjectNames,
            true
          );
        }

        if (!applicableProjects.length) {
          continue;
        }

        if (releaseGroup.projectsRelationship === 'independent') {
          for (const project of applicableProjects) {
            setBumpIfNotNone(
              project,
              args.bump ||
                (await promptForVersion(
                  `How do you want to bump the version of the project "${project}"${
                    releaseGroupName === IMPLICIT_DEFAULT_RELEASE_GROUP
                      ? ''
                      : ` within group "${releaseGroupName}"`
                  }?`
                ))
            );
          }
        } else {
          setBumpIfNotNone(
            releaseGroupName,
            args.bump ||
              (await promptForVersion(
                `How do you want to bump the versions of ${
                  releaseGroupName === IMPLICIT_DEFAULT_RELEASE_GROUP
                    ? 'all projects'
                    : `the projects in the group "${releaseGroupName}"`
                }?`
              ))
          );
        }
      }

      // Create a version plan file if applicable
      await createVersionPlanFileForBumps(args, versionPlanBumps);
      return 0;
    }

    /**
     * Run plan for all remaining release groups
     */
    for (const releaseGroup of releaseGroups) {
      const releaseGroupName = releaseGroup.name;
      let applicableProjects = releaseGroup.projects;

      if (
        args.onlyTouched &&
        typeof getProjectsToVersionForGroup === 'function'
      ) {
        applicableProjects = await getProjectsToVersionForGroup(
          releaseGroup,
          releaseGroup.projects,
          false
        );
      }

      if (!applicableProjects.length) {
        continue;
      }

      if (releaseGroup.projectsRelationship === 'independent') {
        for (const project of applicableProjects) {
          setBumpIfNotNone(
            project,
            args.bump ||
              (await promptForVersion(
                `How do you want to bump the version of the project "${project}"${
                  releaseGroupName === IMPLICIT_DEFAULT_RELEASE_GROUP
                    ? ''
                    : ` within group "${releaseGroupName}"`
                }?`
              ))
          );
        }
      } else {
        setBumpIfNotNone(
          releaseGroupName,
          args.bump ||
            (await promptForVersion(
              `How do you want to bump the versions of ${
                releaseGroupName === IMPLICIT_DEFAULT_RELEASE_GROUP
                  ? 'all projects'
                  : `the projects in the group "${releaseGroupName}"`
              }?`
            ))
        );
      }
    }

    // Create a version plan file if applicable
    await createVersionPlanFileForBumps(args, versionPlanBumps);
    return 0;
  };
}

async function createVersionPlanFileForBumps(
  args: PlanOptions,
  versionPlanBumps: Record<string, string>
) {
  if (!Object.keys(versionPlanBumps).length) {
    let bodyLines: string[] = [];
    if (args.onlyTouched) {
      bodyLines = [
        'This might be because no projects have been changed, or projects you expected to release have not been touched',
        'To include all projects, not just those that have been changed, pass --only-touched=false',
        'Alternatively, you can specify alternate --base and --head refs to include only changes from certain commits',
      ];
    }
    output.warn({
      title:
        'No version bumps were selected so no version plan file was created.',
      bodyLines,
    });
    return 0;
  }

  const versionPlanName = `version-plan-${new Date().getTime()}`;
  const versionPlanMessage =
    args.message || (await promptForMessage(versionPlanName));
  const versionPlanFileContent = generateVersionPlanContent(
    versionPlanBumps,
    versionPlanMessage
  );
  const versionPlanFileName = `${versionPlanName}.md`;

  if (args.dryRun) {
    output.logSingleLine(
      `Would create version plan file "${versionPlanFileName}", but --dry-run was set.`
    );
    printDiff('', versionPlanFileContent, 1);
  } else {
    output.logSingleLine(`Creating version plan file "${versionPlanFileName}"`);
    printDiff('', versionPlanFileContent, 1);

    const versionPlansAbsolutePath = getVersionPlansAbsolutePath();
    await mkdir(versionPlansAbsolutePath, { recursive: true });
    await writeFile(
      join(versionPlansAbsolutePath, versionPlanFileName),
      versionPlanFileContent
    );
  }
}

async function promptForVersion(message: string): Promise<string> {
  try {
    const reply = await prompt<{ version: string }>([
      {
        name: 'version',
        message,
        type: 'select',
        choices: [...RELEASE_TYPES, 'none'],
      },
    ]);
    return reply.version;
  } catch (e) {
    output.log({
      title: 'Cancelled version plan creation.',
    });
    process.exit(0);
  }
}

async function promptForMessage(versionPlanName: string): Promise<string> {
  let message: string;
  do {
    message = await _promptForMessage(versionPlanName);
  } while (!message);
  return message;
}

async function _promptForMessage(versionPlanName: string): Promise<string> {
  try {
    const reply = await prompt<{ message: string }>([
      {
        name: 'message',
        message:
          'What changelog message would you like associated with this change? (Leave blank to open an external editor for multi-line messages/easier editing)',
        type: 'input',
      },
    ]);

    let message = reply.message.trim();

    if (!message.length) {
      const tmpDir = dirSync().name;
      const messageFilePath = join(
        tmpDir,
        `DRAFT_MESSAGE__${versionPlanName}.md`
      );
      writeFileSync(messageFilePath, '');
      await launchEditor(messageFilePath);
      message = readFileSync(messageFilePath, 'utf-8');
    }

    message = message.trim();

    if (!message) {
      output.warn({
        title:
          'A changelog message is required in order to create the version plan file',
        bodyLines: [],
      });
    }

    return message;
  } catch (e) {
    output.log({
      title: 'Cancelled version plan creation.',
    });
    process.exit(0);
  }
}
