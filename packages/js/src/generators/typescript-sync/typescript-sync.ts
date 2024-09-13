import {
  createProjectGraphAsync,
  formatFiles,
  joinPathFragments,
  logger,
  parseJson,
  readNxJson,
  type ExpandedPluginConfiguration,
  type ProjectGraph,
  type ProjectGraphProjectNode,
  type Tree,
} from '@nx/devkit';
import ignore from 'ignore';
import { applyEdits, modify } from 'jsonc-parser';
import { dirname, normalize, relative } from 'node:path/posix';
import type { SyncGeneratorResult } from 'nx/src/utils/sync-generators';
import * as ts from 'typescript';
import {
  PLUGIN_NAME,
  type TscPluginOptions,
} from '../../plugins/typescript/plugin';

interface Tsconfig {
  references?: Array<{ path: string }>;
  compilerOptions?: {
    paths?: Record<string, string[]>;
    rootDir?: string;
    outDir?: string;
  };
  nx?: {
    sync?: {
      ignoredReferences?: string[];
    };
  };
}

const COMMON_RUNTIME_TS_CONFIG_FILE_NAMES = [
  'tsconfig.app.json',
  'tsconfig.lib.json',
  'tsconfig.build.json',
  'tsconfig.cjs.json',
  'tsconfig.esm.json',
  'tsconfig.runtime.json',
];

type GeneratorOptions = {
  runtimeTsConfigFileNames?: string[];
};

type NormalizedGeneratorOptions = Required<GeneratorOptions>;

