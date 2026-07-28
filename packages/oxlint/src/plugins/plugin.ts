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
  lintableFilesPerProjectRoot: Map<string, string[]>,
  configChainsByConfig: Map<string, string[]>,
  tsconfigChainsByProjectRoot: Map<string, string[]>,
  projectsCache: PluginCache<OxlintProjects>,
  hashByRoot: Map<string, string>,
  pmc: ReturnType<typeof getPackageManagerCommand>
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
      const hasLintableFiles =
        (configDir === projectRoot && projectRoot !== '.') ||
        (lintableFilesPerProjectRoot.get(projectRoot)?.length ?? 0) > 0;

      if (!hasLintableFiles) {
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
        tsconfigChainsByProjectRoot.get(projectRoot) ?? []
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
    const pmc = getPackageManagerCommand(
      detectPackageManager(context.workspaceRoot)
    );
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `oxlint-${optionsHash}.hash`
    );
    const targetsCache = new PluginCache<OxlintProjects>(cachePath);

    const { oxlintConfigFiles, projectRoots, projectRootsByOxlintRoots } =
      splitConfigFiles(configFiles);
    const lintableFilesPerProjectRoot = await collectLintableFilesByProjectRoot(
      projectRoots,
      options,
      context
    );
    const configChainsByConfig = collectConfigChains(
      oxlintConfigFiles,
      context.workspaceRoot
    );
    const tsconfigChainsByProjectRoot = collectTsconfigChainsByProjectRoot(
      projectRoots,
      context.workspaceRoot
    );
    const lockFilePattern = getLockFileName(
      detectPackageManager(context.workspaceRoot)
    );
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      options,
      context,
      projectRoots.map((root) => {
        const parentConfigs = oxlintConfigFiles.filter((oxlintConfig) =>
          isSubDir(root, dirname(oxlintConfig))
        );
        return [
          ...parentConfigs,
          ...parentConfigs.flatMap(
            (config) => configChainsByConfig.get(config) ?? []
          ),
          lockFilePattern,
          ...(tsconfigChainsByProjectRoot.get(root) ?? []),
        ];
      })
    );
    const hashByRoot = new Map<string, string>(
      projectRoots.map((r, i) => [r, hashes[i]])
    );

    try {
      if (oxlintConfigFiles.length === 0) {
        return [];
      }
      return await createNodesFromFiles(
        (configFile, fileOptions, fileContext) =>
          internalCreateNodes(
            configFile,
            fileOptions,
            fileContext,
            projectRootsByOxlintRoots,
            lintableFilesPerProjectRoot,
            configChainsByConfig,
            tsconfigChainsByProjectRoot,
            targetsCache,
            hashByRoot,
            pmc
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

function splitConfigFiles(configFiles: readonly string[]): {
  oxlintConfigFiles: string[];
  projectRoots: string[];
  projectRootsByOxlintRoots: Map<string, string[]>;
} {
  const oxlintConfigFiles: string[] = [];
  const projectRoots = new Set<string>();

  for (const configFile of configFiles) {
    if (PROJECT_CONFIG_FILENAMES.includes(basename(configFile))) {
      projectRoots.add(dirname(configFile));
    } else {
      oxlintConfigFiles.push(configFile);
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

      const absolutePath = join(workspaceRoot, relativeConfigPath);
      if (!existsSync(absolutePath)) {
        return;
      }

      let json: { extends?: string[] };
      try {
        json = readJsonFile(absolutePath, {
          expectComments: true,
          allowTrailingComma: true,
        });
      } catch {
        return;
      }

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
        extended.push(resolved);
        walk(resolved);
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

async function collectLintableFilesByProjectRoot(
  projectRoots: string[],
  options: OxlintPluginOptions,
  context: CreateNodesContext
): Promise<Map<string, string[]>> {
  const lintableFilesPerProjectRoot = new Map<string, string[]>();

  const lintableFiles = await globWithWorkspaceContext(context.workspaceRoot, [
    `**/*.{${options.extensions.join(',')}}`,
  ]);

  for (const projectRoot of projectRoots) {
    lintableFilesPerProjectRoot.set(projectRoot, []);
  }

  for (const file of lintableFiles) {
    const projectRoot = getRootForDirectory(
      dirname(file),
      lintableFilesPerProjectRoot
    );
    if (projectRoot) {
      lintableFilesPerProjectRoot.get(projectRoot).push(file);
    }
  }

  return lintableFilesPerProjectRoot;
}

function getRootForDirectory(
  directory: string,
  roots: Map<string, string[]>
): string {
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
  tsconfigChainOutsideProjectRoot: string[]
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
  const rootConfig = OXLINT_CONFIG_FILENAMES.find((file) =>
    existsSync(join(context.workspaceRoot, file))
  );
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
