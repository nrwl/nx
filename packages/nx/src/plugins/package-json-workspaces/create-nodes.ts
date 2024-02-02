import { minimatch } from 'minimatch';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { toProjectName } from '../../config/workspaces';
import { readJsonFile, readYamlFile } from '../../utils/fileutils';
import { combineGlobPatterns } from '../../utils/globs';
import { NX_PREFIX } from '../../utils/logger';
import { NxPluginV2 } from '../../utils/nx-plugin';
import { output } from '../../utils/output';
import {
  PackageJson,
  readTargetsFromPackageJson,
} from '../../utils/package-json';
import { joinPathFragments } from '../../utils/path';

export function getNxPackageJsonWorkspacesPlugin(root: string): NxPluginV2 {
  const readJson = (f) => readJsonFile(join(root, f));
  const patterns = getGlobPatternsFromPackageManagerWorkspaces(root, readJson);

  // If the user only specified a negative pattern, we should find all package.json
  // files and only return those that don't match a negative pattern.
  const negativePatterns = patterns.filter((p) => p.startsWith('!'));
  let positivePatterns = patterns.filter((p) => !p.startsWith('!'));

  if (
    // There are some negative patterns
    negativePatterns.length > 0 &&
    // No positive patterns
    (positivePatterns.length === 0 ||
      // Or only a single positive pattern that is the default coming from root package
      (positivePatterns.length === 1 && positivePatterns[0] === 'package.json'))
  ) {
    positivePatterns.push('**/package.json');
  }

  return {
    name: 'nx/core/package-json-workspaces',
    createNodes: [
      combineGlobPatterns(positivePatterns),
      (p) => {
        if (!negativePatterns.some((negative) => minimatch(p, negative))) {
          return createNodeFromPackageJson(p, root);
        }
        // A negative pattern matched, so we should not create a node for this package.json
        return {};
      },
    ],
  };
}

export function createNodeFromPackageJson(pkgJsonPath: string, root: string) {
  const json: PackageJson = readJsonFile(join(root, pkgJsonPath));
  const project = buildProjectConfigurationFromPackageJson(
    json,
    pkgJsonPath,
    readNxJson(root)
  );
  return {
    projects: {
      [project.root]: project,
    },
  };
}

export function buildProjectConfigurationFromPackageJson(
  packageJson: PackageJson,
  path: string,
  nxJson: NxJsonConfiguration
): ProjectConfiguration & { name: string } {
  const normalizedPath = path.split('\\').join('/');
  const directory = dirname(normalizedPath);

  if (!packageJson.name && directory === '.') {
    throw new Error(
      'Nx requires the root package.json to specify a name if it is being used as an Nx project.'
    );
  }

  let name = packageJson.name ?? toProjectName(normalizedPath);
  const projectType =
    nxJson?.workspaceLayout?.appsDir != nxJson?.workspaceLayout?.libsDir &&
    nxJson?.workspaceLayout?.appsDir &&
    directory.startsWith(nxJson.workspaceLayout.appsDir)
      ? 'application'
      : 'library';

  return {
    root: directory,
    sourceRoot: directory,
    name,
    projectType,
    ...packageJson.nx,
    targets: readTargetsFromPackageJson(packageJson),
  };
}

/**
 * Get the package.json globs from package manager workspaces
 */
export function getGlobPatternsFromPackageManagerWorkspaces(
  root: string,
  readJson: <T extends Object>(path: string) => T = <T extends Object>(path) =>
    readJsonFile<T>(join(root, path)) // making this an arg allows us to reuse in devkit
): string[] {
  try {
    const patterns: string[] = [];
    const packageJson = readJson<PackageJson>('package.json');

    patterns.push(
      ...normalizePatterns(
        Array.isArray(packageJson.workspaces)
          ? packageJson.workspaces
          : packageJson.workspaces?.packages ?? []
      )
    );

    if (existsSync(join(root, 'pnpm-workspace.yaml'))) {
      try {
        const { packages } = readYamlFile<{ packages: string[] }>(
          join(root, 'pnpm-workspace.yaml')
        );
        patterns.push(...normalizePatterns(packages || []));
      } catch (e: unknown) {
        output.warn({
          title: `${NX_PREFIX} Unable to parse pnpm-workspace.yaml`,
          bodyLines: [e.toString()],
        });
      }
    }

    if (existsSync(join(root, 'lerna.json'))) {
      try {
        const { packages } = readJson<any>('lerna.json');
        patterns.push(
          ...normalizePatterns(packages?.length > 0 ? packages : ['packages/*'])
        );
      } catch (e: unknown) {
        output.warn({
          title: `${NX_PREFIX} Unable to parse lerna.json`,
          bodyLines: [e.toString()],
        });
      }
    }

    // Merge patterns from workspaces definitions
    // TODO(@AgentEnder): update logic after better way to determine root project inclusion
    // Include the root project
    return packageJson.nx ? patterns.concat('package.json') : patterns;
  } catch {
    return [];
  }
}

function normalizePatterns(patterns: string[]): string[] {
  return patterns.map((pattern) =>
    removeRelativePath(
      pattern.endsWith('/package.json')
        ? pattern
        : joinPathFragments(pattern, 'package.json')
    )
  );
}

function removeRelativePath(pattern: string): string {
  return pattern.startsWith('./') ? pattern.substring(2) : pattern;
}
