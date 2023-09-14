import * as chalk from 'chalk';
import * as enquirer from 'enquirer';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { RELEASE_TYPES, valid } from 'semver';
import { Generator } from '../../config/misc-interfaces';
import { readNxJson } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import {
  NxJsonConfiguration,
  joinPathFragments,
  logger,
  output,
  workspaceRoot,
} from '../../devkit-exports';
import { FsTree, Tree, flushChanges } from '../../generators/tree';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { NxArgs } from '../../utils/command-line-utils';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { combineOptionsForGenerator } from '../../utils/params';
import { parseGeneratorString } from '../generate/generate';
import { getGeneratorInformation } from '../generate/generator-utils';
import { VersionOptions } from './command-object';
import { createNxReleaseConfig } from './config/config';
import {
  CATCH_ALL_RELEASE_GROUP,
  ReleaseGroup,
  createReleaseGroups,
  handleCreateReleaseGroupsError,
} from './config/create-release-groups';
import { printDiff } from './utils/print-diff';
import { isRelativeVersionKeyword } from './utils/semver';

// Reexport for use in plugin release-version generator implementations
export { deriveNewSemverVersion } from './utils/semver';

export interface ReleaseVersionGeneratorSchema {
  // The projects being versioned in the current execution
  projects: ProjectGraphProjectNode[];
  projectGraph: ProjectGraph;
  specifier: string;
  packageRoot?: string;
  currentVersionResolver?: 'registry' | 'disk';
  currentVersionResolverMetadata?: Record<string, unknown>;
}

export async function versionHandler(args: VersionOptions): Promise<void> {
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const nxJson = readNxJson();

  const nxArgs = args as NxArgs;
  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  // Apply default configuration to any optional user configuration
  const nxReleaseConfig = createNxReleaseConfig(nxJson.release);
  const releaseGroupsData = await createReleaseGroups(
    projectGraph,
    nxReleaseConfig.groups
  );
  if (releaseGroupsData.error) {
    return await handleCreateReleaseGroupsError(releaseGroupsData.error);
  }

  const tree = new FsTree(workspaceRoot, nxArgs.verbose);

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
     * Run semver versioning for all remaining release groups and filtered projects within them
     */
    for (const releaseGroup of releaseGroups) {
      const releaseGroupName = releaseGroup.name;

      // Resolve the generator data for the current release group
      const generatorData = resolveGeneratorData({
        ...extractGeneratorCollectionAndName(
          `release-group "${releaseGroupName}"`,
          releaseGroup.version.generator
        ),
        configGeneratorOptions: releaseGroup.version.generatorOptions,
      });

      const semverSpecifier = await resolveSemverSpecifier(
        args.specifier,
        `What kind of change is this for the ${
          releaseGroupToFilteredProjects.get(releaseGroup).size
        } matched project(s) within release group "${releaseGroupName}"?`,
        `What is the exact version for the ${
          releaseGroupToFilteredProjects.get(releaseGroup).size
        } matched project(s) within release group "${releaseGroupName}"?`
      );

      await runVersionOnProjects(
        projectGraph,
        nxJson,
        nxArgs,
        tree,
        generatorData,
        Array.from(releaseGroupToFilteredProjects.get(releaseGroup)),
        semverSpecifier
      );
    }

    printChanges(tree, !!args.dryRun);

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
   * Run semver versioning for all remaining release groups
   */
  for (const releaseGroup of releaseGroups) {
    const releaseGroupName = releaseGroup.name;

    // Resolve the generator data for the current release group
    const generatorData = resolveGeneratorData({
      ...extractGeneratorCollectionAndName(
        `release-group "${releaseGroupName}"`,
        releaseGroup.version.generator
      ),
      configGeneratorOptions: releaseGroup.version.generatorOptions,
    });

    const semverSpecifier = await resolveSemverSpecifier(
      args.specifier,
      releaseGroupName === CATCH_ALL_RELEASE_GROUP
        ? `What kind of change is this for all packages?`
        : `What kind of change is this for release group "${releaseGroupName}"?`,
      releaseGroupName === CATCH_ALL_RELEASE_GROUP
        ? `What is the exact version for all packages?`
        : `What is the exact version for release group "${releaseGroupName}"?`
    );

    await runVersionOnProjects(
      projectGraph,
      nxJson,
      nxArgs,
      tree,
      generatorData,
      releaseGroup.projects,
      semverSpecifier
    );
  }

  printChanges(tree, !!args.dryRun);

  process.exit(0);
}

