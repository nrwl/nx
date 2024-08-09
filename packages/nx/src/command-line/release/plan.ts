import { prompt } from 'enquirer';
import { ensureDir, readFileSync, writeFile, writeFileSync } from 'fs-extra';
import { join } from 'node:path';
import { RELEASE_TYPES } from 'semver';
import { dirSync } from 'tmp';
import { NxReleaseConfiguration, readNxJson } from '../../config/nx-json';
import { createProjectFileMapUsingProjectGraph } from '../../project-graph/file-map-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { output } from '../../utils/output';
import { handleErrors } from '../../utils/params';
import { PlanOptions } from './command-object';
import {
  IMPLICIT_DEFAULT_RELEASE_GROUP,
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import { deepMergeJson } from './config/deep-merge-json';
import { filterReleaseGroups } from './config/filter-release-groups';
import { getVersionPlansAbsolutePath } from './config/version-plans';
import { generateVersionPlanContent } from './utils/generate-version-plan-content';
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

    if (args.verbose) {
      process.env.NX_VERBOSE_LOGGING = 'true';
    }

    // Apply default configuration to any optional user configuration
    const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
      projectGraph,
      await createProjectFileMapUsingProjectGraph(projectGraph),
      nxJson.release
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

    const versionPlanBumps: Record<string, string> = {};
    const setBumpIfNotNone = (projectOrGroup: string, version: string) => {
      if (version !== 'none') {
        versionPlanBumps[projectOrGroup] = version;
      }
    };

    if (releaseGroups[0].name === IMPLICIT_DEFAULT_RELEASE_GROUP) {
      const group = releaseGroups[0];
      if (group.projectsRelationship === 'independent') {
        for (const project of group.projects) {
          setBumpIfNotNone(
            project,
            args.bump ||
              (await promptForVersion(
                `How do you want to bump the version of the project "${project}"?`
              ))
          );
        }
      } else {
        // TODO: use project names instead of the implicit default release group name? (though this might be confusing, as users might think they can just delete one of the project bumps to change the behavior to independent versioning)
        setBumpIfNotNone(
          group.name,
          args.bump ||
            (await promptForVersion(
              `How do you want to bump the versions of all projects?`
            ))
        );
      }
    } else {
      for (const group of releaseGroups) {
        if (group.projectsRelationship === 'independent') {
          for (const project of releaseGroupToFilteredProjects.get(group)) {
            setBumpIfNotNone(
              project,
              args.bump ||
                (await promptForVersion(
                  `How do you want to bump the version of the project "${project}" within group "${group.name}"?`
                ))
            );
          }
        } else {
          setBumpIfNotNone(
            group.name,
            args.bump ||
              (await promptForVersion(
                `How do you want to bump the versions of the projects in the group "${group.name}"?`
              ))
          );
        }
      }
    }

    if (!Object.keys(versionPlanBumps).length) {
      output.warn({
        title:
          'No version bumps were selected so no version plan file was created.',
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
      output.logSingleLine(
        `Creating version plan file "${versionPlanFileName}"`
      );
      printDiff('', versionPlanFileContent, 1);

      const versionPlansAbsolutePath = getVersionPlansAbsolutePath();
      await ensureDir(versionPlansAbsolutePath);
      await writeFile(
        join(versionPlansAbsolutePath, versionPlanFileName),
        versionPlanFileContent
      );
    }

    return 0;
  };
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
