import {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  Tree,
  formatFiles,
  joinPathFragments,
  output,
  readJson,
  updateJson,
  workspaceRoot,
  writeJson,
} from '@nx/devkit';
import * as chalk from 'chalk';
import { exec } from 'node:child_process';
import { join } from 'node:path';
import { IMPLICIT_DEFAULT_RELEASE_GROUP } from 'nx/src/command-line/release/config/config';
import {
  getFirstGitCommit,
  getLatestGitTagForPattern,
} from 'nx/src/command-line/release/utils/git';
import {
  resolveSemverSpecifierFromConventionalCommits,
  resolveSemverSpecifierFromPrompt,
} from 'nx/src/command-line/release/utils/resolve-semver-specifier';
import { isValidSemverSpecifier } from 'nx/src/command-line/release/utils/semver';
import {
  ReleaseVersionGeneratorResult,
  VersionData,
  deriveNewSemverVersion,
  validReleaseVersionPrefixes,
} from 'nx/src/command-line/release/version';
import { interpolate } from 'nx/src/tasks-runner/utils';
import * as ora from 'ora';
import { prerelease } from 'semver';
import { parseRegistryOptions } from '../../utils/npm-config';
import { ReleaseVersionGeneratorSchema } from './schema';
import {
  LocalPackageDependency,
  resolveLocalPackageDependencies,
} from './utils/resolve-local-package-dependencies';
import { updateLockFile } from './utils/update-lock-file';

