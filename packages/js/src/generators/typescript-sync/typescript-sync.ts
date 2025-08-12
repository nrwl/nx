import {
  createProjectGraphAsync,
  formatFiles,
  joinPathFragments,
  logger,
  parseJson,
  readNxJson,
  type ProjectGraph,
  type ProjectGraphProjectNode,
  type Tree,
} from '@nx/devkit';
import ignore from 'ignore';
import { applyEdits, modify } from 'jsonc-parser';
import { dirname, normalize, relative } from 'node:path/posix';
import {
  SyncError,
  type SyncGeneratorResult,
} from 'nx/src/utils/sync-generators';
import * as ts from 'typescript';

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
type TsconfigInfoCaches = {
  composite: Map<string, boolean>;
  content: Map<string, string>;
  exists: Map<string, boolean>;
};
type ChangedFileDetails = { missing: Set<string>; stale: Set<string> };
type ChangeType = keyof ChangedFileDetails;

export async function syncGenerator(tree: Tree): Promise<SyncGeneratorResult> {
  // Ensure that the plugin has been wired up in nx.json
  const nxJson = readNxJson(tree);

  const tsconfigInfoCaches: TsconfigInfoCaches = {
    composite: new Map(),
    content: new Map(),
    exists: new Map(),
  };
  // Root tsconfig containing project references for the whole workspace
  const rootTsconfigPath = 'tsconfig.json';
  if (!tsconfigExists(tree, tsconfigInfoCaches, rootTsconfigPath)) {
    throw new SyncError('Missing root "tsconfig.json"', [
      `A "tsconfig.json" file must exist in the workspace root in order to sync the project graph information to the TypeScript configuration files.`,
    ]);
  }

  const stringifiedRootJsonContents = readRawTsconfigContents(
    tree,
    tsconfigInfoCaches,
    rootTsconfigPath
  );
  const rootTsconfig = parseJson<Tsconfig>(stringifiedRootJsonContents);
  const projectGraph = await createProjectGraphAsync();
  const projectRoots = new Set<string>();

  const tsconfigProjectNodeValues = Object.values(projectGraph.nodes).filter(
    (node) => {
      projectRoots.add(node.data.root);
      const projectTsconfigPath = joinPathFragments(
        node.data.root,
        'tsconfig.json'
      );
      return tsconfigExists(tree, tsconfigInfoCaches, projectTsconfigPath);
    }
  );

  const tsSysFromTree: ts.System = {
    ...ts.sys,
    fileExists(path) {
      // Given ts.System.resolve resolve full path for tsconfig within node_modules
      // We need to remove the workspace root to ensure we don't have double workspace root within the Tree
      const correctPath = path.startsWith(tree.root)
        ? relative(tree.root, path)
        : path;
      return tsconfigExists(tree, tsconfigInfoCaches, correctPath);
    },
    readFile(path) {
      // Given ts.System.resolve resolve full path for tsconfig within node_modules
      // We need to remove the workspace root to ensure we don't have double workspace root within the Tree
      const correctPath = path.startsWith(tree.root)
        ? relative(tree.root, path)
        : path;
      return readRawTsconfigContents(tree, tsconfigInfoCaches, correctPath);
    },
  };

  // Track if any changes were made to the tsconfig files. We check the changes
  // made by this generator to know if the TS config is out of sync with the
  // project graph. Therefore, we don't format the files if there were no changes
  // to avoid potential format-only changes that can lead to false positives.
  const changedFiles = new Map<string, ChangedFileDetails>();

  if (tsconfigProjectNodeValues.length > 0) {
    const referencesSet = new Set<string>();
    for (const ref of rootTsconfig.references ?? []) {
      // reference path is relative to the tsconfig file
      const resolvedRefPath = getTsConfigPathFromReferencePath(
        rootTsconfigPath,
        ref.path
      );
      if (tsconfigExists(tree, tsconfigInfoCaches, resolvedRefPath)) {
        // we only keep the references that still exist
        referencesSet.add(normalizeReferencePath(ref.path));
      } else {
        addChangedFile(
          changedFiles,
          rootTsconfigPath,
          resolvedRefPath,
          'stale'
        );
      }
    }

    for (const node of tsconfigProjectNodeValues) {
      const normalizedPath = normalizeReferencePath(node.data.root);
      // Skip the root tsconfig itself
      if (node.data.root !== '.' && !referencesSet.has(normalizedPath)) {
        referencesSet.add(normalizedPath);
        addChangedFile(
          changedFiles,
          rootTsconfigPath,
          toFullProjectReferencePath(node.data.root),
          'missing'
        );
      }
    }

    if (changedFiles.size > 0) {
      const updatedReferences = Array.from(referencesSet)
        // Check composite is true in the internal reference before proceeding
        .filter((ref) =>
          hasCompositeEnabled(
            tsSysFromTree,
            tsconfigInfoCaches,
            joinPathFragments(ref, 'tsconfig.json')
          )
        )
        .map((ref) => ({
          path: `./${ref}`,
        }));
      patchTsconfigJsonReferences(
        tree,
        tsconfigInfoCaches,
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
  for (const projectName of Object.keys(projectGraph.dependencies)) {
    if (
      !projectGraph.nodes[projectName] ||
      projectGraph.nodes[projectName].data.root === '.'
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
    if (!tsconfigExists(tree, tsconfigInfoCaches, sourceProjectTsconfigPath)) {
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

    for (const runtimeTsConfigFileName of runtimeTsConfigFileNames) {
      const runtimeTsConfigPath = joinPathFragments(
        sourceProjectNode.data.root,
        runtimeTsConfigFileName
      );
      if (!tsconfigExists(tree, tsconfigInfoCaches, runtimeTsConfigPath)) {
        continue;
      }

      // Update project references for the runtime tsconfig
      updateTsConfigReferences(
        tree,
        tsSysFromTree,
        tsconfigInfoCaches,
        runtimeTsConfigPath,
        dependencies,
        sourceProjectNode.data.root,
        projectRoots,
        changedFiles,
        runtimeTsConfigFileName,
        runtimeTsConfigFileNames
      );
    }

    // Update project references for the tsconfig.json file
    updateTsConfigReferences(
      tree,
      tsSysFromTree,
      tsconfigInfoCaches,
      sourceProjectTsconfigPath,
      dependencies,
      sourceProjectNode.data.root,
      projectRoots,
      changedFiles
    );
  }

  if (changedFiles.size > 0) {
    await formatFiles(tree);

    const outOfSyncDetails: string[] = [];
    for (const [filePath, details] of changedFiles) {
      outOfSyncDetails.push(`${filePath}:`);
      if (details.missing.size > 0) {
        outOfSyncDetails.push(
          `  - Missing references: ${Array.from(details.missing).join(', ')}`
        );
      }
      if (details.stale.size > 0) {
        outOfSyncDetails.push(
          `  - Stale references: ${Array.from(details.stale).join(', ')}`
        );
      }
    }

    return {
      outOfSyncMessage:
        'Some TypeScript configuration files are missing project references to the projects they depend on or contain stale project references.',
      outOfSyncDetails,
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
  tsconfigInfoCaches: TsconfigInfoCaches,
  tsconfigPath: string
): string {
  if (!tsconfigInfoCaches.content.has(tsconfigPath)) {
    tsconfigInfoCaches.content.set(
      tsconfigPath,
      tree.read(tsconfigPath, 'utf-8')
    );
  }

  return tsconfigInfoCaches.content.get(tsconfigPath);
}

/**
 * Within the context of a sync generator, performance is a key concern,
 * so avoid FS interactions whenever possible.
 */
function tsconfigExists(
  tree: Tree,
  tsconfigInfoCaches: TsconfigInfoCaches,
  tsconfigPath: string
): boolean {
  if (!tsconfigInfoCaches.exists.has(tsconfigPath)) {
    tsconfigInfoCaches.exists.set(tsconfigPath, tree.exists(tsconfigPath));
  }

  return tsconfigInfoCaches.exists.get(tsconfigPath);
}

function updateTsConfigReferences(
  tree: Tree,
  tsSysFromTree: ts.System,
  tsconfigInfoCaches: TsconfigInfoCaches,
  tsConfigPath: string,
  dependencies: ProjectGraphProjectNode[],
  projectRoot: string,
  projectRoots: Set<string>,
  changedFiles: Map<string, ChangedFileDetails>,
  runtimeTsConfigFileName?: string,
  possibleRuntimeTsConfigFileNames?: string[]
): void {
  const stringifiedJsonContents = readRawTsconfigContents(
    tree,
    tsconfigInfoCaches,
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
      tsConfigPath,
      ref.path
    );
    if (
      isProjectReferenceWithinNxProject(
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

    if (!newReferencesSet.has(normalizedPath)) {
      addChangedFile(changedFiles, tsConfigPath, resolvedRefPath, 'stale');
    }
  }

  let hasChanges = false;
  for (const dep of dependencies) {
    // Ensure the project reference for the target is set if we can find the
    // relevant tsconfig file
    let referencePath: string;
    if (runtimeTsConfigFileName) {
      const runtimeTsConfigPath = joinPathFragments(
        dep.data.root,
        runtimeTsConfigFileName
      );
      if (tsconfigExists(tree, tsconfigInfoCaches, runtimeTsConfigPath)) {
        // Check composite is true in the dependency runtime tsconfig file before proceeding
        if (
          !hasCompositeEnabled(
            tsSysFromTree,
            tsconfigInfoCaches,
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
              tsconfigInfoCaches,
              possibleRuntimeTsConfigPath
            )
          ) {
            // Check composite is true in the dependency runtime tsconfig file before proceeding
            if (
              !hasCompositeEnabled(
                tsSysFromTree,
                tsconfigInfoCaches,
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
          tsconfigInfoCaches,
          joinPathFragments(dep.data.root, 'tsconfig.json')
        )
      ) {
        continue;
      }
    }
    if (!referencePath) {
      if (
        tsconfigExists(
          tree,
          tsconfigInfoCaches,
          joinPathFragments(dep.data.root, 'tsconfig.json')
        )
      ) {
        referencePath = dep.data.root;
      } else {
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
      addChangedFile(
        changedFiles,
        tsConfigPath,
        toFullProjectReferencePath(referencePath),
        'missing'
      );
    }
  }

  hasChanges ||= newReferencesSet.size !== originalReferencesSet.size;

  if (hasChanges) {
    patchTsconfigJsonReferences(
      tree,
      tsconfigInfoCaches,
      tsConfigPath,
      references
    );
  }
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
    if (!targetProjectNode || dep.type === 'implicit') {
      // It's an npm or an implicit dependency
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

    if (process.env.NX_ENABLE_TS_SYNC_TRANSITIVE_DEPENDENCIES !== 'true') {
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

function toFullProjectReferencePath(path: string): string {
  const normalizedPath = normalizeReferencePath(path);

  return normalizedPath.endsWith('.json')
    ? normalizedPath
    : joinPathFragments(normalizedPath, 'tsconfig.json');
}

function isProjectReferenceWithinNxProject(
  refTsConfigPath: string,
  projectRoot: string,
  projectRoots: Set<string>
): boolean {
  let currentPath = getTsConfigDirName(refTsConfigPath);

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

function getTsConfigDirName(tsConfigPath: string): string {
  return tsConfigPath.endsWith('.json')
    ? dirname(tsConfigPath)
    : normalize(tsConfigPath);
}

function getTsConfigPathFromReferencePath(
  ownerTsConfigPath: string,
  referencePath: string
): string {
  const resolvedRefPath = joinPathFragments(
    dirname(ownerTsConfigPath),
    referencePath
  );

  return resolvedRefPath.endsWith('.json')
    ? resolvedRefPath
    : joinPathFragments(resolvedRefPath, 'tsconfig.json');
}

/**
 * Minimally patch just the "references" property within the tsconfig file at a given path.
 * This allows comments in other sections of the file to remain intact when syncing is run.
 */
function patchTsconfigJsonReferences(
  tree: Tree,
  tsconfigInfoCaches: TsconfigInfoCaches,
  tsconfigPath: string,
  updatedReferences: { path: string }[]
) {
  const stringifiedJsonContents = readRawTsconfigContents(
    tree,
    tsconfigInfoCaches,
    tsconfigPath
  );
  const edits = modify(
    stringifiedJsonContents,
    ['references'],
    updatedReferences,
    { formattingOptions: { keepLines: true, insertSpaces: true, tabSize: 2 } }
  );
  const updatedJsonContents = applyEdits(stringifiedJsonContents, edits);
  // The final contents will be formatted by formatFiles() later
  tree.write(tsconfigPath, updatedJsonContents);
}

function hasCompositeEnabled(
  tsSysFromTree: ts.System,
  tsconfigInfoCaches: TsconfigInfoCaches,
  tsconfigPath: string
): boolean {
  if (!tsconfigInfoCaches.composite.has(tsconfigPath)) {
    const parsed = ts.parseJsonConfigFileContent(
      ts.readConfigFile(tsconfigPath, tsSysFromTree.readFile).config,
      tsSysFromTree,
      dirname(tsconfigPath)
    );
    tsconfigInfoCaches.composite.set(
      tsconfigPath,
      parsed.options.composite === true
    );
  }

  return tsconfigInfoCaches.composite.get(tsconfigPath);
}

function addChangedFile(
  changedFiles: Map<string, ChangedFileDetails>,
  filePath: string,
  referencePath: string,
  type: ChangeType
) {
  if (!changedFiles.has(filePath)) {
    changedFiles.set(filePath, { missing: new Set(), stale: new Set() });
  }

  changedFiles.get(filePath)[type].add(referencePath);
}
