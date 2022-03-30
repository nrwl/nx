import * as path from 'path';
import {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  normalizePath,
  DependencyType,
  parseJson,
  ProjectGraphExternalNode,
  joinPathFragments,
  FileData,
} from '@nrwl/devkit';
import { join } from 'path';
import { workspaceRoot } from './app-root';
import { getPath, pathExists } from './graph-utils';
import { existsSync } from 'fs';
import { readFileIfExisting } from 'nx/src/core/file-utils';
import { TargetProjectLocator } from 'nx/src/core/target-project-locator';

export type MappedProjectGraphNode<T = any> = ProjectGraphProjectNode<T> & {
  data: {
    files: Record<string, FileData>;
  };
};
export type MappedProjectGraph<T = any> = ProjectGraph<T> & {
  nodes: Record<string, MappedProjectGraphNode<T>>;
};

export type Deps = { [projectName: string]: ProjectGraphDependency[] };
export type DepConstraint = {
  sourceTag: string;
  onlyDependOnLibsWithTags: string[];
  notDependOnLibsWithTags: string[];
  bannedExternalImports?: string[];
};

export function stringifyTags(tags: string[]): string {
  return tags.map((t) => `"${t}"`).join(', ');
}

export function hasNoneOfTheseTags(
  proj: ProjectGraphProjectNode,
  tags: string[]
): boolean {
  return tags.filter((tag) => hasTag(proj, tag)).length === 0;
}

/**
 * Check if any of the given tags is included in the project
 * @param proj ProjectGraphProjectNode
 * @param tags
 * @returns
 */
export function findDependenciesWithTags(
  targetProject: ProjectGraphProjectNode,
  tags: string[],
  graph: ProjectGraph
): ProjectGraphProjectNode[][] {
  // find all reachable projects that have one of the tags and
  // are reacheable from the targetProject (including self)
  const allReachableProjects = Object.keys(graph.nodes).filter(
    (projectName) =>
      pathExists(graph, targetProject.name, projectName) &&
      tags.some((tag) => hasTag(graph.nodes[projectName], tag))
  );

  // return path from targetProject to reachable project
  return allReachableProjects.map((project) =>
    targetProject.name === project
      ? [targetProject]
      : getPath(graph, targetProject.name, project)
  );
}

function hasTag(proj: ProjectGraphProjectNode, tag: string) {
  return tag === '*' || (proj.data.tags || []).indexOf(tag) > -1;
}

function removeExt(file: string): string {
  return file.replace(/(?<!(^|\/))\.[^/.]+$/, '');
}

export function matchImportWithWildcard(
  // This may or may not contain wildcards ("*")
  allowableImport: string,
  extractedImport: string
): boolean {
  if (allowableImport.endsWith('/**')) {
    const prefix = allowableImport.substring(0, allowableImport.length - 2);
    return extractedImport.startsWith(prefix);
  } else if (allowableImport.endsWith('/*')) {
    const prefix = allowableImport.substring(0, allowableImport.length - 1);
    if (!extractedImport.startsWith(prefix)) return false;
    return extractedImport.substring(prefix.length).indexOf('/') === -1;
  } else if (allowableImport.indexOf('/**/') > -1) {
    const [prefix, suffix] = allowableImport.split('/**/');
    return (
      extractedImport.startsWith(prefix) && extractedImport.endsWith(suffix)
    );
  } else {
    return new RegExp(allowableImport).test(extractedImport);
  }
}

export function isRelative(s: string) {
  return s.startsWith('.');
}

export function getTargetProjectBasedOnRelativeImport(
  imp: string,
  projectPath: string,
  projectGraph: MappedProjectGraph,
  sourceFilePath: string
): MappedProjectGraphNode<any> | undefined {
  if (!isRelative(imp)) {
    return undefined;
  }

  const targetFile = normalizePath(
    path.resolve(path.join(projectPath, path.dirname(sourceFilePath)), imp)
  ).substring(projectPath.length + 1);

  return findTargetProject(projectGraph, targetFile);
}

export function findProjectUsingFile<T>(
  projectGraph: MappedProjectGraph<T>,
  file: string
): MappedProjectGraphNode {
  return Object.values(projectGraph.nodes).find((n) => n.data.files[file]);
}

export function findSourceProject(
  projectGraph: MappedProjectGraph,
  sourceFilePath: string
) {
  const targetFile = removeExt(sourceFilePath);
  return findProjectUsingFile(projectGraph, targetFile);
}

export function findTargetProject(
  projectGraph: MappedProjectGraph,
  targetFile: string
) {
  let targetProject = findProjectUsingFile(projectGraph, targetFile);
  if (!targetProject) {
    targetProject = findProjectUsingFile(
      projectGraph,
      normalizePath(path.join(targetFile, 'index'))
    );
  }
  if (!targetProject) {
    targetProject = findProjectUsingFile(
      projectGraph,
      normalizePath(path.join(targetFile, 'src', 'index'))
    );
  }
  return targetProject;
}

export function isAbsoluteImportIntoAnotherProject(
  imp: string,
  workspaceLayout = { libsDir: 'libs', appsDir: 'apps' }
) {
  return (
    imp.startsWith(`${workspaceLayout.libsDir}/`) ||
    imp.startsWith(`/${workspaceLayout.libsDir}/`) ||
    imp.startsWith(`${workspaceLayout.appsDir}/`) ||
    imp.startsWith(`/${workspaceLayout.appsDir}/`)
  );
}

