import type { NxJsonConfiguration, NxOwnersConfiguration } from '@nx/devkit';
import type { CLIErrorMessageConfig } from '@nx/devkit/internal';

export type OwnerId = string;

const VALID_FORMATS_TO_DEFAULT_OUTPUT_PATH = {
  github: '.github/CODEOWNERS',
  gitlab: '.gitlab/CODEOWNERS',
  bitbucket: '.bitbucket/CODEOWNERS',
} as const;

export type OwnershipPattern = NonNullable<
  NxOwnersConfiguration['patterns']
>[number];

type GitLabSection = NonNullable<NxOwnersConfiguration['sections']>[number];

export interface RootOwnersConfig {
  format: keyof typeof VALID_FORMATS_TO_DEFAULT_OUTPUT_PATH;
  outputPath: string;
  prefix?: string;
  patterns: OwnershipPattern[];
  sections?: GitLabSection[];
}

export type ProjectOwnersConfig = Record<
  string,
  // Owners can be specified via an array shorthand or a config object with an optional description
  | OwnerId[]
  | {
      owners: OwnerId[];
      description?: string;
    }
>;

/**
 * @deprecated Use `NxJsonConfiguration` from `@nx/devkit` instead. This will be removed in Nx 25.
 */
export type NxJsonWithOwners = NxJsonConfiguration;

export function exitWithError({
  title,
  bodyLines,
}: CLIErrorMessageConfig): never {
  const errorData = {
    title,
    bodyLines,
  };
  let SyncError:
    | typeof import('nx/src/utils/sync-generators').SyncError
    | undefined = undefined;
  try {
    // Not all supported versions of nx have SyncError available at runtime
    ({ SyncError } = require('nx/src/utils/sync-generators'));
  } catch {
    /* empty */
  }
  if (SyncError) {
    throw new SyncError(errorData.title, errorData.bodyLines ?? []);
  }
  // Fall back to throwing a plain Error if SyncError is not available in the currently installed nx version
  throw new Error(JSON.stringify(errorData));
}

export function validateAndSetDefaultsForRootConfig(
  rootOwnersConfig: NxOwnersConfiguration
): rootOwnersConfig is RootOwnersConfig {
  // Set default values for config options
  // Allow an empty object in the root config, because project.json can be used exclusively if desired
  rootOwnersConfig.patterns = rootOwnersConfig.patterns ?? [];
  rootOwnersConfig.format = rootOwnersConfig.format ?? 'github';

  if (!VALID_FORMATS_TO_DEFAULT_OUTPUT_PATH[rootOwnersConfig.format]) {
    return exitWithError({
      title: 'Invalid "owners" config in nx.json',
      bodyLines: [
        `The "format" property must be one of the following values: ${Object.keys(VALID_FORMATS_TO_DEFAULT_OUTPUT_PATH).join(', ')}`,
      ],
    });
  }

  // Default output path based on format
  if (!rootOwnersConfig.outputPath) {
    rootOwnersConfig.outputPath =
      VALID_FORMATS_TO_DEFAULT_OUTPUT_PATH[rootOwnersConfig.format];
  }

  if (rootOwnersConfig.format !== 'gitlab' && rootOwnersConfig.sections) {
    return exitWithError({
      title: 'Invalid "owners" config in nx.json',
      bodyLines: [
        `The "sections" property is only valid for the "gitlab" format`,
      ],
    });
  }

  if (rootOwnersConfig.format === 'bitbucket') {
    if (rootOwnersConfig.patterns.some((p) => p.owners === false)) {
      return exitWithError({
        title: 'Invalid "owners" config in nx.json',
        bodyLines: [
          `When using Bitbucket, setting the "owners" property to false is not supported:`,
          JSON.stringify(
            rootOwnersConfig.patterns.find((p) => p.owners === false),
            null,
            2
          ),
        ],
      });
    }
  }

  ensureValidPatterns(rootOwnersConfig.patterns);

  if (rootOwnersConfig.sections) {
    for (const section of rootOwnersConfig.sections) {
      if (
        typeof section.optional !== 'undefined' &&
        typeof section.numberOfRequiredApprovals !== 'undefined'
      ) {
        return exitWithError({
          title: 'Invalid "owners" config in nx.json',
          bodyLines: [
            `The "optional" property cannot be used with "numberOfRequiredApprovals" in the following section:`,
            JSON.stringify(section, null, 2),
          ],
        });
      }
      if (
        typeof section.numberOfRequiredApprovals !== 'undefined' &&
        (!Number.isInteger(section.numberOfRequiredApprovals) ||
          section.numberOfRequiredApprovals < 1)
      ) {
        return exitWithError({
          title: 'Invalid "owners" config in nx.json',
          bodyLines: [
            `The "numberOfRequiredApprovals" property must be an integer greater than 0 in the following section:`,
            JSON.stringify(section, null, 2),
          ],
        });
      }

      ensureValidPatterns(section.patterns, section);
    }
  }

  return true;
}

