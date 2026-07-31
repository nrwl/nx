import {
  calculateHashesForCreateNodes,
  PluginCache,
} from '@nx/devkit/internal';
import {
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResult,
  detectPackageManager,
  getPackageManagerCommand,
  readJsonFile,
  TargetConfiguration,
} from '@nx/devkit';
import { getLockFileName, getRootTsConfigFileName } from '@nx/js';
import {
  walkTsconfigExtendsChain,
  type RawTsconfigJsonCache,
} from '@nx/js/internal';
import { existsSync } from 'node:fs';
import { relative as nativeRelative, sep as nativeSep } from 'node:path';
import { basename, dirname, join, normalize, sep } from 'node:path/posix';
import { hashObject } from 'nx/src/hasher/file-hasher';
import {
  buildPackageJsonPatterns,
  buildPackageJsonWorkspacesMatcher,
} from 'nx/src/plugins/package-json/create-nodes';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { OXLINT_CONFIG_FILENAMES } from '../utils/config-file.js';

export interface OxlintPluginOptions {
  targetName?: string;
  extensions?: string[];
}

/** Source types Oxlint can parse. It does not lint JSON. */
const DEFAULT_EXTENSIONS = [
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'mts',
  'cts',
  'tsx',
  'vue',
  'svelte',
  'astro',
];
const PROJECT_CONFIG_FILENAMES = ['project.json', 'package.json'];
const OXLINT_CONFIG_GLOB = combineGlobPatterns([
  ...OXLINT_CONFIG_FILENAMES.map((f) => `**/${f}`),
  ...PROJECT_CONFIG_FILENAMES.map((f) => `**/${f}`),
]);

type OxlintProjects = CreateNodesResult['projects'];

const internalCreateNodes = async (
  configFilePath: string,
  options: OxlintPluginOptions,
  context: CreateNodesContext,
  projectRootsByOxlintRoots: Map<string, string[]>,
  getLintableFilesPerProjectRoot: () => Promise<Map<string, number>>,
  configChainsByConfig: Map<string, string[]>,
  tsconfigChainsByProjectRoot: Map<string, string[]>,
  projectsCache: PluginCache<OxlintProjects>,
  hashByRoot: Map<string, string>,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  rootConfig: string | undefined
): Promise<CreateNodesResult> => {
  const configDir = dirname(configFilePath);

  // Collect each project root's contribution in parallel, but write them into
  // `projects` afterwards in input order so insertion order (and therefore
  // downstream merge order) stays deterministic.
  const orderedProjectRoots = projectRootsByOxlintRoots.get(configDir) ?? [];
  const contributions = await Promise.all(
    orderedProjectRoots.map(async (projectRoot) => {
      const hash = hashByRoot.get(projectRoot);

      const cached = projectsCache.get(hash);
      if (cached) {
        return cached;
      }

      // A project that owns its own config is assumed to want linting; for
      // every other project, only infer a target when there is something to
      // lint. Without this, docs-only and non-JS projects sprout Oxlint
      // targets that lint nothing.
      //
      // The right-hand side globs the whole workspace, so it stays behind the
      // `||` and behind the cache check above: a warm run never pays for it.
      const shouldInferTarget =
        (configDir === projectRoot && projectRoot !== '.') ||
        ((await getLintableFilesPerProjectRoot()).get(projectRoot) ?? 0) > 0;

      if (!shouldInferTarget) {
        projectsCache.set(hash, {});
        return null;
      }

      const project = getProjectUsingOxlintConfig(
        configFilePath,
        projectRoot,
        options,
        context,
        pmc,
        configChainsByConfig,
        tsconfigChainsByProjectRoot.get(projectRoot) ?? [],
        rootConfig
      );

      if (project) {
        const entry = { [projectRoot]: project };
        projectsCache.set(hash, entry);
        return entry;
      }

      projectsCache.set(hash, {});
      return null;
    })
  );

  const projects: CreateNodesResult['projects'] = {};
  for (const contribution of contributions) {
    if (contribution) {
      Object.assign(projects, contribution);
    }
  }

  return { projects };
};

