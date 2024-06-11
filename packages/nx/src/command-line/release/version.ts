import * as chalk from 'chalk';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { Generator } from '../../config/misc-interfaces';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { FsTree, Tree, flushChanges } from '../../generators/tree';
import { createProjectFileMapUsingProjectGraph } from '../../project-graph/file-map-utils';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { output } from '../../utils/output';
import { combineOptionsForGenerator, handleErrors } from '../../utils/params';
import { joinPathFragments } from '../../utils/path';
import { workspaceRoot } from '../../utils/workspace-root';
import { parseGeneratorString } from '../generate/generate';
import { getGeneratorInformation } from '../generate/generator-utils';
import { VersionOptions } from './command-object';
import {
  NxReleaseConfig,
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import {
  ReleaseGroupWithName,
  filterReleaseGroups,
} from './config/filter-release-groups';
import {
  readRawVersionPlans,
  setVersionPlansOnGroups,
} from './config/version-plans';
import { batchProjectsByGeneratorConfig } from './utils/batch-projects-by-generator-config';
import { gitAdd, gitTag } from './utils/git';
import { printDiff } from './utils/print-changes';
import { resolveNxJsonConfigErrorMessage } from './utils/resolve-nx-json-error-message';
import {
  ReleaseVersionGeneratorResult,
  VersionData,
  commitChanges,
  createCommitMessageValues,
  createGitTagValues,
  handleDuplicateGitTags,
} from './utils/shared';

const LARGE_BUFFER = 1024 * 1000000;

// Reexport some utils for use in plugin release-version generator implementations
export { deriveNewSemverVersion } from './utils/semver';
export type {
  ReleaseVersionGeneratorResult,
  VersionData,
} from './utils/shared';

export const validReleaseVersionPrefixes = ['auto', '', '~', '^', '='] as const;

export interface ReleaseVersionGeneratorSchema {
  // The projects being versioned in the current execution
  projects: ProjectGraphProjectNode[];
  releaseGroup: ReleaseGroupWithName;
  projectGraph: ProjectGraph;
  specifier?: string;
  specifierSource?: 'prompt' | 'conventional-commits' | 'version-plans';
  preid?: string;
  packageRoot?: string;
  currentVersionResolver?: 'registry' | 'disk' | 'git-tag';
  currentVersionResolverMetadata?: Record<string, unknown>;
  fallbackCurrentVersionResolver?: 'disk';
  firstRelease?: boolean;
  // auto means the existing prefix will be preserved, and is the default behavior
  versionPrefix?: (typeof validReleaseVersionPrefixes)[number];
  skipLockFileUpdate?: boolean;
  installArgs?: string;
  installIgnoreScripts?: boolean;
  conventionalCommitsConfig?: NxReleaseConfig['conventionalCommits'];
  deleteVersionPlans?: boolean;
  /**
   * 'auto' allows users to opt into dependents being updated (a patch version bump) when a dependency is versioned.
   * This is only applicable to independently released projects.
   */
  updateDependents?: 'never' | 'auto';
}

export interface NxReleaseVersionResult {
  /**
   * In one specific (and very common) case, an overall workspace version is relevant, for example when there is
   * only a single release group in which all projects have a fixed relationship to each other. In this case, the
   * overall workspace version is the same as the version of the release group (and every project within it). This
   * version could be a `string`, or it could be `null` if using conventional commits and no changes were detected.
   *
   * In all other cases (independent versioning, multiple release groups etc), the overall workspace version is
   * not applicable and will be `undefined` here. If a user attempts to use this value later when it is `undefined`
   * (for example in the changelog command), we will throw an appropriate error.
   */
  workspaceVersion: (string | null) | undefined;
  projectsVersionData: VersionData;
}

export const releaseVersionCLIHandler = (args: VersionOptions) =>
  handleErrors(args.verbose, () => releaseVersion(args));

/**
 * NOTE: This function is also exported for programmatic usage and forms part of the public API
 * of Nx. We intentionally do not wrap the implementation with handleErrors because users need
 * to have control over their own error handling when using the API.
 */
export async function releaseVersion(
  args: VersionOptions
): Promise<NxReleaseVersionResult> {
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const { projects } = readProjectsConfigurationFromProjectGraph(projectGraph);
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

  // The nx release top level command will always override these three git args. This is how we can tell
  // if the top level release command was used or if the user is using the changelog subcommand.
  // If the user explicitly overrides these args, then it doesn't matter if the top level config is set,
  // as all of the git options would be overridden anyway.
  if (
    (args.gitCommit === undefined ||
      args.gitTag === undefined ||
      args.stageChanges === undefined) &&
    nxJson.release?.git
  ) {
    const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
      'release',
      'git',
    ]);
    output.error({
      title: `The "release.git" property in nx.json may not be used with the "nx release version" subcommand or programmatic API. Instead, configure git options for subcommands directly with "release.version.git" and "release.changelog.git".`,
      bodyLines: [nxJsonMessage],
    });
    process.exit(1);
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
  const rawVersionPlans = await readRawVersionPlans();
  setVersionPlansOnGroups(
    rawVersionPlans,
    releaseGroups,
    Object.keys(projectGraph.nodes)
  );

  if (args.deleteVersionPlans === undefined) {
    // default to not delete version plans after versioning as they may be needed for changelog generation
    args.deleteVersionPlans = false;
  }

  runPreVersionCommand(nxReleaseConfig.version.preVersionCommand, {
    dryRun: args.dryRun,
    verbose: args.verbose,
  });

  const tree = new FsTree(workspaceRoot, args.verbose);

  const versionData: VersionData = {};
  const commitMessage: string | undefined =
    args.gitCommitMessage || nxReleaseConfig.version.git.commitMessage;
  const generatorCallbacks: (() => Promise<void>)[] = [];

  /**
   * additionalChangedFiles are files which need to be updated as a side-effect of versioning (such as package manager lock files),
   * and need to get staged and committed as part of the existing commit, if applicable.
   */
  const additionalChangedFiles = new Set<string>();
  const additionalDeletedFiles = new Set<string>();

  if (args.projects?.length) {
    /**
     * Run versioning for all remaining release groups and filtered projects within them
     */
    for (const releaseGroup of releaseGroups) {
      const releaseGroupName = releaseGroup.name;
      const releaseGroupProjectNames = Array.from(
        releaseGroupToFilteredProjects.get(releaseGroup)
      );
      const projectBatches = batchProjectsByGeneratorConfig(
        projectGraph,
        releaseGroup,
        // Only batch based on the filtered projects within the release group
        releaseGroupProjectNames
      );

      for (const [
        generatorConfigString,
        projectNames,
      ] of projectBatches.entries()) {
        const [generatorName, generatorOptions] = JSON.parse(
          generatorConfigString
        );
        // Resolve the generator for the batch and run versioning on the projects within the batch
        const generatorData = resolveGeneratorData({
          ...extractGeneratorCollectionAndName(
            `batch "${JSON.stringify(
              projectNames
            )}" for release-group "${releaseGroupName}"`,
            generatorName
          ),
          configGeneratorOptions: generatorOptions,
          // all project data from the project graph (not to be confused with projectNamesToRunVersionOn)
          projects,
        });
        const generatorCallback = await runVersionOnProjects(
          projectGraph,
          nxJson,
          args,
          tree,
          generatorData,
          args.generatorOptionsOverrides,
          projectNames,
          releaseGroup,
          versionData,
          nxReleaseConfig.conventionalCommits
        );
        // Capture the callback so that we can run it after flushing the changes to disk
        generatorCallbacks.push(async () => {
          const result = await generatorCallback(tree, {
            dryRun: !!args.dryRun,
            verbose: !!args.verbose,
            generatorOptions: {
              ...generatorOptions,
              ...args.generatorOptionsOverrides,
            },
          });
          const { changedFiles, deletedFiles } =
            parseGeneratorCallbackResult(result);
          changedFiles.forEach((f) => additionalChangedFiles.add(f));
          deletedFiles.forEach((f) => additionalDeletedFiles.add(f));
        });
      }
    }

    // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
    const gitTagValues: string[] =
      args.gitTag ?? nxReleaseConfig.version.git.tag
        ? createGitTagValues(
            releaseGroups,
            releaseGroupToFilteredProjects,
            versionData
          )
        : [];
    handleDuplicateGitTags(gitTagValues);

    printAndFlushChanges(tree, !!args.dryRun);

    for (const generatorCallback of generatorCallbacks) {
      await generatorCallback();
    }

    const changedFiles = [
      ...tree.listChanges().map((f) => f.path),
      ...additionalChangedFiles,
    ];

    // No further actions are necessary in this scenario (e.g. if conventional commits detected no changes)
    if (!changedFiles.length) {
      return {
        // An overall workspace version cannot be relevant when filtering to independent projects
        workspaceVersion: undefined,
        projectsVersionData: versionData,
      };
    }

    if (args.gitCommit ?? nxReleaseConfig.version.git.commit) {
      await commitChanges({
        changedFiles,
        deletedFiles: Array.from(additionalDeletedFiles),
        isDryRun: !!args.dryRun,
        isVerbose: !!args.verbose,
        gitCommitMessages: createCommitMessageValues(
          releaseGroups,
          releaseGroupToFilteredProjects,
          versionData,
          commitMessage
        ),
        gitCommitArgs:
          args.gitCommitArgs || nxReleaseConfig.version.git.commitArgs,
      });
    } else if (args.stageChanges ?? nxReleaseConfig.version.git.stageChanges) {
      output.logSingleLine(`Staging changed files with git`);
      await gitAdd({
        changedFiles,
        dryRun: args.dryRun,
        verbose: args.verbose,
      });
    }

    if (args.gitTag ?? nxReleaseConfig.version.git.tag) {
      output.logSingleLine(`Tagging commit with git`);
      for (const tag of gitTagValues) {
        await gitTag({
          tag,
          message: args.gitTagMessage || nxReleaseConfig.version.git.tagMessage,
          additionalArgs:
            args.gitTagArgs || nxReleaseConfig.version.git.tagArgs,
          dryRun: args.dryRun,
          verbose: args.verbose,
        });
      }
    }

    return {
      // An overall workspace version cannot be relevant when filtering to independent projects
      workspaceVersion: undefined,
      projectsVersionData: versionData,
    };
  }

  /**
   * Run versioning for all remaining release groups
   */
  for (const releaseGroup of releaseGroups) {
    const releaseGroupName = releaseGroup.name;
    const projectBatches = batchProjectsByGeneratorConfig(
      projectGraph,
      releaseGroup,
      // Batch based on all projects within the release group
      releaseGroup.projects
    );

    for (const [
      generatorConfigString,
      projectNames,
    ] of projectBatches.entries()) {
      const [generatorName, generatorOptions] = JSON.parse(
        generatorConfigString
      );
      // Resolve the generator for the batch and run versioning on the projects within the batch
      const generatorData = resolveGeneratorData({
        ...extractGeneratorCollectionAndName(
          `batch "${JSON.stringify(
            projectNames
          )}" for release-group "${releaseGroupName}"`,
          generatorName
        ),
        configGeneratorOptions: generatorOptions,
        // all project data from the project graph (not to be confused with projectNamesToRunVersionOn)
        projects,
      });
      const generatorCallback = await runVersionOnProjects(
        projectGraph,
        nxJson,
        args,
        tree,
        generatorData,
        args.generatorOptionsOverrides,
        projectNames,
        releaseGroup,
        versionData,
        nxReleaseConfig.conventionalCommits
      );
      // Capture the callback so that we can run it after flushing the changes to disk
      generatorCallbacks.push(async () => {
        const result = await generatorCallback(tree, {
          dryRun: !!args.dryRun,
          verbose: !!args.verbose,
          generatorOptions: {
            ...generatorOptions,
            ...args.generatorOptionsOverrides,
          },
        });
        const { changedFiles, deletedFiles } =
          parseGeneratorCallbackResult(result);
        changedFiles.forEach((f) => additionalChangedFiles.add(f));
        deletedFiles.forEach((f) => additionalDeletedFiles.add(f));
      });
    }
  }

  // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
  const gitTagValues: string[] =
    args.gitTag ?? nxReleaseConfig.version.git.tag
      ? createGitTagValues(
          releaseGroups,
          releaseGroupToFilteredProjects,
          versionData
        )
      : [];
  handleDuplicateGitTags(gitTagValues);

  printAndFlushChanges(tree, !!args.dryRun);

  for (const generatorCallback of generatorCallbacks) {
    await generatorCallback();
  }

  // Only applicable when there is a single release group with a fixed relationship
  let workspaceVersion: string | null | undefined = undefined;
  if (releaseGroups.length === 1) {
    const releaseGroup = releaseGroups[0];
    if (releaseGroup.projectsRelationship === 'fixed') {
      const releaseGroupProjectNames = Array.from(
        releaseGroupToFilteredProjects.get(releaseGroup)
      );
      workspaceVersion = versionData[releaseGroupProjectNames[0]].newVersion; // all projects have the same version so we can just grab the first
    }
  }

  const changedFiles = [
    ...tree.listChanges().map((f) => f.path),
    ...additionalChangedFiles,
  ];

  // No further actions are necessary in this scenario (e.g. if conventional commits detected no changes)
  if (!changedFiles.length) {
    return {
      workspaceVersion,
      projectsVersionData: versionData,
    };
  }

  if (args.gitCommit ?? nxReleaseConfig.version.git.commit) {
    await commitChanges({
      changedFiles,
      deletedFiles: Array.from(additionalDeletedFiles),
      isDryRun: !!args.dryRun,
      isVerbose: !!args.verbose,
      gitCommitMessages: createCommitMessageValues(
        releaseGroups,
        releaseGroupToFilteredProjects,
        versionData,
        commitMessage
      ),
      gitCommitArgs:
        args.gitCommitArgs || nxReleaseConfig.version.git.commitArgs,
    });
  } else if (args.stageChanges ?? nxReleaseConfig.version.git.stageChanges) {
    output.logSingleLine(`Staging changed files with git`);
    await gitAdd({
      changedFiles,
      dryRun: args.dryRun,
      verbose: args.verbose,
    });
  }

  if (args.gitTag ?? nxReleaseConfig.version.git.tag) {
    output.logSingleLine(`Tagging commit with git`);
    for (const tag of gitTagValues) {
      await gitTag({
        tag,
        message: args.gitTagMessage || nxReleaseConfig.version.git.tagMessage,
        additionalArgs: args.gitTagArgs || nxReleaseConfig.version.git.tagArgs,
        dryRun: args.dryRun,
        verbose: args.verbose,
      });
    }
  }

  return {
    workspaceVersion,
    projectsVersionData: versionData,
  };
}

