import {
  DependencyType,
  joinPathFragments,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProjectNode,
  workspaceRoot,
} from '@nx/devkit';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type FileMapCache, setWorkspaceRoot } from '@nx/devkit/internal';
import {
  convertToReadOnly,
  convertToWritable,
  ReadOnlyConformanceTree,
  WritableConformanceTree,
} from '../src/conformance-tree';

type NestedFiles = {
  [fileName: string]: string;
};

/**
 * Adapted from https://github.com/nrwl/nx/blob/b360446a51ba3b67b2baafc7cc97b26d0f7c8f24/packages/nx/src/internal-testing-utils/temp-fs.ts
 *
 * @internal
 */
export class TempFs {
  readonly tempDir: string;

  private previousWorkspaceRoot: string;

  constructor(
    private dirname: string,
    overrideWorkspaceRoot = true
  ) {
    this.tempDir = realpathSync(mkdtempSync(join(tmpdir(), this.dirname)));
    this.previousWorkspaceRoot = workspaceRoot;

    if (overrideWorkspaceRoot) {
      setWorkspaceRoot(this.tempDir);
    }

    // Create an initial empty nx.json file
    this.createFileSync('nx.json', '{}');
  }

  async createFiles(fileObject: NestedFiles) {
    await Promise.all(
      Object.keys(fileObject).map(async (path) => {
        await this.createFile(path, fileObject[path]);
      })
    );
  }

  createFilesSync(fileObject: NestedFiles) {
    for (const path of Object.keys(fileObject)) {
      this.createFileSync(path, fileObject[path]);
    }
  }

  async createFile(filePath: string, content: string) {
    const dir = joinPathFragments(this.tempDir, dirname(filePath));
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(joinPathFragments(this.tempDir, filePath), content);
  }

  createFileSync(filePath: string, content: string) {
    const dir = joinPathFragments(this.tempDir, dirname(filePath));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(joinPathFragments(this.tempDir, filePath), content);
  }

  createSymlinkSync(
    fileOrDirPath: string,
    symlinkPath: string,
    type: 'dir' | 'file'
  ) {
    const absoluteFileOrDirPath = joinPathFragments(
      this.tempDir,
      fileOrDirPath
    );
    const absoluteSymlinkPath = joinPathFragments(this.tempDir, symlinkPath);
    const symlinkDir = dirname(absoluteSymlinkPath);
    if (!existsSync(symlinkDir)) {
      mkdirSync(symlinkDir, { recursive: true });
    }

    symlinkSync(absoluteFileOrDirPath, absoluteSymlinkPath, type);
  }

  async readFile(filePath: string): Promise<string> {
    return await readFile(joinPathFragments(this.tempDir, filePath), 'utf-8');
  }

  removeFileSync(filePath: string): void {
    unlinkSync(joinPathFragments(this.tempDir, filePath));
  }

  appendFile(filePath: string, content: string) {
    appendFileSync(joinPathFragments(this.tempDir, filePath), content);
  }

  writeFile(filePath: string, content: string) {
    writeFileSync(joinPathFragments(this.tempDir, filePath), content);
  }
  renameFile(oldPath: string, newPath: string) {
    renameSync(
      joinPathFragments(this.tempDir, oldPath),
      joinPathFragments(this.tempDir, newPath)
    );
  }

  cleanup() {
    try {
      rmSync(this.tempDir, { recursive: true, force: true, maxRetries: 5 });
    } catch (e) {
      // We are experiencing flakiness in CI related to this cleanup, so log only for now
      if (process.env.CI) {
        console.error(`Failed to cleanup temp dir: ${e}`);
      } else {
        throw e;
      }
    } finally {
      setWorkspaceRoot(this.previousWorkspaceRoot);
    }
  }

  reset() {
    try {
      rmSync(this.tempDir, { recursive: true, force: true, maxRetries: 5 });
      mkdirSync(this.tempDir, { recursive: true });
    } catch (e) {
      // We are experiencing flakiness in CI related to this cleanup, so log only for now
      if (process.env.CI) {
        console.error(`Failed to cleanup temp dir: ${e}`);
      } else {
        throw e;
      }
    }
  }
}

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