export const createNodes: CreateNodes<OxlintPluginOptions> = [
  OXLINT_CONFIG_GLOB,
  async (configFiles, options, context) => {
    options = normalizeOptions(options);
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `oxlint-${optionsHash}.hash`
    );
    const targetsCache = new PluginCache<OxlintProjects>(cachePath);

    const { oxlintConfigFiles, projectRoots, projectRootsByOxlintRoots } =
      splitConfigFiles(configFiles, context.workspaceRoot);

    // The glob also matches `**/package.json`, so this callback runs in every
    // workspace, Oxlint or not. Bail before the chain walks and the hashing.
    if (oxlintConfigFiles.length === 0) {
      return [];
    }

    // Globbing every lintable file in the workspace is the most expensive thing
    // this plugin does, and it is only consulted on a cache miss. Keep it lazy
    // so a warm graph computation skips it, and memoize the promise so the
    // concurrent per-config calls below share one glob.
    let lintableFilesPerProjectRoot: Promise<Map<string, number>> | undefined;
    const getLintableFilesPerProjectRoot = () =>
      (lintableFilesPerProjectRoot ??= collectLintableFilesByProjectRoot(
        projectRoots,
        options,
        context
      ));

    // Workspace-global and invariant for the whole run, so it is resolved once
    // here rather than re-stat'ed for every project.
    const rootConfig = OXLINT_CONFIG_FILENAMES.find((file) =>
      existsSync(join(context.workspaceRoot, file))
    );

    const configChainsByConfig = collectConfigChains(
      oxlintConfigFiles,
      context.workspaceRoot
    );
    const tsconfigChainsByProjectRoot = collectTsconfigChainsByProjectRoot(
      projectRoots,
      context.workspaceRoot
    );
    // Detected once: it stats the workspace root for lock files, and both the
    // executor command and the lock-file input below need the answer. Placed
    // after the bail so a workspace with no Oxlint config never pays for it.
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFilePattern = getLockFileName(packageManager);
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      options,
      context,
      projectRoots.map((root) => {
        // Configs that govern this project: the one in its own directory, and
        // every ancestor's. Configs *below* the project root are already
        // covered by the `{projectRoot}/**/*` glob the hasher adds, and it is
        // the ancestors whose edits would otherwise go unnoticed.
        const governingConfigs = oxlintConfigFiles.filter((oxlintConfig) => {
          const configDir = dirname(oxlintConfig);
          return configDir === root || isSubDir(configDir, root);
        });
        // Deduped: with a config per project every chain resolves to the same
        // root config, and each duplicate is another glob for the hasher to
        // evaluate against the whole workspace.
        return [
          ...new Set([
            ...governingConfigs,
            ...governingConfigs.flatMap(
              (config) => configChainsByConfig.get(config) ?? []
            ),
            lockFilePattern,
            ...(tsconfigChainsByProjectRoot.get(root) ?? []),
          ]),
        ];
      })
    );
    const hashByRoot = new Map<string, string>(
      projectRoots.map((r, i) => [r, hashes[i]])
    );

    try {
      return await createNodesFromFiles(
        (configFile, fileOptions, fileContext) =>
          internalCreateNodes(
            configFile,
            fileOptions,
            fileContext,
            projectRootsByOxlintRoots,
            getLintableFilesPerProjectRoot,
            configChainsByConfig,
            tsconfigChainsByProjectRoot,
            targetsCache,
            hashByRoot,
            pmc,
            rootConfig
          ),
        oxlintConfigFiles,
        options,
        context
      );
    } finally {
      targetsCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

function splitConfigFiles(
  configFiles: readonly string[],
  workspaceRoot: string
): {
  oxlintConfigFiles: string[];
  projectRoots: string[];
  projectRootsByOxlintRoots: Map<string, string[]>;
} {
  const oxlintConfigFiles: string[] = [];
  const packageJsonFiles: string[] = [];
  const projectJsonRoots = new Set<string>();

  for (const configFile of configFiles) {
    const fileName = basename(configFile);
    if (fileName === 'package.json') {
      packageJsonFiles.push(configFile);
    } else if (fileName === 'project.json') {
      projectJsonRoots.add(dirname(configFile));
    } else {
      oxlintConfigFiles.push(configFile);
    }
  }

  // Nothing below depends on the package.json/project.json partition when there
  // is no Oxlint config, and the caller bails on that too. Returning here keeps
  // a registered-but-unconfigured workspace from reading the root package.json,
  // pnpm-workspace.yaml and lerna.json and minimatching every package.json on
  // every graph computation, for a result it discards.
  if (oxlintConfigFiles.length === 0) {
    return {
      oxlintConfigFiles,
      projectRoots: [],
      projectRootsByOxlintRoots: new Map(),
    };
  }

  // A package.json outside the package manager's workspaces is not a project —
  // nested marker files (`{"sideEffects": false}` next to a bundle, say) have no
  // `name`, and promoting one to a project root fails the whole graph with
  // ProjectsWithNoNameError.
  //
  // Applied unconditionally, matching core's default path. (Core skips the
  // matcher when `NX_INFER_ALL_PACKAGE_JSONS=true` and no root package.json is
  // in play; that escape hatch is deliberately not mirrored, and the failure
  // direction is a missing target.) There is no
  // empty-globs escape hatch on purpose: core appends the root package.json to
  // the globs only when it carries an `nx` key (which `nx init` writes), so a
  // root that is genuinely a project already comes through this matcher. Empty
  // globs mean core creates no root project, and inferring one anyway either
  // invents a project the rest of the graph lacks or fails it outright. A
  // package.json beside a project.json is admitted by `projectJsonRoots` below
  // regardless.
  const patterns = buildPackageJsonPatterns(workspaceRoot, (f) =>
    readJsonFile(join(workspaceRoot, f))
  );
  const isInPackageManagerWorkspaces =
    buildPackageJsonWorkspacesMatcher(patterns);

  const projectRoots = new Set<string>(projectJsonRoots);
  for (const packageJsonFile of packageJsonFiles) {
    // Next to a project.json it is a project regardless of the workspaces globs.
    if (
      isInPackageManagerWorkspaces(packageJsonFile) ||
      projectJsonRoots.has(dirname(packageJsonFile))
    ) {
      projectRoots.add(dirname(packageJsonFile));
    }
  }

  const projectRootsByOxlintRoots = new Map<string, string[]>();
  for (const configFile of oxlintConfigFiles) {
    projectRootsByOxlintRoots.set(dirname(configFile), []);
  }
  for (const projectRoot of projectRoots) {
    const oxlintRoot = getRootForDirectory(
      projectRoot,
      projectRootsByOxlintRoots
    );
    if (oxlintRoot) {
      projectRootsByOxlintRoots.get(oxlintRoot).push(projectRoot);
    }
  }

  return {
    oxlintConfigFiles,
    projectRoots: Array.from(projectRoots),
    projectRootsByOxlintRoots,
  };
}

/**
 * Resolves each config's `extends` chain to workspace-relative paths so they
 * can be declared as target inputs. Oxlint resolves `extends` entries relative
 * to the referencing config's own directory and only tracks the chain for its
 * LSP, so Nx has to walk it here or caching goes stale on an extended file.
 *
 * TypeScript configs (`oxlint.config.{ts,mts}`) are not statically readable,
 * so only the config file itself is tracked for those.
 */
function collectConfigChains(
  oxlintConfigFiles: string[],
  workspaceRoot: string
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  // Shared across configs, not per config: with a config per project every
  // chain ends at the same root config, so without this each project re-reads
  // and re-parses it. `null` records "read failed", so a bad file is not
  // retried once per referrer either.
  const jsonCache = new Map<string, { extends?: string[] } | null>();
  const existsCache = new Map<string, boolean>();

  const configExists = (relativeConfigPath: string): boolean => {
    let exists = existsCache.get(relativeConfigPath);
    if (exists === undefined) {
      exists = existsSync(join(workspaceRoot, relativeConfigPath));
      existsCache.set(relativeConfigPath, exists);
    }
    return exists;
  };

  const readConfig = (
    relativeConfigPath: string
  ): { extends?: string[] } | null => {
    if (jsonCache.has(relativeConfigPath)) {
      return jsonCache.get(relativeConfigPath);
    }

    let json: { extends?: string[] } | null = null;
    if (configExists(relativeConfigPath)) {
      try {
        json = readJsonFile(join(workspaceRoot, relativeConfigPath), {
          expectComments: true,
          allowTrailingComma: true,
        });
      } catch {
        // A malformed config drops its chain from the task inputs rather than
        // failing graph construction, matching `readCachedJson` in @nx/js.
        json = null;
      }
    }

    jsonCache.set(relativeConfigPath, json);
    return json;
  };

  for (const configFile of oxlintConfigFiles) {
    const extended: string[] = [];
    const seen = new Set<string>();

    const walk = (relativeConfigPath: string) => {
      if (seen.has(relativeConfigPath)) {
        return;
      }
      seen.add(relativeConfigPath);

      if (!/\.jsonc?$/.test(relativeConfigPath)) {
        return;
      }

      const json = readConfig(relativeConfigPath);

      if (!Array.isArray(json?.extends)) {
        return;
      }

      for (const entry of json.extends) {
        if (typeof entry !== 'string') {
          continue;
        }
        const resolved = normalize(join(dirname(relativeConfigPath), entry));
        if (resolved.startsWith('..')) {
          continue; // escapes the workspace, cannot be a `{workspaceRoot}` input
        }
        // Declared even when absent: a `{workspaceRoot}` input that matches no
        // file contributes nothing to the hash, so declaring it costs nothing
        // and keeps the target's `inputs` stable across the file appearing.
        extended.push(resolved);
        if (configExists(resolved)) {
          walk(resolved);
        }
      }
    };

    walk(configFile);
    result.set(configFile, extended);
  }

  return result;
}

/**
 * For each project root that has a `tsconfig.json`, resolves its `extends`
 * chain and returns the workspace-relative paths of every reachable file that
 * lives OUTSIDE the project root. Type-aware Oxlint reads the tsconfig, so
 * those files have to invalidate the cache.
 *
 * Mirrors `@nx/eslint`'s equivalent, including its skip cases.
 */
function collectTsconfigChainsByProjectRoot(
  projectRoots: string[],
  workspaceRoot: string
): Map<string, string[]> {
  const jsonCache: RawTsconfigJsonCache = new Map();
  const result = new Map<string, string[]>();

  // The root tsconfig is handled by the native selective hasher, which only
  // hashes the path aliases relevant to each project. Declaring it explicitly
  // would bypass that and make every project dirty on any change.
  const rootTsConfigName = getRootTsConfigFileName();

  for (const projectRoot of projectRoots) {
    if (projectRoot === '.') continue;
    const tsconfigPath = join(projectRoot, 'tsconfig.json');
    if (!existsSync(join(workspaceRoot, tsconfigPath))) continue;

    const outside: string[] = [];
    const projectPrefix = `${projectRoot}/`;
    walkTsconfigExtendsChain(
      join(workspaceRoot, tsconfigPath),
      (absolutePath) => {
        const wsRelative = nativeRelative(workspaceRoot, absolutePath)
          .split(nativeSep)
          .join('/');
        if (wsRelative.startsWith('../') || wsRelative === '..') {
          return 'continue'; // escapes workspace
        }
        if (
          wsRelative.startsWith('node_modules/') ||
          wsRelative.includes('/node_modules/')
        ) {
          return 'continue'; // external package, lockfile invalidates
        }
        if (
          wsRelative === projectRoot ||
          wsRelative.startsWith(projectPrefix)
        ) {
          return 'continue'; // inside project root, covered by `default`
        }
        if (wsRelative === rootTsConfigName) {
          return 'continue'; // handled by native selective hasher
        }
        outside.push(wsRelative);
        return 'continue';
      },
      { jsonCache }
    );
    result.set(projectRoot, outside);
  }
  return result;
}

/**
 * Counts rather than collects: the only caller asks whether a project has any
 * lintable file, and the glob spans the whole workspace, so keeping the paths
 * would retain every one of them for the rest of the graph computation.
 */
async function collectLintableFilesByProjectRoot(
  projectRoots: string[],
  options: OxlintPluginOptions,
  context: CreateNodesContext
): Promise<Map<string, number>> {
  const lintableFilesPerProjectRoot = new Map<string, number>();

  const lintableFiles = await globWithWorkspaceContext(context.workspaceRoot, [
    `**/*.{${options.extensions.join(',')}}`,
  ]);

  for (const projectRoot of projectRoots) {
    lintableFilesPerProjectRoot.set(projectRoot, 0);
  }

  for (const file of lintableFiles) {
    const projectRoot = getRootForDirectory(
      dirname(file),
      lintableFilesPerProjectRoot
    );
    if (projectRoot) {
      lintableFilesPerProjectRoot.set(
        projectRoot,
        lintableFilesPerProjectRoot.get(projectRoot) + 1
      );
    }
  }

  return lintableFilesPerProjectRoot;
}

// Only the keys are read, so the value type is left open for both callers.
function getRootForDirectory(
  directory: string,
  roots: Map<string, unknown>
): string | null {
  let currentPath = normalize(directory);

  while (currentPath !== dirname(currentPath)) {
    if (roots.has(currentPath)) {
      return currentPath;
    }
    currentPath = dirname(currentPath);
  }

  return roots.has(currentPath) ? currentPath : null;
}

function getProjectUsingOxlintConfig(
  configFilePath: string,
  projectRoot: string,
  options: OxlintPluginOptions,
  context: CreateNodesContext,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  configChainsByConfig: Map<string, string[]>,
  tsconfigChainOutsideProjectRoot: string[],
  rootConfig: string | undefined
): CreateNodesResult['projects'][string] | null {
  let standaloneSrcPath: string | undefined;
  if (
    projectRoot === '.' &&
    existsSync(join(context.workspaceRoot, projectRoot, 'package.json'))
  ) {
    if (existsSync(join(context.workspaceRoot, projectRoot, 'src'))) {
      standaloneSrcPath = 'src';
    } else if (existsSync(join(context.workspaceRoot, projectRoot, 'lib'))) {
      standaloneSrcPath = 'lib';
    }
  }

  if (projectRoot === '.' && !standaloneSrcPath) {
    return null;
  }

  const oxlintConfigs = [configFilePath];
  if (rootConfig && !oxlintConfigs.includes(rootConfig)) {
    oxlintConfigs.unshift(rootConfig);
  }

  // Deduped: a project config that extends the root names it a second time.
  const configInputs = [
    ...new Set(
      oxlintConfigs.flatMap((config) => [
        config,
        ...(configChainsByConfig.get(config) ?? []),
      ])
    ),
  ];

  const isRootProject = projectRoot === '.';
  const lintPath =
    isRootProject && standaloneSrcPath ? `./${standaloneSrcPath}` : '.';

  const targetConfig: TargetConfiguration = {
    command: `oxlint ${lintPath}`,
    options: { cwd: projectRoot },
    cache: true,
    inputs: [
      'default',
      '^default',
      ...configInputs.map((config) => `{workspaceRoot}/${config}`),
      ...tsconfigChainOutsideProjectRoot.map(
        (file) => `{workspaceRoot}/${file}`
      ),
      { externalDependencies: ['oxlint'] },
    ],
    metadata: {
      technologies: ['oxlint'],
      description: 'Runs Oxlint on project',
      help: {
        command: `${pmc.exec} oxlint --help`,
        example: {
          options: {
            'max-warnings': 0,
          },
        },
      },
    },
  };

  return {
    targets: {
      [options.targetName]: targetConfig,
    },
  };
}

function normalizeOptions(options: OxlintPluginOptions): OxlintPluginOptions {
  return {
    targetName: options?.targetName ?? 'lint',
    extensions: (options?.extensions ?? DEFAULT_EXTENSIONS).map((f) =>
      f.replace(/^\.+/, '')
    ),
  };
}

function isSubDir(parent: string, child: string): boolean {
  if (parent === '.') {
    return true;
  }

  parent = normalize(parent);
  child = normalize(child);

  if (!parent.endsWith(sep)) {
    parent += sep;
  }

  return child.startsWith(parent);
}