function appendVersionData(
  existingVersionData: VersionData,
  newVersionData: VersionData
): VersionData {
  // Mutate the existing version data
  for (const [key, value] of Object.entries(newVersionData)) {
    if (existingVersionData[key]) {
      throw new Error(
        `Version data key "${key}" already exists in version data. This is likely a bug, please report your use-case on https://github.com/nrwl/nx`
      );
    }
    existingVersionData[key] = value;
  }
  return existingVersionData;
}

async function runVersionOnProjects(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  args: VersionOptions,
  tree: Tree,
  generatorData: GeneratorData,
  generatorOverrides: Record<string, unknown> | undefined,
  projectNames: string[],
  releaseGroup: ReleaseGroupWithName,
  versionData: VersionData,
  conventionalCommitsConfig: NxReleaseConfig['conventionalCommits']
): Promise<ReleaseVersionGeneratorResult['callback']> {
  const generatorOptions: ReleaseVersionGeneratorSchema = {
    // Always ensure a string to avoid generator schema validation errors
    specifier: args.specifier ?? '',
    preid: args.preid ?? '',
    ...generatorData.configGeneratorOptions,
    ...(generatorOverrides ?? {}),
    // The following are not overridable by user config
    projects: projectNames.map((p) => projectGraph.nodes[p]),
    projectGraph,
    releaseGroup,
    firstRelease: args.firstRelease ?? false,
    conventionalCommitsConfig,
    deleteVersionPlans: args.deleteVersionPlans,
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
    args.verbose
  );

  const releaseVersionGenerator = generatorData.implementationFactory();

  // We expect all version generator implementations to return a ReleaseVersionGeneratorResult object, rather than a GeneratorCallback
  const versionResult = (await releaseVersionGenerator(
    tree,
    combinedOpts
  )) as unknown as ReleaseVersionGeneratorResult;

  if (typeof versionResult === 'function') {
    throw new Error(
      `The version generator ${generatorData.collectionName}:${generatorData.normalizedGeneratorName} returned a function instead of an expected ReleaseVersionGeneratorResult`
    );
  }

  // Merge the extra version data into the existing
  appendVersionData(versionData, versionResult.data);

  return versionResult.callback;
}

