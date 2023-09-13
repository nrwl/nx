import {
  Tree,
  joinPathFragments,
  output,
  readJson,
  updateJson,
  workspaceRoot,
  writeJson,
} from '@nx/devkit';
import * as chalk from 'chalk';
import { exec } from 'child_process';
import { deriveNewSemverVersion } from 'nx/src/command-line/release/version';
import { interpolate } from 'nx/src/tasks-runner/utils';
import * as ora from 'ora';
import { relative } from 'path';
import { ReleaseVersionGeneratorSchema } from './schema';
import { resolveLocalPackageDependencies } from './utils/resolve-local-package-dependencies';

export async function releaseVersionGenerator(
  tree: Tree,
  options: ReleaseVersionGeneratorSchema
) {
  const projects = options.projects;

  // Resolve any custom package roots for each project upfront as they will need to be reused during dependency resolution
  const projectNameToPackageRootMap = new Map<string, string>();
  for (const project of projects) {
    projectNameToPackageRootMap.set(
      project.name,
      // Default to the project root if no custom packageRoot
      !options.packageRoot
        ? project.data.root
        : interpolate(options.packageRoot, {
            workspaceRoot: '',
            projectRoot: project.data.root,
            projectName: project.name,
          })
    );
  }

  let currentVersion: string;

  for (const project of projects) {
    const projectName = project.name;
    const packageRoot = projectNameToPackageRootMap.get(projectName);
    const packageJsonPath = joinPathFragments(packageRoot, 'package.json');
    const workspaceRelativePackageJsonPath = relative(
      workspaceRoot,
      packageJsonPath
    );

    const color = getColor(projectName);
    const log = (msg: string) => {
      console.log(color.instance.bold(projectName) + ' ' + msg);
    };

    if (!tree.exists(packageJsonPath)) {
      throw new Error(
        `The project "${projectName}" does not have a package.json available at ${workspaceRelativePackageJsonPath}.
        
To fix this you will either need to add a package.json file at that location, or configure "release" within your nx.json to exclude "${projectName}" from the current release group, or amend the packageRoot configuration to point to where the package.json should be.`
      );
    }

    output.logSingleLine(
      `Running release version for project: ${color.instance.bold(
        project.name
      )}`
    );

    const projectPackageJson = readJson(tree, packageJsonPath);
    log(
      `🔍 Reading data for package "${projectPackageJson.name}" from ${workspaceRelativePackageJsonPath}`
    );

    const { name: packageName, version: currentVersionFromDisk } =
      projectPackageJson;

    switch (options.currentVersionResolver) {
      case 'registry': {
        const metadata = options.currentVersionResolverMetadata;
        const registry = metadata?.registry ?? 'https://registry.npmjs.org';
        const tag = metadata?.tag ?? 'latest';

        // If the currentVersionResolver is set to registry, we only want to make the request once for the whole batch of projects
        if (!currentVersion) {
          const spinner = ora(
            `${Array.from(new Array(projectName.length + 3)).join(
              ' '
            )}Resolving the current version for tag "${tag}" on ${registry}`
          );
          spinner.color =
            color.spinnerColor as typeof colors[number]['spinnerColor'];
          spinner.start();

          // Must be non-blocking async to allow spinner to render
          currentVersion = await new Promise<string>((resolve, reject) => {
            exec(
              `npm view ${packageName} version --registry=${registry} --tag=${tag}`,
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
        } else {
          log(
            `📄 Using the current version ${currentVersion} already resolved from the registry ${registry}`
          );
        }
        break;
      }
      case 'disk':
        currentVersion = currentVersionFromDisk;
        log(
          `📄 Resolved the current version as ${currentVersion} from ${packageJsonPath}`
        );
        break;
      default:
        throw new Error(
          `Invalid value for options.currentVersionResolver: ${options.currentVersionResolver}`
        );
    }

    // Resolve any local package dependencies for this project (before applying the new version)
    const localPackageDependencies = resolveLocalPackageDependencies(
      tree,
      options.projectGraph,
      projects,
      projectNameToPackageRootMap
    );

    const newVersion = deriveNewSemverVersion(
      currentVersion,
      options.specifier
    );

    writeJson(tree, packageJsonPath, {
      ...projectPackageJson,
      version: newVersion,
    });

    log(
      `✍️  New version ${newVersion} written to ${workspaceRelativePackageJsonPath}`
    );

    const dependentProjects = Object.values(localPackageDependencies)
      .filter((localPackageDependencies) => {
        return localPackageDependencies.some(
          (localPackageDependency) =>
            localPackageDependency.target === project.name
        );
      })
      .flat();

    if (dependentProjects.length > 0) {
      log(
        `✍️  Applying new version ${newVersion} to ${
          dependentProjects.length
        } ${
          dependentProjects.length > 1
            ? 'packages which depend'
            : 'package which depends'
        } on ${project.name}`
      );
    }

    for (const dependentProject of dependentProjects) {
      updateJson(
        tree,
        joinPathFragments(
          projectNameToPackageRootMap.get(dependentProject.source),
          'package.json'
        ),
        (json) => {
          json[dependentProject.dependencyCollection][packageName] = newVersion;
          return json;
        }
      );
    }
  }
}

export default releaseVersionGenerator;

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
