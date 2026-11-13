import {
  DependencyType,
  joinPathFragments,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '@nx/devkit';
import type { FileMapCache } from '@nx/devkit/internal';
import {
  convertToReadOnly,
  convertToWritable,
  ReadOnlyConformanceTree,
  WritableConformanceTree,
} from '../src/conformance-tree';

export interface ProjectNodesWithFiles {
  projectNode: ProjectGraphProjectNode;
  projectFiles?: {
    projectRootRelativeFile: string;
    depsItCreates: (string | [string, DependencyType])[];
  }[];
}

/**
 * Creates a test workspace using a temporary directory on disk with the given nodes and files, and returns a
 * read-only tree representing that directory, as well as a stubbed project graph and file map cache.
 *
 * This is useful for testing conformance rules which care about project graph and file map cache data.
 *
 * NOTE: These are testing utilities, changes to the tree will not automatically reflect in the project graph and file map cache.
 * You must modify the project graph and file map cache objects manually or use the `applyProjectNodesAndFiles` function from
 * `@nx/conformance/testing` to update them when applicable in your tests.
 *
 * See the `@nx/conformance` README.md for full details and examples of testing conformance rules.
 *
 * @public
 */
export async function createStubbedProjectGraphAndFileMapCache(
  tree: ReadOnlyConformanceTree | WritableConformanceTree,
  projectNodesWithFiles: ProjectNodesWithFiles[]
): Promise<{
  projectGraph: ProjectGraph;
  fileMapCache: FileMapCache;
}> {
  const projectGraph: ProjectGraph = {
    nodes: {},
    dependencies: {},
  };
  const projectFileMap: ProjectFileMap = {};
  const fileMapCache: FileMapCache = {
    version: '',
    nxVersion: '',
    pathMappings: {},
    nxJsonPlugins: [],
    fileMap: {
      nonProjectFiles: [],
      projectFileMap,
    },
  };

  // Apply any initial project nodes and files data to the tree, project graph and file map cache
  applyProjectNodesAndFiles(
    tree,
    projectGraph,
    fileMapCache,
    projectNodesWithFiles
  );

  return {
    projectGraph,
    fileMapCache,
  };
}

/**
 * Applies the given project nodes and files to the tree, project graph and file map cache for use in testing conformance rules
 * that require specific project graph and file map cache data.
 *
 * See the `@nx/conformance` README.md for full details and examples of testing conformance rules.
 *
 * @public
 */
export function applyProjectNodesAndFiles(
  tree: ReadOnlyConformanceTree | WritableConformanceTree,
  projectGraph: ProjectGraph,
  fileMapCache: FileMapCache,
  projectNodesWithFiles: ProjectNodesWithFiles[]
): void {
  // Create the files in the tree
  const filesObject: Record<string, string> = projectNodesWithFiles.reduce(
    (acc, { projectNode, projectFiles }) => {
      (projectFiles ?? []).forEach(({ projectRootRelativeFile }) => {
        const fullPath = joinPathFragments(
          projectNode.data.root,
          projectRootRelativeFile
        );
        acc[fullPath] = '';
      });
      return acc;
    },
    {}
  );

  const isReadOnlyTree = (tree as any).isReadOnly;
  if (isReadOnlyTree) {
    tree = convertToWritable(tree);
  }

  for (const [path, content] of Object.entries(filesObject)) {
    tree.write(path, content);
  }

  // Convert back to read only tree if we started with one
  if (isReadOnlyTree) {
    tree = convertToReadOnly(tree);
  }

  projectNodesWithFiles.forEach(({ projectNode, projectFiles }) => {
    projectGraph.nodes[projectNode.name] = projectNode;
    (projectFiles ?? []).forEach(
      ({ projectRootRelativeFile, depsItCreates }) => {
        // Add to the project graph dependencies
        projectGraph.dependencies[projectNode.name] =
          projectGraph.dependencies[projectNode.name] || [];
        for (const dep of depsItCreates) {
          const depTarget = typeof dep === 'string' ? dep : dep[0];
          const depType = typeof dep === 'string' ? 'static' : dep[1];
          projectGraph.dependencies[projectNode.name].push({
            type: depType,
            source: projectNode.name,
            target: depTarget,
          });
        }
        // Add to the file map cache
        const fileData = {
          file: joinPathFragments(
            projectNode.data.root,
            projectRootRelativeFile
          ),
          hash: '',
          deps: depsItCreates,
        };
        fileMapCache.fileMap.projectFileMap[projectNode.name] =
          fileMapCache.fileMap.projectFileMap[projectNode.name] || [];
        fileMapCache.fileMap.projectFileMap[projectNode.name].push(fileData);
      }
    );
  });
}