export async function releaseVersionGenerator(
  tree: Tree,
  options: ReleaseVersionGeneratorSchema
): Promise<ReleaseVersionGeneratorResult> {
  try {
    const versionData: VersionData = {};

    // If the user provided a specifier, validate that it is valid semver or a relative semver keyword
    if (options.specifier) {
      if (!isValidSemverSpecifier(options.specifier)) {
        throw new Error(
          `The given version specifier "${options.specifier}" is not valid. You provide an exact version or a valid semver keyword such as "major", "minor", "patch", etc.`
        );
      }
      // The node semver library classes a leading `v` as valid, but we want to ensure it is not present in the final version
      options.specifier = options.specifier.replace(/^v/, '');
    }

    if (
      options.versionPrefix &&
      validReleaseVersionPrefixes.indexOf(options.versionPrefix) === -1
    ) {
      throw new Error(
        `Invalid value for version.generatorOptions.versionPrefix: "${
          options.versionPrefix
        }"

Valid values are: ${validReleaseVersionPrefixes
          .map((s) => `"${s}"`)
          .join(', ')}`
      );
    }

    if (options.firstRelease) {
      // always use disk as a fallback for the first release
      options.fallbackCurrentVersionResolver = 'disk';
    }

    // Set defaults for updateDependentsOptions
    const updateDependentsOptions = options.updateDependents ?? {};
    // "auto" means "only when the dependents are already included in the current batch", and is the default
    updateDependentsOptions.when = updateDependentsOptions.when || 'auto';
    // in the case "when" is set to "always", what semver bump should be applied to the dependents which are not included in the current batch
    updateDependentsOptions.bump = updateDependentsOptions.bump || 'patch';

    // Sort the projects topologically because there are cases where we need to perform updates based on dependent relationships
    // TODO: maybe move this sorting to the command level?
    const projects = sortProjectsTopologically(
      options.projectGraph,
      options.projects
    );
    const projectToDependencyBumps = new Map<string, any>();

    const resolvePackageRoot = createResolvePackageRoot(options.packageRoot);

    // Resolve any custom package roots for each project upfront as they will need to be reused during dependency resolution
    const projectNameToPackageRootMap = new Map<string, string>();
    for (const project of projects) {
      projectNameToPackageRootMap.set(
        project.name,
        resolvePackageRoot(project)
      );
    }

    let currentVersion: string | undefined = undefined;
    let currentVersionResolvedFromFallback = false;

    // only used for options.currentVersionResolver === 'git-tag', but
    // must be declared here in order to reuse it for additional projects
    let latestMatchingGitTag:
      | { tag: string; extractedVersion: string }
      | null
      | undefined = undefined;

    // if specifier is undefined, then we haven't resolved it yet
    // if specifier is null, then it has been resolved and no changes are necessary
    let specifier: string | null | undefined = options.specifier
      ? options.specifier
      : undefined;

    for (const project of projects) {
      const projectName = project.name;
      const packageRoot = projectNameToPackageRootMap.get(projectName);
      if (!packageRoot) {
        throw new Error(
          `The project "${projectName}" does not have a packageRoot available. Please report this issue on https://github.com/nrwl/nx`
        );
      }

      const packageJsonPath = join(packageRoot, 'package.json');

      const color = getColor(projectName);
      const log = (msg: string) => {
        console.log(color.instance.bold(projectName) + ' ' + msg);
      };

      if (!tree.exists(packageJsonPath)) {
        throw new Error(
          `The project "${projectName}" does not have a package.json available at ${packageJsonPath}.

To fix this you will either need to add a package.json file at that location, or configure "release" within your nx.json to exclude "${projectName}" from the current release group, or amend the packageRoot configuration to point to where the package.json should be.`
        );
      }

      output.logSingleLine(
        `Running release version for project: ${color.instance.bold(
          project.name
        )}`
      );

      const packageJson = readJson(tree, packageJsonPath);
      log(
        `🔍 Reading data for package "${packageJson.name}" from ${packageJsonPath}`
      );

      const { name: packageName, version: currentVersionFromDisk } =
        packageJson;

      switch (options.currentVersionResolver) {
        case 'registry': {
          const metadata = options.currentVersionResolverMetadata;
          const registryArg =
            typeof metadata?.registry === 'string'
              ? metadata.registry
              : undefined;
          const tagArg =
            typeof metadata?.tag === 'string' ? metadata.tag : undefined;

          const warnFn = (message: string) => {
            console.log(chalk.keyword('orange')(message));
          };
          const { registry, tag, registryConfigKey } =
            await parseRegistryOptions(
              workspaceRoot,
              {
                packageRoot: join(workspaceRoot, packageRoot),
                packageJson,
              },
              {
                registry: registryArg,
                tag: tagArg,
              },
              warnFn
            );

          /**
           * If the currentVersionResolver is set to registry, and the projects are not independent, we only want to make the request once for the whole batch of projects.
           * For independent projects, we need to make a request for each project individually as they will most likely have different versions.
           */
          if (
            !currentVersion ||
            options.releaseGroup.projectsRelationship === 'independent'
          ) {
            const spinner = ora(
              `${Array.from(new Array(projectName.length + 3)).join(
                ' '
              )}Resolving the current version for tag "${tag}" on ${registry}`
            );
            spinner.color =
              color.spinnerColor as typeof colors[number]['spinnerColor'];
            spinner.start();

            try {
              // Must be non-blocking async to allow spinner to render
              currentVersion = await new Promise<string>((resolve, reject) => {
                exec(
                  `npm view ${packageName} version --"${registryConfigKey}=${registry}" --tag=${tag}`,
                  (error, stdout, stderr) => {
                    if (error) {
                      return reject(error);
                    }
                    if (stderr) {
                      return reject(stderr);
                    }
                    return resolve(stdout.trim());
                  }
                );
              });

              spinner.stop();

              log(
                `📄 Resolved the current version as ${currentVersion} for tag "${tag}" from registry ${registry}`
              );
            } catch (e) {
              spinner.stop();

              if (options.fallbackCurrentVersionResolver === 'disk') {
                log(
                  `📄 Unable to resolve the current version from the registry ${registry}. Falling back to the version on disk of ${currentVersionFromDisk}`
                );
                currentVersion = currentVersionFromDisk;
                currentVersionResolvedFromFallback = true;
              } else {
                throw new Error(
                  `Unable to resolve the current version from the registry ${registry}. Please ensure that the package exists in the registry in order to use the "registry" currentVersionResolver. Alternatively, you can use the --first-release option or set "release.version.generatorOptions.fallbackCurrentVersionResolver" to "disk" in order to fallback to the version on disk when the registry lookup fails.`
                );
              }
            }
          } else {
            if (currentVersionResolvedFromFallback) {
              log(
                `📄 Using the current version ${currentVersion} already resolved from disk fallback.`
              );
            } else {
              log(
                `📄 Using the current version ${currentVersion} already resolved from the registry ${registry}`
              );
            }
          }
          break;
        }
        case 'disk':
          currentVersion = currentVersionFromDisk;
          if (!currentVersion) {
            throw new Error(
              `Unable to determine the current version for project "${project.name}" from ${packageJsonPath}`
            );
          }
          log(
            `📄 Resolved the current version as ${currentVersion} from ${packageJsonPath}`
          );
          break;
        case 'git-tag': {
          if (
            !currentVersion ||
            // We always need to independently resolve the current version from git tag per project if the projects are independent
            options.releaseGroup.projectsRelationship === 'independent'
          ) {
            const releaseTagPattern = options.releaseGroup.releaseTagPattern;
            latestMatchingGitTag = await getLatestGitTagForPattern(
              releaseTagPattern,
              {
                projectName: project.name,
              }
            );
            if (!latestMatchingGitTag) {
              if (options.fallbackCurrentVersionResolver === 'disk') {
                log(
                  `📄 Unable to resolve the current version from git tag using pattern "${releaseTagPattern}". Falling back to the version on disk of ${currentVersionFromDisk}`
                );
                currentVersion = currentVersionFromDisk;
                currentVersionResolvedFromFallback = true;
              } else {
                throw new Error(
                  `No git tags matching pattern "${releaseTagPattern}" for project "${project.name}" were found. You will need to create an initial matching tag to use as a base for determining the next version. Alternatively, you can use the --first-release option or set "release.version.generatorOptions.fallbackCurrentVersionResolver" to "disk" in order to fallback to the version on disk when no matching git tags are found.`
                );
              }
            } else {
              currentVersion = latestMatchingGitTag.extractedVersion;
              log(
                `📄 Resolved the current version as ${currentVersion} from git tag "${latestMatchingGitTag.tag}".`
              );
            }
          } else {
            if (currentVersionResolvedFromFallback) {
              log(
                `📄 Using the current version ${currentVersion} already resolved from disk fallback.`
              );
            } else {
              log(
                // In this code path we know that latestMatchingGitTag is defined, because we are not relying on the fallbackCurrentVersionResolver, so we can safely use the non-null assertion operator
                `📄 Using the current version ${currentVersion} already resolved from git tag "${
                  latestMatchingGitTag!.tag
                }".`
              );
            }
          }
          break;
        }
        default:
          throw new Error(
            `Invalid value for options.currentVersionResolver: ${options.currentVersionResolver}`
          );
      }

      if (options.specifier) {
        log(`📄 Using the provided version specifier "${options.specifier}".`);
      }

      /**
       * If we are versioning independently then we always need to determine the specifier for each project individually, except
       * for the case where the user has provided an explicit specifier on the command.
       *
       * Otherwise, if versioning the projects together we only need to perform this logic if the specifier is still unset from
       * previous iterations of the loop.
       *
       * NOTE: In the case that we have previously determined via conventional commits that no changes are necessary, the specifier
       * will be explicitly set to `null`, so that is why we only check for `undefined` explicitly here.
       */
      if (
        specifier === undefined ||
        (options.releaseGroup.projectsRelationship === 'independent' &&
          !options.specifier)
      ) {
        const specifierSource = options.specifierSource;
        switch (specifierSource) {
          case 'conventional-commits': {
            if (options.currentVersionResolver !== 'git-tag') {
              throw new Error(
                `Invalid currentVersionResolver "${options.currentVersionResolver}" provided for release group "${options.releaseGroup.name}". Must be "git-tag" when "specifierSource" is "conventional-commits"`
              );
            }

            const affectedProjects =
              options.releaseGroup.projectsRelationship === 'independent'
                ? [projectName]
                : projects.map((p) => p.name);

            // latestMatchingGitTag will be undefined if the current version was resolved from the disk fallback.
            // In this case, we want to use the first commit as the ref to be consistent with the changelog command.
            const previousVersionRef = latestMatchingGitTag
              ? latestMatchingGitTag.tag
              : options.fallbackCurrentVersionResolver === 'disk'
              ? await getFirstGitCommit()
              : undefined;

            if (!previousVersionRef) {
              // This should never happen since the checks above should catch if the current version couldn't be resolved
              throw new Error(
                `Unable to determine previous version ref for the projects ${affectedProjects.join(
                  ', '
                )}. This is likely a bug in Nx.`
              );
            }

            specifier = await resolveSemverSpecifierFromConventionalCommits(
              previousVersionRef,
              options.projectGraph,
              affectedProjects,
              options.conventionalCommitsConfig
            );

            if (!specifier) {
              if (projectToDependencyBumps.has(projectName)) {
                // No applicable changes to the project directly by the user, but we have updated one or more dependencies from the current batch already, so it does need to be bumped
                specifier = updateDependentsOptions.bump;
                log(
                  `📄 Resolved the specifier as "${specifier}" based on "release.version.generatorOptions.updateDependentsOptions.bump"`
                );
                break;
              }
              log(
                `🚫 No changes were detected using git history and the conventional commits standard.`
              );
              break;
            }

            // TODO: reevaluate this prerelease logic/workflow for independent projects
            //
            // Always assume that if the current version is a prerelease, then the next version should be a prerelease.
            // Users must manually graduate from a prerelease to a release by providing an explicit specifier.
            if (prerelease(currentVersion ?? '')) {
              specifier = 'prerelease';
              log(
                `📄 Resolved the specifier as "${specifier}" since the current version is a prerelease.`
              );
            } else {
              log(
                `📄 Resolved the specifier as "${specifier}" using git history and the conventional commits standard.`
              );
            }
            break;
          }
          case 'prompt': {
            // Only add the release group name to the log if it is one set by the user, otherwise it is useless noise
            const maybeLogReleaseGroup = (log: string): string => {
              if (
                options.releaseGroup.name === IMPLICIT_DEFAULT_RELEASE_GROUP
              ) {
                return log;
              }
              return `${log} within release group "${options.releaseGroup.name}"`;
            };
            if (options.releaseGroup.projectsRelationship === 'independent') {
              specifier = await resolveSemverSpecifierFromPrompt(
                `${maybeLogReleaseGroup(
                  `What kind of change is this for project "${projectName}"`
                )}?`,
                `${maybeLogReleaseGroup(
                  `What is the exact version for project "${projectName}"`
                )}?`
              );
            } else {
              specifier = await resolveSemverSpecifierFromPrompt(
                `${maybeLogReleaseGroup(
                  `What kind of change is this for the ${projects.length} matched projects(s)`
                )}?`,
                `${maybeLogReleaseGroup(
                  `What is the exact version for the ${projects.length} matched project(s)`
                )}?`
              );
            }
            break;
          }
          default:
            throw new Error(
              `Invalid specifierSource "${specifierSource}" provided. Must be one of "prompt" or "conventional-commits"`
            );
        }
      }

      // Resolve any local package dependencies for this project (before applying the new version or updating the versionData)
      const localPackageDependencies = resolveLocalPackageDependencies(
        tree,
        options.projectGraph,
        projects,
        projectNameToPackageRootMap,
        resolvePackageRoot,
        // includeAll when the release group is independent, as we may be filtering to a specific subset of projects, but we still want to update their dependents
        options.releaseGroup.projectsRelationship === 'independent'
      );

      const allDependentProjects = Object.values(localPackageDependencies)
        .flat()
        .filter((localPackageDependency) => {
          return localPackageDependency.target === project.name;
        });

      const includeTransitiveDependents =
        updateDependentsOptions.when === 'always';
      const transitiveLocalPackageDependents: LocalPackageDependency[] = [];
      if (includeTransitiveDependents) {
        for (const directDependent of allDependentProjects) {
          // Look through localPackageDependencies to find any which have a target on the current dependent
          for (const localPackageDependency of Object.values(
            localPackageDependencies
          ).flat()) {
            if (localPackageDependency.target === directDependent.source) {
              transitiveLocalPackageDependents.push(localPackageDependency);
            }
          }
        }
      }

      const dependentProjectsInCurrentBatch = [];
      const dependentProjectsOutsideCurrentBatch = [];

      for (const dependentProject of allDependentProjects) {
        const isInCurrentBatch = options.projects.some(
          (project) => project.name === dependentProject.source
        );
        if (!isInCurrentBatch) {
          dependentProjectsOutsideCurrentBatch.push(dependentProject);
        } else {
          dependentProjectsInCurrentBatch.push(dependentProject);
        }
      }

      // If not always updating dependents (when they don't already appear in the batch itself), print a warning to the user about what is being skipped and how to change it
      if (updateDependentsOptions.when === 'auto') {
        if (dependentProjectsOutsideCurrentBatch.length > 0) {
          let logMsg = `⚠️  Warning, the following packages depend on "${project.name}"`;
          if (options.releaseGroup.name === IMPLICIT_DEFAULT_RELEASE_GROUP) {
            logMsg += ` but have been filtered out via --projects, and therefore will not be updated:`;
          } else {
            logMsg += ` but are either not part of the current release group "${options.releaseGroup.name}", or have been filtered out via --projects, and therefore will not be updated:`;
          }
          const indent = Array.from(new Array(projectName.length + 4))
            .map(() => ' ')
            .join('');
          logMsg += `\n${dependentProjectsOutsideCurrentBatch
            .map((dependentProject) => `${indent}- ${dependentProject.source}`)
            .join('\n')}`;
          logMsg += `\n${indent}=> You can adjust this behavior by setting \`version.generatorOptions.updateDependents.when\` to "always"`;
          log(logMsg);
        }
      }

      if (!currentVersion) {
        throw new Error(
          `The current version for project "${project.name}" could not be resolved. Please report this on https://github.com/nrwl/nx`
        );
      }

      versionData[projectName] = {
        currentVersion,
        newVersion: null, // will stay as null in the final result in the case that no changes are detected
        dependentProjects: allDependentProjects,
      };

      if (!specifier) {
        log(
          `🚫 Skipping versioning "${packageJson.name}" as no changes were detected.`
        );
        continue;
      }

      const newVersion = deriveNewSemverVersion(
        currentVersion,
        specifier,
        options.preid
      );
      versionData[projectName].newVersion = newVersion;

      writeJson(tree, packageJsonPath, {
        ...packageJson,
        version: newVersion,
      });

      log(`✍️  New version ${newVersion} written to ${packageJsonPath}`);

      if (allDependentProjects.length > 0) {
        const totalProjectsToUpdate =
          updateDependentsOptions.when === 'always'
            ? allDependentProjects.length +
              transitiveLocalPackageDependents.length
            : dependentProjectsInCurrentBatch.length;
        if (totalProjectsToUpdate > 0) {
          log(
            `✍️  Applying new version ${newVersion} to ${totalProjectsToUpdate} ${
              totalProjectsToUpdate > 1
                ? 'packages which depend'
                : 'package which depends'
            } on ${project.name}`
          );
        }
      }

      const updateDependentProjectAndAddToVersionData = ({
        dependentProject,
        dependencyPackageName,
        newDependencyVersion,
        forceVersionBump,
      }: {
        dependentProject: LocalPackageDependency;
        dependencyPackageName: string;
        newDependencyVersion: string;
        forceVersionBump: 'major' | 'minor' | 'patch' | false;
      }) => {
        const updatedFilePath = joinPathFragments(
          projectNameToPackageRootMap.get(dependentProject.source),
          'package.json'
        );
        updateJson(tree, updatedFilePath, (json) => {
          // Auto (i.e.infer existing) by default
          let versionPrefix = options.versionPrefix ?? 'auto';
          const currentDependencyVersion =
            json[dependentProject.dependencyCollection][dependencyPackageName];

          // For auto, we infer the prefix based on the current version of the dependent
          if (versionPrefix === 'auto') {
            versionPrefix = ''; // we don't want to end up printing auto
            if (currentDependencyVersion) {
              const prefixMatch = currentDependencyVersion.match(/^[~^]/);
              if (prefixMatch) {
                versionPrefix = prefixMatch[0];
              } else {
                versionPrefix = '';
              }
            }
          }

          // Apply the new version of the dependency to the dependent
          const newDepVersion = `${versionPrefix}${newDependencyVersion}`;
          json[dependentProject.dependencyCollection][dependencyPackageName] =
            newDepVersion;

          // Bump the dependent's version if applicable and record it in the version data
          if (forceVersionBump) {
            const currentPackageVersion = json.version;
            const newPackageVersion = deriveNewSemverVersion(
              currentPackageVersion,
              forceVersionBump,
              options.preid
            );
            json.version = newPackageVersion;

            // Look up any dependent projects from the transitiveLocalPackageDependents list
            const transitiveDependentProjects =
              transitiveLocalPackageDependents.filter(
                (localPackageDependency) =>
                  localPackageDependency.target === dependentProject.source
              );

            versionData[dependentProject.source] = {
              currentVersion: currentPackageVersion,
              newVersion: newPackageVersion,
              dependentProjects: transitiveDependentProjects,
            };
          }

          return json;
        });
      };

      for (const dependentProject of dependentProjectsInCurrentBatch) {
        if (projectToDependencyBumps.has(dependentProject.source)) {
          const dependencyBumps = projectToDependencyBumps.get(
            dependentProject.source
          );
          dependencyBumps.add(projectName);
        } else {
          projectToDependencyBumps.set(
            dependentProject.source,
            new Set([projectName])
          );
        }
        updateDependentProjectAndAddToVersionData({
          dependentProject,
          dependencyPackageName: packageName,
          newDependencyVersion: newVersion,
          // We don't force bump because we know they will come later in the topologically sorted projects loop and may have their own version update logic to take into account
          forceVersionBump: false,
        });
      }

      if (updateDependentsOptions.when === 'always') {
        for (const dependentProject of dependentProjectsOutsideCurrentBatch) {
          updateDependentProjectAndAddToVersionData({
            dependentProject,
            dependencyPackageName: packageName,
            newDependencyVersion: newVersion,
            // For these additional dependents, we need to update their package.json version as well because we know they will not come later in the topologically sorted projects loop
            forceVersionBump: updateDependentsOptions.bump,
          });
        }
      }
      for (const transitiveDependentProject of transitiveLocalPackageDependents) {
        const dependencyProjectName = transitiveDependentProject.target;
        const dependencyPackageRoot = projectNameToPackageRootMap.get(
          dependencyProjectName
        );
        if (!dependencyPackageRoot) {
          throw new Error(
            `The project "${dependencyProjectName}" does not have a packageRoot available. Please report this issue on https://github.com/nrwl/nx`
          );
        }
        const dependencyPackageJsonPath = join(
          dependencyPackageRoot,
          'package.json'
        );
        const dependencyPackageJson = readJson(tree, dependencyPackageJsonPath);

        updateDependentProjectAndAddToVersionData({
          dependentProject: transitiveDependentProject,
          dependencyPackageName: dependencyPackageJson.name,
          newDependencyVersion: dependencyPackageJson.version,
          // For these additional dependents, we need to update their package.json version as well because we know they will not come later in the topologically sorted projects loop
          forceVersionBump: updateDependentsOptions.bump,
        });
      }
    }

    /**
     * Ensure that formatting is applied so that version bump diffs are as minimal as possible
     * within the context of the user's workspace.
     */
    await formatFiles(tree);

    // Return the version data so that it can be leveraged by the overall version command
    return {
      data: versionData,
      callback: async (tree, opts) => {
        const cwd = tree.root;
        const updatedFiles = await updateLockFile(cwd, opts);
        return updatedFiles;
      },
    };
  } catch (e: any) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      output.error({
        title: e.message,
      });
      // Dump the full stack trace in verbose mode
      console.error(e);
    } else {
      output.error({
        title: e.message,
      });
    }
    process.exit(1);
  }
}