function printAndFlushChanges(tree: Tree, isDryRun: boolean) {
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
    } else if (f.type === 'DELETE' && !f.path.includes('.nx')) {
      throw new Error(
        'Unexpected DELETE change, please report this as an issue'
      );
    }
  });

  if (!isDryRun) {
    flushChanges(workspaceRoot, changes);
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
  projects,
}): GeneratorData {
  try {
    const { normalizedGeneratorName, schema, implementationFactory } =
      getGeneratorInformation(
        collectionName,
        generatorName,
        workspaceRoot,
        projects
      );

    return {
      collectionName,
      generatorName,
      configGeneratorOptions,
      normalizedGeneratorName,
      schema,
      implementationFactory,
    };
  } catch (err) {
    if (err.message.startsWith('Unable to resolve')) {
      // See if it is because the plugin is not installed
      try {
        require.resolve(collectionName);
        // is installed
        throw new Error(
          `Unable to resolve the generator called "${generatorName}" within the "${collectionName}" package`
        );
      } catch {
        /**
         * Special messaging for the most common case (especially as the user is unlikely to explicitly have
         * the @nx/js generator config in their nx.json so we need to be clear about what the problem is)
         */
        if (collectionName === '@nx/js') {
          throw new Error(
            'The @nx/js plugin is required in order to version your JavaScript packages. Run "nx add @nx/js" to add it to your workspace.'
          );
        }
        throw new Error(
          `Unable to resolve the package ${collectionName} in order to load the generator called ${generatorName}. Is the package installed?`
        );
      }
    }
    // Unexpected error, rethrow
    throw err;
  }
}
function runPreVersionCommand(
  preVersionCommand: string,
  { dryRun, verbose }: { dryRun: boolean; verbose: boolean }
) {
  if (!preVersionCommand) {
    return;
  }

  output.logSingleLine(`Executing pre-version command`);
  if (verbose) {
    console.log(`Executing the following pre-version command:`);
    console.log(preVersionCommand);
  }

  let env: Record<string, string> = {
    ...process.env,
  };
  if (dryRun) {
    env.NX_DRY_RUN = 'true';
  }

  const stdio = verbose ? 'inherit' : 'pipe';
  try {
    execSync(preVersionCommand, {
      encoding: 'utf-8',
      maxBuffer: LARGE_BUFFER,
      stdio,
      env,
    });
  } catch (e) {
    const title = verbose
      ? `The pre-version command failed. See the full output above.`
      : `The pre-version command failed. Retry with --verbose to see the full output of the pre-version command.`;
    output.error({
      title,
      bodyLines: [preVersionCommand, e],
    });
    process.exit(1);
  }
}

function parseGeneratorCallbackResult(
  result: string[] | { changedFiles: string[]; deletedFiles: string[] }
): { changedFiles: string[]; deletedFiles: string[] } {
  if (Array.isArray(result)) {
    return {
      changedFiles: result,
      deletedFiles: [],
    };
  } else {
    return result;
  }
}
