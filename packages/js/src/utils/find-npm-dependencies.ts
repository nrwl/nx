import {
  type ProjectGraph,
  type ProjectGraphProjectNode,
  type ProjectFileMap,
  readJsonFile,
} from '@nx/devkit';
import { fileExists } from 'nx/src/utils/fileutils';
import { join } from 'path';
import { readTsConfig } from './typescript/ts-config';
import { fileDataDepTarget } from 'nx/src/config/project-graph';

/**
 * Finds all npm dependencies and their expected versions for a given project.
 */
export function findNpmDependencies(
  workspaceRoot: string,
  sourceProject: ProjectGraphProjectNode,
  projectGraph: ProjectGraph,
  projectFileMap: ProjectFileMap,
  options: {
    recursive?: boolean;
  } = {}
): Record<string, string> {
  let seen: null | Set<string> = null;
  if (options.recursive) {
    seen = new Set<string>();
  }

  const results: Record<string, string> = {};

  function collectAll(
    currentProject: ProjectGraphProjectNode,
    collectedDeps: Record<string, string>
  ): void {
    if (seen?.has(currentProject.name)) return;

    collectDependenciesFromFileMap(
      workspaceRoot,
      currentProject,
      projectGraph,
      projectFileMap,
      collectedDeps
    );
    collectPeerAndOptionalDependencies(
      workspaceRoot,
      currentProject,
      projectGraph,
      collectedDeps
    );
    collectHelperDependencies(
      workspaceRoot,
      currentProject,
      projectGraph,
      collectedDeps
    );
    if (options.recursive) {
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

// ts, js, mts, mjs, cts, cjs, tsx, jsx
const sourceFileRegex = /\.([jt]sx?|[ct][jt]s)$/;

function collectDependenciesFromFileMap(
  workspaceRoot: string,
  sourceProject: ProjectGraphProjectNode,
  projectGraph: ProjectGraph,
  projectFileMap: ProjectFileMap,
  npmDeps: Record<string, string>
): void {
  const files = projectFileMap[sourceProject.name];
  if (!files) return;

  for (const fileData of files) {
    if (!fileData.deps) continue;
    if (!sourceFileRegex.test(fileData.file)) continue;

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
        if (packageJson) {
          // This is a workspace lib so we can't reliably read in a specific version since it depends on how the workspace is set up.
          // ASSUMPTION: Most users will use '*' for workspace lib versions. Otherwise, they can manually update it.
          npmDeps[packageJson.name] = '*';
          seenWorkspaceDeps[workspaceDep.name] = {
            name: packageJson.name,
            version: '*',
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

function collectPeerAndOptionalDependencies(
  workspaceRoot: string,
  sourceProject: ProjectGraphProjectNode,
  projectGraph: ProjectGraph,
  npmDeps: Record<string, string>
): void {
  const packageJson = readPackageJson(sourceProject, workspaceRoot);
  if (packageJson?.peerDependencies) {
    for (const pkg of Object.keys(packageJson.peerDependencies)) {
      const externalNode = projectGraph.externalNodes[`npm:${pkg}`];
      if (externalNode) {
        npmDeps[pkg] = externalNode.data.version;
      }
    }
  }
  if (packageJson?.optionalDependencies) {
    for (const pkg of Object.keys(packageJson.optionalDependencies)) {
      const externalNode = projectGraph.externalNodes[`npm:${pkg}`];
      if (externalNode) {
        npmDeps[pkg] = externalNode.data.version;
      }
    }
  }
}

function collectHelperDependencies(
  workspaceRoot: string,
  sourceProject: ProjectGraphProjectNode,
  projectGraph: ProjectGraph,
  npmDeps: Record<string, string>
): void {
  for (const target of Object.values(sourceProject.data.targets)) {
    if (target.executor === '@nx/js:tsc' && target.options?.tsConfig) {
      const tsConfig = readTsConfig(
        join(workspaceRoot, target.options.tsConfig)
      );
      if (tsConfig?.options['importHelpers']) {
        npmDeps['tslib'] =
          projectGraph.externalNodes['npm:tslib']?.data.version;
      }
    }
    if (target.executor === '@nx/js:swc') {
      const swcConfigPath = target.options.swcrc
        ? join(workspaceRoot, target.options.swcrc)
        : join(workspaceRoot, sourceProject.data.root, '.swcrc');
      const swcConfig = fileExists(swcConfigPath)
        ? readJsonFile(swcConfigPath)
        : {};
      if (swcConfig?.jsc?.externalHelpers) {
        npmDeps['@swc/helpers'] =
          projectGraph.externalNodes['npm:@swc/helpers']?.data.version;
      }
    }
  }
}