export default releaseVersionGenerator;

function createResolvePackageRoot(customPackageRoot?: string) {
  return (projectNode: ProjectGraphProjectNode): string => {
    // Default to the project root if no custom packageRoot
    if (!customPackageRoot) {
      return projectNode.data.root;
    }
    if (projectNode.data.root === '.') {
      // TODO This is a temporary workaround to fix NXC-574 until NXC-573 is resolved
      return projectNode.data.root;
    }
    return interpolate(customPackageRoot, {
      workspaceRoot: '',
      projectRoot: projectNode.data.root,
      projectName: projectNode.name,
    });
  };
}

const colors = [
  { instance: chalk.green, spinnerColor: 'green' },
  { instance: chalk.greenBright, spinnerColor: 'green' },
  { instance: chalk.red, spinnerColor: 'red' },
  { instance: chalk.redBright, spinnerColor: 'red' },
  { instance: chalk.cyan, spinnerColor: 'cyan' },
  { instance: chalk.cyanBright, spinnerColor: 'cyan' },
  { instance: chalk.yellow, spinnerColor: 'yellow' },
  { instance: chalk.yellowBright, spinnerColor: 'yellow' },
  { instance: chalk.magenta, spinnerColor: 'magenta' },
  { instance: chalk.magentaBright, spinnerColor: 'magenta' },
] as const;

