import { isAbsolute, join, relative } from 'path';
import { rcompare, valid } from 'semver';
import {
  joinPathFragments,
  normalizePath,
  type ProjectFileMap,
  type ProjectGraph,
  type ProjectGraphProjectNode,
  readJsonFile,
} from '@nx/devkit';
import { getRootTsConfigPath, readTsConfig } from './typescript/ts-config';
import {
  readNxJsonFromDisk as readNxJson,
  fileExists,
  fileDataDepTarget,
  filterUsingGlobPatterns,
  getTargetInputs,
} from '@nx/devkit/internal';

const highestHelperVersions = new WeakMap<
  NonNullable<ProjectGraph['externalNodes']>,
  Map<string, string | undefined>
>();

/**
 * Finds all npm dependencies and their expected versions for a given project.
 */
export function findNpmDependencies(
  workspaceRoot: string,
  sourceProject: ProjectGraphProjectNode,
  projectGraph: ProjectGraph,
  projectFileMap: ProjectFileMap,
  buildTarget: string,
  options: {
    includeTransitiveDependencies?: boolean;
    ignoredFiles?: string[];
    useLocalPathsForWorkspaceDependencies?: boolean;
    runtimeHelpers?: string[];
  } = {}
): Record<string, string> {
  let seen: null | Set<string> = null;
  if (options.includeTransitiveDependencies) {
    seen = new Set<string>();
  }

  const results: Record<string, string> = {};

  function collectAll(
    currentProject: ProjectGraphProjectNode,
    collectedDeps: Record<string, string>
  ): void {
    if (seen?.has(currentProject.name)) return;
    seen?.add(currentProject.name);

    collectDependenciesFromFileMap(
      workspaceRoot,
      currentProject,
      projectGraph,
      projectFileMap,
      buildTarget,
      options.ignoredFiles,
      options.useLocalPathsForWorkspaceDependencies,
      collectedDeps
    );

    collectHelperDependencies(
      workspaceRoot,
      currentProject,
      projectGraph,
      buildTarget,
      options.runtimeHelpers,
      collectedDeps
    );

    if (options.includeTransitiveDependencies) {
      const projectDeps = projectGraph.dependencies[currentProject.name];
      for (const dep of projectDeps) {
        const projectDep = projectGraph.nodes[dep.target];
        if (projectDep) collectAll(projectDep, collectedDeps);
      }
    }
  }

  collectAll(sourceProject, results);

  return results;
}

// Keep track of workspace libs we already read package.json for so we don't read from disk again.
const seenWorkspaceDeps: Record<string, { name: string; version: string }> = {};

function collectDependenciesFromFileMap(
  workspaceRoot: string,
  sourceProject: ProjectGraphProjectNode,
  projectGraph: ProjectGraph,
  projectFileMap: ProjectFileMap,
  buildTarget: string,
  ignoredFiles: string[],
  useLocalPathsForWorkspaceDependencies: boolean,
  npmDeps: Record<string, string>
): void {
  const rawFiles = projectFileMap[sourceProject.name];
  if (!rawFiles) return;

  // If build target does not exist in project, use all files as input.
  // This is needed for transitive dependencies for apps -- where libs may not be buildable.
  const inputs = sourceProject.data.targets[buildTarget]
    ? getTargetInputs(readNxJson(), sourceProject, buildTarget).selfInputs
    : ['{projectRoot}/**/*'];
  if (ignoredFiles) {
    for (const pattern of ignoredFiles) {
      inputs.push(`!${pattern}`);
    }
  }
  const files = filterUsingGlobPatterns(
    sourceProject.data.root,
    projectFileMap[sourceProject.name] || [],
    inputs
  );

  for (const fileData of files) {
    if (
      !fileData.deps ||
      fileData.file ===
        joinPathFragments(sourceProject.data.root, 'package.json')
    ) {
      continue;
    }

    for (const dep of fileData.deps) {
      const target = fileDataDepTarget(dep);

      // If the node is external, then read package info from `data`.
      const externalDep = projectGraph.externalNodes[target];
      if (externalDep?.type === 'npm') {
        npmDeps[externalDep.data.packageName] = externalDep.data.version;
        continue;
      }

      // If node is internal, then try reading package info from `package.json` (which must exist for this to work).
      const workspaceDep = projectGraph.nodes[target];
      if (!workspaceDep) continue;
      const cached = seenWorkspaceDeps[workspaceDep.name];
      if (cached) {
        npmDeps[cached.name] = cached.version;
      } else {
        const packageJson = readPackageJson(workspaceDep, workspaceRoot);
        if (
          // Check that this is a buildable project, otherwise it cannot be a dependency in package.json.
          workspaceDep.data.targets[buildTarget] &&
          // Make sure package.json exists and has a valid name.
          packageJson?.name
        ) {
          let version: string;
          if (useLocalPathsForWorkspaceDependencies) {
            // Find the relative `file:...` path and use that as the version value.
            // This is useful for monorepos like Nx where the release will handle setting the correct version in dist.
            const depRoot = join(workspaceRoot, workspaceDep.data.root);
            const ownRoot = join(workspaceRoot, sourceProject.data.root);
            const relativePath = relative(ownRoot, depRoot);
            const filePath = normalizePath(relativePath); // normalize slashes for windows
            version = `file:${filePath}`;
          } else {
            // Otherwise, read the version from the dependencies `package.json` file.
            // This is useful for monorepos that commit release versions.
            // Users can also set version as "*" in source `package.json` files, which will be the value set here.
            // This is useful if they use custom scripts to update them in dist.
            version = packageJson.version ?? '*'; // fallback in case version is missing
          }
          npmDeps[packageJson.name] = version;
          seenWorkspaceDeps[workspaceDep.name] = {
            name: packageJson.name,
            version,
          };
        }
      }
    }
  }
}

