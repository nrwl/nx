import type { Dirent } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { ProjectGraphExternalNode } from '../../../../config/project-graph';
import { hashArray, hashFile } from '../../../../hasher/file-hasher';

/**
 * Folds the contents of the local-path packages' sources into the hashes of
 * their external nodes. `nodeSources` maps a node name to its sources, relative
 * to `workspaceRoot`. Returns new node objects for the folded nodes, so a parser
 * that reuses its nodes keeps their lockfile hashes.
 *
 * A directory hashes the files a pruned deploy output copies from it
 * (`listLocalPathFiles`), ignored ones included. A source outside the
 * workspace keeps its lockfile hash, as linked packages do elsewhere in Nx.
 */
export function foldLocalPathHashes(
  nodes: Record<string, ProjectGraphExternalNode>,
  nodeSources: Record<string, string[]>,
  workspaceRoot: string
): Record<string, ProjectGraphExternalNode> {
  const nodeNames = Object.keys(nodeSources).filter((name) => nodes[name]);
  if (!nodeNames.length) {
    return nodes;
  }
  const hashes = hashLocalPathSources(
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

function hashLocalPathSources(
  sources: string[],
  workspaceRoot: string
): Map<string, string> {
  const hashes = new Map<string, string>();
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
    hashes.set(
      source,
      isDirectory
        ? hashLocalPathDirectory(absolutePath)
        : hashArray([`missing local path ${source}`])
    );
  }
  return hashes;
}

// An unreadable directory fails the copy, not the project graph.
function hashLocalPathDirectory(directory: string): string {
  const unreadable: string[] = [];
  const files = listLocalPathFiles(directory, {
    onUnreadableDirectory: (relativePath) =>
      unreadable.push(`unreadable directory ${relativePath}`),
  });
  return hashArray([
    ...files.flatMap((file) => [
      file.relativePath,
      hashFile(file.absolutePath),
    ]),
    ...unreadable,
  ]);
}

/**
 * Lists the files a local-path directory ships, sorted: every file outside
 * `node_modules`, whether or not git ignores it. Symbolic links are neither
 * followed nor listed; `onSymbolicLink` receives each one. A directory that
 * cannot be read throws unless `onUnreadableDirectory` is given.
 */
export function listLocalPathFiles(
  directory: string,
  callbacks: {
    onSymbolicLink?: (absolutePath: string) => void;
    onUnreadableDirectory?: (relativePath: string) => void;
  } = {}
): { relativePath: string; absolutePath: string }[] {
  const files: { relativePath: string; absolutePath: string }[] = [];
  const walk = (absoluteDir: string, relativeDir: string) => {
    let dirEntries: Dirent[];
    try {
      dirEntries = readdirSync(absoluteDir, { withFileTypes: true });
    } catch (e) {
      if (!callbacks.onUnreadableDirectory) {
        throw e;
      }
      callbacks.onUnreadableDirectory(relativeDir);
      return;
    }
    // Listing order depends on the filesystem.
    dirEntries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of dirEntries) {
      if (entry.name === 'node_modules') {
        continue;
      }
      const relativePath = relativeDir
        ? `${relativeDir}/${entry.name}`
        : entry.name;
      const absolutePath = join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath, relativePath);
      } else if (entry.isFile()) {
        files.push({ relativePath, absolutePath });
      } else if (entry.isSymbolicLink()) {
        callbacks.onSymbolicLink?.(absolutePath);
      }
    }
  };
  walk(directory, '');
  return files;
}
