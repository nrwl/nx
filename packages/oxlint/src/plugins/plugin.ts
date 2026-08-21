import {
  buildPackageJsonPatterns,
  buildPackageJsonWorkspacesMatcher,
  calculateHashesForCreateNodes,
  combineGlobPatterns,
  globWithWorkspaceContext,
  hashObject,
  PluginCache,
  workspaceDataDirectory,
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
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  dirname as nativeDirname,
  join as nativeJoin,
  relative as nativeRelative,
  sep as nativeSep,
} from 'node:path';
import { basename, dirname, join, normalize, sep } from 'node:path/posix';
import { OXLINT_CONFIG_FILENAMES } from '../utils/config-file.js';

export interface OxlintPluginOptions {
  targetName?: string;
}

/**
 * Source types Oxlint can parse. It does not lint JSON. Not configurable:
 * Oxlint picks the files it lints itself, so this only decides whether a
 * project has anything worth inferring a target for.
 */
const LINTABLE_EXTENSIONS = [
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
const LINTABLE_FILES_GLOB = `**/*.{${LINTABLE_EXTENSIONS.join(',')}}`;
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

      // Require something lintable, so docs-only projects get no target even
      // when they own a config — a target there fails with "No files found to
      // lint". This spans the whole workspace, so it stays behind the cache
      // check and is memoized across configs.
      const shouldInferTarget =
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

    // The most expensive thing here, and only needed on a cache miss. Lazy so a
    // warm run skips it; memoized so concurrent per-config calls share one glob.
    let lintableFilesPerProjectRoot: Promise<Map<string, number>> | undefined;
    const getLintableFilesPerProjectRoot = () =>
      (lintableFilesPerProjectRoot ??= collectLintableFilesByProjectRoot(
        projectRoots,
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
    // Stats the workspace root, so detect once for both uses below — and after
    // the bail, so a workspace with no Oxlint config never pays for it.
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFilePattern = getLockFileName(packageManager);
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      options,
      context,
      projectRoots.map((root) => {
        // Own directory and every ancestor. Configs below the root are already
        // covered by the hasher's `{projectRoot}/**/*` glob.
        const governingConfigs = oxlintConfigFiles.filter((oxlintConfig) => {
          const configDir = dirname(oxlintConfig);
          return configDir === root || isSubDir(configDir, root);
        });
        // Deduped: every chain ends at the same root config, and each duplicate
        // is another whole-workspace glob for the hasher.
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

  // The caller bails on this too, so returning early keeps a workspace with no
  // Oxlint config from reading the root package.json, pnpm-workspace.yaml and
  // lerna.json and minimatching every package.json for a discarded result.
  if (oxlintConfigFiles.length === 0) {
    return {
      oxlintConfigFiles,
      projectRoots: [],
      projectRootsByOxlintRoots: new Map(),
    };
  }

  // A package.json outside the workspaces globs is not a project: nested marker
  // files have no `name`, and promoting one fails the whole graph with
  // ProjectsWithNoNameError. Unconditional on purpose — core admits a root only
  // when it carries an `nx` key, so empty globs mean core creates no root either.
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
 * Resolves each config's `extends` chain to workspace-relative target inputs.
 * Oxlint resolves entries relative to the referencing config and only tracks the
 * chain for its LSP, so Nx walks it here or caching goes stale. TypeScript
 * configs are not statically readable, so only the file itself is tracked.
 */
function collectConfigChains(
  oxlintConfigFiles: string[],
  workspaceRoot: string
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  // Shared across configs so the common root config is read once. `null` records
  // a failed read, so a bad file is not retried per referrer.
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
        // Declared even when absent: an input matching no file costs nothing and
        // keeps `inputs` stable if the file later appears.
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
 * Per project root, the `extends`-reachable tsconfig files that live OUTSIDE the
 * project root. Type-aware Oxlint reads the tsconfig, so those have to invalidate
 * the cache. Mirrors `@nx/eslint`'s equivalent, including its skip cases.
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

const localRequire = createRequire(import.meta.url);

/**
 * Asks Oxlint itself which files it would lint. A glob cannot answer this:
 * Oxlint honours `ignorePatterns`, `.eslintignore` and `.gitignore`, including
 * from nested project configs, so a project whose files are all ignored is
 * empty to Oxlint but not to a glob.
 *
 * Returns null when Oxlint cannot answer — it is not installed, or one
 * malformed config anywhere aborts the whole run. Callers fall back to globbing
 * rather than failing graph construction over another project's broken config.
 */
function enumerateLintableFilesWithOxlint(
  workspaceRoot: string
): string[] | null {
  let bin: string;
  try {
    bin = nativeJoin(
      nativeDirname(
        localRequire.resolve('oxlint/package.json', { paths: [workspaceRoot] })
      ),
      'bin',
      'oxlint'
    );
  } catch {
    return null;
  }
  if (!existsSync(bin)) {
    return null;
  }

  try {
    // Spawned through `process.execPath` rather than the `.bin` shim so this
    // does not depend on a shell or on PATH.
    // `--ignore-pattern` rather than trusting the workspace's `.gitignore`:
    // `globWithWorkspaceContext` always skips `node_modules`, and a workspace
    // that does not gitignore it would otherwise enumerate every dependency.
    const stdout = execFileSync(
      process.execPath,
      [bin, '--debug=files', '--ignore-pattern', '**/node_modules/**', '.'],
      {
        cwd: workspaceRoot,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        // Graph construction must not hang on a wedged subprocess; a timeout
        // throws, which is the same fall-back-to-globbing path as any other
        // failure here.
        timeout: 30_000,
      }
    );
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((file) => file.split(nativeSep).join(sep));
  } catch {
    return null;
  }
}

/**
 * Counts rather than collects: the only caller asks whether a project has any
 * lintable file, and the enumeration spans the whole workspace.
 */
async function collectLintableFilesByProjectRoot(
  projectRoots: string[],
  context: CreateNodesContext
): Promise<Map<string, number>> {
  const lintableFilesPerProjectRoot = new Map<string, number>();

  const lintableFiles =
    enumerateLintableFilesWithOxlint(context.workspaceRoot) ??
    (await globWithWorkspaceContext(context.workspaceRoot, [
      LINTABLE_FILES_GLOB,
    ]));

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