function ensureValidPatterns(
  patterns: OwnershipPattern[],
  parentSection?: GitLabSection
) {
  for (const config of patterns) {
    const parentSectionHasValidDefaultOwners =
      Array.isArray(parentSection?.defaultOwners) &&
      parentSection?.defaultOwners.length > 0;

    if (config.owners !== false) {
      if (!Array.isArray(config.owners)) {
        // Not having owners is allowed only if there is a parent section with defaultOwners specified
        if (parentSection) {
          if (!parentSectionHasValidDefaultOwners) {
            return exitWithError({
              title: 'Invalid "owners" config in nx.json',
              bodyLines: [
                `The "owners" property must be an array for the following config entry (or you must specify "defaultOwners" on the parent section):`,
                JSON.stringify(config, null, 2),
              ],
            });
          }
        } else {
          return exitWithError({
            title: 'Invalid "owners" config in nx.json',
            bodyLines: [
              `The "owners" property must be an array for the following config entry:`,
              JSON.stringify(config, null, 2),
            ],
          });
        }
      } else if (config.owners.length === 0) {
        // Not having owners is allowed only if there is a parent section with defaultOwners specified
        if (parentSection) {
          if (!parentSectionHasValidDefaultOwners) {
            return exitWithError({
              title: 'Invalid "owners" config in nx.json',
              bodyLines: [
                `At least one owner must be specified in the "owners" array for the following config entry (or specified in the "defaultOwners" array in the parent section):`,
                JSON.stringify(config, null, 2),
              ],
            });
          }
        } else {
          return exitWithError({
            title: 'Invalid "owners" config in nx.json',
            bodyLines: [
              `At least one owner must be specified in the "owners" array for the following config entry:`,
              JSON.stringify(config, null, 2),
            ],
          });
        }
      }
    }

    // Must have at least "files" or "projects" (both together is also valid for scoped file overrides)
    if (!('files' in config) && !('projects' in config)) {
      return exitWithError({
        title: 'Invalid "owners" config in nx.json',
        bodyLines: [
          `Either "files" or "projects" (or both) is required in the following config entry:`,
          JSON.stringify(config, null, 2),
        ],
      });
    }

    if ('files' in config) {
      if (!Array.isArray(config.files)) {
        return exitWithError({
          title: 'Invalid "owners" config in nx.json',
          bodyLines: [
            `The "files" property must be an array for the following config entry:`,
            JSON.stringify(config, null, 2),
          ],
        });
      }
      if (config.files.length === 0) {
        return exitWithError({
          title: 'Invalid "owners" config in nx.json',
          bodyLines: [
            `At least one file (or "*" for all files) must be specified in the "files" array for the following config entry:`,
            JSON.stringify(config, null, 2),
          ],
        });
      }
    }

    if ('projects' in config) {
      if (!Array.isArray(config.projects)) {
        return exitWithError({
          title: 'Invalid "owners" config in nx.json',
          bodyLines: [
            `The "projects" property must be an array for the following config entry:`,
            JSON.stringify(config, null, 2),
          ],
        });
      }
      if (config.projects.length === 0) {
        return exitWithError({
          title: 'Invalid "owners" config in nx.json',
          bodyLines: [
            `At least one project pattern must be specified in the "projects" array for the following config entry:`,
            JSON.stringify(config, null, 2),
          ],
        });
      }
    }
  }
}