function readPackageJson(
  project: ProjectGraphProjectNode,
  workspaceRoot: string
): null | {
  name: string;
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
} {
  const packageJsonPath = join(
    workspaceRoot,
    project.data.root,
    'package.json'
  );
  if (fileExists(packageJsonPath)) return readJsonFile(packageJsonPath);
  return null;
}

function collectHelperDependencies(
  workspaceRoot: string,
  sourceProject: ProjectGraphProjectNode,
  projectGraph: ProjectGraph,
  buildTarget: string,
  runtimeHelpers: string[] | undefined,
  npmDeps: Record<string, string>
): void {
  if (runtimeHelpers?.length > 0) {
    for (const helper of runtimeHelpers) {
      if (npmDeps[helper]) continue;
      const version = findHelperVersion(projectGraph, sourceProject, helper);
      if (version) {
        npmDeps[helper] = version;
      }
    }

    return;
  }

  const target = sourceProject.data.targets[buildTarget];
  if (!target) return;

  if (target.executor === '@nx/js:tsc' && target.options?.tsConfig) {
    const tsConfig = readTsConfig(join(workspaceRoot, target.options.tsConfig));
    const version =
      tsConfig?.options['importHelpers'] &&
      findHelperVersion(projectGraph, sourceProject, 'tslib');
    if (version) {
      npmDeps['tslib'] = version;
    }
  }
  if (target.executor === '@nx/js:swc') {
    const swcConfigPath = target.options.swcrc
      ? join(workspaceRoot, target.options.swcrc)
      : join(workspaceRoot, sourceProject.data.root, '.swcrc');
    const swcConfig = fileExists(swcConfigPath)
      ? readJsonFile(swcConfigPath)
      : {};
    const version =
      swcConfig?.jsc?.externalHelpers &&
      findHelperVersion(projectGraph, sourceProject, '@swc/helpers');
    if (version) {
      npmDeps['@swc/helpers'] = version;
    }
  }

  // For inferred targets or manually added run-commands, check if user is using `tsc` in build target.
  if (
    target.executor === 'nx:run-commands' &&
    /\b(tsc|tsgo)\b/.test(target.options.command)
  ) {
    const tsConfigPath = resolveTsConfigForRunCommandsTarget(
      workspaceRoot,
      sourceProject,
      target.options
    );
    if (tsConfigPath) {
      const tsConfig = readTsConfig(tsConfigPath);
      const version =
        tsConfig?.options['importHelpers'] &&
        findHelperVersion(projectGraph, sourceProject, 'tslib');
      if (version) {
        npmDeps['tslib'] = version;
      }
    }
  }
}

function findHelperVersion(
  projectGraph: ProjectGraph,
  sourceProject: ProjectGraphProjectNode,
  helper: string
): string | undefined {
  const bareNode = projectGraph.externalNodes[`npm:${helper}`];
  if (bareNode) {
    return bareNode.type === 'npm' ? bareNode.data.version : undefined;
  }
  // A helper with several versions can have only versioned nodes, for
  // example when the pnpm root importer does not declare it. Prefer the
  // version that the project depends on, else the highest.
  const isHelperNode = (name: string) =>
    projectGraph.externalNodes[name]?.type === 'npm' &&
    projectGraph.externalNodes[name].data.packageName === helper;
  const projectDependency = projectGraph.dependencies[sourceProject.name]?.find(
    (dependency) => isHelperNode(dependency.target)
  );
  if (projectDependency) {
    return projectGraph.externalNodes[projectDependency.target].data.version;
  }
  let versions = highestHelperVersions.get(projectGraph.externalNodes);
  if (!versions) {
    versions = new Map();
    highestHelperVersions.set(projectGraph.externalNodes, versions);
  }
  if (!versions.has(helper)) {
    versions.set(
      helper,
      Object.keys(projectGraph.externalNodes)
        .filter(isHelperNode)
        .map((name) => projectGraph.externalNodes[name].data.version)
        .filter((version) => valid(version) !== null)
        .sort(rcompare)[0]
    );
  }
  return versions.get(helper);
}

function resolveTsConfigForRunCommandsTarget(
  workspaceRoot: string,
  sourceProject: ProjectGraphProjectNode,
  targetOptions: { command: string; cwd?: string }
): string | null {
  const commandTsConfig = extractTsConfigFromCommand(targetOptions.command);
  if (commandTsConfig) {
    const cwd = targetOptions.cwd ?? sourceProject.data.root;
    const cwdAbsolute = isAbsolute(cwd) ? cwd : join(workspaceRoot, cwd);
    const resolved = isAbsolute(commandTsConfig)
      ? commandTsConfig
      : join(cwdAbsolute, commandTsConfig);
    if (fileExists(resolved)) return resolved;
  }

  // Preserves prior behavior when the tsconfig can't be determined from the command.
  return getRootTsConfigPath();
}

// Matches the `<compiler> --build <configName>` shape emitted by the
// `@nx/js/typescript` plugin. Other shapes fall through to the workspace root
// tsconfig in the caller.
function extractTsConfigFromCommand(command: string): string | null {
  const match = command.match(/(?:^|\s)--build\s+([^\s-]\S*)/);
  return match ? match[1] : null;
}
