import {
  type CreateNodes,
  type CreateNodesResultArray,
  type TargetConfiguration,
} from '@nx/devkit';
import {
  calculateHashesForCreateNodes,
  emitPluginWorkerLog,
  hashObject,
  PluginCache,
  workspaceDataDirectory,
} from '@nx/devkit/internal';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join, posix } from 'node:path';
import {
  getShebangLine,
  parseShebang,
  readScriptHeader,
  type Shebang,
} from './shebang';
import { parseTargetName } from './target-name';

export interface ScriptPluginOptions {
  /** Runs claimed scripts in watch mode as continuous targets. Defaults to `true`. */
  watch?: boolean;
}

export interface ScriptPluginDefinition<T extends ScriptPluginOptions> {
  /** Prefix of the plugin's cache file. */
  cacheName: string;
  technology: string;
  /** Only files whose shebang the plugin claims become targets. */
  claims(shebang: Shebang): boolean;
  /** `file` is relative to the target's cwd. */
  command(file: string, shebang: Shebang, watch: boolean): string;
  /** Targets not tied to a shebang; claimed scripts win on name clashes. */
  extraTargets?(
    projectRoot: string,
    workspaceRoot: string,
    options: T
  ): Promise<ScriptTargets>;
}

export type ScriptTargets = Record<string, TargetConfiguration>;

const SCRIPT_GLOB = '**/*.{js,cjs,mjs,ts,cts,mts}';
const PROJECT_MARKERS = ['package.json', 'project.json'];

export function createScriptNodes<T extends ScriptPluginOptions>(
  definition: ScriptPluginDefinition<T>
): CreateNodes<T> {
  return [
    SCRIPT_GLOB,
    async (files, options, context) => {
      const scriptsByRoot = groupScriptsByProjectRoot(
        files,
        context.workspaceRoot
      );
      const projectRoots = [...scriptsByRoot.keys()];
      if (!projectRoots.length) {
        return [];
      }

      const cache = new PluginCache<ScriptTargets>(
        join(
          workspaceDataDirectory,
          `${definition.cacheName}-${hashObject(options ?? {})}.hash`
        )
      );
      try {
        const hashes = await calculateHashesForCreateNodes(
          projectRoots,
          options ?? {},
          context
        );
        const results: CreateNodesResultArray = [];
        for (const [i, projectRoot] of projectRoots.entries()) {
          const scripts = scriptsByRoot.get(projectRoot);
          // include/exclude can change which scripts a project gets without
          // changing its contents.
          const key = hashObject([hashes[i], [...scripts].sort()]);
          if (!cache.has(key)) {
            cache.set(key, {
              ...(await definition.extraTargets?.(
                projectRoot,
                context.workspaceRoot,
                options
              )),
              ...createTargets(
                definition,
                context.workspaceRoot,
                projectRoot,
                scripts,
                options?.watch !== false
              ),
            });
          }
          const targets = cache.get(key);
          if (Object.keys(targets).length) {
            results.push([
              scripts[0],
              { projects: { [projectRoot]: { root: projectRoot, targets } } },
            ]);
          }
        }
        return results;
      } finally {
        cache.writeToDisk();
      }
    },
  ];
}

/**
 * Assigns each script to its nearest enclosing project root. Roots are
 * resolved from disk rather than globbed, so markers never reach createNodes.
 */
function groupScriptsByProjectRoot(
  files: readonly string[],
  workspaceRoot: string
): Map<string, string[]> {
  // Directory -> nearest project root, or null outside any project.
  const rootOf = new Map<string, string | null>();
  const findRoot = (start: string) => {
    const visited: string[] = [];
    let dir = start;
    let root = rootOf.get(dir);
    while (root === undefined) {
      visited.push(dir);
      if (
        PROJECT_MARKERS.some((m) => existsSync(join(workspaceRoot, dir, m)))
      ) {
        root = dir;
      } else if (dir === '.') {
        root = null;
      } else {
        dir = dirname(dir);
        root = rootOf.get(dir);
      }
    }
    for (const v of visited) {
      rootOf.set(v, root);
    }
    return root;
  };

  const byRoot = new Map<string, string[]>();
  for (const script of files) {
    const root = findRoot(dirname(script));
    if (root === null) {
      continue;
    }
    if (!byRoot.has(root)) {
      byRoot.set(root, []);
    }
    byRoot.get(root).push(script);
  }
  return byRoot;
}

interface ClaimedScript {
  path: string;
  relativePath: string;
  shebang: Shebang;
  targetName?: string;
}

function createTargets<T extends ScriptPluginOptions>(
  definition: ScriptPluginDefinition<T>,
  workspaceRoot: string,
  projectRoot: string,
  scripts: string[],
  watch: boolean
): ScriptTargets {
  const claimed: ClaimedScript[] = [];
  for (const script of scripts) {
    const header = readScriptHeader(join(workspaceRoot, script));
    const shebang =
      header === null ? null : parseShebang(getShebangLine(header));
    if (!shebang || !definition.claims(shebang)) {
      continue;
    }
    const { name, warnings } = parseTargetName(header);
    for (const warning of warnings) {
      emitPluginWorkerLog('warn', `${script}: ${warning}.`);
    }
    claimed.push({
      path: script,
      relativePath: posix.relative(projectRoot, script),
      shebang,
      targetName: name,
    });
  }

  const baseNameCounts = new Map<string, number>();
  for (const { relativePath } of claimed) {
    const name = withoutExtension(basename(relativePath));
    baseNameCounts.set(name, (baseNameCounts.get(name) ?? 0) + 1);
  }

  const targets: ScriptTargets = {};
  for (const script of claimed) {
    const baseName = withoutExtension(basename(script.relativePath));
    const name =
      script.targetName ??
      (baseNameCounts.get(baseName) > 1
        ? withoutExtension(script.relativePath)
        : baseName);
    targets[name] = createTarget(definition, projectRoot, script, watch);
  }
  return targets;
}

function createTarget<T extends ScriptPluginOptions>(
  definition: ScriptPluginDefinition<T>,
  projectRoot: string,
  { path, relativePath, shebang }: ClaimedScript,
  watch: boolean
): TargetConfiguration {
  return {
    command: definition.command(
      quoteShellArg(posix.relative(projectRoot, path)),
      shebang,
      watch
    ),
    options: { cwd: projectRoot },
    cache: false,
    ...(watch && { continuous: true }),
    metadata: {
      technologies: [definition.technology],
      description: `Runs ${relativePath}`,
    },
  };
}

/**
 * Quotes a path for a shell command when the shell would split or expand it.
 * Double quotes keep spaces intact in sh and cmd.exe; cmd.exe still expands `%VAR%`.
 */
export function quoteShellArg(arg: string): string {
  if (/^[\w@%+=:,./-]+$/.test(arg)) {
    return arg;
  }
  return '"' + arg.replace(/(["\\$`])/g, '\\$1') + '"';
}

function withoutExtension(path: string): string {
  return path.slice(0, path.length - extname(path).length);
}
