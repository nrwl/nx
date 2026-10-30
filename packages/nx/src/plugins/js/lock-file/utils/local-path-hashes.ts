import { readdirSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { ProjectGraphExternalNode } from '../../../../config/project-graph';
import { hashArray, hashFile } from '../../../../hasher/file-hasher';
import {
  hashMultiGlobWithWorkspaceContext,
  multiGlobWithWorkspaceContext,
} from '../../../../utils/workspace-context';

/**
 * Folds the contents of the local-path packages' sources into the hashes of
 * their external nodes. `nodeSources` maps a node name to its sources, relative
 * to `workspaceRoot`. Returns new node objects for the folded nodes, so a parser
 * that reuses its nodes keeps their lockfile hashes.
 *
 * A directory hashes the files the workspace context tracks under it, the same
 * files any other task input sees. A directory the context tracks nothing
 * under, such as a gitignored one, is walked instead, without `node_modules`. A
 * source outside the workspace keeps its lockfile hash, as linked packages do
 * elsewhere in Nx.
 */
export async function foldLocalPathHashes(
  nodes: Record<string, ProjectGraphExternalNode>,
  nodeSources: Record<string, string[]>,
  workspaceRoot: string
): Promise<Record<string, ProjectGraphExternalNode>> {
  const nodeNames = Object.keys(nodeSources).filter((name) => nodes[name]);
  if (!nodeNames.length) {
    return nodes;
  }
  const hashes = await hashLocalPathSources(
    nodeNames.flatMap((name) => nodeSources[name]),
    workspaceRoot
  );
  const folded = { ...nodes };
  for (const name of nodeNames) {
    const sourceHashes = nodeSources[name]
      .map((source) => hashes.get(source))
      .filter((hash) => hash !== undefined);
    if (!sourceHashes.length) {
      continue;
    }
    const node = nodes[name];
    folded[name] = {
      ...node,
      data: {
        ...node.data,
        hash: hashArray([node.data.hash ?? '', ...sourceHashes]),
      },
    };
  }
  return folded;
}

async function hashLocalPathSources(
  sources: string[],
  workspaceRoot: string
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  const contextDirectories: string[] = [];
  for (const source of new Set(sources)) {
    if (isAbsolute(source) || source === '..' || source.startsWith('../')) {
      continue;
    }
    const absolutePath = join(workspaceRoot, source);
    let isDirectory: boolean;
    try {
      const stats = statSync(absolutePath);
      if (stats.isFile()) {
        hashes.set(source, hashFile(absolutePath));
        continue;
      }
      isDirectory = stats.isDirectory();
    } catch {
      isDirectory = false;
    }
    if (!isDirectory) {
      hashes.set(source, hashArray([`missing local path ${source}`]));
    } else if (/[*?[\]{}()!]/.test(source)) {
      // The path would read as a glob.
      hashes.set(source, hashDirectoryTree(absolutePath));
    } else {
      contextDirectories.push(source);
    }
  }
  if (!contextDirectories.length) {
    return hashes;
  }

  const globs = contextDirectories.map((directory) => `${directory}/**/*`);
  const trackedFiles = await multiGlobWithWorkspaceContext(
    workspaceRoot,
    globs
  );
  const tracked = contextDirectories.filter(
    (_, i) => trackedFiles[i].length > 0
  );
  const trackedHashes = tracked.length
    ? await hashMultiGlobWithWorkspaceContext(
        workspaceRoot,
        tracked.map((directory) => [`${directory}/**/*`])
      )
    : [];
  tracked.forEach((directory, i) => hashes.set(directory, trackedHashes[i]));
  for (const directory of contextDirectories) {
    if (!hashes.has(directory)) {
      hashes.set(directory, hashDirectoryTree(join(workspaceRoot, directory)));
    }
  }
  return hashes;
}

function hashDirectoryTree(directory: string): string {
  const entries: string[] = [];
  const walk = (absoluteDir: string, relativeDir: string) => {
    // Listing order depends on the filesystem.
    const dirEntries = readdirSync(absoluteDir, { withFileTypes: true }).sort(
      (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    );
    for (const entry of dirEntries) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      const relativePath = relativeDir
        ? `${relativeDir}/${entry.name}`
        : entry.name;
      const absolutePath = join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath, relativePath);
      } else if (entry.isFile()) {
        entries.push(relativePath, hashFile(absolutePath));
      }
    }
  };
  walk(directory, '');
  return hashArray(entries);
}