async function runVersionOnProjects(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  nxArgs: NxArgs,
  tree: Tree,
  generatorData: GeneratorData,
  projectNames: string[],
  newVersionSpecifier: string
) {
  // Should be impossible state
  if (!newVersionSpecifier) {
    output.error({
      title: `No version or semver keyword could be determined`,
    });
    process.exit(1);
  }
  // Specifier could be user provided so we need to validate it
  if (
    !valid(newVersionSpecifier) &&
    !isRelativeVersionKeyword(newVersionSpecifier)
  ) {
    output.error({
      title: `The given version specifier "${newVersionSpecifier}" is not valid. You provide an exact version or a valid semver keyword such as "major", "minor", "patch", etc.`,
    });
    process.exit(1);
  }

  const generatorOptions: ReleaseVersionGeneratorSchema = {
    projects: projectNames.map((p) => projectGraph.nodes[p]),
    projectGraph,
    specifier: newVersionSpecifier,
    ...generatorData.configGeneratorOptions,
  };

  // Apply generator defaults from schema.json file etc
  const combinedOpts = await combineOptionsForGenerator(
    generatorOptions as any,
    generatorData.collectionName,
    generatorData.normalizedGeneratorName,
    readProjectsConfigurationFromProjectGraph(projectGraph),
    nxJson,
    generatorData.schema,
    false,
    null,
    relative(process.cwd(), workspaceRoot),
    nxArgs.verbose
  );

  const releaseVersionGenerator = generatorData.implementationFactory();
  await releaseVersionGenerator(tree, combinedOpts);
}

function printChanges(tree: Tree, isDryRun: boolean) {
  const changes = tree.listChanges();

  console.log('');

  // Print the changes
  changes.forEach((f) => {
    if (f.type === 'CREATE') {
      console.error(
        `${chalk.green('CREATE')} ${f.path}${
          isDryRun ? chalk.keyword('orange')(' [dry-run]') : ''
        }`
      );
      printDiff('', f.content?.toString() || '');
    } else if (f.type === 'UPDATE') {
      console.error(
        `${chalk.white('UPDATE')} ${f.path}${
          isDryRun ? chalk.keyword('orange')(' [dry-run]') : ''
        }`
      );
      const currentContentsOnDisk = readFileSync(
        joinPathFragments(tree.root, f.path)
      ).toString();
      printDiff(currentContentsOnDisk, f.content?.toString() || '');
    } else if (f.type === 'DELETE') {
      throw new Error(
        'Unexpected DELETE change, please report this as an issue'
      );
    }
  });

  if (!isDryRun) {
    flushChanges(workspaceRoot, changes);
  }

  if (isDryRun) {
    logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
  }
}

async function resolveSemverSpecifier(
  cliArgSpecifier: string,
  selectionMessage: string,
  customVersionMessage: string
): Promise<string> {
  try {
    let newVersionSpecifier = cliArgSpecifier;
    // If the user didn't provide a new version specifier directly on the CLI, prompt for one
    if (!newVersionSpecifier) {
      const reply = await enquirer.prompt<{ specifier: string }>([
        {
          name: 'specifier',
          message: selectionMessage,
          type: 'select',
          choices: [
            ...RELEASE_TYPES.map((t) => ({ name: t, message: t })),
            {
              name: 'custom',
              message: 'Custom exact version',
            },
          ],
        },
      ]);
      if (reply.specifier !== 'custom') {
        newVersionSpecifier = reply.specifier;
      } else {
        const reply = await enquirer.prompt<{ specifier: string }>([
          {
            name: 'specifier',
            message: customVersionMessage,
            type: 'input',
            validate: (input) => {
              if (valid(input)) {
                return true;
              }
              return 'Please enter a valid semver version';
            },
          },
        ]);
        newVersionSpecifier = reply.specifier;
      }
    }
    return newVersionSpecifier;
  } catch {
    // We need to catch the error from enquirer prompt, otherwise yargs will print its help
    process.exit(1);
  }
}

function extractGeneratorCollectionAndName(
  description: string,
  generatorString: string
) {
  let collectionName: string;
  let generatorName: string;
  const parsedGeneratorString = parseGeneratorString(generatorString);
  collectionName = parsedGeneratorString.collection;
  generatorName = parsedGeneratorString.generator;

  if (!collectionName || !generatorName) {
    throw new Error(
      `Invalid generator string: ${generatorString} used for ${description}. Must be in the format of [collectionName]:[generatorName]`
    );
  }

  return { collectionName, generatorName };
}

interface GeneratorData {
  collectionName: string;
  generatorName: string;
  configGeneratorOptions: NxJsonConfiguration['release']['groups'][number]['version']['generatorOptions'];
  normalizedGeneratorName: string;
  schema: any;
  implementationFactory: () => Generator<unknown>;
}

function resolveGeneratorData({
  collectionName,
  generatorName,
  configGeneratorOptions,
}): GeneratorData {
  const { normalizedGeneratorName, schema, implementationFactory } =
    getGeneratorInformation(collectionName, generatorName, workspaceRoot);

  return {
    collectionName,
    generatorName,
    configGeneratorOptions,
    normalizedGeneratorName,
    schema,
    implementationFactory,
  };
}
