import {
  type CreateNodes,
  type CreateNodesResultArray,
  readJsonFile,
  type TargetConfiguration,
} from '@nx/devkit';
import {
  buildPackageJsonPatterns,
  buildPackageJsonWorkspacesMatcher,
  calculateHashesForCreateNodes,
  combineGlobPatterns,
  emitPluginWorkerLog,
  getShebangFilesInContext,
  hashObject,
  PluginCache,
  workspaceDataDirectory,
} from '@nx/devkit/internal';
import { basename, dirname, extname, join, posix } from 'node:path';
import { getShebangLine, parseShebang, type Shebang } from './shebang';
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

/** Specs, tests, stories and typings are never scripts. */
const SCRIPT_GLOB = '**/!(*.spec|*.test|*.stories|*.d).{js,cjs,mjs,ts,cts,mts}';
const PROJECT_MARKERS = ['package.json', 'project.json'];

export function createScriptNodes<T extends ScriptPluginOptions>(
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
        context.workspaceRoot,
        !!definition.extraTargets
      );
      const projectRoots = [...scriptsByRoot.keys()];
      if (!projectRoots.length) {
        return [];
      }
      const claimed = await claimedShebangs(definition, context.workspaceRoot);

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
          const { marker, scripts: handed } = scriptsByRoot.get(projectRoot);
          const scripts = handed.filter((file) => claimed.has(file));
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
                projectRoot,
                scripts,
                claimed,
                options?.watch !== false
              ),
            });
          }
          const targets = cache.get(key);
          if (Object.keys(targets).length) {
            results.push([
              handed[0] ?? marker,
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
 * Assigns each script to its nearest enclosing project root among the
 * markers the plugin was handed, so `include`/`exclude` scope projects as well
 * as scripts. Roots without scripts are kept only when `includeAllRoots` is set.
 */
function groupScriptsByProjectRoot(
  files: readonly string[],
  workspaceRoot: string,
  includeAllRoots: boolean
): Map<string, ProjectScripts> {
  const handed = new Map<
    string,
    { packageJson?: string; projectJson?: string }
  >();
  const scripts: string[] = [];
  for (const file of files) {
    const name = basename(file);
    if (!PROJECT_MARKERS.includes(name)) {
      scripts.push(file);
      continue;
    }
    const dir = dirname(file);
    const entry = handed.get(dir) ?? {};
    entry[name === 'project.json' ? 'projectJson' : 'packageJson'] = file;
    handed.set(dir, entry);
  }
  // A package.json is a project root only where core's default package-json
  // plugin makes one: in the package manager workspaces, or beside a
  // project.json. The opt-in `nx/plugins/package-json` is not consulted.
  const inWorkspaces = isInPackageManagerWorkspaces(workspaceRoot);
  const markers = new Map<string, string>();
  for (const [dir, { packageJson, projectJson }] of handed) {
    if (projectJson) {
      markers.set(dir, projectJson);
    } else if (inWorkspaces(packageJson)) {
      markers.set(dir, packageJson);
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

function isInPackageManagerWorkspaces(
  workspaceRoot: string
): (packageJsonPath: string) => boolean {
  return buildPackageJsonWorkspacesMatcher(
    buildPackageJsonPatterns(workspaceRoot, (file) =>
      readJsonFile(join(workspaceRoot, file))
    )
  );
}

interface ClaimedHeader {
  header: string;
  shebang: Shebang;
}

/**
 * Headers of the scripts the plugin claims, by workspace-relative path. The
 * workspace walk recorded them, so no file is opened here.
 */
async function claimedShebangs<T extends ScriptPluginOptions>(
  definition: ScriptPluginDefinition<T>,
  workspaceRoot: string
): Promise<Map<string, ClaimedHeader>> {
  const claimed = new Map<string, ClaimedHeader>();
  for (const { file, header } of await getShebangFilesInContext(workspaceRoot, [
    SCRIPT_GLOB,
  ])) {
    const shebang = parseShebang(getShebangLine(header));
    if (shebang && definition.claims(shebang)) {
      claimed.set(file, { header, shebang });
    }
  }
  return claimed;
}

interface ClaimedScript {
  path: string;
  relativePath: string;
  shebang: Shebang;
  targetName?: string;
}

function createTargets<T extends ScriptPluginOptions>(
  definition: ScriptPluginDefinition<T>,
  projectRoot: string,
  scripts: string[],
  headers: ReadonlyMap<string, ClaimedHeader>,
  watch: boolean
): ScriptTargets {
  const claimed: ClaimedScript[] = [];
  for (const file of scripts) {
    const { header, shebang } = headers.get(file);
    const { name, warnings } = parseTargetName(header);
    for (const warning of warnings) {
      emitPluginWorkerLog('warn', `${file}: ${warning}.`);
    }
    claimed.push({
      path: file,
      relativePath: posix.relative(projectRoot, file),
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
