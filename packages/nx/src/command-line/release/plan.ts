import { prompt } from 'enquirer';
import { ensureDir, writeFile } from 'fs-extra';
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
import { parseConventionalCommitsMessage } from './utils/git';
import { printDiff } from './utils/print-changes';

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

  if (args.message) {
    const message = parseConventionalCommitsMessage(args.message);
    if (!message) {
      output.error({
        title: 'Changelog message is not in conventional commits format.',
        bodyLines: [
          'Please ensure your message is in the form of:',
          '  type(optional scope): description',
          '',
          'For example:',
          '  feat(pkg-b): add new feature',
          '  fix(pkg-a): correct a bug',
          '  chore: update build process',
          '  fix(core)!: breaking change in core package',
        ],
      });
      process.exit(1);
    }
  }

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

  const versionPlanMessage = args.message || (await promptForMessage());
  const versionPlanFileContent = getVersionPlanFileContent(
    versionPlanBumps,
    versionPlanMessage
  );
  const versionPlanFileName = `version-plan-${new Date().getTime()}.md`;

  if (args.dryRun) {
    output.logSingleLine(
      `Would create version plan file "${versionPlanFileName}", but --dry-run was set.`
    );
    printDiff('', versionPlanFileContent, 1);
  } else {
    output.logSingleLine(`Creating version plan file "${versionPlanFileName}"`);
    printDiff('', versionPlanFileContent, 1);

    const versionPlansAbsolutePath = getVersionPlansAbsolutePath();
    await ensureDir(versionPlansAbsolutePath);
    await writeFile(
      join(versionPlansAbsolutePath, versionPlanFileName),
      versionPlanFileContent
    );
  }

  return 0;
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

async function promptForMessage(): Promise<string> {
  let message: string;
  do {
    message = await _promptForMessage();
  } while (!message);
  return message;
}

// TODO: support non-conventional commits messages (will require significant changelog renderer changes)
async function _promptForMessage(): Promise<string> {
  try {
    const reply = await prompt<{ message: string }>([
      {
        name: 'message',
        message:
          'What changelog message would you like associated with this change?',
        type: 'input',
      },
    ]);

    const conventionalCommitsMessage = parseConventionalCommitsMessage(
      reply.message
    );
    if (!conventionalCommitsMessage) {
      output.warn({
        title: 'Changelog message is not in conventional commits format.',
        bodyLines: [
          'Please ensure your message is in the form of:',
          '  type(optional scope): description',
          '',
          'For example:',
          '  feat(pkg-b): add new feature',
          '  fix(pkg-a): correct a bug',
          '  chore: update build process',
          '  fix(core)!: breaking change in core package',
        ],
      });
      return null;
    }

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
  return `---
${Object.entries(bumps)
  .filter(([_, version]) => version !== 'none')
  .map(([projectOrGroup, version]) => `${projectOrGroup}: ${version}`)
  .join('\n')}
---

${message}
`;
}