export function findProjectUsingImport(
  projectGraph: MappedProjectGraph,
  targetProjectLocator: TargetProjectLocator,
  filePath: string,
  imp: string,
  npmScope: string
): MappedProjectGraphNode | ProjectGraphExternalNode {
  const target = targetProjectLocator.findProjectWithImport(
    imp,
    filePath,
    npmScope
  );
  return projectGraph.nodes[target] || projectGraph.externalNodes?.[target];
}

export function findConstraintsFor(
  depConstraints: DepConstraint[],
  sourceProject: ProjectGraphProjectNode
) {
  return depConstraints.filter((f) => hasTag(sourceProject, f.sourceTag));
}

export function onlyLoadChildren(
  graph: ProjectGraph,
  sourceProjectName: string,
  targetProjectName: string,
  visited: string[]
) {
  if (visited.indexOf(sourceProjectName) > -1) return false;
  return (
    (graph.dependencies[sourceProjectName] || []).filter((d) => {
      if (d.type !== DependencyType.dynamic) return false;
      if (d.target === targetProjectName) return true;
      return onlyLoadChildren(graph, d.target, targetProjectName, [
        ...visited,
        sourceProjectName,
      ]);
    }).length > 0
  );
}

export function getSourceFilePath(sourceFileName: string, projectPath: string) {
  return normalizePath(sourceFileName).substring(projectPath.length + 1);
}

export function hasBannedImport(
  source: ProjectGraphProjectNode,
  target: ProjectGraphProjectNode | ProjectGraphExternalNode,
  depConstraints: DepConstraint[]
): DepConstraint | null {
  // return those constraints that match source projec and have `bannedExternalImports` defined
  depConstraints = depConstraints.filter(
    (c) =>
      (source.data.tags || []).includes(c.sourceTag) &&
      c.bannedExternalImports &&
      c.bannedExternalImports.length
  );
  return depConstraints.find((constraint) =>
    constraint.bannedExternalImports.some((importDefinition) =>
      parseImportWildcards(importDefinition).test(target.data.packageName)
    )
  );
}

export function isDirectDependency(target: ProjectGraphExternalNode): boolean {
  const fileName = 'package.json';
  const content = readFileIfExisting(join(workspaceRoot, fileName));
  if (content) {
    const { dependencies, devDependencies, peerDependencies } =
      parseJson(content);
    if (dependencies && dependencies[target.data.packageName]) {
      return true;
    }
    if (peerDependencies && peerDependencies[target.data.packageName]) {
      return true;
    }
    if (devDependencies && devDependencies[target.data.packageName]) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Maps import with wildcards to regex pattern
 * @param importDefinition
 * @returns
 */
function parseImportWildcards(importDefinition: string): RegExp {
  const mappedWildcards = importDefinition.split('*').join('.*');
  return new RegExp(`^${new RegExp(mappedWildcards).source}$`);
}

/**
 * Verifies whether the given node has an architect builder attached
 * @param projectGraph the node to verify
 */
export function hasBuildExecutor(
  projectGraph: ProjectGraphProjectNode
): boolean {
  return (
    // can the architect not be defined? real use case?
    projectGraph.data.targets &&
    projectGraph.data.targets.build &&
    projectGraph.data.targets.build.executor !== ''
  );
}

export function mapProjectGraphFiles<T>(
  projectGraph: ProjectGraph<T>
): MappedProjectGraph | null {
  if (!projectGraph) {
    return null;
  }
  const nodes: Record<string, MappedProjectGraphNode> = {};
  Object.entries(
    projectGraph.nodes as Record<string, ProjectGraphProjectNode>
  ).forEach(([name, node]) => {
    const files: Record<string, FileData> = {};
    node.data.files.forEach(({ file, hash, deps }) => {
      files[removeExt(file)] = { file, hash, ...(deps && { deps }) };
    });
    const data = { ...node.data, files };

    nodes[name] = { ...node, data };
  });

  return {
    ...projectGraph,
    nodes,
  };
}

const ESLINT_REGEX = /node_modules.*\/eslint$/;
const NRWL_CLI_REGEX = /nx\/bin\/run-executor\.js$/;

export function isTerminalRun(): boolean {
  return (
    process.argv.length > 1 &&
    (!!process.argv[1].match(NRWL_CLI_REGEX) ||
      !!process.argv[1].match(ESLINT_REGEX))
  );
}

/**
 * Takes an array of imports and tries to group them, so rather than having
 * `import { A } from './some-location'` and `import { B } from './some-location'` you get
 * `import { A, B } from './some-location'`
 * @param importsToRemap
 * @returns
 */
export function groupImports(
  importsToRemap: { member: string; importPath: string }[]
): string {
  const importsToRemapGrouped = importsToRemap.reduce((acc, curr) => {
    const existing = acc.find(
      (i) => i.importPath === curr.importPath && i.member !== curr.member
    );
    if (existing) {
      if (existing.member) {
        existing.member += `, ${curr.member}`;
      }
    } else {
      acc.push({
        importPath: curr.importPath,
        member: curr.member,
      });
    }
    return acc;
  }, []);

  return importsToRemapGrouped
    .map((entry) => `import { ${entry.member} } from '${entry.importPath}';`)
    .join('\n');
}

/**
 * Checks if import points to a secondary entry point in Angular project
 * @param targetProjectLocator
 * @param importExpr
 * @returns
 */
export function isAngularSecondaryEntrypoint(
  targetProjectLocator: TargetProjectLocator,
  importExpr: string
): boolean {
  const targetFiles = targetProjectLocator.findPaths(importExpr);
  return (
    targetFiles &&
    targetFiles.some(
      (file) =>
        file.endsWith('src/index.ts') &&
        existsSync(joinPathFragments(file, '../../', 'ng-package.json'))
    )
  );
}