function getColor(projectName: string) {
  let code = 0;
  for (let i = 0; i < projectName.length; ++i) {
    code += projectName.charCodeAt(i);
  }
  const colorIndex = code % colors.length;

  return colors[colorIndex];
}

function sortProjectsTopologically(
  projectGraph: ProjectGraph,
  projectNodes: ProjectGraphProjectNode[]
): ProjectGraphProjectNode[] {
  const edges = new Map<ProjectGraphProjectNode, number>(
    projectNodes.map((node) => [node, 0])
  );

  const filteredDependencies: ProjectGraphDependency[] = [];
  for (const node of projectNodes) {
    const deps = projectGraph.dependencies[node.name];
    if (deps) {
      filteredDependencies.push(
        ...deps.filter((dep) => projectNodes.find((n) => n.name === dep.target))
      );
    }
  }

  filteredDependencies.forEach((dep) => {
    const sourceNode = projectGraph.nodes[dep.source];
    // dep.source depends on dep.target
    edges.set(sourceNode, (edges.get(sourceNode) || 0) + 1);
  });

  // Initialize queue with projects that have no dependencies
  const processQueue = [...edges]
    .filter(([_, count]) => count === 0)
    .map(([node]) => node);
  const sortedProjects = [];

  while (processQueue.length > 0) {
    const node = processQueue.shift();
    sortedProjects.push(node);

    // Process each project that depends on the current node
    filteredDependencies.forEach((dep) => {
      const dependentNode = projectGraph.nodes[dep.source];
      const count = edges.get(dependentNode) - 1;
      edges.set(dependentNode, count);
      if (count === 0) {
        processQueue.push(dependentNode);
      }
    });
  }

  // TODO: should hopefully be impossible by this point?
  if (sortedProjects.length !== projectNodes.length) {
    throw new Error(
      'Cycle detected or a disconnected node exists that was not included in the input set.'
    );
  }

  return sortedProjects;
}
