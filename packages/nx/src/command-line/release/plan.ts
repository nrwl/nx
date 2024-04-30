import { prompt } from 'enquirer';
import { writeFile } from 'fs-extra';
import { join } from 'path';
import { RELEASE_TYPES } from 'semver';
import { readNxJson } from '../../config/nx-json';
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
import { filterReleaseGroups } from './config/filter-release-groups';
import { getVersionPlansAbsolutePath } from './config/version-plans';

export const releasePlanCLIHandler = (args: PlanOptions) =>
  handleErrors(args.verbose, () => releasePlan(args));

export async function releasePlan(args: PlanOptions): Promise<string | number> {
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const nxJson = readNxJson();

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

  const { error: filterError, releaseGroups } = filterReleaseGroups(
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

  if (releaseGroups[0].name === IMPLICIT_DEFAULT_RELEASE_GROUP) {
    const group = releaseGroups[0];
    if (group.projectsRelationship === 'independent') {
      for (const project of group.projects) {
        versionPlanBumps[project] = await promptForVersion(
          `How do you want to bump the version of the project "${project}"?`
        );
      }
    } else {
      versionPlanBumps[group.name] = await promptForVersion(
        `How do you want to bump the versions of all projects?`
      );
    }
  } else {
    for (const group of releaseGroups) {
      if (group.projectsRelationship === 'independent') {
        for (const project of group.projects) {
          versionPlanBumps[project] = await promptForVersion(
            `How do you want to bump the version of the project "${project}" within group "${group.name}"?`
          );
        }
      } else {
        versionPlanBumps[group.name] = await promptForVersion(
          `How do you want to bump the versions of the projects in the group "${group.name}"?`
        );
      }
    }
  }

  const versionPlanMessage = await promptForMessage();
  const versionPlanFileContent = getVersionPlanFileContent(
    versionPlanBumps,
    versionPlanMessage
  );
  const versionPlanFileName = `version-plan-${new Date().getTime()}.md`;

  if (args.dryRun) {
    output.logSingleLine(
      `Would create version plan file "${versionPlanFileName}", but --dry-run was set.`
    );
  } else {
    output.logSingleLine(`Creating version plan file "${versionPlanFileName}"`);
    await writeFile(
      join(getVersionPlansAbsolutePath(), versionPlanFileName),
      versionPlanFileContent
    );
  }

  return versionPlanFileName;
}

async function promptForVersion(message: string): Promise<string> {
  try {
    const reply = await prompt<{ version: string }>([
      {
        name: 'version',
        message,
        type: 'select',
        choices: RELEASE_TYPES,
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

async function promptForMessage(): Promise<string> {
  try {
    const reply = await prompt<{ message: string }>([
      {
        name: 'message',
        message:
          'What changelog message would you like associated with this change?',
        type: 'input',
      },
    ]);
    return reply.message;
  } catch (e) {
    output.log({
      title: 'Cancelled version plan creation.',
    });
    process.exit(0);
  }
}

function getVersionPlanFileContent(
  bumps: Record<string, string>,
  message: string
): string {
  return `
---
${Object.entries(bumps)
  .map(([projectOrGroup, version]) => `${projectOrGroup}: ${version}`)
  .join('\n')}
---

${message}
`;
}