export async function syncGenerator(tree: Tree): Promise<SyncGeneratorResult> {
  // Ensure that the plugin has been wired up in nx.json
  const nxJson = readNxJson(tree);
  const tscPluginConfig:
    | string
    | ExpandedPluginConfiguration<TscPluginOptions> = nxJson.plugins.find(
    (p) => {
      if (typeof p === 'string') {
        return p === PLUGIN_NAME;
      }
      return p.plugin === PLUGIN_NAME;
    }
  );
  if (!tscPluginConfig) {
    throw new Error(
      `The ${PLUGIN_NAME} plugin must be added to the "plugins" array in nx.json before syncing tsconfigs`
    );
  }

  // Root tsconfig containing project references for the whole workspace
  const rootTsconfigPath = 'tsconfig.json';
  if (!tree.exists(rootTsconfigPath)) {
    throw new Error(
      `A "tsconfig.json" file must exist in the workspace root in order to use this sync generator.`
    );
  }

  const rawTsconfigContentsCache = new Map<string, string>();
  const stringifiedRootJsonContents = readRawTsconfigContents(
    tree,
    rawTsconfigContentsCache,
    rootTsconfigPath
  );
  const rootTsconfig = parseJson<Tsconfig>(stringifiedRootJsonContents);
  const projectGraph = await createProjectGraphAsync();
  const projectRoots = new Set<string>();
  const tsconfigHasCompositeEnabledCache = new Map<string, boolean>();

  const tsconfigProjectNodeValues = Object.values(projectGraph.nodes).filter(
    (node) => {
      projectRoots.add(node.data.root);
      const projectTsconfigPath = joinPathFragments(
        node.data.root,
        'tsconfig.json'
      );
      return tsconfigExists(
        tree,
        rawTsconfigContentsCache,
        projectTsconfigPath
      );
    }
  );

  const tsSysFromTree: ts.System = {
    ...ts.sys,
    readFile(path) {
      return readRawTsconfigContents(tree, rawTsconfigContentsCache, path);
    },
  };

  // Track if any changes were made to the tsconfig files. We check the changes
  // made by this generator to know if the TS config is out of sync with the
  // project graph. Therefore, we don't format the files if there were no changes
  // to avoid potential format-only changes that can lead to false positives.
  let hasChanges = false;

  if (tsconfigProjectNodeValues.length > 0) {
    const referencesSet = new Set<string>();
    for (const ref of rootTsconfig.references ?? []) {
      // reference path is relative to the tsconfig file
      const resolvedRefPath = getTsConfigPathFromReferencePath(
        tree,
        rootTsconfigPath,
        ref.path
      );
      if (tsconfigExists(tree, rawTsconfigContentsCache, resolvedRefPath)) {
        // we only keep the references that still exist
        referencesSet.add(normalizeReferencePath(ref.path));
      } else {
        hasChanges = true;
      }
    }

    for (const node of tsconfigProjectNodeValues) {
      const normalizedPath = normalizeReferencePath(node.data.root);
      // Skip the root tsconfig itself
      if (node.data.root !== '.' && !referencesSet.has(normalizedPath)) {
        referencesSet.add(normalizedPath);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      const updatedReferences = Array.from(referencesSet)
        // Check composite is true in the internal reference before proceeding
        .filter((ref) =>
          hasCompositeEnabled(
            tsSysFromTree,
            tsconfigHasCompositeEnabledCache,
            joinPathFragments(ref, 'tsconfig.json')
          )
        )
        .map((ref) => ({
          path: `./${ref}`,
        }));
      patchTsconfigJsonReferences(
        tree,
        rawTsconfigContentsCache,
        rootTsconfigPath,
        updatedReferences
      );
    }
  }

  const userOptions = nxJson.sync?.generatorOptions?.[
    '@nx/js:typescript-sync'
  ] as GeneratorOptions | undefined;
  const { runtimeTsConfigFileNames }: NormalizedGeneratorOptions = {
    runtimeTsConfigFileNames:
      userOptions?.runtimeTsConfigFileNames ??
      COMMON_RUNTIME_TS_CONFIG_FILE_NAMES,
  };

  const collectedDependencies = new Map<string, ProjectGraphProjectNode[]>();
  for (const [projectName, data] of Object.entries(projectGraph.dependencies)) {
    if (
      !projectGraph.nodes[projectName] ||
      projectGraph.nodes[projectName].data.root === '.' ||
      !data.length
    ) {
      continue;
    }

    // Get the source project nodes for the source and target
    const sourceProjectNode = projectGraph.nodes[projectName];

    // Find the relevant tsconfig file for the source project
    const sourceProjectTsconfigPath = joinPathFragments(
      sourceProjectNode.data.root,
      'tsconfig.json'
    );
    if (
      !tsconfigExists(tree, rawTsconfigContentsCache, sourceProjectTsconfigPath)
    ) {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        logger.warn(
          `Skipping project "${projectName}" as there is no tsconfig.json file found in the project root "${sourceProjectNode.data.root}".`
        );
      }
      continue;
    }

    // Collect the dependencies of the source project
    const dependencies = collectProjectDependencies(
      tree,
      projectName,
      projectGraph,
      collectedDependencies
    );
    if (!dependencies.length) {
      continue;
    }

    for (const runtimeTsConfigFileName of runtimeTsConfigFileNames) {
      const runtimeTsConfigPath = joinPathFragments(
        sourceProjectNode.data.root,
        runtimeTsConfigFileName
      );
      if (
        !tsconfigExists(tree, rawTsconfigContentsCache, runtimeTsConfigPath)
      ) {
        continue;
      }

      // Update project references for the runtime tsconfig
      hasChanges =
        updateTsConfigReferences(
          tree,
          tsSysFromTree,
          rawTsconfigContentsCache,
          tsconfigHasCompositeEnabledCache,
          runtimeTsConfigPath,
          dependencies,
          sourceProjectNode.data.root,
          projectRoots,
          runtimeTsConfigFileName,
          runtimeTsConfigFileNames
        ) || hasChanges;
    }

    // Update project references for the tsconfig.json file
    hasChanges =
      updateTsConfigReferences(
        tree,
        tsSysFromTree,
        rawTsconfigContentsCache,
        tsconfigHasCompositeEnabledCache,
        sourceProjectTsconfigPath,
        dependencies,
        sourceProjectNode.data.root,
        projectRoots
      ) || hasChanges;
  }

  if (hasChanges) {
    await formatFiles(tree);

    return {
      outOfSyncMessage:
        'Based on the workspace project graph, some TypeScript configuration files are missing project references to the projects they depend on.',
    };
  }
}

export default syncGenerator;

/**
 * Within the context of a sync generator, performance is a key concern,
 * so avoid FS interactions whenever possible.
 */
function readRawTsconfigContents(
  tree: Tree,
  rawTsconfigContentsCache: Map<string, string>,
  tsconfigPath: string
): string {
  if (!rawTsconfigContentsCache.has(tsconfigPath)) {
    rawTsconfigContentsCache.set(
      tsconfigPath,
      tree.read(tsconfigPath, 'utf-8')
    );
  }
  return rawTsconfigContentsCache.get(tsconfigPath);
}

/**
 * Within the context of a sync generator, performance is a key concern,
 * so avoid FS interactions whenever possible.
 */
function tsconfigExists(
  tree: Tree,
  rawTsconfigContentsCache: Map<string, string>,
  tsconfigPath: string
): boolean {
  return rawTsconfigContentsCache.has(tsconfigPath)
    ? true
    : tree.exists(tsconfigPath);
}

