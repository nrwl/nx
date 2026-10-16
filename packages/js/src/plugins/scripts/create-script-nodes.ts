import {
  type CreateNodes,
  type CreateNodesResultArray,
  logger,
  type TargetConfiguration,
} from '@nx/devkit';
import {
  calculateHashesForCreateNodes,
  combineGlobPatterns,
  hashObject,
  PluginCache,
  workspaceDataDirectory,
} from '@nx/devkit/internal';
import { readFileSync } from 'node:fs';
import { basename, dirname, extname, join, posix } from 'node:path';
import { type Frontmatter, parseFrontmatter } from './frontmatter';
import { parseShebang, readShebangLine, type Shebang } from './shebang';

export interface ScriptPluginDefinition<T> {
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

// Frontmatter keys the plugin interprets; any other key merges into the target.
const RESERVED_KEYS = ['name', 'description', 'disable', 'watch', 'cwd'];
const SCRIPT_GLOB = '**/*.{js,cjs,mjs,ts,cts,mts}';
const PROJECT_MARKERS = ['package.json', 'project.json'];

export function createScriptNodes<T extends object>(
  definition: ScriptPluginDefinition<T>
): CreateNodes<T> {
  return [
    combineGlobPatterns([
      SCRIPT_GLOB,
      ...PROJECT_MARKERS.map((marker) => `**/${marker}`),
    ]),
    async (files, options, context) => {
      const scriptsByRoot = groupScriptsByProjectRoot(
        files,
        !!definition.extraTargets
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
          const { marker, scripts } = scriptsByRoot.get(projectRoot);
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
                scripts
              ),
            });
          }
          const targets = cache.get(key);
          if (Object.keys(targets).length) {
            results.push([
              scripts[0] ?? marker,
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

interface ProjectScripts {
  marker: string;
  scripts: string[];
}

/**
 * Assigns each script to its nearest enclosing project root. Roots without
 * scripts are kept only when `includeAllRoots` is set.
 */
function groupScriptsByProjectRoot(
  files: readonly string[],
  includeAllRoots: boolean
): Map<string, ProjectScripts> {
  const markers = new Map<string, string>();
  const scripts: string[] = [];
  for (const file of files) {
    if (PROJECT_MARKERS.includes(basename(file))) {
      markers.set(dirname(file), file);
    } else {
      scripts.push(file);
    }
  }

  const byRoot = new Map<string, ProjectScripts>();
  if (includeAllRoots) {
    for (const [root, marker] of markers) {
      byRoot.set(root, { marker, scripts: [] });
    }
  }
  for (const script of scripts) {
    let dir = dirname(script);
    while (!markers.has(dir) && dir !== '.') {
      dir = dirname(dir);
    }
    if (!markers.has(dir)) {
      continue;
    }
    if (!byRoot.has(dir)) {
      byRoot.set(dir, { marker: markers.get(dir), scripts: [] });
    }
    byRoot.get(dir).scripts.push(script);
  }
  return byRoot;
}

interface ClaimedScript {
  path: string;
  relativePath: string;
  shebang: Shebang;
  frontmatter: Frontmatter;
}

function createTargets<T>(
  definition: ScriptPluginDefinition<T>,
  workspaceRoot: string,
  projectRoot: string,
  scripts: string[]
): ScriptTargets {
  const claimed: ClaimedScript[] = [];
  for (const script of scripts) {
    const absolutePath = join(workspaceRoot, script);
    const line = readShebangLine(absolutePath);
    const shebang = line === null ? null : parseShebang(line);
    if (!shebang || !definition.claims(shebang)) {
      continue;
    }
    let frontmatter: Frontmatter = {};
    try {
      frontmatter = parseFrontmatter(readFileSync(absolutePath, 'utf-8'));
    } catch (e) {
      logger.warn(
        `Ignoring the nx frontmatter in ${script}: ${(e as Error).message}`
      );
    }
    frontmatter = dropInvalidKeys(frontmatter, script);
    if (frontmatter.disable === true) {
      continue;
    }
    claimed.push({
      path: script,
      relativePath: posix.relative(projectRoot, script),
      shebang,
      frontmatter,
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
      typeof script.frontmatter.name === 'string'
        ? script.frontmatter.name
        : baseNameCounts.get(baseName) > 1
          ? withoutExtension(script.relativePath)
          : baseName;
    targets[name] = createTarget(definition, projectRoot, script);
  }
  return targets;
}

function createTarget<T>(
  definition: ScriptPluginDefinition<T>,
  projectRoot: string,
  { path, relativePath, shebang, frontmatter }: ClaimedScript
): TargetConfiguration {
  const { description, watch, cwd, options, metadata } = frontmatter as {
    description?: string;
    watch?: boolean;
    cwd?: string;
    options?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  const rest = { ...frontmatter };
  for (const key of [...RESERVED_KEYS, 'options', 'metadata']) {
    delete rest[key];
  }
  const targetCwd =
    cwd ?? (typeof options?.cwd === 'string' ? options.cwd : projectRoot);
  return {
    command: definition.command(
      quoteShellArg(posix.relative(targetCwd, path)),
      shebang,
      watch === true
    ),
    options: { ...options, cwd: targetCwd },
    cache: false,
    ...(watch === true && { continuous: true }),
    metadata: {
      technologies: [definition.technology],
      description: description ?? `Runs ${relativePath}`,
      ...metadata,
    },
    ...rest,
  };
}

const EXPECTED_TYPES: Record<
  string,
  'string' | 'boolean' | 'array' | 'object'
> = {
  name: 'string',
  description: 'string',
  cwd: 'string',
  cache: 'boolean',
  continuous: 'boolean',
  watch: 'boolean',
  disable: 'boolean',
  dependsOn: 'array',
  inputs: 'array',
  outputs: 'array',
  options: 'object',
  metadata: 'object',
};

/** Drops known keys with the wrong type so they cannot break the project graph. */
function dropInvalidKeys(
  frontmatter: Frontmatter,
  script: string
): Frontmatter {
  const valid: Frontmatter = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    const expected = EXPECTED_TYPES[key];
    const actual = Array.isArray(value)
      ? 'array'
      : value === null
        ? 'null'
        : typeof value;
    if (expected && actual !== expected) {
      logger.warn(
        `Ignoring nx frontmatter key "${key}" in ${script}: expected ${expected}, got ${actual}.`
      );
      continue;
    }
    valid[key] = value;
  }
  return valid;
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
