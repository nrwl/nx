import * as path from 'path';
import { FileData, readFileIfExisting } from '../core/file-utils';
import {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphNode,
  ProjectGraphProjectNode,
  normalizePath,
  DependencyType,
  parseJson,
  ProjectGraphExternalNode,
} from '@nrwl/devkit';
import { TargetProjectLocator } from '../core/target-project-locator';
import { join } from 'path';
import { appRootPath } from './app-root';

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
  bannedExternalImports?: string[];
};

export function hasNoneOfTheseTags(
  proj: ProjectGraphNode<any>,
  tags: string[]
) {
  return tags.filter((allowedTag) => hasTag(proj, allowedTag)).length === 0;
}

function hasTag(proj: ProjectGraphNode, tag: string) {
  return (proj.data.tags || []).indexOf(tag) > -1 || tag === '*';
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

export function isRelativeImportIntoAnotherProject(
  imp: string,
  projectPath: string,
  projectGraph: MappedProjectGraph,
  sourceFilePath: string,
  sourceProject: ProjectGraphNode
): boolean {
  if (!isRelative(imp)) return false;

  const targetFile = normalizePath(
    path.resolve(path.join(projectPath, path.dirname(sourceFilePath)), imp)
  ).substring(projectPath.length + 1);

  const targetProject = findTargetProject(projectGraph, targetFile);
  return sourceProject && targetProject && sourceProject !== targetProject;
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
  projectGraph: ProjectGraph,
  targetProjectLocator: TargetProjectLocator,
  filePath: string,
  imp: string,
  npmScope: string
) {
  const target = targetProjectLocator.findProjectWithImport(
    imp,
    filePath,
    npmScope
  );
  return projectGraph.nodes[target] || projectGraph.externalNodes?.[target];
}

export function findConstraintsFor(
  depConstraints: DepConstraint[],
  sourceProject: ProjectGraphNode
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
  source: ProjectGraphNode,
  target: ProjectGraphNode,
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
  const content = readFileIfExisting(join(appRootPath, fileName));
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
export function hasBuildExecutor(projectGraph: ProjectGraphNode): boolean {
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