function updateTsConfigReferences(
  tree: Tree,
  tsSysFromTree: ts.System,
  rawTsconfigContentsCache: Map<string, string>,
  tsconfigHasCompositeEnabledCache: Map<string, boolean>,
  tsConfigPath: string,
  dependencies: ProjectGraphProjectNode[],
  projectRoot: string,
  projectRoots: Set<string>,
  runtimeTsConfigFileName?: string,
  possibleRuntimeTsConfigFileNames?: string[]
): boolean {
  const stringifiedJsonContents = readRawTsconfigContents(
    tree,
    rawTsconfigContentsCache,
    tsConfigPath
  );
  const tsConfig = parseJson<Tsconfig>(stringifiedJsonContents);
  const ignoredReferences = new Set(tsConfig.nx?.sync?.ignoredReferences ?? []);

  // We have at least one dependency so we can safely set it to an empty array if not already set
  const references = [];
  const originalReferencesSet = new Set();
  const newReferencesSet = new Set();

  for (const ref of tsConfig.references ?? []) {
    const normalizedPath = normalizeReferencePath(ref.path);
    originalReferencesSet.add(normalizedPath);
    if (ignoredReferences.has(ref.path)) {
      // we keep the user-defined ignored references
      references.push(ref);
      newReferencesSet.add(normalizedPath);
      continue;
    }

    // reference path is relative to the tsconfig file
    const resolvedRefPath = getTsConfigPathFromReferencePath(
      tree,
      tsConfigPath,
      ref.path
    );
    if (
      isProjectReferenceWithinNxProject(
        tree,
        rawTsconfigContentsCache,
        resolvedRefPath,
        projectRoot,
        projectRoots
      ) ||
      isProjectReferenceIgnored(tree, resolvedRefPath)
    ) {
      // we keep all references within the current Nx project or that are ignored
      references.push(ref);
      newReferencesSet.add(normalizedPath);
    }
  }

  let hasChanges = false;
  for (const dep of dependencies) {
    // Ensure the project reference for the target is set
    let referencePath = dep.data.root;
    if (runtimeTsConfigFileName) {
      const runtimeTsConfigPath = joinPathFragments(
        dep.data.root,
        runtimeTsConfigFileName
      );
      if (tsconfigExists(tree, rawTsconfigContentsCache, runtimeTsConfigPath)) {
        // Check composite is true in the dependency runtime tsconfig file before proceeding
        if (
          !hasCompositeEnabled(
            tsSysFromTree,
            tsconfigHasCompositeEnabledCache,
            runtimeTsConfigPath
          )
        ) {
          continue;
        }
        referencePath = runtimeTsConfigPath;
      } else {
        // Check for other possible runtime tsconfig file names
        // TODO(leo): should we check if there are more than one runtime tsconfig files and throw an error?
        for (const possibleRuntimeTsConfigFileName of possibleRuntimeTsConfigFileNames ??
          []) {
          const possibleRuntimeTsConfigPath = joinPathFragments(
            dep.data.root,
            possibleRuntimeTsConfigFileName
          );
          if (
            tsconfigExists(
              tree,
              rawTsconfigContentsCache,
              possibleRuntimeTsConfigPath
            )
          ) {
            // Check composite is true in the dependency runtime tsconfig file before proceeding
            if (
              !hasCompositeEnabled(
                tsSysFromTree,
                tsconfigHasCompositeEnabledCache,
                possibleRuntimeTsConfigPath
              )
            ) {
              continue;
            }
            referencePath = possibleRuntimeTsConfigPath;
            break;
          }
        }
      }
    } else {
      // Check composite is true in the dependency tsconfig.json file before proceeding
      if (
        !hasCompositeEnabled(
          tsSysFromTree,
          tsconfigHasCompositeEnabledCache,
          joinPathFragments(dep.data.root, 'tsconfig.json')
        )
      ) {
        continue;
      }
    }
    const relativePathToTargetRoot = relative(projectRoot, referencePath);
    if (!newReferencesSet.has(relativePathToTargetRoot)) {
      newReferencesSet.add(relativePathToTargetRoot);
      // Make sure we unshift rather than push so that dependencies are built in the right order by TypeScript when it is run directly from the root of the workspace
      references.unshift({ path: relativePathToTargetRoot });
    }
    if (!originalReferencesSet.has(relativePathToTargetRoot)) {
      hasChanges = true;
    }
  }

  hasChanges ||= newReferencesSet.size !== originalReferencesSet.size;

  if (hasChanges) {
    patchTsconfigJsonReferences(
      tree,
      rawTsconfigContentsCache,
      tsConfigPath,
      references
    );
  }

  return hasChanges;
}

// TODO(leo): follow up with the TypeScript team to confirm if we really need
// to reference transitive dependencies.
// Collect the dependencies of a project recursively sorted from root to leaf
function collectProjectDependencies(
  tree: Tree,
  projectName: string,
  projectGraph: ProjectGraph,
  collectedDependencies: Map<string, ProjectGraphProjectNode[]>
): ProjectGraphProjectNode[] {
  if (collectedDependencies.has(projectName)) {
    // We've already collected the dependencies for this project
    return collectedDependencies.get(projectName);
  }

  collectedDependencies.set(projectName, []);

  for (const dep of projectGraph.dependencies[projectName]) {
    const targetProjectNode = projectGraph.nodes[dep.target];
    if (!targetProjectNode) {
      // It's an npm dependency
      continue;
    }

    // Add the target project node to the list of dependencies for the current project
    if (
      !collectedDependencies
        .get(projectName)
        .some((d) => d.name === targetProjectNode.name)
    ) {
      collectedDependencies.get(projectName).push(targetProjectNode);
    }

    if (process.env.NX_DISABLE_TS_SYNC_TRANSITIVE_DEPENDENCIES === 'true') {
      continue;
    }

    // Recursively get the dependencies of the target project
    const transitiveDependencies = collectProjectDependencies(
      tree,
      dep.target,
      projectGraph,
      collectedDependencies
    );
    for (const transitiveDep of transitiveDependencies) {
      if (
        !collectedDependencies
          .get(projectName)
          .some((d) => d.name === transitiveDep.name)
      ) {
        collectedDependencies.get(projectName).push(transitiveDep);
      }
    }
  }

  return collectedDependencies.get(projectName);
}

// Normalize the paths to strip leading `./` and trailing `/tsconfig.json`
function normalizeReferencePath(path: string): string {
  return normalize(path)
    .replace(/\/tsconfig.json$/, '')
    .replace(/^\.\//, '');
}

function isProjectReferenceWithinNxProject(
  tree: Tree,
  rawTsconfigContentsCache: Map<string, string>,
  refTsConfigPath: string,
  projectRoot: string,
  projectRoots: Set<string>
): boolean {
  let currentPath = getTsConfigDirName(
    tree,
    rawTsconfigContentsCache,
    refTsConfigPath
  );

  if (relative(projectRoot, currentPath).startsWith('..')) {
    // it's outside of the project root, so it's an external project reference
    return false;
  }

  while (currentPath !== projectRoot) {
    if (projectRoots.has(currentPath)) {
      // it's inside a nested project root, so it's and external project reference
      return false;
    }
    currentPath = dirname(currentPath);
  }

  // it's inside the project root, so it's an internal project reference
  return true;
}

function isProjectReferenceIgnored(
  tree: Tree,
  refTsConfigPath: string
): boolean {
  const ig = ignore();
  if (tree.exists('.gitignore')) {
    ig.add('.git');
    ig.add(tree.read('.gitignore', 'utf-8'));
  }
  if (tree.exists('.nxignore')) {
    ig.add(tree.read('.nxignore', 'utf-8'));
  }

  return ig.ignores(refTsConfigPath);
}

function getTsConfigDirName(
  tree: Tree,
  rawTsconfigContentsCache: Map<string, string>,
  tsConfigPath: string
): string {
  return (
    rawTsconfigContentsCache.has(tsConfigPath)
      ? true
      : tree.isFile(tsConfigPath)
  )
    ? dirname(tsConfigPath)
    : normalize(tsConfigPath);
}

function getTsConfigPathFromReferencePath(
  tree: Tree,
  ownerTsConfigPath: string,
  referencePath: string
): string {
  const resolvedRefPath = joinPathFragments(
    dirname(ownerTsConfigPath),
    referencePath
  );

  return tree.isFile(resolvedRefPath)
    ? resolvedRefPath
    : joinPathFragments(resolvedRefPath, 'tsconfig.json');
}

/**
 * Minimally patch just the "references" property within the tsconfig file at a given path.
 * This allows comments in other sections of the file to remain intact when syncing is run.
 */
function patchTsconfigJsonReferences(
  tree: Tree,
  rawTsconfigContentsCache: Map<string, string>,
  tsconfigPath: string,
  updatedReferences: { path: string }[]
) {
  const stringifiedJsonContents = readRawTsconfigContents(
    tree,
    rawTsconfigContentsCache,
    tsconfigPath
  );
  const edits = modify(
    stringifiedJsonContents,
    ['references'],
    updatedReferences,
    {}
  );
  const updatedJsonContents = applyEdits(stringifiedJsonContents, edits);
  // The final contents will be formatted by formatFiles() later
  tree.write(tsconfigPath, updatedJsonContents);
}

function hasCompositeEnabled(
  tsSysFromTree: ts.System,
  tsconfigHasCompositeEnabledCache: Map<string, boolean>,
  tsconfigPath: string
): boolean {
  if (!tsconfigHasCompositeEnabledCache.has(tsconfigPath)) {
    const parsed = ts.parseJsonConfigFileContent(
      ts.readConfigFile(tsconfigPath, tsSysFromTree.readFile).config,
      tsSysFromTree,
      dirname(tsconfigPath)
    );
    const enabledVal = parsed.options.composite === true;
    tsconfigHasCompositeEnabledCache.set(tsconfigPath, enabledVal);
  }
  return tsconfigHasCompositeEnabledCache.get(tsconfigPath);
}
